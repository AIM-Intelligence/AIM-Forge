"""Markdown Note template (visual-only component).

The backend does not execute code for this node. The file exists so the
component library can reference a template path consistently.
"""

CONTENT = """### 새 Markdown 노트\n설명을 여기에 작성하세요."""

def RunScript(_: dict | None = None) -> dict:
    """Return static content placeholder (unused at runtime)."""
    return {"content": CONTENT}
