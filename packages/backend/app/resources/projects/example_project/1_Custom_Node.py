from typing import Any

def RunScript(start: Any = None, a: float = 0, b: float = 0):
    
    result = float(a) + float(b)

    return {
        "a + b": result
    }