from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
import json
import asyncio
from pathlib import Path
from ..core import (
    project_operations,
    project_structure,
    node_operations,
    edge_operations
)
from ..core.flow_executor import FlowExecutor
from ..core.enhanced_flow_executor import EnhancedFlowExecutor
from ..core.flow_analyzer import FlowAnalyzer

router = APIRouter()

# Global executor instance to maintain object store across requests
_global_executor = None

# Constants
PROJECTS_DIR = "projects"

def get_executor():
    """Get or create the global executor instance"""
    global _global_executor
    if _global_executor is None:
        import os
        projects_root = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "projects"
        )
        _global_executor = EnhancedFlowExecutor(projects_root)
    return _global_executor

# Request/Response Models
class CreateProjectRequest(BaseModel):
    project_name: str
    project_description: str
    project_id: str

class DeleteProjectRequest(BaseModel):
    project_name: str
    project_id: str

class CreateNodeRequest(BaseModel):
    project_id: str
    node_id: str
    node_type: str = "custom"
    position: Dict[str, float]
    data: Dict[str, Any]

class DeleteNodeRequest(BaseModel):
    project_id: str
    node_id: str

class UpdateNodePositionRequest(BaseModel):
    project_id: str
    node_id: str
    position: Dict[str, float]

class UpdateNodeDataRequest(BaseModel):
    project_id: str
    node_id: str
    data: Dict[str, Any]

class CreateEdgeRequest(BaseModel):
    project_id: str
    edge_id: str
    edge_type: str = "bezier"
    source: str
    target: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    marker_end: Optional[Dict[str, Any]] = None

class DeleteEdgeRequest(BaseModel):
    project_id: str
    edge_id: str

class ExecuteFlowRequest(BaseModel):
    project_id: str
    start_node_id: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    result_node_values: Dict[str, Any] = Field(default_factory=dict)  # Deprecated, kept for compatibility
    node_values: Dict[str, Any] = Field(default_factory=dict)  # New: all node values
    max_workers: int = Field(default=4, ge=1, le=10)
    timeout_sec: int = Field(default=30, ge=1, le=300)
    halt_on_error: bool = True

class AnalyzeFlowRequest(BaseModel):
    project_id: str




@router.get("/")
async def get_all_projects():
    """Get all project names from the projects folder"""
    try:
        projects = project_operations.get_all_projects()
        return {
            "success": True,
            "projects": projects
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"message": str(e), "type": type(e).__name__})


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get a specific project's node-edge structure by project_id"""
    try:
        structure = project_structure.get_project_structure(project_id)
        
        # Ensure the structure has all required fields for ReactFlow
        # Validate and add default values for nodes
        for node in structure.get("nodes", []):
            # Ensure node has required fields
            if "data" not in node:
                node["data"] = {}
            if "title" not in node["data"]:
                node["data"]["title"] = f"Node {node.get('id', 'unknown')}"
            if "description" not in node["data"]:
                node["data"]["description"] = ""
            
            # Ensure position exists with default values
            if "position" not in node:
                node["position"] = {"x": 100, "y": 100}
            elif not isinstance(node["position"], dict):
                node["position"] = {"x": 100, "y": 100}
            elif "x" not in node["position"] or "y" not in node["position"]:
                node["position"]["x"] = node["position"].get("x", 100)
                node["position"]["y"] = node["position"].get("y", 100)
        
        # Validate edges
        for edge in structure.get("edges", []):
            # Ensure edge has minimum required fields
            if "source" not in edge or "target" not in edge:
                continue  # Skip invalid edges
            
            # Add optional fields with null as default
            if "sourceHandle" not in edge:
                edge["sourceHandle"] = None
            if "targetHandle" not in edge:
                edge["targetHandle"] = None
            
            # Ensure markerEnd has correct format for ReactFlow
            if "markerEnd" not in edge:
                edge["markerEnd"] = {"type": "arrowclosed"}
            elif isinstance(edge.get("markerEnd"), dict):
                # Normalize markerEnd type to lowercase for ReactFlow compatibility
                marker_type = edge["markerEnd"].get("type", "arrowclosed")
                if isinstance(marker_type, str):
                    # Convert to lowercase and handle common variations
                    marker_type_lower = marker_type.lower()
                    if marker_type_lower in ["arrowclosed", "arrow"]:
                        edge["markerEnd"]["type"] = marker_type_lower
                    elif marker_type_lower == "arrowclosed" or "closed" in marker_type_lower:
                        edge["markerEnd"]["type"] = "arrowclosed"
                    else:
                        edge["markerEnd"]["type"] = "arrowclosed"  # Default
        
        return {
            "success": True,
            "project": structure
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"message": str(e), "type": type(e).__name__})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"message": str(e), "type": type(e).__name__})


@router.post("/make")
async def make_project(request: CreateProjectRequest):
    """Create a new project with folder and json file"""
    try:
        result = project_operations.create_project(request.project_name, request.project_description, request.project_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"message": str(e), "type": type(e).__name__})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"message": str(e), "type": type(e).__name__})


@router.delete("/delete")
async def delete_project(request: DeleteProjectRequest):
    """Delete entire project folder"""
    try:
        result = project_operations.delete_project(request.project_name, request.project_id)
        
        # Clean up object store for this project
        executor = get_executor()
        executor.cleanup_project_store(request.project_id)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/makenode")
