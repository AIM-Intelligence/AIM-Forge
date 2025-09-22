"""FastAPI router skeleton for user-defined component templates."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import user_components as user_component_service
from app.core.user_components import UserComponent

router = APIRouter()


class PortMetadata(BaseModel):
    name: str
    type: str
    required: Optional[bool] = None
    default: Optional[Any] = None


class ComponentMetadata(BaseModel):
    inputs: List[PortMetadata] = Field(default_factory=list)
    outputs: List[PortMetadata] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class UserComponentMetadata(BaseModel):
    """Response model for a stored user component template."""

    id: str = Field(..., description="Unique identifier for the template")
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime
    updated_at: datetime
    author_id: str = Field(default="anonymous")
    project_id: Optional[str] = None
    metadata: ComponentMetadata = Field(default_factory=ComponentMetadata)


class CreateUserComponentRequest(BaseModel):
    """Payload for storing a user-defined component template."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    code: str = Field(..., min_length=1, description="Python source code for the component")
    project_id: Optional[str] = Field(default=None, description="Origin project identifier")
    author_id: Optional[str] = Field(default=None, description="Optional author identifier")
    metadata: Optional[ComponentMetadata] = Field(default=None, description="Optional component IO metadata")


@router.post("/", response_model=UserComponentMetadata)
async def create_user_component(payload: CreateUserComponentRequest) -> UserComponentMetadata:
    """Persist a new user component template to disk."""

    try:
        component = user_component_service.save_user_component(
            name=payload.name,
            description=payload.description,
            code=payload.code,
            author_id=payload.author_id,
            project_id=payload.project_id,
            metadata=payload.metadata.model_dump() if payload.metadata else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _to_response(component)


@router.get("/", response_model=List[UserComponentMetadata])
async def list_user_components() -> List[UserComponentMetadata]:
    """Return available user component templates."""

    components = user_component_service.list_user_components()
    return [_to_response(component) for component in components]


@router.get("/{template_id}", response_model=UserComponentMetadata)
async def get_user_component(template_id: str) -> UserComponentMetadata:
    """Retrieve metadata for a specific user component template."""

    try:
        component = user_component_service.get_user_component(template_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return _to_response(component)


@router.delete("/{template_id}")
async def delete_user_component(template_id: str) -> Dict[str, bool]:
    try:
        user_component_service.delete_user_component(template_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {"success": True}


def _to_response(component: UserComponent) -> UserComponentMetadata:
    return UserComponentMetadata(
        id=component.id,
        name=component.name,
        description=component.description,
        created_at=component.created_at,
        updated_at=component.updated_at,
        author_id=component.author_id,
        project_id=component.project_id,
        metadata=ComponentMetadata(**_normalise_metadata(component.metadata)),
    )


def _normalise_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not metadata:
        return {}

    inputs = metadata.get("inputs") or []
    outputs = metadata.get("outputs") or []
    tags = metadata.get("tags") or []

    # Ensure items are dict-like for Pydantic
    def _coerce_ports(candidates):
        coerced = []
        for item in candidates:
            if isinstance(item, dict):
                coerced.append({
                    "name": item.get("name", ""),
                    "type": item.get("type", "unknown"),
                    "required": item.get("required"),
                    "default": item.get("default"),
                })
        return coerced

    return {
        "inputs": _coerce_ports(inputs),
        "outputs": _coerce_ports(outputs),
        "tags": [str(tag) for tag in tags if isinstance(tag, (str, int))],
    }
