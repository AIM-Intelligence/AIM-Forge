"""Project worker process

Simple JSON-lines protocol over stdin/stdout:
Request: {"id": "<uuid>", "op": "exec_node", "file": "<file.py>", "project_root": "<abs>", "input": {...}}
Response: {"id": "<same>", "ok": true, "output": <any>, "time_ms": 12} or {"id": "<same>", "ok": false, "error": str, "traceback": str}

This module uses only standard library to avoid PYTHONPATH concerns.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional


_BOOTSTRAPPED_PROJECT: Optional[Path] = None


def _site_packages_paths(project_root: Path) -> List[Path]:
    venv_dir = project_root / ".venv"
    if sys.platform == "win32":
        candidates = [venv_dir / "Lib" / "site-packages"]
    else:
        lib_dir = venv_dir / "lib"
        candidates = list(lib_dir.glob("python*/site-packages")) if lib_dir.exists() else []
    return [path for path in candidates if path.exists()]


def _initialize_environment(project_root: Path) -> None:
    global _BOOTSTRAPPED_PROJECT
    if _BOOTSTRAPPED_PROJECT == project_root:
        return

    backend_root = Path(__file__).resolve().parents[2]
    repo_root = Path(__file__).resolve().parents[4]

    seen = set()
    default_entries = list(sys.path)
    new_sys_path: List[str] = []

    def _append(entry: str) -> None:
        if entry in seen:
            return
        new_sys_path.append(entry)
        seen.add(entry)

    for entry in default_entries:
        _append(entry)

    def _prepend(path: Path) -> None:
        resolved = str(path)
        if not path.exists() or resolved in seen:
            return
        new_sys_path.insert(0, resolved)
        seen.add(resolved)

    _prepend(project_root)
    _prepend(backend_root)
    _prepend(repo_root)

    aim_redlab = os.environ.get("AIM_REDLAB_PATH") or str(repo_root / "AIM-RedLab")
    if aim_redlab and os.path.exists(aim_redlab) and aim_redlab not in seen:
        new_sys_path.insert(0, aim_redlab)
        seen.add(aim_redlab)

    sys.path[:] = new_sys_path

    try:
        import site  # noqa: WPS433 - intentionally importing after -S startup
    except Exception:
        site = None

    for site_path in _site_packages_paths(project_root):
        if site is not None:
            site.addsitedir(str(site_path))
        elif str(site_path) not in sys.path:
            sys.path.append(str(site_path))

    _BOOTSTRAPPED_PROJECT = project_root


def _create_safe_namespace(input_data: Any) -> Dict[str, Any]:
    # Minimal safe namespace similar to EnhancedFlowExecutor
    import builtins as _builtins

    safe_names = {
        "abs",
        "all",
        "any",
        "bool",
        "dict",
        "enumerate",
        "filter",
        "float",
        "int",
        "len",
        "list",
        "map",
        "max",
        "min",
        "print",
        "range",
        "round",
        "set",
        "sorted",
        "str",
        "sum",
        "tuple",
        "type",
        "zip",
        "isinstance",
        "hasattr",
        "getattr",
        "setattr",
        "repr",
        "hash",
        "id",
        "iter",
        "next",
        "reversed",
        "__build_class__",
        "property",
        "classmethod",
        "staticmethod",
        "super",
        "object",
        "Exception",
        "ValueError",
        "TypeError",
        "AttributeError",
        "KeyError",
        "IndexError",
        "RuntimeError",
        "__import__",
    }

    ns: Dict[str, Any] = {
        "__builtins__": {k: getattr(_builtins, k) for k in safe_names if hasattr(_builtins, k)},
        "__name__": "__main__",
        "input_data": input_data,
        # Common stdlib modules
        "json": __import__("json"),
        "math": __import__("math"),
        "datetime": __import__("datetime"),
        "time": __import__("time"),
        "random": __import__("random"),
        "re": __import__("re"),
        "collections": __import__("collections"),
        "itertools": __import__("itertools"),
        "Path": __import__("pathlib").Path,
        "pathlib": __import__("pathlib"),
        "os": __import__("os"),
        "sys": __import__("sys"),
        "asyncio": __import__("asyncio"),
        "tempfile": __import__("tempfile"),
    }
    return ns


def _call_function(func: Any, input_data: Any) -> Any:
    """Best-effort invocation compatible with RunScript/main signatures."""
    import inspect

    try:
        sig = inspect.signature(func)
        params = list(sig.parameters.keys())

        if len(params) == 0:
            return func()

        if func.__name__ == "RunScript":
            if isinstance(input_data, dict):
                kwargs: Dict[str, Any] = {}
                for name, param in sig.parameters.items():
                    if name in input_data:
                        kwargs[name] = input_data[name]
                    elif param.default is not inspect.Parameter.empty:
                        pass
                return func(**kwargs)
            else:
                first = params[0]
                return func(**{first: input_data})

        if isinstance(input_data, dict) and len(params) > 1:
            kwargs2: Dict[str, Any] = {}
            for name in params:
                if name in input_data:
                    kwargs2[name] = input_data[name]
                elif sig.parameters[name].default is not inspect.Parameter.empty:
                    pass
                else:
                    return func(input_data)
            return func(**kwargs2)

        if input_data is not None:
            return func(input_data)
        return func()
    except Exception:
        raise


def _execute_node(project_root: Path, file_name: str, input_data: Any) -> Any:
    file_path = (project_root / file_name).resolve()
    if not str(file_path).startswith(str(project_root.resolve())):
        raise RuntimeError("Node file path escapes project root")
    if not file_path.exists():
        raise FileNotFoundError(f"Node file not found: {file_name}")

    code = file_path.read_text(encoding="utf-8")
    ns = _create_safe_namespace(input_data)
    exec(code, ns)

    # Priority: RunScript > main > first callable
    if "RunScript" in ns and callable(ns["RunScript"]):
        return _call_function(ns["RunScript"], input_data)
    if "main" in ns and callable(ns["main"]):
        return _call_function(ns["main"], input_data)
    for name, obj in ns.items():
        if callable(obj) and not name.startswith("_") and name not in {
            "json",
            "sys",
            "time",
            "datetime",
            "math",
            "Path",
            "pathlib",
            "os",
            "asyncio",
            "tempfile",
        }:
            return _call_function(obj, input_data)
    raise RuntimeError("No callable function found in node")


def _handle_line(line: str) -> str:
    try:
        data = json.loads(line)
        msg_id = data.get("id")
        op = data.get("op")
        project_root = Path(data.get("project_root") or os.environ.get("WORKER_PROJECT_PATH", "")).resolve()
        if not project_root.exists():
            raise RuntimeError("Invalid project root")
        if op == "exec_node":
            file_name = data.get("file")
            input_data = data.get("input")
            _initialize_environment(project_root)
            t0 = time.perf_counter()
            try:
                out = _execute_node(project_root, file_name, input_data)
                dt = int((time.perf_counter() - t0) * 1000)
                return json.dumps({"id": msg_id, "ok": True, "output": out, "time_ms": dt})
            except Exception as exc:
                tb = traceback.format_exc()
                return json.dumps({"id": msg_id, "ok": False, "error": str(exc), "traceback": tb})
        return json.dumps({"id": msg_id, "ok": False, "error": f"Unknown op: {op}"})
    except Exception as exc:
        # If parsing fails, return a generic error without id
        return json.dumps({"id": None, "ok": False, "error": f"Invalid message: {exc}"})


def main() -> None:
    # Unbuffered I/O for realtime behavior
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", newline="\n")
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        resp = _handle_line(line)
        print(resp, flush=True)


if __name__ == "__main__":
    main()
