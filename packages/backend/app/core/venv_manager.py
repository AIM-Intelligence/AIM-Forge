"""Utilities for managing per-project Python virtual environments."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
import json
from datetime import datetime, timezone


class VenvError(RuntimeError):
    """Raised when a virtual environment operation fails."""

    def __init__(self, message: str, stdout: str = "", stderr: str = "") -> None:
        super().__init__(message)
        self.stdout = stdout
        self.stderr = stderr


VENV_DIRNAME = ".venv"
_ACTIVATION_LOCK = threading.RLock()


def _run_uv(command: Sequence[str], error_prefix: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("UV_NO_CONFIG", "1")
    env.setdefault("UV_PYTHON_DOWNLOADS", "never")
    cache_dir = Path(__file__).resolve().parents[4] / ".uv-cache"
    cache_dir.mkdir(exist_ok=True)
    env.setdefault("UV_CACHE_DIR", str(cache_dir))
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=env,
        )
    except FileNotFoundError as exc:  # pragma: no cover
        raise VenvError("uv 명령을 찾을 수 없습니다. uv가 설치되어 있는지 확인하세요.") from exc
    except subprocess.CalledProcessError as exc:
        output = exc.stderr or exc.stdout or str(exc)
        raise VenvError(f"{error_prefix}: {output}", stdout=exc.stdout or "", stderr=exc.stderr or "") from exc


def _run_python_pip(
    project_path: Path, args: Sequence[str], error_prefix: str
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            [str(python_bin(project_path)), "-m", "pip", *args],
            check=True,
            capture_output=True,
            text=True,
            env=execution_env(project_path),
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover
        output = exc.stderr or exc.stdout or str(exc)
        raise VenvError(f"{error_prefix}: {output}", stdout=exc.stdout or "", stderr=exc.stderr or "") from exc



def _metadata_path(project_path: Path) -> Path:
    return project_path / "env_meta.json"


def _pip_logs_dir(project_path: Path) -> Path:
    path = project_path / ".pip-logs"
    path.mkdir(exist_ok=True)
    return path


def _ensure_pip_entrypoints(project_path: Path) -> None:
    """Make sure generic pip launchers exist inside the virtualenv."""

    python_path = python_bin(project_path)
    bin_dir = _bin_dir(project_path)

    if sys.platform == "win32":  # pragma: no cover - windows only
        script_content = f"@echo off\r\n\"{python_path}\" -m pip %*\r\n"
        for suffix in ("pip.cmd", "pip.bat"):
            candidate = bin_dir / suffix
            if not candidate.exists():
                candidate.write_text(script_content, encoding="utf-8")
        return

    pip_path = bin_dir / "pip"
    if not pip_path.exists():
        pip_path.write_text(
            "#!/usr/bin/env sh\n"
            f'"{python_path}" -m pip "$@"\n',
            encoding="utf-8",
        )
        os.chmod(pip_path, 0o755)

    pip3_path = bin_dir / "pip3"
    if not pip3_path.exists():
        try:
            pip3_path.symlink_to("pip")
        except (OSError, NotImplementedError):
            pip3_path.write_text(
                "#!/usr/bin/env sh\n"
                f'"{python_path}" -m pip "$@"\n',
                encoding="utf-8",
            )
            os.chmod(pip3_path, 0o755)


def write_pip_log(
    project_path: Path | str,
    action: str,
    packages: Sequence[str],
    stdout: str,
    stderr: str,
    success: bool,
) -> str:
    project_path = _project_path(Path(project_path))
    logs_dir = _pip_logs_dir(project_path)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    status = "success" if success else "error"
    file_name = f"{timestamp}_{action}_{status}.log"
    log_path = logs_dir / file_name

    header = [
        f"action: {action}",
        f"packages: {', '.join(packages)}" if packages else "packages: (none)",
        f"status: {status}",
        f"timestamp: {datetime.now(timezone.utc).isoformat()}",
        "",
    ]

    with open(log_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(header))
        if stdout:
            handle.write("\n[stdout]\n")
            handle.write(stdout)
        if stderr:
            handle.write("\n[stderr]\n")
            handle.write(stderr)

    return str(log_path.relative_to(project_path))


def update_env_metadata(
    project_path: Path | str,
    packages: Sequence[Dict[str, str]],
    last_action: Dict[str, Any],
) -> None:
    project_path = _project_path(Path(project_path))
    metadata_path = _metadata_path(project_path)
    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "packages": list(packages),
        "last_action": last_action,
    }
    metadata_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def read_env_metadata(project_path: Path | str) -> Dict[str, Any]:
    project_path = _project_path(Path(project_path))
    metadata_path = _metadata_path(project_path)
    if not metadata_path.exists():
        return {
            "updated_at": None,
            "packages": [],
            "last_action": None,
        }

    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "updated_at": None,
            "packages": [],
            "last_action": None,
        }


def read_pip_log(project_path: Path | str, log_path: str) -> Dict[str, str]:
    project_path = _project_path(Path(project_path))
    logs_dir = _pip_logs_dir(project_path)

    relative = Path(log_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise VenvError("로그 경로가 올바르지 않습니다.")

    if str(relative).startswith(str(logs_dir.name)) or str(relative).startswith(".pip-logs"):
        candidate = project_path / relative
    else:
        candidate = logs_dir / relative

    candidate = candidate.resolve()
    if candidate.is_dir():
        raise VenvError("로그 파일 경로가 디렉터리입니다.")
    if not str(candidate).startswith(str(logs_dir.resolve())):
        raise VenvError("로그 경로가 허용된 범위를 벗어났습니다.")
    if not candidate.exists():
        raise VenvError("로그 파일을 찾을 수 없습니다.")

    content = candidate.read_text(encoding="utf-8", errors="ignore")
    return {
        "path": str(candidate.relative_to(project_path)),
        "content": content,
    }

def _project_path(path: Path | str) -> Path:
    project_path = Path(path)
    if not project_path.exists():
        raise VenvError(f"프로젝트 경로가 존재하지 않습니다: {project_path}")
    return project_path


def _venv_path(project_path: Path) -> Path:
    return project_path / VENV_DIRNAME


def venv_path(project_path: Path | str) -> Path:
    project_path = _project_path(Path(project_path))
    path = _venv_path(project_path)
    if not path.exists():
        raise VenvError("가상환경이 초기화되지 않았습니다. 먼저 create()를 호출하세요.")
    return path


def _bin_dir(project_path: Path) -> Path:
    venv_path = _venv_path(project_path)
    if sys.platform == "win32":
        return venv_path / "Scripts"
    return venv_path / "bin"


def python_bin(project_path: Path | str) -> Path:
    """Return the python executable path for the project's virtual environment."""
    project_path = _project_path(Path(project_path))
    bin_dir = _bin_dir(project_path)
    python_name = "python.exe" if sys.platform == "win32" else "python"
    python_path = bin_dir / python_name
    if not python_path.exists():
        raise VenvError("가상환경이 초기화되지 않았습니다. 먼저 create()를 호출하세요.")
    return python_path