async def make_node(request: CreateNodeRequest):
    """Create a new node with corresponding python file"""
    try:
        result = node_operations.create_node(
            request.project_id,
            request.node_id,
            request.node_type,
            request.position,
            request.data
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deletenode")
async def delete_node(request: DeleteNodeRequest):
    """Delete a node and its python file"""
    try:
        result = node_operations.delete_node(request.project_id, request.node_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/updatenode/position")
async def update_node_position(request: UpdateNodePositionRequest):
    """Update node position in project structure"""
    try:
        result = node_operations.update_node_position(
            request.project_id,
            request.node_id,
            request.position
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/updatenode/data")
async def update_node_data(request: UpdateNodeDataRequest):
    """Update node data (including value, dimensions, etc.) in project structure"""
    try:
        result = node_operations.update_node_data(
            request.project_id,
            request.node_id,
            request.data
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/makeedge")
async def make_edge(request: CreateEdgeRequest):
    """Create a new edge between nodes"""
    try:
        result = edge_operations.create_edge(
            request.project_id,
            request.edge_id,
            request.edge_type,
            request.source,
            request.target,
            request.marker_end,
            request.source_handle,
            request.target_handle
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deleteedge")
async def delete_edge(request: DeleteEdgeRequest):
    """Delete an edge"""
    try:
        result = edge_operations.delete_edge(request.project_id, request.edge_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-flow")
async def execute_flow(request: ExecuteFlowRequest):
    """Execute the node flow starting from start node"""
    try:
        # Use global executor to maintain object store
        executor = get_executor()
        
        # Merge node_values with result_node_values for backward compatibility
        all_node_values = {**request.result_node_values, **request.node_values}
        
        # Execute the flow
        result = await executor.execute_flow(
            project_id=request.project_id,
            start_node_id=request.start_node_id,
            params=request.params,
            result_node_values=all_node_values,  # Use merged values
            max_workers=request.max_workers,
            timeout_sec=request.timeout_sec,
            halt_on_error=request.halt_on_error
        )
        
        return result
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flow execution failed: {str(e)}")


@router.post("/execute-flow-stream")
async def execute_flow_stream(request: ExecuteFlowRequest):
    """Execute the node flow with streaming results via SSE"""
    async def event_generator():
        try:
            executor = get_executor()
            
            # Merge node_values with result_node_values for backward compatibility
            all_node_values = {**request.result_node_values, **request.node_values}
            
            # Execute flow with streaming
            async for node_result in executor.execute_flow_streaming(
                project_id=request.project_id,
                start_node_id=request.start_node_id,
                params=request.params,
                result_node_values=all_node_values,  # Use merged values
                max_workers=request.max_workers,
                timeout_sec=request.timeout_sec,
                halt_on_error=request.halt_on_error
            ):
                # Send each node result as SSE event
                event_data = json.dumps(node_result)
                yield f"data: {event_data}\n\n"
                await asyncio.sleep(0.01)  # Small delay to ensure proper streaming
                
        except Exception as e:
            # Send error event
            error_event = json.dumps({
                "type": "error",
                "error": str(e)
            })
            yield f"data: {error_event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
            "Connection": "keep-alive"
        }
    )


@router.post("/analyze-flow")
async def analyze_flow(request: AnalyzeFlowRequest):
    """Analyze the flow structure for validation and optimization"""
    try:
        # Get project structure
        structure = project_structure.get_project_structure(request.project_id)
        nodes = structure.get('nodes', [])
        edges = structure.get('edges', [])
        
        # Perform analysis
        analysis = FlowAnalyzer.analyze_flow_structure(nodes, edges)
        
        # Validate flow
        is_valid, errors = FlowAnalyzer.validate_flow(nodes, edges)
        analysis['is_valid'] = is_valid
        analysis['validation_errors'] = errors
        
        return {
            "success": True,
            "project_id": request.project_id,
            "analysis": analysis
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flow analysis failed: {str(e)}")

@router.put("/updateedge")
async def update_edge(request: dict):
    """
    Update edge handles when node ports change.
    """
    try:
        project_id = request.get('project_id')
        edge_id = request.get('edge_id')
        source_handle = request.get('source_handle')
        target_handle = request.get('target_handle')
        
        if not project_id or not edge_id:
            raise ValueError("project_id and edge_id are required")
        
        # Load project structure
        project_path = Path(PROJECTS_DIR) / project_id
        structure_file = project_path / "structure.json"
        
        if not structure_file.exists():
            raise ValueError(f"Project {project_id} not found")
        
        with open(structure_file, 'r') as f:
            structure = json.load(f)
        
        # Find and update the edge
        edges = structure.get('edges', [])
        edge_found = False
        
        for edge in edges:
            if edge['id'] == edge_id:
                if source_handle is not None:
                    edge['sourceHandle'] = source_handle
                if target_handle is not None:
                    edge['targetHandle'] = target_handle
                edge_found = True
                break
        
        if not edge_found:
            raise ValueError(f"Edge {edge_id} not found")
        
        # Save updated structure
        with open(structure_file, 'w') as f:
            json.dump(structure, f, indent=2)
        
        return {
            "success": True,
            "message": f"Edge {edge_id} updated successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update edge: {str(e)}")

@router.get("/{project_id}/node/{node_id}/full-result")
async def get_full_node_result(project_id: str, node_id: str):
    """Get the full result data for a node (not truncated)"""
    try:
        executor = get_executor()
        
        # Check if there's a reference in the object store
        if project_id in executor.object_stores:
            # Look for the node's result in object store
            for ref_id, data in executor.object_stores[project_id].items():
                if ref_id.startswith(f"{node_id}_"):
                    return {
                        "success": True,
                        "data": data,
                        "node_id": node_id
                    }
        
        # If no reference found, return error
        return {
            "success": False,
            "error": "No full data available for this node",
            "node_id": node_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get full result: {str(e)}")
