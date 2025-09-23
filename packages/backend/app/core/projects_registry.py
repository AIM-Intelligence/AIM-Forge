import json
import os
from pathlib import Path
from typing import List, Dict, Any

# Get absolute path to projects directory
PROJECTS_BASE_PATH = Path(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))) / "projects"
PROJECTS_REGISTRY_FILE = PROJECTS_BASE_PATH / "projects.json"

def ensure_projects_registry() -> None:
    """Ensure the projects.json file exists with proper structure"""
    PROJECTS_BASE_PATH.mkdir(exist_ok=True)
    
    if not PROJECTS_REGISTRY_FILE.exists():
        initial_registry = {
            "projects": []
        }
        with open(PROJECTS_REGISTRY_FILE, 'w') as f:
            json.dump(initial_registry, f, indent=2)

def get_projects_registry() -> Dict[str, Any]:
    """Get the entire projects registry"""
    ensure_projects_registry()
    
    try:
        with open(PROJECTS_REGISTRY_FILE, 'r') as f:
            content = f.read()
            # Treat empty or whitespace-only files as empty registry
            if not content or not content.strip():
                return {"projects": []}
            data = json.loads(content)
            # Guard against non-dict JSON (e.g., a stray number like 4)
            if not isinstance(data, dict):
                return {"projects": []}
            projects = data.get("projects", [])
            # Ensure projects is a list
            if not isinstance(projects, list):
                return {"projects": []}
            return {"projects": projects}
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading projects registry: {e}")
        # Return empty registry if file is corrupted
        return {"projects": []}

def save_projects_registry(registry: Dict[str, Any]) -> None:
    """Save the projects registry"""
    ensure_projects_registry()
    
    with open(PROJECTS_REGISTRY_FILE, 'w') as f:
        json.dump(registry, f, indent=2)

def add_project_to_registry(project_name: str, project_description: str, project_id:str) -> None:
    """Add a project to the registry"""
    registry = get_projects_registry()
    
    # Check if project already exists
    for project in registry["projects"]:
        if project["project_name"] == project_name:
            raise ValueError(f"Project '{project_name}' already exists in registry")
    
    # Add new project
    registry["projects"].append({
        "project_name": project_name,
        "project_description": project_description,
        "project_id": project_id
    })
    
    save_projects_registry(registry)

def remove_project_from_registry(project_name: str, project_id: str) -> None:
    """Remove a project from the registry using project_id"""
    registry = get_projects_registry()
    
    # Find and remove project by project_id
    original_length = len(registry["projects"])
    registry["projects"] = [
        p for p in registry["projects"] 
        if p["project_id"] != project_id
    ]
    
    if len(registry["projects"]) == original_length:
        raise ValueError(f"Project with ID '{project_id}' not found in registry")
    
    save_projects_registry(registry)

# def update_project_in_registry(project_name: str, project_description: str) -> None:
#     """Update a project's description in the registry"""
#     registry = get_projects_registry()
    
#     # Find and update project
#     found = False
#     for project in registry["projects"]:
#         if project["project_name"] == project_name:
#             project["project_description"] = project_description
#             found = True
#             break
    
#     if not found:
#         raise ValueError(f"Project '{project_name}' not found in registry")
    
#     save_projects_registry(registry)