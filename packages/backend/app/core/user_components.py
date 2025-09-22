"""Utilities for managing user-defined component templates."""

from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from .logging import get_logger

__all__ = [
    "UserComponent",
    "UserComponentStore",
    "save_user_component",
    "list_user_components",
    "get_user_component",
    "delete_user_component",
]

logger = get_logger(__name__)

USER_TEMPLATES_ENV = "AIM_USER_TEMPLATES_DIR"
DEFAULT_USER_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "user_templates"


@dataclass
class UserComponent:
    """In-memory representation of a stored user component."""

    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    author_id: str
    project_id: Optional[str]
    path: Path
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_metadata(cls, metadata: Dict[str, object], base_dir: Path) -> "UserComponent":
        try:
            component_id = str(metadata["id"])
            name = str(metadata["name"])
            created_at = datetime.fromisoformat(str(metadata["created_at"]))
            updated_at = datetime.fromisoformat(str(metadata["updated_at"]))
        except Exception as exc:  # pragma: no cover - defensively log and re-raise
            logger.warning("Invalid metadata for user component", exc_info=exc)
            raise

        description = metadata.get("description")
        author_id = str(metadata.get("author_id", "anonymous"))
        project_id = metadata.get("project_id")
        component_path = base_dir / component_id
        component_metadata = metadata.get("metadata") or {}

        return cls(
            id=component_id,
            name=name,
            description=str(description) if description is not None else None,
            created_at=created_at,
            updated_at=updated_at,
            author_id=author_id,
            project_id=str(project_id) if project_id is not None else None,
            path=component_path,
            metadata=component_metadata,
        )

    def to_metadata(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "author_id": self.author_id,
            "project_id": self.project_id,
            "metadata": self.metadata,
        }


class UserComponentStore:
    """Filesystem-backed store for user component templates."""

    def __init__(self, base_dir: Optional[Path] = None) -> None:
        env_dir = os.getenv(USER_TEMPLATES_ENV)
        if base_dir is None:
            base_dir = Path(env_dir) if env_dir else DEFAULT_USER_TEMPLATES_DIR
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    @property
    def metadata_files(self) -> Iterable[Path]:
        return self.base_dir.glob("*/metadata.json")

    def save(
        self,
        name: str,
        code: str,
        description: Optional[str] = None,
        *,
        author_id: Optional[str] = None,
        project_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UserComponent:
        normalized_name = self._normalize_name(name)
        self._ensure_unique_name(normalized_name)

        now = datetime.now(timezone.utc)
        component_id = self._generate_id(normalized_name)
        component_dir = self.base_dir / component_id
        component_dir.mkdir(parents=True, exist_ok=False)

        metadata_payload: Dict[str, Any] = {
            "id": component_id,
            "name": name,
            "description": description,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "author_id": author_id or "anonymous",
            "project_id": project_id,
            "metadata": metadata or {},
        }

        metadata_path = component_dir / "metadata.json"
        code_path = component_dir / "node.py"

        metadata_path.write_text(json.dumps(metadata_payload, indent=2, ensure_ascii=False), encoding="utf-8")
        code_path.write_text(code, encoding="utf-8")

        logger.info("Stored user component", extra={"component_id": component_id, "component_name": name})

        return UserComponent.from_metadata(metadata_payload, self.base_dir)

    def list(self) -> List[UserComponent]:
        components: List[UserComponent] = []
        for metadata_path in self.metadata_files:
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                component = UserComponent.from_metadata(metadata, self.base_dir)
                components.append(component)
            except Exception as exc:  # pragma: no cover - log and continue for robustness
                logger.warning("Failed to load user component metadata", extra={"path": str(metadata_path)}, exc_info=exc)
        components.sort(key=lambda c: c.created_at, reverse=True)
        return components

    def get(self, component_id: str) -> UserComponent:
        metadata_path = self.base_dir / component_id / "metadata.json"
        if not metadata_path.exists():
            raise FileNotFoundError(f"Component '{component_id}' not found")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        return UserComponent.from_metadata(metadata, self.base_dir)

    def delete(self, component_id: str) -> None:
        component_dir = self.base_dir / component_id
        if not component_dir.exists():
            raise FileNotFoundError(f"Component '{component_id}' not found")
        shutil.rmtree(component_dir)

    def _ensure_unique_name(self, normalized_name: str) -> None:
        for existing in self.list():
            if self._normalize_name(existing.name) == normalized_name:
                raise ValueError(f"Component name '{existing.name}' already exists")

    @staticmethod
    def _normalize_name(name: str) -> str:
        return re.sub(r"\s+", " ", name.strip()).lower()

    @staticmethod
    def _generate_id(normalized_name: str) -> str:
        slug = re.sub(r"[^a-z0-9-]", "-", normalized_name.replace(" ", "-"))
        slug = re.sub(r"-+", "-", slug).strip("-") or "component"
        suffix = uuid4().hex[:8]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"{slug}-{timestamp}-{suffix}"


def _store(base_dir: Optional[Path] = None) -> UserComponentStore:
    return UserComponentStore(base_dir)


def save_user_component(
    name: str,
    code: str,
    description: Optional[str] = None,
    *,
    author_id: Optional[str] = None,
    project_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    base_dir: Optional[Path] = None,
) -> UserComponent:
    store = _store(base_dir)
    return store.save(
        name,
        code,
        description,
        author_id=author_id,
        project_id=project_id,
        metadata=metadata,
    )


def list_user_components(base_dir: Optional[Path] = None) -> List[UserComponent]:
    store = _store(base_dir)
    return store.list()


def get_user_component(component_id: str, base_dir: Optional[Path] = None) -> UserComponent:
    store = _store(base_dir)
    return store.get(component_id)


def delete_user_component(component_id: str, base_dir: Optional[Path] = None) -> None:
    store = _store(base_dir)
    store.delete(component_id)
