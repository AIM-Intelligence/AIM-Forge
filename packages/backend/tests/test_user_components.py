import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core import user_components
from app.main import app


@pytest.fixture
def templates_dir(tmp_path, monkeypatch):
    directory = tmp_path / "user_templates"
    directory.mkdir()
    monkeypatch.setenv(user_components.USER_TEMPLATES_ENV, str(directory))
    return directory


def test_save_and_get_user_component(templates_dir):
    component = user_components.save_user_component(
        name="My Custom Node",
        description="Test description",
        code="def main():\n    return 1\n",
        project_id="proj-123",
        author_id="tester",
        metadata={
            "inputs": [{"name": "a", "type": "int", "required": True}],
            "outputs": [{"name": "result", "type": "int"}],
            "tags": ["math"],
        },
    )

    metadata_path = templates_dir / component.id / "metadata.json"
    code_path = templates_dir / component.id / "node.py"

    assert metadata_path.exists()
    assert code_path.exists()

    saved_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert saved_metadata["name"] == "My Custom Node"
    assert saved_metadata["project_id"] == "proj-123"
    assert saved_metadata["metadata"]["inputs"][0]["name"] == "a"

    fetched = user_components.get_user_component(component.id)
    assert fetched.name == component.name
    assert fetched.author_id == "tester"
    assert fetched.metadata["tags"] == ["math"]


def test_duplicate_name_raises_value_error(templates_dir):
    user_components.save_user_component(name="Dup Node", code="print('hi')")

    with pytest.raises(ValueError):
        user_components.save_user_component(name="Dup Node", code="print('again')")


def test_list_user_components_returns_all(templates_dir):
    first = user_components.save_user_component(name="First", code="pass")
    second = user_components.save_user_component(name="Second", code="pass")

    components = user_components.list_user_components()
    ids = [component.id for component in components]

    assert set(ids) == {first.id, second.id}


def test_delete_user_component(templates_dir):
    component = user_components.save_user_component(name="Temp", code="pass")

    user_components.delete_user_component(component.id)

    remaining = user_components.list_user_components()
    assert all(item.id != component.id for item in remaining)
    with pytest.raises(FileNotFoundError):
        user_components.get_user_component(component.id)


def test_user_component_routes(templates_dir):
    client = TestClient(app)

    payload = {
        "name": "Route Node",
        "description": "Created via API",
        "code": "def main():\n    return 'ok'\n",
        "project_id": "proj-api",
        "metadata": {
            "inputs": [{"name": "prompt", "type": "str"}],
            "outputs": [{"name": "answer", "type": "str"}],
            "tags": ["llm"],
        },
    }

    response = client.post("/api/user-components/", json=payload)
    assert response.status_code == 200
    created = response.json()
    component_id = created["id"]

    list_response = client.get("/api/user-components/")
    assert list_response.status_code == 200
    items = list_response.json()
    assert any(item["id"] == component_id for item in items)

    detail_response = client.get(f"/api/user-components/{component_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["id"] == component_id
    assert detail["name"] == payload["name"]
    assert detail["metadata"]["inputs"][0]["name"] == "prompt"

    dup_response = client.post("/api/user-components/", json=payload)
    assert dup_response.status_code == 400

    delete_response = client.delete(f"/api/user-components/{component_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["success"] is True

    list_after_delete = client.get("/api/user-components/").json()
    assert all(item["id"] != component_id for item in list_after_delete)
