import json
import shutil
import os
from pathlib import Path
from typing import List, Dict, Any

from .projects_registry import (
    add_project_to_registry,
    remove_project_from_registry,
    get_projects_registry
)
from . import venv_manager

# Get absolute path to projects directory
PROJECTS_BASE_PATH = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))) / "projects"
BASE_REQUIREMENTS_FILE = Path(__file__).resolve().parents[2] / "base_requirements.txt"


def _load_base_requirements() -> List[str]:
    """Return default packages that should be installed in new project environments."""
    if not BASE_REQUIREMENTS_FILE.exists():
        return []

    requirements: List[str] = []
    with open(BASE_REQUIREMENTS_FILE, "r", encoding="utf-8") as handle:
        for line in handle:
            candidate = line.strip()
            if not candidate or candidate.startswith("#"):
                continue
            requirements.append(candidate)
    return requirements

def ensure_projects_dir() -> None:
    """Ensure the projects directory exists"""
    PROJECTS_BASE_PATH.mkdir(exist_ok=True)

def get_all_projects() -> List[Dict[str, str]]:
    """Get all projects from the projects registry"""
    registry = get_projects_registry()
    return registry["projects"]

def create_project(project_name: str, project_description: str, project_id: str) -> Dict[str, Any]:
    """Create a new project folder and json file"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_id
    
    if project_path.exists():
        raise ValueError(f"Project '{project_name}' already exists")
    
    # Add to registry first (will raise error if already exists)
    add_project_to_registry(project_name, project_description, project_id)
    
    try:
        project_path.mkdir(exist_ok=True)
        
        # Create empty project json with initial structure matching ReactFlow format
        project_json_path = project_path / "structure.json"
        initial_structure = {
            "project_name": project_name,
            "project_description": project_description or "",
            "project_id": project_id,
            "nodes": [],
            "edges": []
        }
        
        with open(project_json_path, 'w') as f:
            json.dump(initial_structure, f, indent=2)

        # Initialize isolated virtual environment for the project
        base_requirements = _load_base_requirements()
        try:
            venv_manager.create(project_path, base_requirements)
        except Exception:
            # Clean up project directory and registry record if venv creation fails
            shutil.rmtree(project_path, ignore_errors=True)
            remove_project_from_registry(project_name, project_id)
            raise

        return {
            "success": True,
            "message": f"Project '{project_name}' created successfully",
        }
    except Exception as e:
        # If folder creation fails, remove from registry
        try:
            remove_project_from_registry(project_name, project_id)
        except ValueError:
            pass
        raise e

def delete_project(project_name: str, project_id:str) -> Dict[str, Any]:
    """Delete entire project folder including venv and remove from registry"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_id

    if not project_path.exists():
        raise ValueError(f"Project with ID '{project_id}' does not exist")

    # Remove virtual environment first so no orphaned interpreters remain
    try:
        venv_manager.delete(project_path)
    except venv_manager.VenvError:
        # Proceed even if venv is missing or already cleaned up
        pass

    # Delete folder
    shutil.rmtree(project_path)
    
    # Remove from registry
    try:
        remove_project_from_registry(project_name, project_id)
    except ValueError:
        # Project might not be in registry if it was created before registry system
        pass
    
    return {
        "success": True,
        "message": f"Project '{project_name}' deleted successfully"
    }

def get_project_path(project_id: str) -> Path:
    """Get the path to a project directory using project_id"""
    ensure_projects_dir()
    project_path = PROJECTS_BASE_PATH / project_id
    
    if not project_path.exists():
        raise ValueError(f"Project with ID '{project_id}' does not exist")
    
    return project_path

def get_project_id_by_name(project_name: str) -> str:
    """Get project_id from project_name using the registry"""
    registry = get_projects_registry()
    for project in registry["projects"]:
        if project["project_name"] == project_name:
            return project["project_id"]
    raise ValueError(f"Project '{project_name}' not found in registry")
