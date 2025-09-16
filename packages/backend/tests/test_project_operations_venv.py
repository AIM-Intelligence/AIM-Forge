from pathlib import Path
from typing import Dict, List

import pytest

from app.core import project_operations
from app.core import venv_manager
from app.core.execute_code import execute_python_code


@pytest.fixture()
def fake_registry(monkeypatch: pytest.MonkeyPatch) -> Dict[str, List[Dict[str, str]]]:
    registry: Dict[str, List[Dict[str, str]]] = {"projects": []}

    def add_project_to_registry(name: str, description: str, project_id: str) -> None:
        if any(p["project_id"] == project_id for p in registry["projects"]):
            raise ValueError("duplicate project")
        registry["projects"].append(
            {
                "project_name": name,
                "project_description": description,
                "project_id": project_id,
            }
        )

    def remove_project_from_registry(_name: str, project_id: str) -> None:
        before = len(registry["projects"])
        registry["projects"] = [p for p in registry["projects"] if p["project_id"] != project_id]
        if len(registry["projects"]) == before:
            raise ValueError("missing project")

    def get_projects_registry() -> Dict[str, List[Dict[str, str]]]:
        return registry

    monkeypatch.setattr(project_operations, "add_project_to_registry", add_project_to_registry)
    monkeypatch.setattr(project_operations, "remove_project_from_registry", remove_project_from_registry)
    monkeypatch.setattr(project_operations, "get_projects_registry", get_projects_registry)
    return registry


@pytest.fixture(autouse=True)
def isolate_projects_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    projects_dir = tmp_path / "projects"
    monkeypatch.setattr(project_operations, "PROJECTS_BASE_PATH", projects_dir)


def test_create_project_initializes_virtualenv(fake_registry: Dict[str, List[Dict[str, str]]]) -> None:
    project_id = "proj-1"
    result = project_operations.create_project("Example", "desc", project_id)

    assert result["success"] is True
    project_path = project_operations.PROJECTS_BASE_PATH / project_id
    assert (project_path / "structure.json").exists()
    assert (project_path / venv_manager.VENV_DIRNAME).exists()


def test_delete_project_removes_virtualenv(fake_registry: Dict[str, List[Dict[str, str]]]) -> None:
    project_id = "proj-2"
    project_operations.create_project("Example", "desc", project_id)
    project_path = project_operations.PROJECTS_BASE_PATH / project_id
    # sanity check
    assert (project_path / venv_manager.VENV_DIRNAME).exists()

    project_operations.delete_project("Example", project_id)

    assert not project_path.exists()


def test_failed_venv_creation_rolls_back(fake_registry: Dict[str, List[Dict[str, str]]], monkeypatch: pytest.MonkeyPatch) -> None:
    project_id = "proj-3"

    def bad_create(path: Path, base_requirements):  # type: ignore[override]
        raise RuntimeError("boom")

    monkeypatch.setattr(project_operations.venv_manager, "create", bad_create)

    with pytest.raises(RuntimeError):
        project_operations.create_project("Broken", "desc", project_id)

    project_path = project_operations.PROJECTS_BASE_PATH / project_id
    assert not project_path.exists()
    assert all(p["project_id"] != project_id for p in fake_registry["projects"])


def test_execute_python_code_uses_virtualenv(tmp_path: Path) -> None:
    project_dir = tmp_path / "project"
    project_dir.mkdir()
    venv_manager.create(project_dir)

    python_path = venv_manager.python_bin(project_dir)
    env = venv_manager.execution_env(project_dir)

    result = execute_python_code(
        "import sys\nprint(sys.executable)",
        python_executable=str(python_path),
        working_dir=str(project_dir),
        env=env,
    )

    assert result["exit_code"] == 0
    assert str(python_path) in result["output"].strip()
