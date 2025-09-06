from pathlib import Path
from typing import Dict, Any, Optional

def create_node(project_id: str, node_id: str, node_type: str, position: Dict[str, float], 
                data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new node and corresponding python file matching React Flow structure"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_id)
    
    # Update project json first to check for existing nodes
    structure = get_project_structure(project_id)
    
    # Check if node already exists
    if any(node['id'] == node_id for node in structure['nodes']):
        raise ValueError(f"Node with ID '{node_id}' already exists")
    
    # Extract title from data for filename
    node_title = data.get('title', f'node_{node_id}')
    
    # Only create Python file for custom nodes
    # Start and Result nodes don't need code files
    py_filename = None
    if node_type == 'custom':
        # Create python file for the node
        py_filename = f"{node_id}_{node_title}.py".replace(" ", "_").replace("/", "__")
        py_filepath = project_path / py_filename
        
        # Create empty python file with basic template
        initial_code = f"""# Node: {node_title}
# ID: {node_id}

def main(input_data=None):
    \"\"\"
    Process input data and return result
    
    Args:
        input_data: Data from previous node(s)
    
    Returns:
        Processed data for next node
    \"\"\"
    # Your code here
    if input_data:
        return input_data
    return None
"""
        with open(py_filepath, 'w') as f:
            f.write(initial_code)
    # Start and Result nodes don't need any Python file
    
    # Add new node with React Flow structure
    # Ensure data has required fields
    node_data = {
        "title": data.get('title', f'Node {node_id}'),
        "description": data.get('description', ''),
        **data  # Include any additional data fields
    }
    
    # Only add file reference if a file was created
    if py_filename:
        node_data["file"] = py_filename
    
    new_node = {
        "id": node_id,
        "type": node_type,
        "position": position,
        "data": node_data
    }
    structure['nodes'].append(new_node)
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_title}' created successfully",
        "node": new_node
    }

def delete_node(project_id: str, node_id: str) -> Dict[str, Any]:
    """Delete a node and its corresponding python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure, save_project_structure
    
    project_path = get_project_path(project_id)
    
    # Get project structure
    structure = get_project_structure(project_id)
    
    # Find node to delete
    node_to_delete = None
    for node in structure['nodes']:
        if node['id'] == node_id:
            node_to_delete = node
            break
    
    if not node_to_delete:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Delete python file (file reference is now in data)
    file_name = node_to_delete.get('data', {}).get('file')
    if file_name:
        py_filepath = project_path / file_name
        if py_filepath.exists():
            py_filepath.unlink()
    
    # Remove node from structure
    structure['nodes'] = [n for n in structure['nodes'] if n['id'] != node_id]
    
    # Remove any edges connected to this node
    structure['edges'] = [
        e for e in structure['edges'] 
        if e.get('source') != node_id and e.get('target') != node_id
    ]
    
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Node '{node_id}' deleted successfully"
    }

def get_node_code(project_id: str, node_id: str) -> str:
    """Get the code content of a node's python file"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    
    project_path = get_project_path(project_id)
    structure = get_project_structure(project_id)
    
    # Find node
    node = None
    for n in structure['nodes']:
        if n['id'] == node_id:
            node = n
            break
    
    if not node:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Read python file (file reference is now in data)
    file_name = node.get('data', {}).get('file')
    if not file_name:
        return ""
    
    py_filepath = project_path / file_name
    if not py_filepath.exists():
        return ""
    
    with open(py_filepath, 'r') as f:
        return f.read()

def save_node_code(project_id: str, node_id: str, code: str) -> Dict[str, Any]:
    """Save code to a node's python file with automatic variable renaming"""
    from .project_operations import get_project_path
    from .project_structure import get_project_structure
    import ast
    import re
    
    project_path = get_project_path(project_id)
    structure = get_project_structure(project_id)
    
    # Find node
    node = None
    for n in structure['nodes']:
        if n['id'] == node_id:
            node = n
            break
    
    if not node:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Get file path
    file_name = node.get('data', {}).get('file')
    if not file_name:
        raise ValueError(f"Node '{node_id}' does not have an associated file")
    
    py_filepath = project_path / file_name
    
    # Get the old code to compare parameters
    old_code = ""
    if py_filepath.exists():
        with open(py_filepath, 'r') as f:
            old_code = f.read()
    
    # Parse and compare function parameters
    try:
        # Parse old and new code
        old_tree = ast.parse(old_code) if old_code else None
        new_tree = ast.parse(code)
        
        # Find RunScript function in both
        old_params = []
        new_params = []
        
        if old_tree:
            for node in ast.walk(old_tree):
                if isinstance(node, ast.FunctionDef) and node.name == 'RunScript':
                    old_params = [arg.arg for arg in node.args.args]
                    break
        
        for node in ast.walk(new_tree):
            if isinstance(node, ast.FunctionDef) and node.name == 'RunScript':
                new_params = [arg.arg for arg in node.args.args]
                break
        
        # If parameters changed, update variable names in the code
        if old_params and new_params and len(old_params) == len(new_params):
            modified_code = code
            for old_param, new_param in zip(old_params, new_params):
                if old_param != new_param:
                    # Find the function body and replace old parameter name with new one
                    # Use word boundaries to avoid partial replacements
                    pattern = r'\b' + re.escape(old_param) + r'\b'
                    modified_code = re.sub(pattern, new_param, modified_code)
                    print(f"Renamed variable: {old_param} -> {new_param}")
            code = modified_code
    
    except (SyntaxError, Exception) as e:
        # If parsing fails, just save the code as-is
        print(f"Warning: Could not parse code for automatic variable renaming: {e}")
    
    # Write the updated code
    with open(py_filepath, 'w') as f:
        f.write(code)
    
    return {
        "success": True,
        "message": f"Code saved for node '{node_id}'",
        "file_path": str(py_filepath)
    }

def update_node_position(project_id: str, node_id: str, position: Dict[str, float]) -> Dict[str, Any]:
    """Update node position in project structure"""
    from .project_structure import get_project_structure, save_project_structure
    
    # Get current structure
    structure = get_project_structure(project_id)
    
    # Find and update node position
    node_found = False
    for node in structure['nodes']:
        if node['id'] == node_id:
            node['position'] = position
            node_found = True
            break
    
    if not node_found:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Save updated structure
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Position updated for node '{node_id}'",
        "node_id": node_id,
        "position": position
    }

def update_node_data(project_id: str, node_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update the data of a node in the project structure"""
    from .project_structure import get_project_structure, save_project_structure
    
    # Get current structure
    structure = get_project_structure(project_id)
    
    # Find and update node data
    node_found = False
    for node in structure['nodes']:
        if node['id'] == node_id:
            # Merge the new data with existing data
            if 'data' not in node:
                node['data'] = {}
            node['data'].update(data)
            node_found = True
            updated_data = node['data']
            break
    
    if not node_found:
        raise ValueError(f"Node with ID '{node_id}' not found")
    
    # Save updated structure
    save_project_structure(project_id, structure)
    
    return {
        "success": True,
        "message": f"Data updated for node '{node_id}'",
        "node_id": node_id,
        "data": updated_data
    }