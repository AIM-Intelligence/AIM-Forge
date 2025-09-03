"""
Output Node - Pass-through component for data forwarding
This node simply forwards input data to the next connected component.
"""

from typing import Any, Dict

def RunScript(
    input_data: Any = None,
) -> Dict[str, Any]:
    """
    Pass-through node that forwards data to the next component.
    
    Parameters:
        input_data: Data from the previous node
    
    Returns:
        Dictionary with the forwarded data
    """
    
    # Simply pass through the input data
    if input_data is None:
        return {
            "output": None,
            "status": "no_data",
            "message": "No input data received"
        }
    
    # Forward the data unchanged
    return {
        "output": input_data,
        "status": "success",
        "message": "Data forwarded successfully"
    }