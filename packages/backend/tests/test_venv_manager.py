import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.core import venv_manager


def test_create_initializes_virtualenv(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()

    venv_path = venv_manager.create(project_dir)

    assert venv_path.exists()
    python_exe = venv_manager.python_bin(project_dir)
    result = subprocess.run(
        [str(python_exe), "-m", "pip", "--version"],
        capture_output=True,
        text=True,
        check=True,
        env=venv_manager.execution_env(project_dir),
    )
    assert "pip" in result.stdout


def test_python_bin_raises_when_env_missing(tmp_path: Path) -> None:
    project_dir = tmp_path / "missing"
    project_dir.mkdir()
    with pytest.raises(venv_manager.VenvError):
        venv_manager.python_bin(project_dir)


def test_install_invokes_pip_with_packages(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    venv_manager.create(project_dir)

    captured = {}

    def fake_run(cmd, **kwargs):  # type: ignore[override]
        captured["cmd"] = cmd
        captured["kwargs"] = kwargs
        class DummyCompleted:
            stdout = "installed"
            stderr = ""
        return DummyCompleted()

    monkeypatch.setattr(venv_manager.subprocess, "run", fake_run)

    venv_manager.install(project_dir, ["samplepkg==1.0"])

    assert captured["cmd"][:3] == ["uv", "pip", "install"]
    assert "--python" in captured["cmd"]
    python_index = captured["cmd"].index("--python") + 1
    python_path = venv_manager.python_bin(project_dir)
    assert captured["cmd"][python_index] == str(python_path)
    assert captured["cmd"][-1] == "samplepkg==1.0"


def test_execution_env_sets_virtual_env(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    venv_manager.create(project_dir)

    env = venv_manager.execution_env(project_dir)
    assert env["VIRTUAL_ENV"].endswith(venv_manager.VENV_DIRNAME)
    assert env["PATH"].split(os.pathsep)[0] == str(Path(env["VIRTUAL_ENV"]) / ("Scripts" if os.name == "nt" else "bin"))


def test_activated_context_updates_interpreter(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    venv_manager.create(project_dir)

    original_prefix = sys.prefix
    original_exec_prefix = sys.exec_prefix
    original_executable = sys.executable
    original_virtual_env = os.environ.get("VIRTUAL_ENV")

    venv_dir = venv_manager.venv_path(project_dir)
    python_path = venv_manager.python_bin(project_dir)

    with venv_manager.activated(project_dir) as info:
        assert sys.executable == str(python_path)
        assert sys.prefix == str(venv_dir)
        assert sys.exec_prefix == str(venv_dir)
        assert os.environ.get("VIRTUAL_ENV") == str(venv_dir)
        if info["site_packages"]:
            assert info["site_packages"][0] in sys.path

    assert sys.prefix == original_prefix
    assert sys.exec_prefix == original_exec_prefix
    assert sys.executable == original_executable
    if original_virtual_env is None:
        assert "VIRTUAL_ENV" not in os.environ
    else:
        assert os.environ.get("VIRTUAL_ENV") == original_virtual_env


def test_activated_removes_host_site_packages(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    venv_manager.create(project_dir)

    fake_host_path = tmp_path / "host_site"
    fake_host_path.mkdir()

    original_sys_path = list(sys.path)
    sys.path.insert(0, str(fake_host_path))

    try:
        with venv_manager.activated(project_dir):
            assert str(fake_host_path) not in sys.path
    finally:
        sys.path = original_sys_path
