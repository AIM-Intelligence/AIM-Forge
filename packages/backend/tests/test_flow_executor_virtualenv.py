import asyncio
import json
from pathlib import Path

import pytest

from app.core.flow_executor import FlowExecutor
from app.core import venv_manager


def test_flow_executor_passes_virtualenv(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    projects_root = tmp_path / "projects"
    project_id = "demo"
    project_path = projects_root / project_id
    node_file = project_path / "node.py"
    projects_root.mkdir()
    project_path.mkdir()

    node_file.write_text("def main(input_data=None):\n    return 1\n", encoding="utf-8")

    structure = {
        "nodes": [
            {"id": "start", "type": "start", "data": {}},
            {"id": "node", "type": "custom", "data": {"file": node_file.name}},
            {"id": "result", "type": "result", "data": {}},
        ],
        "edges": [
            {"source": "start", "target": "node"},
            {"source": "node", "target": "result"},
        ],
    }
    (project_path / "structure.json").write_text(json.dumps(structure), encoding="utf-8")

    # Ensure virtual environment exists
    venv_manager.create(project_path)
    expected_python = str(venv_manager.python_bin(project_path))

    captured = {}

    def fake_execute_python_code(code, timeout, python_executable=None, working_dir=None, env=None):  # type: ignore[override]
        captured["python_executable"] = python_executable
        captured["working_dir"] = working_dir
        captured["env"] = env
        return {"output": json.dumps({"success": True, "result": 1}), "error": "", "exit_code": 0}

    from app.core import flow_executor as flow_executor_module

    monkeypatch.setattr(flow_executor_module, "execute_python_code", fake_execute_python_code)

    executor = FlowExecutor(str(projects_root))
    result = asyncio.run(executor.execute_flow(project_id, "start"))

    assert result["success"] is True
    assert captured["python_executable"] == expected_python
    assert captured["working_dir"] == str(project_path)
    assert captured["env"]["VIRTUAL_ENV"].endswith(venv_manager.VENV_DIRNAME)
