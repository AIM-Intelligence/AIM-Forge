import json
import os

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


def _collect_output(websocket, expected: bytes, max_messages: int = 40) -> bytes:
    output = b""
    for _ in range(max_messages):
        chunk = websocket.receive_bytes()
        if not chunk:
            continue
        output += chunk
        if expected in output:
            break
    return output


def test_terminal_websocket_echo(monkeypatch):
    client = TestClient(app)

    # Prefer a predictable shell for tests
    monkeypatch.setenv("SHELL", "/bin/sh")

    try:
        with client.websocket_connect("/api/ws/terminal/example_project") as websocket:
            websocket.send_text(json.dumps({"type": "input", "data": "echo hello-from-terminal\n"}))
            output = _collect_output(websocket, b"hello-from-terminal")
            assert b"hello-from-terminal" in output

            websocket.send_text(json.dumps({"type": "close"}))
    except WebSocketDisconnect as exc:
        if "pty" in (exc.reason or ""):
            pytest.skip("pty devices unavailable in test environment")
        raise
