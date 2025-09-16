from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Union

from ..core import project_operations, venv_manager

router = APIRouter()


class PackageRequest(BaseModel):
    packages: Union[str, List[str]]


def _normalize_packages(packages: Union[str, List[str]]) -> List[str]:
    if isinstance(packages, str):
        normalized = [packages.strip()]
    else:
        normalized = [pkg.strip() for pkg in packages if isinstance(pkg, str)]

    cleaned = [pkg for pkg in normalized if pkg]
    if not cleaned:
        raise HTTPException(status_code=400, detail="설치할 패키지를 입력하세요.")
    return cleaned


@router.post("/{project_id}/packages/install")
async def install_packages(project_id: str, request: PackageRequest):
    packages = _normalize_packages(request.packages)
    try:
        project_path = project_operations.get_project_path(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        result = venv_manager.install(project_path, packages)
        package_list = venv_manager.list_installed(project_path)
        log_path = venv_manager.write_pip_log(
            project_path,
            action="install",
            packages=packages,
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            success=True,
        )
        venv_manager.update_env_metadata(
            project_path,
            package_list,
            {
                "action": "install",
                "packages": packages,
                "success": True,
                "log_path": log_path,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        metadata = venv_manager.read_env_metadata(project_path)
        return {
            "success": True,
            "packages": package_list,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "log_path": log_path,
            "metadata": metadata,
        }
    except venv_manager.VenvError as exc:
        log_path = venv_manager.write_pip_log(
            project_path,
            action="install",
            packages=packages,
            stdout=exc.stdout,
            stderr=exc.stderr,
            success=False,
        )
        raise HTTPException(
            status_code=400,
            detail={"message": str(exc), "log_path": log_path},
        )


@router.delete("/{project_id}/packages/uninstall")
async def uninstall_packages(project_id: str, request: PackageRequest):
    packages = _normalize_packages(request.packages)
    try:
        project_path = project_operations.get_project_path(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        result = venv_manager.uninstall(project_path, packages)
        package_list = venv_manager.list_installed(project_path)
        log_path = venv_manager.write_pip_log(
            project_path,
            action="uninstall",
            packages=packages,
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            success=True,
        )
        venv_manager.update_env_metadata(
            project_path,
            package_list,
            {
                "action": "uninstall",
                "packages": packages,
                "success": True,
                "log_path": log_path,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        metadata = venv_manager.read_env_metadata(project_path)
        return {
            "success": True,
            "packages": package_list,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "log_path": log_path,
            "metadata": metadata,
        }
    except venv_manager.VenvError as exc:
        log_path = venv_manager.write_pip_log(
            project_path,
            action="uninstall",
            packages=packages,
            stdout=exc.stdout,
            stderr=exc.stderr,
            success=False,
        )
        raise HTTPException(
            status_code=400,
            detail={"message": str(exc), "log_path": log_path},
        )


@router.get("/{project_id}/packages/list")
async def list_packages(project_id: str):
    try:
        project_path = project_operations.get_project_path(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        package_list = venv_manager.list_installed(project_path)
        # Keep metadata current even when just listing
        venv_manager.update_env_metadata(
            project_path,
            package_list,
            {
                "action": "list",
                "packages": [],
                "success": True,
                "log_path": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        metadata = venv_manager.read_env_metadata(project_path)
        return {
            "success": True,
            "packages": package_list,
            "metadata": metadata,
        }
    except venv_manager.VenvError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{project_id}/packages/logs/{log_path:path}")
async def get_package_log(project_id: str, log_path: str):
    try:
        project_path = project_operations.get_project_path(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        log_info = venv_manager.read_pip_log(project_path, log_path)
        return {
            "success": True,
            "log_path": log_info["path"],
            "content": log_info["content"],
        }
    except venv_manager.VenvError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
