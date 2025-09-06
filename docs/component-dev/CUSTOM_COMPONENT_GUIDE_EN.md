# Custom Component Development Guide

A unified ruleset for creating everything from simple scripts to full components with the same UX in AIM-Forge/RedLab.

> **Core Principle**: Inputs are defined by function signatures, outputs by dict keys - both automatically map to UI

## 📋 Table of Contents

- [Development Modes Overview](#development-modes-overview)
- [Python Script Mode](#1-python-script-mode-quick-bridge)
- [AIM SDK Mode](#2-aim-sdk-mode-production-components)
- [Input/Output Auto-Mapping](#inputoutput-auto-mapping)
- [Type Hint to UI Mapping Rules](#type-hint-to-ui-mapping-rules)
- [Large Data Handling](#large-data-handling)
- [Development Workflow](#development-workflow)
- [Best Practices](#best-practices)

## Development Modes Overview

AIM-Forge provides two component development modes:

| Mode | Purpose | Complexity | When to Use |
|------|---------|------------|-------------|
| **Python Script Mode** | Quick prototyping, experiments | Low | Testing ideas, simple processing |
| **AIM SDK Mode** | Reusable production components | Medium-High | Deployment, team sharing |

## 1. Python Script Mode (Quick Bridge)

### Purpose
For quickly creating small intermediate processing or experimental components.

### Features
- Minimal boilerplate
- Just define a RunScript function
- Automatic port generation

### Basic Template

```python
def RunScript(x: int = 0, y: str = "default") -> dict:
    """
    Simple processing function
    
    Args:
        x: Input number (auto-generates number input UI)
        y: Input string (auto-generates text input UI)
    
    Returns:
        dict: Dictionary that maps to output ports
    """
    # Simple processing logic
    result = f"Processed: {x} with {y}"
    
    return {
        "output": result,
        "count": x * 2
    }
```

### Real Example: Text Processor

```python
def RunScript(
    text: str = "",
    uppercase: bool = False,
    max_length: int = 100
) -> dict:
    """Simple text processor"""
    
    # Process
    processed = text.upper() if uppercase else text.lower()
    truncated = processed[:max_length]
    
    return {
        "result": truncated,
        "length": len(truncated),
        "was_truncated": len(processed) > max_length
    }
```

## 2. AIM SDK Mode (Production Components)

### Purpose
Developing reusable components with parameters, outputs, validation, and metadata.

### Features
- Freely define helper classes/functions
- Single entry point RunScript
- Type hint-based automatic UI configuration
- Input validation and error handling

### Complete Component Example

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSV Data Processor Component
A reusable data processing component
"""

from __future__ import annotations
from typing import Dict, Any, List, Literal, Optional
import csv
import json
from dataclasses import dataclass
from enum import Enum

# ===========================
# Helper Layer
# ===========================

class ProcessingMode(Enum):
    """Processing mode definitions"""
    FAST = "fast"
    NORMAL = "normal"
    DETAILED = "detailed"

@dataclass
class ProcessingResult:
    """Processing result container"""
    data: List[Dict[str, Any]]
    stats: Dict[str, Any]
    errors: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "data": self.data,
            "statistics": self.stats,
            "error_messages": self.errors,
            "success": len(self.errors) == 0
        }

class DataProcessor:
    """Data processing utility"""
    
    def __init__(self, mode: ProcessingMode = ProcessingMode.NORMAL):
        self.mode = mode
        self.processed_count = 0
    
    def process_csv_data(
        self, 
        file_path: str,
        filter_column: Optional[str] = None,
        filter_value: Optional[str] = None
    ) -> ProcessingResult:
        """Process CSV data"""
        data = []
        errors = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    # Filtering logic
                    if filter_column and filter_value:
                        if row.get(filter_column) != filter_value:
                            continue
                    
                    # Mode-specific processing
                    if self.mode == ProcessingMode.DETAILED:
                        # Include all data
                        data.append(row)
                    elif self.mode == ProcessingMode.FAST:
                        # Essential fields only
                        data.append({k: v for k, v in row.items() if k[:3] != '__'})
                    else:
                        data.append(row)
                    
                    self.processed_count += 1
                    
        except FileNotFoundError:
            errors.append(f"File not found: {file_path}")
        except Exception as e:
            errors.append(f"Processing error: {str(e)}")
        
        # Generate statistics
        stats = {
            "total_rows": len(data),
            "processed": self.processed_count,
            "mode": self.mode.value,
            "filtered": filter_column is not None
        }
        
        return ProcessingResult(data, stats, errors)

def validate_inputs(
    file_path: str,
    mode: str,
    limit: int
) -> List[str]:
    """Input validation helper"""
    errors = []
    
    if not file_path:
        errors.append("File path is required")
    
    if mode not in ["fast", "normal", "detailed"]:
        errors.append(f"Invalid mode: {mode}")
    
    if limit < 0:
        errors.append("Limit must be non-negative")
    
    return errors

# ===========================
# Entry Point
# ===========================

def RunScript(
    # Required inputs
    file_path: str = "",
    
    # Processing options
    mode: Literal["fast", "normal", "detailed"] = "normal",
    filter_column: str = "",
    filter_value: str = "",
    
    # Output control
    limit: int = 1000,
    include_stats: bool = True,
    format_output: Literal["json", "dict", "list"] = "dict",
    
    # Debug
    verbose: bool = False
) -> Dict[str, Any]:
    """
    CSV Data Processing Component
    
    Parameters automatically map to input ports:
    - file_path: File path input (text UI)
    - mode: Processing mode selection (dropdown UI)
    - filter_column/value: Filtering options (text UI)
    - limit: Maximum rows (number UI)
    - include_stats: Include statistics (checkbox UI)
    - format_output: Output format (dropdown UI)
    - verbose: Debug output (checkbox UI)
    
    Return keys map to output ports.
    """
    
    # 1. Input validation
    validation_errors = validate_inputs(file_path, mode, limit)
    if validation_errors:
        return {
            "success": False,
            "data": None,
            "error": "; ".join(validation_errors),
            "metadata": {"stage": "validation"}
        }
    
    # 2. Initialize processor
    proc_mode = ProcessingMode(mode)
    processor = DataProcessor(proc_mode)
    
    if verbose:
        print(f"[DEBUG] Processing {file_path} in {mode} mode")
        print(f"[DEBUG] Filter: {filter_column}={filter_value}")
    
    # 3. Process data
    result = processor.process_csv_data(
        file_path,
        filter_column if filter_column else None,
        filter_value if filter_value else None
    )
    
    # 4. Format results
    output_data = result.data[:limit] if limit > 0 else result.data
    
    if format_output == "json":
        formatted = json.dumps(output_data, indent=2)
    elif format_output == "list":
        formatted = output_data
    else:  # dict
        formatted = {"rows": output_data}
    
    # 5. Construct output
    output = {
        "data": formatted,
        "success": len(result.errors) == 0,
        "row_count": len(output_data)
    }
    
    if include_stats:
        output["statistics"] = result.stats
    
    if result.errors:
        output["errors"] = result.errors
    
    if verbose:
        output["debug_info"] = {
            "processor": processor.__class__.__name__,
            "mode": proc_mode.value,
            "total_processed": processor.processed_count
        }
    
    # Add metadata
    output["metadata"] = {
        "component": "CSV Data Processor",
        "version": "1.0.0",
        "format": format_output
    }
    
    return output

# ===========================
# Local Testing
# ===========================

if __name__ == "__main__":
    # Standalone component testing
    test_result = RunScript(
        file_path="test_data.csv",
        mode="normal",
        filter_column="status",
        filter_value="active",
        limit=10,
        include_stats=True,
        verbose=True
    )
    
    from pprint import pprint
    print("\n=== Test Result ===")
    pprint(test_result)
```

## Input/Output Auto-Mapping

### Input Mapping (Parameters → UI Ports)

```python
def RunScript(
    # Each parameter becomes an input port
    text: str = "default",           # → Text input port
    number: float = 1.0,              # → Number input port
    enabled: bool = True,             # → Checkbox port
    mode: Literal["a", "b"] = "a",   # → Dropdown port
    optional: Optional[int] = None   # → Optional input port
) -> Dict[str, Any]:
    ...
```

### Output Mapping (Dict Keys → UI Ports)

```python
def RunScript(...) -> Dict[str, Any]:
    return {
        "result": processed_data,      # → "result" output port
        "count": 42,                    # → "count" output port
        "metadata": {...},              # → "metadata" output port
        "success": True                 # → "success" output port
    }
```

## Type Hint to UI Mapping Rules

| Python Type | UI Widget | Example |
|-------------|-----------|---------|
| `str` | Text input | `name: str = ""` |
| `int` | Integer spinner | `count: int = 0` |
| `float` | Float input | `value: float = 0.0` |
| `bool` | Checkbox | `enabled: bool = False` |
| `Literal[...]` | Dropdown | `mode: Literal["a", "b", "c"] = "a"` |
| `List[T]` | List editor | `items: List[str] = []` |
| `Dict[K, V]` | JSON editor | `config: Dict[str, Any] = {}` |
| `Optional[T]` | Optional input | `filter: Optional[str] = None` |
| `Any` | Free input | `data: Any = None` |

## Large Data Handling

### Automatic Reference System

Data larger than 10KB is automatically converted to a reference system:

```python
def RunScript(large_data: Any = None) -> Dict[str, Any]:
    # Generate large data
    huge_array = [i for i in range(1000000)]
    
    return {
        "data": huge_array,  # Automatically converted to reference
        "size": len(huge_array)
    }
    
    # In the UI, this is transmitted as:
    # {
    #   "data": {
    #     "__ref__": "object_abc123",
    #     "__preview__": "[0, 1, 2, ...]",
    #     "__size__": 1000000
    #   },
    #   "size": 1000000
    # }
```

### Receiving Reference Data

```python
def RunScript(input_ref: Any = None) -> Dict[str, Any]:
    # Handles both references and actual data automatically
    if isinstance(input_ref, dict) and "__ref__" in input_ref:
        print(f"Received reference: {input_ref['__ref__']}")
        # Execution system automatically dereferences to actual data
    
    # Just use it directly
    actual_data = input_ref  # Already dereferenced
    
    return {"processed": len(actual_data)}
```

## Development Workflow

### Step 1: Start with Script Mode

```python
# test_component.py
def RunScript(x: int = 0) -> dict:
    return {"double": x * 2}
```

### Step 2: Test and Validate

```bash
# Local test
python test_component.py

# Test in AIM-Forge
1. Create Custom Node
2. Paste code
3. Execute and verify
```

### Step 3: Evolve to SDK Mode

```python
# production_component.py
class Calculator:
    def double(self, x: int) -> int:
        return x * 2

def RunScript(
    x: int = 0,
    validate: bool = True
) -> Dict[str, Any]:
    if validate and x < 0:
        return {"error": "x must be non-negative"}
    
    calc = Calculator()
    return {
        "result": calc.double(x),
        "success": True
    }
```

### Step 4: Register Component

```python
# packages/backend/templates/dataops/my_calculator.py
# Save the code above

# packages/frontend/src/components/nodes/dataops/index.ts
export const dataopsComponents = [
  {
    id: "calculator",
    name: "Calculator",
    icon: "🧮",
    template: "dataops/my_calculator",
    nodeType: "custom"
  }
];
```

## Best Practices

### ✅ DO

1. **Use Clear Type Hints**
   ```python
   def RunScript(count: int = 0, name: str = "") -> Dict[str, Any]:
   ```

2. **Provide Meaningful Defaults**
   ```python
   def RunScript(threshold: float = 0.5, max_items: int = 100):
   ```

3. **Add Input Validation**
   ```python
   if not 0 <= threshold <= 1:
       raise ValueError("threshold must be between 0 and 1")
   ```

4. **Use Descriptive Output Keys**
   ```python
   return {
       "processed_data": data,      # Good
       "d": data                     # Bad
   }
   ```

5. **Include Error Handling**
   ```python
   try:
       result = process(data)
       return {"data": result, "success": True}
   except Exception as e:
       return {"error": str(e), "success": False}
   ```

### ❌ DON'T

1. **Avoid Global State**
   ```python
   global_cache = {}  # Bad
   
   def RunScript():
       global_cache["key"] = value  # Bad
   ```

2. **Avoid Side-Effect Imports**
   ```python
   import some_module_that_modifies_system  # Bad
   ```

3. **Avoid Infinite Loops or Long Execution**
   ```python
   while True:  # Bad
       process()
   ```

4. **Avoid Direct File System Modifications**
   ```python
   os.remove("/important/file")  # Bad
   ```

## Debugging Tips

### Local Testing Pattern

```python
def RunScript(x: int = 0, debug: bool = False) -> Dict[str, Any]:
    if debug:
        print(f"[DEBUG] Input: x={x}")
    
    result = x * 2
    
    if debug:
        print(f"[DEBUG] Output: {result}")
    
    return {"result": result}

if __name__ == "__main__":
    # Test by direct execution
    test_result = RunScript(x=5, debug=True)
    print(f"Test result: {test_result}")
```

### Type Checking

```bash
# Type check with mypy
pip install mypy
mypy my_component.py
```

### Unit Testing

```python
# test_my_component.py
import unittest
from my_component import RunScript

class TestMyComponent(unittest.TestCase):
    def test_basic(self):
        result = RunScript(x=5)
        self.assertEqual(result["result"], 10)
    
    def test_validation(self):
        result = RunScript(x=-1)
        self.assertIn("error", result)

if __name__ == "__main__":
    unittest.main()
```

## Advanced Patterns

### Async Processing (Future)

```python
import asyncio
from typing import Dict, Any

async def async_process(data):
    await asyncio.sleep(1)
    return data * 2

def RunScript(x: int = 0) -> Dict[str, Any]:
    # Run async code with sync wrapper
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(async_process(x))
    loop.close()
    
    return {"result": result}
```

### External API Calls

```python
import requests
from typing import Dict, Any, Optional

def RunScript(
    api_url: str = "",
    api_key: str = "",
    timeout: int = 30
) -> Dict[str, Any]:
    if not api_url:
        return {"error": "API URL is required"}
    
    try:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        response = requests.get(api_url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        return {
            "data": response.json(),
            "status_code": response.status_code,
            "success": True
        }
    except requests.RequestException as e:
        return {
            "error": str(e),
            "success": False
        }
```

## Migration Guide

### Existing Python Script → AIM Component

Existing script:
```python
# old_script.py
def process_data(input_file, output_file):
    with open(input_file, 'r') as f:
        data = f.read()
    
    processed = data.upper()
    
    with open(output_file, 'w') as f:
        f.write(processed)
```

Convert to AIM Component:
```python
# new_component.py
def RunScript(
    input_file: str = "",
    to_uppercase: bool = True
) -> Dict[str, Any]:
    try:
        with open(input_file, 'r') as f:
            data = f.read()
        
        if to_uppercase:
            processed = data.upper()
        else:
            processed = data.lower()
        
        return {
            "processed_text": processed,
            "original_length": len(data),
            "processed_length": len(processed),
            "success": True
        }
    except Exception as e:
        return {
            "error": str(e),
            "success": False
        }
```

## Next Steps

1. **Create Simple Script Mode Components**
   - Text processing, number calculations, etc.

2. **Evolve to SDK Mode**
   - Add helper classes
   - Enhance input validation
   - Improve error handling

3. **Register as Official Components**
   - Save to backend/templates
   - Register in frontend category
   - Share with team

4. **Leverage Advanced Features**
   - Large data reference system
   - Async processing
   - External API integration

---

> 💡 **Pro Tip**: Start quickly with Script Mode and evolve to SDK Mode as needed. 
> All components use the same RunScript interface, making transitions seamless.