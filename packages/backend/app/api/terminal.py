"""WebSocket-based embedded terminal for per-project virtual environments."""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import pty
import fcntl
import shlex
import signal
import struct
import subprocess
import termios
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from ..core import project_operations, venv_manager


router = APIRouter()


def _build_terminal_env(project_id: str) -> tuple[str, dict[str, str]]:
    """Return working directory and sanitized environment for terminal sessions."""

    project_path = project_operations.get_project_path(project_id)
    env = venv_manager.execution_env(project_path)
    env["PYTHONNOUSERSITE"] = "1"
    env.pop("PYTHONPATH", None)
    env.pop("PYTHONHOME", None)
    env.setdefault("TERM", "xterm-256color")
    env.setdefault("LC_ALL", "en_US.UTF-8")
    env.setdefault("LANG", "en_US.UTF-8")

    aim_redlab_path = os.environ.get("AIM_REDLAB_PATH")
    if aim_redlab_path:
        env["AIM_REDLAB_PATH"] = aim_redlab_path

    return str(project_path), env


async def _forward_pty_output(websocket: WebSocket, master_fd: int, stop_event: asyncio.Event) -> None:
    loop = asyncio.get_running_loop()
    try:
        while not stop_event.is_set():
            try:
                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
            except OSError:
                break
            if not data:
                break
            await websocket.send_bytes(data)
    finally:
        stop_event.set()


def _apply_resize(master_fd: int, cols: int, rows: int) -> None:
    if cols <= 0 or rows <= 0:
        return
    winsize = struct.pack("hhhh", rows, cols, 0, 0)
    try:
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)  # type: ignore[attr-defined]
    except OSError:
        pass


def _spawn_shell(cmd_env: dict[str, str], cwd: str) -> tuple[subprocess.Popen[bytes], int]:
    shell = os.environ.get("SHELL") or "/bin/bash"
    command = [shell, "-i"]

    venv_dir = Path(cmd_env.get("VIRTUAL_ENV", "")) if cmd_env.get("VIRTUAL_ENV") else None
    activation_cmd: Optional[str] = None

    if venv_dir:
        shell_name = os.path.basename(shell).lower()
        activation_candidates = []

        if "fish" in shell_name:
            activation_candidates.append(venv_dir / "bin" / "activate.fish")
        elif shell_name.endswith("csh") or shell_name.endswith("tcsh"):
            activation_candidates.append(venv_dir / "bin" / "activate.csh")
        else:
            activation_candidates.append(venv_dir / "bin" / "activate")

        for candidate in activation_candidates:
            if candidate.exists():
                quoted_activate = shlex.quote(str(candidate))
                quoted_shell = shlex.quote(shell)
                if "fish" in shell_name:
                    activation_cmd = f"source {quoted_activate}; and exec {quoted_shell} -i"
                elif shell_name.endswith("csh") or shell_name.endswith("tcsh"):
                    activation_cmd = f"source {quoted_activate} && exec {quoted_shell} -i"
                else:
                    activation_cmd = f". {quoted_activate} && exec {quoted_shell} -i"
                break

    if activation_cmd:
        command = [shell, "-ic", activation_cmd]

    master_fd, slave_fd = pty.openpty()
    proc = subprocess.Popen(
        command,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd=cwd,
        env=cmd_env,
        preexec_fn=os.setsid,
        close_fds=True,
    )
    os.close(slave_fd)
    return proc, master_fd


async def _handle_client_messages(websocket: WebSocket, master_fd: int, stop_event: asyncio.Event) -> None:
    loop = asyncio.get_running_loop()
    while not stop_event.is_set():
        try:
            raw = await websocket.receive_text()
        except WebSocketDisconnect:
            break
        except Exception:
            continue

        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            continue

        msg_type = message.get("type")
        if msg_type == "input":
            data = message.get("data", "")
            if not isinstance(data, str):
                continue
            try:
                await loop.run_in_executor(None, os.write, master_fd, data.encode())
            except OSError:
                break
        elif msg_type == "resize":
            cols = int(message.get("cols", 0) or 0)
            rows = int(message.get("rows", 0) or 0)
            _apply_resize(master_fd, cols, rows)
        elif msg_type == "close":
            stop_event.set()
        else:
            continue


def _terminate_process(proc: Optional[subprocess.Popen[bytes]]) -> None:
    if not proc:
        return
    try:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=1.0)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


@router.websocket("/ws/terminal/{project_id}")
async def terminal_endpoint(websocket: WebSocket, project_id: str) -> None:
    try:
        cwd, env = _build_terminal_env(project_id)
    except ValueError as exc:
        await websocket.close(code=4404, reason=str(exc))
        return

    await websocket.accept()

    proc: Optional[subprocess.Popen[bytes]] = None
    master_fd: Optional[int] = None
    stop_event = asyncio.Event()

    try:
        proc, master_fd = _spawn_shell(env, cwd)
    except Exception as exc:  # pragma: no cover - spawn failure is unusual
        await websocket.close(code=1011, reason=str(exc))
        return

    reader_task = asyncio.create_task(_forward_pty_output(websocket, master_fd, stop_event))

    try:
        await _handle_client_messages(websocket, master_fd, stop_event)
    finally:
        stop_event.set()
        reader_task.cancel()
        try:
            await reader_task
        except asyncio.CancelledError:
            pass

        _terminate_process(proc)
        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass

        with contextlib.suppress(Exception):
            await websocket.close()
