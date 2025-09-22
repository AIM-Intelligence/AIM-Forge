"""
Text Input Node - Persistent text storage for configuration values
Stores and provides text values like API keys, file paths, etc.
"""

from typing import Dict, Any


def RunScript(stored_value: str = "") -> Dict[str, Any]:
    """
    Pass through the stored text value.

    This node is primarily used in the UI to store persistent values
    like API keys, file paths, or other configuration text.
    The actual value is stored in localStorage on the frontend.

    Parameters:
        stored_value: Text value stored by the user (managed by frontend)

    Returns:
        Dictionary with the text value
    """

    return stored_value
