from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from pathlib import Path
from ..core import node_operations
from ..core import venv_manager
from ..core.enhanced_flow_executor import EnhancedFlowExecutor
import os

router = APIRouter()

# Projects root path
PROJECTS_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "projects")

# Global executor instance for metadata analysis
metadata_executor = EnhancedFlowExecutor(Path(PROJECTS_ROOT))

class GetNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None  # For finding the file if needed

class SaveNodeCodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_title: Optional[str] = None
    code: str

class ExecuteNodeRequest(BaseModel):
    project_id: str
    node_id: str
    input_data: Optional[Dict[str, Any]] = None

class PackageInstallRequest(BaseModel):
    project_id: str
    package: str

class PackageUninstallRequest(BaseModel):
    project_id: str
    package: str

class GetPackagesRequest(BaseModel):
    project_id: str

class GetNodeMetadataRequest(BaseModel):
    project_id: str
    node_id: str
    node_data: Optional[Dict[str, Any]] = None

@router.post("/getcode")
async def get_node_code(request: GetNodeCodeRequest):
    """Get the code content of a node for Monaco Editor"""
    try:
        code = node_operations.get_node_code(request.project_id, request.node_id)
        
        # Return in format compatible with Monaco Editor
        return {
            "success": True,
            "code": code,
            "language": "python",
            "node_id": request.node_id,
            "node_title": request.node_title
        }
    except ValueError as e:
        # Return default code if node not found or no code exists
        return {
            "success": True,
            "code": """
            # Write your logic in function.
            # The function name can be changed arbitrarily,
            # but only one function is allowed per node.
            # To pass the return value of this function to the next node,
            # a return statement must be present.
            # The data format and type of input_data should be defined
            # at the beginning of the function and used accordingly.
            # (Using typing or Pydantic is recommended.)

            def main(input_data=None):
                output_data = input_data
                return output_data
            """,
            "language": "python",
            "node_id": request.node_id,
            "node_title": request.node_title,
            "message": str(e)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/savecode")
async def save_node_code(request: SaveNodeCodeRequest):
    """Save code to a node's python file"""
    try:
        result = node_operations.save_node_code(
            request.project_id,
            request.node_id,
            request.code
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/execute-node")
async def execute_single_node(request: ExecuteNodeRequest):
    """Execute a single node and return its output"""
    try:
        # Get the node's code
        code = node_operations.get_node_code(request.project_id, request.node_id)
        
        # Create wrapper to execute the node with input data
        import json
        input_json_str = json.dumps(request.input_data) if request.input_data else 'null'
        
        wrapper_code = f"""
import json
import sys

# Node code
{code}

# Execute with input
try:
    input_json = '''{input_json_str}'''
    if input_json != 'null':
        input_data = json.loads(input_json)
    else:
        input_data = None
    
    # Find and execute main function
    if 'main' in locals() and callable(main):
        result = main(input_data) if input_data is not None else main()
    else:
        # Find first callable
        result = None
        for name, obj in list(locals().items()):
            if callable(obj) and not name.startswith('_') and name not in ['json', 'sys']:
                result = obj(input_data) if input_data is not None else obj()
                break
    
    print(json.dumps({{'success': True, 'output': result}}))
except Exception as e:
    import traceback
    print(json.dumps({{
        'success': False,
        'error': str(e),
        'traceback': traceback.format_exc()
    }}))
"""
        
        project_path = Path(PROJECTS_ROOT) / request.project_id
        if not project_path.exists():
            raise HTTPException(status_code=404, detail="Project not found")

        try:
            python_exe = str(venv_manager.python_bin(project_path))
            exec_env = venv_manager.execution_env(project_path)
        except venv_manager.VenvError as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        execution_result = execute_python_code(
            wrapper_code,
            timeout=30,
            python_executable=python_exe,
            working_dir=str(project_path),
            env=exec_env,
        )
        
        if execution_result['exit_code'] == 0:
            try:
                import json
                output = json.loads(execution_result['output'])
                if output.get('success'):
                    return {
                        "success": True,
                        "output": output.get('output'),
                        "node_id": request.node_id
                    }
                else:
                    return {
                        "success": False,
                        "error": output.get('error', 'Unknown error'),
                        "traceback": output.get('traceback', ''),
                        "node_id": request.node_id
                    }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse output",
                    "output_raw": execution_result['output'],
                    "node_id": request.node_id
                }
        else:
            return {
                "success": False,
                "error": execution_result.get('error', 'Execution failed'),
                "output_raw": execution_result.get('output', ''),
                "node_id": request.node_id
            }
            
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/packages/install")
async def install_package(request: PackageInstallRequest):
    """Install a package (not currently supported without virtual environments)"""
    return {
        "success": False,
        "message": "Package management is not available in single Python environment mode",
        "project_id": request.project_id,
        "package": request.package
    }

@router.post("/packages/uninstall")
async def uninstall_package(request: PackageUninstallRequest):
    """Uninstall a package (not currently supported without virtual environments)"""
    return {
        "success": False,
        "message": "Package management is not available in single Python environment mode",
        "project_id": request.project_id,
        "package": request.package
    }

@router.post("/packages/list")
async def get_packages(request: GetPackagesRequest):
    """Get list of installed packages (returns empty in single Python mode)"""
    return {
        "success": True,
        "project_id": request.project_id,
        "packages": [],
        "python_executable": "system"
    }

@router.post("/packages/info")
async def get_package_info(project_id: str, package: str):
    """Get detailed information about a specific package (not available)"""
    raise HTTPException(status_code=404, detail="Package management is not available in single Python environment mode")

@router.post("/node/metadata")
async def get_node_metadata(request: GetNodeMetadataRequest):
    """
    Get metadata about a node's RunScript function signature.
    This includes input parameters, output keys, and mode information.
    """
    try:
        # Use the enhanced flow executor to analyze the node
        metadata = metadata_executor.analyze_node_signature(
            request.project_id,
            request.node_id,
            request.node_data or {"data": {}}
        )
        
        return {
            "success": True,
            "project_id": request.project_id,
            "node_id": request.node_id,
            "metadata": metadata
        }
    except Exception as e:
        return {
            "success": False,
            "project_id": request.project_id,
            "node_id": request.node_id,
            "error": str(e),
            "metadata": {
                "mode": "unknown",
                "inputs": [],
                "outputs": [],
                "error": str(e)
            }
        }