def pip_bin(project_path: Path | str) -> Path:
    """Return the pip executable path for the project's virtual environment."""
    project_path = _project_path(Path(project_path))
    bin_dir = _bin_dir(project_path)
    pip_name = "pip.exe" if sys.platform == "win32" else "pip"
    pip_path = bin_dir / pip_name
    if not pip_path.exists():
        raise VenvError("pip 실행 파일을 찾을 수 없습니다. 가상환경이 올바르게 생성되었는지 확인하세요.")
    return pip_path


def site_packages_paths(project_path: Path | str) -> List[Path]:
    """Return site-packages directories for the project's virtual environment."""
    project_path = _project_path(Path(project_path))
    venv_dir = venv_path(project_path)

    if sys.platform == "win32":
        candidates = [venv_dir / "Lib" / "site-packages"]
    else:
        lib_dir = venv_dir / "lib"
        candidates = list(lib_dir.glob("python*/site-packages")) if lib_dir.exists() else []

    return [path for path in candidates if path.exists()]


def execution_env(project_path: Path | str, extra_env: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Return environment variables for running commands inside the virtual environment."""
    project_path = _project_path(Path(project_path))
    env = os.environ.copy()
    bin_dir = _bin_dir(project_path)
    current_path = env.get("PATH", "")
    env["PATH"] = os.pathsep.join([str(bin_dir), current_path]) if current_path else str(bin_dir)
    env["VIRTUAL_ENV"] = str(_venv_path(project_path))
    if extra_env:
        env.update(extra_env)
    try:
        _ensure_pip_entrypoints(project_path)
    except VenvError:
        pass
    return env


def create(project_path: Path | str, base_requirements: Sequence[str] | None = None) -> Path:
    """Create a virtual environment for the given project.

    Parameters
    ----------
    project_path: Path | str
        Absolute path to the project directory.
    base_requirements: Sequence[str] | None
        Packages to install immediately after environment creation.
    """
    project_path = Path(project_path)
    if not project_path.exists():
        project_path.mkdir(parents=True, exist_ok=True)
    venv_path = _venv_path(project_path)
    if venv_path.exists():
        return venv_path

    command = [
        "uv",
        "venv",
        "--no-project",
        "--python",
        sys.executable,
        str(venv_path),
    ]

    _run_uv(command, "가상환경 생성에 실패했습니다")

    _bootstrap_seed_packages(project_path)

    if base_requirements:
        install(project_path, base_requirements)

    return venv_path


def install(project_path: Path | str, packages: Sequence[str]) -> subprocess.CompletedProcess[str]:
    """Install packages into the project's virtual environment."""
    if not packages:
        raise VenvError("설치할 패키지가 제공되지 않았습니다.")

    project_path = _project_path(Path(project_path))
    python_path = python_bin(project_path)
    command = [
        "uv",
        "pip",
        "install",
        "--python",
        str(python_path),
        *packages,
    ]
    try:
        return _run_uv(command, "패키지 설치에 실패했습니다")
    except VenvError as exc:
        if "Operation not permitted" not in str(exc):
            raise
        fallback_cmd = ["install", *packages]
        return _run_python_pip(project_path, fallback_cmd, "패키지 설치에 실패했습니다")


def uninstall(project_path: Path | str, packages: Sequence[str]) -> subprocess.CompletedProcess[str]:
    """Uninstall packages from the project's virtual environment."""
    if not packages:
        raise VenvError("삭제할 패키지가 제공되지 않았습니다.")

    project_path = _project_path(Path(project_path))
    command = ["uninstall", "-y", *packages]
    return _run_python_pip(project_path, command, "패키지 삭제에 실패했습니다")


def list_installed(project_path: Path | str) -> List[Dict[str, str]]:
    """Return installed packages in the project's virtual environment."""
    project_path = _project_path(Path(project_path))
    command = ["list", "--format", "json"]

    result = _run_python_pip(project_path, command, "패키지 목록을 조회하지 못했습니다")
    try:
        return json.loads(result.stdout or "[]")
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise VenvError(f"패키지 목록 파싱에 실패했습니다: {exc}") from exc


def _bootstrap_seed_packages(project_path: Path) -> None:
    python_path = python_bin(project_path)
    try:
        subprocess.run(
            [str(python_path), "-m", "ensurepip", "--upgrade"],
            check=True,
            capture_output=True,
            text=True,
            env=execution_env(project_path),
        )
    except subprocess.CalledProcessError as exc:
        output = exc.stderr or exc.stdout or str(exc)
        raise VenvError(f"pip 초기화에 실패했습니다: {output}") from exc

    _ensure_pip_entrypoints(project_path)


def delete(project_path: Path | str) -> None:
    """Delete the project's virtual environment directory if it exists."""
    project_path = _project_path(Path(project_path))
    venv_path = _venv_path(project_path)
    if venv_path.exists():
        shutil.rmtree(venv_path)


@contextmanager
def activated(project_path: Path | str):
    """Temporarily activate the virtual environment in the current process."""

    project_path = _project_path(Path(project_path))
    python_path = python_bin(project_path)
    venv_dir = venv_path(project_path)
    bin_dir = _bin_dir(project_path)
    site_dirs = [str(path) for path in site_packages_paths(project_path)]
    backend_root = Path(__file__).resolve().parents[2]
    repo_root = Path(__file__).resolve().parents[4]
    base_prefix = os.path.abspath(sys.base_prefix)
    base_exec_prefix = os.path.abspath(sys.base_exec_prefix)

    original_path = os.environ.get("PATH")
    original_virtualenv = os.environ.get("VIRTUAL_ENV")
    original_pythonhome = os.environ.get("PYTHONHOME")
    original_sys_path = list(sys.path)
    original_executable = sys.executable
    original_prefix = sys.prefix
    original_exec_prefix = sys.exec_prefix

    with _ACTIVATION_LOCK:
        try:
            if original_pythonhome is not None:
                del os.environ["PYTHONHOME"]

            os.environ["VIRTUAL_ENV"] = str(venv_dir)
            os.environ["PATH"] = (
                os.pathsep.join([str(bin_dir), original_path])
                if original_path
                else str(bin_dir)
            )

            sys.prefix = str(venv_dir)
            sys.exec_prefix = str(venv_dir)
            sys.executable = str(python_path)

            # Rebuild sys.path to avoid leaking host site-packages
            def _is_allowed(candidate: str) -> bool:
                if candidate in ("", "."):
                    return True
                try:
                    resolved = os.path.abspath(candidate)
                except OSError:
                    resolved = candidate

                if resolved.startswith(str(venv_dir)):
                    return True
                if resolved.startswith(str(project_path)):
                    return True
                if resolved.startswith(str(backend_root)) or resolved.startswith(str(repo_root)):
                    return True
                if resolved.startswith(base_prefix) and "site-packages" not in resolved:
                    return True
                if resolved.startswith(base_exec_prefix) and "site-packages" not in resolved:
                    return True
                return False

            new_sys_path: List[str] = []

            def _append(path: str) -> None:
                if path not in new_sys_path:
                    new_sys_path.append(path)

            # Ensure project path and site-packages are prioritised
            _append(str(project_path))
            for site_path in site_dirs:
                _append(site_path)

            for existing in original_sys_path:
                if _is_allowed(existing):
                    _append(existing)

            sys.path = new_sys_path

            yield {
                "python": python_path,
                "venv": venv_dir,
                "site_packages": site_dirs,
            }
        finally:
            # Restore interpreter metadata
            sys.executable = original_executable
            sys.prefix = original_prefix
            sys.exec_prefix = original_exec_prefix
            sys.path = original_sys_path

            if original_path is None:
                os.environ.pop("PATH", None)
            else:
                os.environ["PATH"] = original_path

            if original_virtualenv is None:
                os.environ.pop("VIRTUAL_ENV", None)
            else:
                os.environ["VIRTUAL_ENV"] = original_virtualenv

            if original_pythonhome is None:
                # Ensure PYTHONHOME is removed if it was unset before
                os.environ.pop("PYTHONHOME", None)
            else:
                os.environ["PYTHONHOME"] = original_pythonhome


__all__ = [
    "VenvError",
    "create",
    "delete",
    "execution_env",
    "install",
    "pip_bin",
    "python_bin",
    "site_packages_paths",
    "venv_path",
    "activated",
]
