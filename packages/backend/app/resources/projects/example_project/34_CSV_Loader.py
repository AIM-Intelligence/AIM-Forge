"""
CSV File Loader Node - Load CSV from local file system
Supports both absolute paths and paths relative to project
"""

from pathlib import Path
from aim_inputs import CSVUpload
from typing import Dict, Any, List


def RunScript(
    Start: bool = True,
    file_path: str = "/path/to/your/file.csv",
    has_header: bool = True,
) -> Dict[str, Any]:
    """
    Load CSV file from local filesystem using AIM-RedLab CSVUpload.

    Parameters:
        csv_file_path: Full absolute path to CSV file
        has_header: Whether CSV has header row
        show_preview: Show first 5 rows in output

    Returns:
        Dictionary with loaded data and metadata
    """

    csv_path = Path(file_path)

    # Load CSV using AIM-RedLab with auto encoding detection for Korean support
    loader = CSVUpload(name=csv_path.stem, has_header=has_header, auto_detect=True)

    # Load the data
    data = loader.load(csv_path)

    return {"data": data}
