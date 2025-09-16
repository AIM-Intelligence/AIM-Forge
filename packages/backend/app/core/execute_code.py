import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, Optional

def execute_python_code(
    code: str,
    timeout: int = 30,
    python_executable: Optional[str] = None,
    working_dir: Optional[str] = None,
    env: Optional[Dict[str, str]] = None,
) -> dict:
    """
    Execute Python code in a secure temporary environment
    
    Args:
        code: Python code to execute
        timeout: Maximum execution time in seconds
        python_executable: Optional path to Python executable (for venv)
        working_dir: Optional working directory for execution
        
    Returns:
        Dictionary with output, error, and exit_code
    """
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            temp_file.write(code)
            temp_file_path = temp_file.name
        
        try:
            # Use provided Python executable or system default
            python_exe = Path(python_executable) if python_executable else Path(sys.executable)

            result = subprocess.run(
                [str(python_exe), temp_file_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=working_dir,
                env=env,
            )
            
            return {
                "output": result.stdout,
                "error": result.stderr if result.stderr else None,
                "exit_code": result.returncode
            }
        finally:
            os.unlink(temp_file_path)
            
    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Code execution timed out",
            "exit_code": -1
        }
    except FileNotFoundError:
        return {
            "output": "",
            "error": f"Python 실행 파일을 찾을 수 없습니다: {python_executable}",
            "exit_code": -1,
        }
    except Exception as e:
        return {
            "output": "",
            "error": str(e),
            "exit_code": -1
        }
