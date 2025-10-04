"""Project worker manager

Spawns and manages a per-project worker process that executes node code
inside the project's virtual environment.
"""
from __future__ import annotations

import json
import os
import queue
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional
import subprocess

from . import venv_manager, project_operations


@dataclass
class _WorkerProc:
    project_id: str
    process: subprocess.Popen[str]
    reader_thread: threading.Thread
    pending: Dict[str, "queue.Queue[Dict[str, Any]]"]
    lock: threading.Lock


class WorkerManager:
    def __init__(self) -> None:
        self._workers: Dict[str, _WorkerProc] = {}
        self._global_lock = threading.Lock()

    def _spawn(self, project_id: str) -> _WorkerProc:
        project_path = project_operations.get_project_path(project_id)
        python_path = venv_manager.python_bin(project_path)
        script_path = Path(__file__).resolve().with_name("worker.py")

        base_env = venv_manager.execution_env(project_path)
        env: Dict[str, str] = {}
        # Always expose the virtual environment interpreter and PATH
        env["PATH"] = base_env.get("PATH", "")
        env["VIRTUAL_ENV"] = base_env.get("VIRTUAL_ENV", "")
        # Ensure user-site packages are not considered
        env["PYTHONNOUSERSITE"] = "1"
        # Preserve project root marker and allowed optional hints
        env["WORKER_PROJECT_PATH"] = str(project_path)
        aim_redlab_path = os.environ.get("AIM_REDLAB_PATH")
        if aim_redlab_path:
            env["AIM_REDLAB_PATH"] = aim_redlab_path
        # Provide HOME/USER if available to avoid stdlib lookups failing
        for key in ("HOME", "USER", "TMPDIR"):
            if key in os.environ:
                env[key] = os.environ[key]
        # Remove potentially dangerous Python overrides
        env.pop("PYTHONPATH", None)
        env.pop("PYTHONHOME", None)

        # Text mode (-u unbuffered)
        proc = subprocess.Popen(
            [str(python_path), "-u", "-I", "-s", "-S", str(script_path)],
            cwd=str(project_path),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # line buffered
        )

        pending: Dict[str, "queue.Queue[Dict[str, Any]]"] = {}
        lock = threading.Lock()

        def _reader() -> None:
            try:
                assert proc.stdout is not None
                for line in proc.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except Exception:
                        continue
                    msg_id = payload.get("id")
                    if not msg_id:
                        continue
                    with lock:
                        q = pending.get(msg_id)
                    if q is not None:
                        q.put(payload)
            finally:
                # Drain: unblock all waiters
                with lock:
                    for q in pending.values():
                        try:
                            q.put_nowait({"ok": False, "error": "worker-exit"})
                        except Exception:
                            pass

        reader_thread = threading.Thread(target=_reader, daemon=True)
        reader_thread.start()

        return _WorkerProc(
            project_id=project_id,
            process=proc,
            reader_thread=reader_thread,
            pending=pending,
            lock=lock,
        )

    def start(self, project_id: str) -> None:
        """Ensure a worker process exists for the project."""
        self._ensure(project_id)

    def _ensure(self, project_id: str) -> _WorkerProc:
        with self._global_lock:
            wp = self._workers.get(project_id)
            if wp and wp.process.poll() is None:
                return wp
            # (Re)spawn
            wp = self._spawn(project_id)
            self._workers[project_id] = wp
            return wp

    def exec(self, project_id: str, file_name: str, input_data: Optional[Dict[str, Any]] = None, timeout: float = 30.0) -> Dict[str, Any]:
        for attempt in range(2):
            wp = self._ensure(project_id)
            msg_id = str(uuid.uuid4())
            req = {
                "id": msg_id,
                "op": "exec_node",
                "file": file_name,
                "input": input_data or {},
                "project_root": str(project_operations.get_project_path(project_id)),
            }
            data = json.dumps(req) + "\n"

            with wp.lock:
                q: "queue.Queue[Dict[str, Any]]" = queue.Queue()
                wp.pending[msg_id] = q
                try:
                    assert wp.process.stdin is not None
                    wp.process.stdin.write(data)
                    wp.process.stdin.flush()
                except Exception:
                    wp.pending.pop(msg_id, None)
                    self.restart(project_id)
                    continue

            try:
                resp = q.get(timeout=timeout)
            except queue.Empty:
                resp = None
                self.restart(project_id)
            finally:
                with wp.lock:
                    wp.pending.pop(msg_id, None)

            if resp is not None:
                return resp

        raise TimeoutError("Worker execution timed out after retry")

    def restart(self, project_id: str) -> None:
        with self._global_lock:
            wp = self._workers.pop(project_id, None)
        if not wp:
            return
        try:
            if wp.process.poll() is None:
                wp.process.terminate()
                try:
                    wp.process.wait(timeout=5)
                except Exception:
                    wp.process.kill()
        finally:
            pass

    def stop_all(self) -> None:
        with self._global_lock:
            keys = list(self._workers.keys())
        for pid in keys:
            self.restart(pid)


# Global singleton manager
worker_manager = WorkerManager()
