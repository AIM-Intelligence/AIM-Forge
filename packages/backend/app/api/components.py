from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import json
import shutil

from app.core import user_components as user_component_service

router = APIRouter()

# Templates directory
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"
PROJECTS_ROOT = Path(__file__).parent.parent.parent / "projects"
USER_TEMPLATE_PREFIX = "user:"

# Known template categories within the templates directory
CATEGORY_FOLDERS = [
    "flow_control",
    "params",
    "inputs",
    "dataops",
    "models",
    "jailbreak",
    "reports",
    "annotations",
]

class ComponentTemplate(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    template: str
    category: str

class CreateFromTemplateRequest(BaseModel):
    project_id: str
    node_id: str
    template_name: str
    title: str
    description: Optional[str] = ""
    component_type: Optional[str] = None

class ComponentLibraryResponse(BaseModel):
    success: bool
    templates: List[Dict[str, Any]]

@router.get("/library")
async def get_component_library():
    """Get list of available component templates"""
    try:
        templates = []
        
        # List all template files from category folders
        if TEMPLATES_DIR.exists():
            # First, get templates from root (legacy)
            for template_file in TEMPLATES_DIR.glob("*.py"):
                if not template_file.name.startswith("__"):
                    template_name = template_file.stem
                    
                    # Read first few lines to get description
                    with open(template_file, 'r') as f:
                        lines = f.readlines()
                        description = ""
                        for line in lines[:10]:
                            if line.strip().startswith('"""'):
                                continue
                            if '"""' in line:
                                break
                            if line.strip():
                                description = line.strip()
                                break
                    
                    templates.append({
                        "name": template_name,
                        "description": description,
                        "file": template_file.name,
                        "category": "general"
                    })
            
            # Then, get templates from category folders
            for category in CATEGORY_FOLDERS:
                category_dir = TEMPLATES_DIR / category
                if category_dir.exists():
                    for template_file in category_dir.glob("*.py"):
                        if not template_file.name.startswith("__"):
                            template_name = template_file.stem
                            
                            # Read first few lines to get description
                            with open(template_file, 'r') as f:
                                lines = f.readlines()
                                description = ""
                                for line in lines[:10]:
                                    if line.strip().startswith('"""'):
                                        continue
                                    if '"""' in line:
                                        break
                                    if line.strip():
                                        description = line.strip()
                                        break
                            
                            templates.append({
                                "name": template_name,
                                "description": description,
                                "file": template_file.name,
                                "category": category,
                                "path": f"{category}/{template_file.name}"
                            })
        
        return {
            "success": True,
            "templates": templates
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-from-template")
async def create_node_from_template(request: CreateFromTemplateRequest):
    """Create a new node from a component template"""
    try:
        # Get project directory
        project_dir = PROJECTS_ROOT / request.project_id
        if not project_dir.exists():
            raise HTTPException(status_code=404, detail="Project not found")
        
        template_file: Optional[Path] = None
        template_base = request.template_name
        template_source = "builtin"
        user_template_id: Optional[str] = None
        stored_metadata: Dict[str, Any] = {}

        if request.template_name.startswith(USER_TEMPLATE_PREFIX):
            candidate_id = request.template_name[len(USER_TEMPLATE_PREFIX):].strip()
            if not candidate_id:
                raise HTTPException(status_code=400, detail="Invalid user template identifier")

            try:
                user_component = user_component_service.get_user_component(candidate_id)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc

            template_file = user_component.path / "node.py"
            if not template_file.exists():
                raise HTTPException(status_code=404, detail=f"User component '{candidate_id}' is missing node.py")

            template_source = "user"
            template_base = user_component.name
            user_template_id = candidate_id
            stored_metadata = user_component.metadata or {}
        else:
            # Check if template_name includes category path first
            if "/" in request.template_name:
                potential = TEMPLATES_DIR / f"{request.template_name}.py"
                if potential.exists():
                    template_file = potential
            else:
                for category in CATEGORY_FOLDERS:
                    potential_file = TEMPLATES_DIR / category / f"{request.template_name}.py"
                    if potential_file.exists():
                        template_file = potential_file
                        break

                # If not found in categories, check root
                if not template_file:
                    potential_file = TEMPLATES_DIR / f"{request.template_name}.py"
                    if potential_file.exists():
                        template_file = potential_file

            if not template_file or not template_file.exists():
                raise HTTPException(status_code=404, detail=f"Template '{request.template_name}' not found")

            template_base = template_file.stem

        # Create node file name
        sanitized_title = "".join(c if c.isalnum() or c == "_" else "_" for c in request.title)
        node_file_name = f"{request.node_id}_{sanitized_title}.py"
        node_file_path = project_dir / node_file_name
        
        # Copy template to node file
        shutil.copy(template_file, node_file_path)
        
        # Update structure.json to add the node
        structure_file = project_dir / "structure.json"
        if structure_file.exists():
            with open(structure_file, 'r') as f:
                structure = json.load(f)
        else:
            structure = {"nodes": [], "edges": []}
        
        # Determine node type based on template
        node_type = "custom"
        template_base_lower = template_base.lower()
        if "start" in template_base_lower:
            node_type = "start"
        elif "result" in template_base_lower:
            node_type = "result"

        # Build node data
        node_data = {
            "title": request.title,
            "description": request.description or f"Created from {template_base} template",
            "file": node_file_name
        }

        # Add componentType if provided
        if request.component_type:
            node_data["componentType"] = request.component_type
        elif template_source == "user":
            node_data["componentType"] = "user-template"

        if user_template_id:
            node_data["user_template_id"] = user_template_id
            if stored_metadata:
                node_data["user_metadata"] = stored_metadata

        # Add node to structure
        new_node = {
            "id": request.node_id,
            "type": node_type,
            "position": {"x": 250, "y": 100},  # Default position
            "data": node_data
        }
        
        # Check if node already exists
        node_exists = False
        for i, node in enumerate(structure["nodes"]):
            if node["id"] == request.node_id:
                structure["nodes"][i] = new_node
                node_exists = True
                break
        
        if not node_exists:
            structure["nodes"].append(new_node)
        
        # Save updated structure
        with open(structure_file, 'w') as f:
            json.dump(structure, f, indent=2)
        
        response_payload = {
            "success": True,
            "node_id": request.node_id,
            "file_name": node_file_name,
            "message": f"Node created from template '{request.template_name}'",
        }

        if user_template_id:
            response_payload["user_template_id"] = user_template_id
            if stored_metadata:
                response_payload["metadata"] = stored_metadata

        return response_payload
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/template/{template_name:path}")
async def get_template_code(template_name: str):
    """Get the code content of a specific template"""
    try:
        # Handle both category/template and direct template names
        template_file: Optional[Path] = None

        if template_name.startswith(USER_TEMPLATE_PREFIX):
            candidate_id = template_name[len(USER_TEMPLATE_PREFIX):].strip()
            if not candidate_id:
                raise HTTPException(status_code=400, detail="Invalid user template identifier")

            try:
                user_component = user_component_service.get_user_component(candidate_id)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc

            template_file = user_component.path / "node.py"
        elif "/" in template_name:
            template_file = TEMPLATES_DIR / f"{template_name}.py"
        else:
            for category in CATEGORY_FOLDERS:
                potential_file = TEMPLATES_DIR / category / f"{template_name}.py"
                if potential_file.exists():
                    template_file = potential_file
                    break

            if not template_file:
                potential_file = TEMPLATES_DIR / f"{template_name}.py"
                if potential_file.exists():
                    template_file = potential_file

        if not template_file or not template_file.exists():
            raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
        
        with open(template_file, 'r') as f:
            code = f.read()
        
        return {
            "success": True,
            "template_name": template_name,
            "code": code
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
