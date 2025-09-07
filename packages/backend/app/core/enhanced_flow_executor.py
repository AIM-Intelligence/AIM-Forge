"""
Enhanced Flow Executor with Object Store Support
Enables passing Python objects between nodes without JSON serialization
"""

import json
import sys
import time
import inspect
import traceback
import asyncio
from typing import Any, Dict, Optional, List, Set, Tuple, get_type_hints, get_origin, get_args
from pathlib import Path
from collections import defaultdict, deque
import ast

from .flow_executor import FlowExecutor
from .execute_code import execute_python_code


class EnhancedFlowExecutor(FlowExecutor):
    """Enhanced Flow Executor that supports Python object passing between nodes"""
    
    def __init__(self, projects_root: str):
        super().__init__(projects_root)
        # Object store for each project - stores Python objects that can't be JSON serialized
        self.object_stores = {}  # {project_id: {ref_id: object}}
        
    def _execute_node_isolated(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        input_data: Any,
        timeout: int = 30,
        target_handles: Optional[Dict[str, str]] = None,  # Map of source_id -> target_handle
        result_node_values: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Execute node in the same process to enable object passing"""
        
        node_type = node_data.get("type", "custom")
        
        # Handle start nodes
        if node_type == "start":
            return {
                "status": "success",
                "output": None,
                "execution_time_ms": 0,
                "logs": "Start node - flow initiated",
            }
        
        # Handle textInput nodes - check componentType first, then legacy title check
        component_type = node_data.get("data", {}).get("componentType", "")
        is_text_input = (
            node_type == "textInput" or 
            component_type == "TextInput" or
            (node_type == "custom" and node_data.get("data", {}).get("title", "").startswith("Text Input"))
        )
        
        if is_text_input:
            # TextInput nodes always use their stored value from localStorage (passed via result_node_values)
            stored_value = result_node_values.get(node_id) if result_node_values else None
            
            # Frontend sends the value directly as a string (not wrapped)
            # But if it comes as dict for some reason, unwrap it
            if isinstance(stored_value, dict):
                # Could be {'value': actual_value} or {'display': ..., 'raw_value': ...}
                if 'value' in stored_value:
                    stored_value = stored_value['value']
                elif 'raw_value' in stored_value:
                    stored_value = stored_value['raw_value']
                elif 'display' in stored_value:
                    stored_value = stored_value['display']
            
            print(f"[TEXTINPUT NODE {node_id}] Final stored value: {repr(stored_value)}, Type: {type(stored_value)}")
            
            if stored_value is not None and stored_value != "":
                # Return the stored value directly as a string (not wrapped in dict)
                # This allows it to be used directly as parameter values
                return {
                    "status": "success",
                    "output": stored_value,  # Direct string value, not wrapped
                    "execution_time_ms": 0,
                    "logs": "Text Input node - using stored value",
                }
            else:
                # No stored value, return empty string
                return {
                    "status": "success", 
                    "output": "",  # Empty string, not wrapped
                    "execution_time_ms": 0,
                    "logs": "Text Input node - no stored value",
                }
        
        # Handle result nodes
        if node_type == "result":
            # Check if there's a stored value for this result node
            stored_value = result_node_values.get(node_id)
            
            # If we have stored value but no input, use the stored value
            if stored_value is not None and input_data is None:
                print(f"[RESULT NODE {node_id}] Using stored value: {str(stored_value)[:200]}")
                input_data = stored_value
            elif input_data is not None:
                # We have new input, this will update the stored value
                print(f"[RESULT NODE {node_id}] Received input_data: {str(input_data)[:200]}")
            else:
                # No stored value and no input
                print(f"[RESULT NODE {node_id}] No input or stored value")
                input_data = ""
            
            print(f"[RESULT NODE {node_id}] Input type: {type(input_data)}")
            
            # Prepare both display and full data
            display_output = input_data
            full_data_ref = None
            
            # Handle reference objects specially for Result nodes
            if isinstance(input_data, dict) and input_data.get("type") == "reference":
                # Store the reference for full data access
                full_data_ref = input_data.get("ref")
                
                # Unwrap the reference to get actual value
                unwrapped = self._unwrap_input(project_id, input_data)
                
                # Apply size limit to prevent huge outputs
                if isinstance(unwrapped, str):
                    display_output = unwrapped[:1500] + ("..." if len(unwrapped) > 1500 else "")
                elif isinstance(unwrapped, (dict, list)):
                    # Convert to JSON for readable display
                    import json
                    try:
                        json_str = json.dumps(unwrapped, indent=2, ensure_ascii=False)
                        display_output = json_str[:1500] + ("..." if len(json_str) > 1500 else "")
                    except:
                        # Fallback to string representation
                        display_output = str(unwrapped)[:1500]
                else:
                    display_output = str(unwrapped)[:1500]
            else:
                # Not a reference, check if it needs truncation
                if isinstance(input_data, str) and len(input_data) > 1500:
                    display_output = input_data[:1500] + "..."
                elif isinstance(input_data, (dict, list)):
                    import json
                    try:
                        json_str = json.dumps(input_data, indent=2, ensure_ascii=False)
                        if len(json_str) > 1500:
                            display_output = json_str[:1500] + "..."
                        else:
                            display_output = json_str
                    except:
                        display_output = str(input_data)[:1500]
                
            # For ResultNode, we need to pass through the actual value
            # while also providing display information
            # The output should be the actual value (for pass-through)
            # with display metadata attached
            
            # Pass through the actual input data as output
            # so it can be used by downstream nodes
            actual_output = input_data
            
            # If input_data was a reference, unwrap it for output
            if isinstance(input_data, dict) and input_data.get("type") == "reference":
                actual_output = self._unwrap_input(project_id, input_data)
            
            # Create display metadata for frontend
            display_metadata = {
                "display": display_output,
                "full_ref": full_data_ref,
                "is_truncated": isinstance(display_output, str) and display_output.endswith("..."),
                "raw_value": actual_output
            }
            
            # Store display metadata in a special key that frontend can recognize
            # but pass the actual value as the main output
            return {
                "status": "success",
                "output": actual_output,  # Pass through the actual value
                "display_metadata": display_metadata,  # Metadata for UI display
                "execution_time_ms": 0,
                "logs": "Result node - passing through data",
            }
        
        # Handle custom nodes with in-process execution
        try:
            start_time = time.time()
            
            # 1. Unwrap input data (convert references to actual objects)
            actual_input = self._unwrap_input(project_id, input_data)
            
            # 2. If we have target handle information, restructure input for RunScript
            # Check if input_data already has handle names as keys (from multi-input scenario)
            # In that case, it's already properly structured and we don't need to restructure
            print(f"[NODE {node_id}] Actual input before handle processing: {actual_input}")
            if target_handles and isinstance(actual_input, dict):
                # Check if the keys are already handle names (not source IDs)
                handle_values = set(target_handles.values())
                input_keys = set(actual_input.keys())
                
                if input_keys == handle_values or input_keys.issubset(handle_values):
                    # Input is already structured with handle names, don't restructure
                    pass
                else:
                    # Input has source IDs as keys, need to restructure
                    restructured_input = {}
                    for source_id, value in actual_input.items():
                        if source_id in target_handles:
                            # Use the target handle as the parameter name
                            handle_name = target_handles[source_id]
                            restructured_input[handle_name] = value
                        else:
                            # Keep original key if no handle mapping
                            restructured_input[source_id] = value
                    actual_input = restructured_input
            elif target_handles and len(target_handles) == 1:
                # Single input with target handle - wrap in dict with handle name
                handle_name = list(target_handles.values())[0]
                if handle_name:
                    actual_input = {handle_name: actual_input}
            
            # 3. Execute node code in the same process
            result = self._execute_in_process(
                project_id, node_id, node_data, actual_input
            )
            
            # 4. Wrap output (store objects and return references if needed)
            wrapped_output = self._wrap_output(project_id, node_id, result)
            
            execution_time_ms = round((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "output": wrapped_output,
                "execution_time_ms": execution_time_ms,
                "logs": "",
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "execution_time_ms": 0,
                "logs": traceback.format_exc(),
            }
    
    def _execute_in_process(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        input_data: Any
    ) -> Any:
        """Execute node code in the same process with a safe namespace"""
        
        # Add AIM-RedLab to Python path for imports
        import sys
        import os
        aim_redlab_path = os.environ.get('AIM_REDLAB_PATH', '/Users/kwontaeyoun/Desktop/AIM/AIM-RedLab')
        if os.path.exists(aim_redlab_path) and aim_redlab_path not in sys.path:
            sys.path.insert(0, aim_redlab_path)
        
        # Get node file path
        file_name = node_data.get("data", {}).get("file")
        if not file_name:
            title = node_data.get("data", {}).get("title", f"Node_{node_id}")
            sanitized_title = "".join(
                c if c.isalnum() or c == "_" else "_" for c in title
            )
            file_name = f"{node_id}_{sanitized_title}.py"
        
        file_path = self.projects_root / project_id / file_name
        
        if not file_path.exists():
            raise FileNotFoundError(f"Node file '{file_name}' not found")
        
        # Read node code
        with open(file_path, 'r', encoding='utf-8') as f:
            node_code = f.read()
        
        # Create safe execution namespace
        namespace = self._create_safe_namespace(input_data)
        
        # Execute the code
        exec(node_code, namespace)
        
        # Find and execute the main function
        result = None
        function_found = False
        
        # Priority: RunScript > main > first callable
        if 'RunScript' in namespace and callable(namespace['RunScript']):
            result = self._call_function_with_input(namespace['RunScript'], input_data)
            function_found = True
        elif 'main' in namespace and callable(namespace['main']):
            result = self._call_function_with_input(namespace['main'], input_data)
            function_found = True
        else:
            # Find first callable function
            for name, obj in namespace.items():
                if callable(obj) and not name.startswith('_') and name not in [
                    'json', 'sys', 'traceback', 'inspect', 'math', 'datetime',
                    'pandas', 'pd', 'numpy', 'np'
                ]:
                    result = self._call_function_with_input(obj, input_data)
                    function_found = True
                    break
        
        if not function_found:
            raise RuntimeError("No callable function found in node")
        
        return result
    
    def _create_safe_namespace(self, input_data: Any) -> Dict:
        """Create a safe execution namespace with limited builtins"""
        
        # Safe builtins - remove dangerous functions
        safe_builtins = {
            'abs', 'all', 'any', 'bool', 'dict', 'enumerate',
            'filter', 'float', 'int', 'len', 'list', 'map',
            'max', 'min', 'print', 'range', 'round', 'set',
            'sorted', 'str', 'sum', 'tuple', 'type', 'zip',
            'isinstance', 'hasattr', 'getattr', 'setattr',
            'repr', 'hash', 'id', 'iter', 'next', 'reversed',
            '__build_class__', 'property', 'classmethod', 'staticmethod',
            'super', 'object', 'Exception', 'ValueError', 'TypeError',
            'AttributeError', 'KeyError', 'IndexError', 'RuntimeError',
            '__import__'  # Allow importing modules within node code
        }
        
        # Get the actual builtins based on how they're available
        import builtins
        
        namespace = {
            '__builtins__': {k: getattr(builtins, k) for k in safe_builtins 
                           if hasattr(builtins, k)},
            '__name__': '__main__',  # Required for class definitions
            'input_data': input_data,
            # Standard libraries
            'json': __import__('json'),
            'math': __import__('math'),
            'datetime': __import__('datetime'),
            'time': __import__('time'),
            'random': __import__('random'),
            're': __import__('re'),
            'collections': __import__('collections'),
            'itertools': __import__('itertools'),
            'Path': __import__('pathlib').Path,  # Add Path for file operations
            'pathlib': __import__('pathlib'),
            'os': __import__('os'),
            'sys': __import__('sys'),
            'asyncio': __import__('asyncio'),
            'tempfile': __import__('tempfile'),
        }
        
        # Don't import pandas/numpy here - let nodes import them if needed
        # This avoids import errors affecting all nodes
        
        return namespace
    
    def _call_function_with_input(self, func: callable, input_data: Any) -> Any:
        """Call a function with appropriate input handling for RunScript pattern"""
        
        try:
            sig = inspect.signature(func)
            params = list(sig.parameters.keys())
            
            # No parameters - call without arguments
            if len(params) == 0:
                return func()
            
            # Special handling for RunScript pattern
            if func.__name__ == "RunScript":
                # RunScript always uses keyword arguments from input_data dict
                if isinstance(input_data, dict):
                    # Build kwargs mapping input_data keys to function parameters
                    kwargs = {}
                    for param_name, param in sig.parameters.items():
                        if param_name in input_data:
                            # Use value from input_data
                            kwargs[param_name] = input_data[param_name]
                        elif param.default is not inspect.Parameter.empty:
                            # Parameter has default, will use it
                            pass
                        else:
                            # Required parameter missing - skip it to use Python's default behavior
                            pass
                    
                    return func(**kwargs)
                else:
                    # If input is not a dict, try to pass as first parameter only
                    first_param = params[0] if params else None
                    if first_param:
                        return func(**{first_param: input_data})
                    else:
                        return func()
            
            # For non-RunScript functions, use original logic
            # If input is a dict and function expects multiple parameters
            if isinstance(input_data, dict) and len(params) > 1:
                # Try to map dict keys to function parameters
                kwargs = {}
                for param_name in params:
                    if param_name in input_data:
                        kwargs[param_name] = input_data[param_name]
                    elif sig.parameters[param_name].default is not inspect.Parameter.empty:
                        # Use default value if available
                        pass
                    else:
                        # Required parameter missing, fall back to single argument
                        return func(input_data)
                return func(**kwargs)
            
            # Single parameter or non-dict input
            if input_data is not None:
                return func(input_data)
            else:
                return func()
                
        except TypeError as e:
            # Handle parameter mismatch errors
            if "missing" in str(e) and "required positional argument" in str(e):
                # Try calling with no arguments if it's expecting nothing
                try:
                    return func()
                except:
                    pass
            
            # Fallback: try calling with input_data or without
            if input_data is not None:
                return func(input_data)
            else:
                return func()
        except Exception:
            # Final fallback
            if input_data is not None:
                try:
                    return func(input_data)
                except:
                    return func()
            else:
                return func()
    
    def _unwrap_input(self, project_id: str, data: Any) -> Any:
        """Convert references to actual objects from the object store"""
        
        if data is None:
            return None
        
        # Handle reference objects
        if isinstance(data, dict):
            # Check if this is a reference object
            if data.get("type") == "reference" and "ref" in data:
                ref = data["ref"]
                if project_id in self.object_stores:
                    if ref in self.object_stores[project_id]:
                        return self.object_stores[project_id][ref]
                    else:
                        # Reference not found - return preview if available
                        return data.get("preview", None)
                return None
            
            # Recursively unwrap dict values
            unwrapped = {}
            for key, value in data.items():
                unwrapped[key] = self._unwrap_input(project_id, value)
            return unwrapped
        
        # Handle lists
        if isinstance(data, list):
            return [self._unwrap_input(project_id, item) for item in data]
        
        # Return as-is for primitive types
        return data
    
    def _wrap_output(self, project_id: str, node_id: str, data: Any) -> Any:
        """Wrap output data - use JSON for small data, references for large/complex objects"""
        
        # Primitive types pass through directly
        if data is None or isinstance(data, (bool, int, float, str)):
            return data
        
        # Try JSON serialization for small data
        try:
            json_str = json.dumps(data)
            # If serializable and under 10KB, return directly
            if len(json_str) < 10000:
                return data
        except (TypeError, ValueError):
            # Not JSON serializable, need to use reference
            pass
        
        # Store as reference for large or complex objects
        return self._store_as_reference(project_id, node_id, data)
    
    def _store_as_reference(self, project_id: str, node_id: str, data: Any) -> Dict:
        """Store an object and return a reference"""
        
        # Initialize project store if needed
        if project_id not in self.object_stores:
            self.object_stores[project_id] = {}
        
        # Generate unique reference ID
        ref_id = f"{node_id}_{int(time.time() * 1000)}"
        
        # Store the object
        self.object_stores[project_id][ref_id] = data
        
        # Return reference with metadata
        return {
            "type": "reference",
            "ref": ref_id,
            "preview": self._generate_preview(data),
            "data_type": type(data).__name__,
            "size": sys.getsizeof(data) if hasattr(data, '__sizeof__') else None
        }
    
    def _generate_preview(self, data: Any) -> str:
        """Generate a human-readable preview of the data"""
        
        try:
            # pandas DataFrame
            if hasattr(data, 'shape') and hasattr(data, 'columns'):
                return f"DataFrame: {data.shape[0]} rows × {data.shape[1]} cols"
            
            # numpy array
            elif hasattr(data, 'shape') and hasattr(data, 'ndim'):
                return f"Array: shape={data.shape}, dtype={data.dtype}"
            
            # List or tuple
            elif isinstance(data, (list, tuple)):
                preview = f"{type(data).__name__} with {len(data)} items"
                if len(data) > 0:
                    preview += f" (first: {str(data[0])[:50]})"
                return preview
            
            # Dictionary
            elif isinstance(data, dict):
                keys = list(data.keys())[:3]
                preview = f"Dict with {len(data)} keys"
                if keys:
                    preview += f" ({', '.join(str(k) for k in keys)}{'...' if len(data) > 3 else ''})"
                return preview
            
            # Set
            elif isinstance(data, set):
                return f"Set with {len(data)} items"
            
            # Custom objects
            elif hasattr(data, '__class__'):
                class_name = data.__class__.__name__
                # Try to get a meaningful representation
                if hasattr(data, '__len__'):
                    return f"{class_name} ({len(data)} items)"
                elif hasattr(data, '__str__'):
                    str_repr = str(data)[:100]
                    return f"{class_name}: {str_repr}{'...' if len(str(data)) > 100 else ''}"
                else:
                    return f"{class_name} object"
            
            # Default: string representation
            else:
                preview = str(data)[:100]
                if len(str(data)) > 100:
                    preview += "..."
                return preview
                
        except Exception as e:
            return f"{type(data).__name__} object (preview error: {str(e)[:50]})"
    
    def cleanup_project_store(self, project_id: str):
        """Clean up object store for a project"""
        
        if project_id in self.object_stores:
            # Clear all references for this project
            self.object_stores[project_id].clear()
            del self.object_stores[project_id]
    
    def _extract_reachable_subgraph(
        self, start_id: str, nodes: Dict[str, Dict], edges: List[Dict]
    ) -> Tuple[Set[str], Dict[str, List[Tuple[str, Optional[str]]]]]:
        """Extract nodes reachable from start node, including nodes that provide inputs"""
        # Build adjacency list
        adjacency = defaultdict(list)
        reverse_adjacency = defaultdict(set)  # Track who provides input to whom
        
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            param = edge.get("data", {}).get("param") if edge.get("data") else None

            if source in nodes and target in nodes:
                adjacency[source].append((target, param))
                reverse_adjacency[target].add(source)

        # BFS to find reachable nodes from start
        reachable = set()
        queue = deque([start_id])

        while queue:
            current = queue.popleft()
            if current in reachable:
                continue
            reachable.add(current)

            # Add all nodes that current node connects to
            for target, _ in adjacency[current]:
                if target not in reachable:
                    queue.append(target)
            
            # IMPORTANT: Also add nodes that provide input to the current node
            # This ensures nodes like 7 and 8 that feed into node 6 are included
            for source in reverse_adjacency[current]:
                if source not in reachable:
                    queue.append(source)

        return reachable, adjacency
    
    async def execute_flow(
        self,
        project_id: str,
        start_node_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        result_node_values: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        timeout_sec: int = 30,
        halt_on_error: bool = True,
    ) -> Dict[str, Any]:
        """Execute the complete flow with targetHandle support"""
        
        # Load project structure
        nodes, edges = self._load_structure(project_id)
        
        # Find start node
        if not start_node_id:
            start_node_id = self._find_start_node(nodes)
            if not start_node_id:
                raise ValueError("No start node found in project")
        
        if start_node_id not in nodes:
            raise ValueError(f"Start node {start_node_id} not found")
        
        # Extract reachable subgraph
        reachable_nodes, adjacency = self._extract_reachable_subgraph(
            start_node_id, nodes, edges
        )
        
        # Perform topological sort
        execution_order = self._topological_sort(reachable_nodes, adjacency)
        
        # Initialize execution state
        execution_results = {}
        node_outputs = {}
        node_inputs = defaultdict(dict)
        
        # Calculate dependencies
        dependencies = defaultdict(set)
        for edge in edges:
            if edge["source"] in reachable_nodes and edge["target"] in reachable_nodes:
                dependencies[edge["target"]].add(edge["source"])
        
        # Set initial params for start node
        if params:
            node_inputs[start_node_id] = params
        
        # Execution semaphore for parallel control
        semaphore = asyncio.Semaphore(max_workers)
        
        async def execute_node_async(node_id: str):
            """Execute a single node asynchronously"""
            async with semaphore:
                # Check if all dependencies are satisfied
                for dep in dependencies[node_id]:
                    if dep not in execution_results:
                        return  # Dependencies not ready
                    if halt_on_error and execution_results[dep]["status"] == "error":
                        execution_results[node_id] = {
                            "status": "skipped",
                            "error": f"Skipped due to error in dependency {dep}",
                            "execution_time_ms": 0,
                            "logs": "",
                        }
                        return
                
                # Prepare input data with targetHandle mapping
                input_data = None
                target_handles = {}
                
                # Collect inputs from edges with handle information
                incoming_edges = [
                    {
                        "source": edge["source"],
                        "targetHandle": edge.get("targetHandle"),
                        "sourceHandle": edge.get("sourceHandle")
                    }
                    for edge in edges
                    if edge["target"] == node_id and edge["source"] in node_outputs
                ]
                
                if incoming_edges:
                    if len(incoming_edges) == 1:
                        # Single input
                        edge_info = incoming_edges[0]
                        source = edge_info["source"]
                        source_output = node_outputs[source]
                        
                        # Check if source_output is a reference and unwrap it first
                        source_output_unwrapped = source_output
                        if isinstance(source_output, dict) and source_output.get("type") == "reference":
                            source_output_unwrapped = self._unwrap_input(project_id, source_output)
                        
                        # Extract value based on sourceHandle
                        value = source_output_unwrapped
                        if isinstance(source_output_unwrapped, dict) and edge_info["sourceHandle"]:
                            # Extract specific output from dict
                            if edge_info["sourceHandle"] in source_output_unwrapped:
                                value = source_output_unwrapped[edge_info["sourceHandle"]]
                        
                        # If targetHandle is specified, wrap in dict with handle as key
                        if edge_info["targetHandle"]:
                            input_data = {edge_info["targetHandle"]: value}
                            target_handles[source] = edge_info["targetHandle"]
                        else:
                            input_data = value
                    else:
                        # Multiple inputs - create dict with targetHandle as keys
                        input_data = {}
                        for edge_info in incoming_edges:
                            source = edge_info["source"]
                            source_output = node_outputs.get(source)
                            
                            # Skip if source hasn't been executed yet
                            if source not in node_outputs:
                                continue
                            
                            # Get the actual value to use
                            value = source_output
                            
                            # Extract specific output if sourceHandle is specified
                            if isinstance(source_output, dict) and edge_info["sourceHandle"]:
                                if edge_info["sourceHandle"] in source_output:
                                    value = source_output[edge_info["sourceHandle"]]
                                else:
                                    value = source_output
                            else:
                                value = source_output
                            
                            # Use targetHandle as key if specified
                            if edge_info["targetHandle"]:
                                input_data[edge_info["targetHandle"]] = value
                                target_handles[source] = edge_info["targetHandle"]
                            else:
                                input_data[f"input_{source}"] = value
                elif node_id == start_node_id and params:
                    # Start node with initial params
                    input_data = params
                
                # Execute node in thread pool (blocking operation)
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    self._execute_node_isolated,
                    project_id,
                    node_id,
                    nodes[node_id],
                    input_data,
                    timeout_sec,
                    target_handles if target_handles else None,
                    result_node_values,
                )
                
                execution_results[node_id] = result
                
                # Store output for downstream nodes
                if result["status"] == "success":
                    node_outputs[node_id] = result.get("output")
        
        # Execute nodes in order with parallelization
        executed = set()
        
        while len(executed) < len(execution_order):
            # Find nodes ready to execute
            ready = []
            for node_id in execution_order:
                if node_id not in executed:
                    # Check if all dependencies are executed
                    if all(dep in executed for dep in dependencies[node_id]):
                        ready.append(node_id)
            
            # Execute ready nodes in parallel
            if ready:
                tasks = [execute_node_async(node_id) for node_id in ready]
                await asyncio.gather(*tasks)
                executed.update(ready)
            else:
                # No progress possible - might have cycle or error
                break
        
        # Collect results from result nodes
        result_nodes = {}
        for node_id in execution_results:
            if nodes[node_id].get("type") == "result":
                if execution_results[node_id]["status"] == "success":
                    result_nodes[node_id] = execution_results[node_id]["output"]
        
        return {
            "success": True,
            "run_id": f"{time.strftime('%Y-%m-%dT%H:%M:%SZ')}-{project_id}",
            "execution_results": execution_results,
            "result_nodes": result_nodes,
            "execution_order": execution_order,
            "total_execution_time_ms": sum(
                r.get("execution_time_ms", 0)
                for r in execution_results.values()
                if r.get("status") == "success"
            ),
        }
    
    async def execute_flow_streaming(
        self,
        project_id: str,
        start_node_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        result_node_values: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        timeout_sec: int = 30,
        halt_on_error: bool = True,
    ):
        """Execute flow with streaming results - yields results as nodes complete"""
        
        # Load project structure
        nodes, edges = self._load_structure(project_id)
        
        # Find start node
        if not start_node_id:
            start_node_id = self._find_start_node(nodes)
            if not start_node_id:
                raise ValueError("No start node found in project")
        
        # Get reachable nodes and adjacency
        reachable_nodes, adjacency = self._extract_reachable_subgraph(
            start_node_id, nodes, edges
        )
        
        # Get topological order
        execution_order = self._topological_sort(reachable_nodes, adjacency)
        
        # Filter execution order to only include reachable nodes
        execution_order = [node for node in execution_order if node in reachable_nodes]
        
        # Initialize tracking
        start_time = time.time()
        execution_results = {}
        node_outputs = {}
        result_nodes = {}
        
        # Filter execution order to count only main processing components
        # Exclude: start nodes, result nodes, and text input nodes from progress count
        main_component_count = 0
        main_component_indices = {}  # Map node_id to its index in main components
        completed_main_components = 0  # Track completed main components
        
        for node_id in execution_order:
            node = nodes.get(node_id, {})
            node_type = node.get("type", "custom")
            node_title = node.get("data", {}).get("title", "")
            component_type = node.get("data", {}).get("componentType", "")
            
            # Check if this is a main processing component (exclude result, start, text input)
            is_main_component = (
                node_type not in ["start", "result", "textInput"] and
                component_type != "TextInput" and
                "Text Input" not in node_title and
                "Start Node" not in node_title and
                "Result Node" not in node_title
            )
            
            if is_main_component:
                main_component_indices[node_id] = main_component_count
                main_component_count += 1
        
        print(f"[EXECUTION] Total nodes: {len(execution_order)}, Main components: {main_component_count}")
        print(f"[EXECUTION] Main component indices: {main_component_indices}")
        
        # Classify Result nodes based on incoming edges
        # Input Result nodes: no incoming edges from this pipeline (preserve values)
        # Output Result nodes: have incoming edges from this pipeline (clear values)
        input_result_nodes = []
        output_result_nodes = []
        
        for node_id in reachable_nodes:
            node = nodes.get(node_id, {})
            if node.get("type") == "result":
                # Check if this Result node has incoming edges from nodes in this pipeline
                has_incoming = False
                for edge in edges:
                    if edge["target"] == node_id and edge["source"] in reachable_nodes:
                        has_incoming = True
                        break
                
                if has_incoming:
                    output_result_nodes.append(node_id)
                else:
                    input_result_nodes.append(node_id)
        
        print(f"[EXECUTION] Input Result nodes (preserve): {input_result_nodes}")
        print(f"[EXECUTION] Output Result nodes (clear): {output_result_nodes}")
        
        # Send initial event with classified nodes
        yield {
            "type": "start",
            "total_nodes": main_component_count,  # Use filtered count
            "execution_order": execution_order,
            "affected_nodes": list(reachable_nodes),  # All nodes in this pipeline
            "input_result_nodes": input_result_nodes,  # Result nodes to preserve
            "output_result_nodes": output_result_nodes,  # Result nodes to clear
            "timestamp": time.time()
        }
        
        # Calculate dependencies for each node
        dependencies = defaultdict(set)
        for edge in edges:
            if edge["source"] in reachable_nodes and edge["target"] in reachable_nodes:
                dependencies[edge["target"]].add(edge["source"])
        
        # Execute nodes with dependency-aware parallelism
        print(f"[EXECUTION] Order: {execution_order}")
        print(f"[EXECUTION] Result node values: {result_node_values}")
        print(f"[EXECUTION] Dependencies: {dict(dependencies)}")
        
        # Track which nodes are currently executing
        executing_nodes = set()
        completed_nodes = set()
        completed_main_components = 0  # Track how many main components have completed
        
        # Process nodes in levels (nodes that can execute in parallel)
        while len(completed_nodes) < len(execution_order):
            # Find nodes that can execute now (dependencies satisfied)
            ready_nodes = []
            for node_id in execution_order:
                if node_id not in completed_nodes and node_id not in executing_nodes:
                    # Check if all dependencies are completed
                    if dependencies[node_id].issubset(completed_nodes):
                        ready_nodes.append(node_id)
            
            if not ready_nodes:
                # Wait a bit if no nodes are ready
                await asyncio.sleep(0.01)
                continue
            
            # Execute ready nodes in parallel
            tasks = []
            task_to_node = {}  # Map task to node_id for tracking
            
            for node_id in ready_nodes:
                executing_nodes.add(node_id)
                node_data = nodes[node_id]
                print(f"[EXECUTION] Starting node {node_id}, type: {node_data.get('type')}")
                
                # Create async task for this node
                # Get the main component index for this node (or -1 if not a main component)
                main_index = main_component_indices.get(node_id, -1)
                
                task = asyncio.create_task(self._execute_node_streaming(
                    project_id, node_id, node_data, nodes, edges, 
                    node_outputs, execution_results, result_nodes,
                    result_node_values, main_index, main_component_count,
                    completed_main_components,
                    start_node_id, params, timeout_sec, halt_on_error
                ))
                tasks.append(task)
                task_to_node[task] = node_id
            
            # Wait for all tasks to complete and yield results as they finish
            pending_tasks = set(tasks)
            while pending_tasks:
                # Wait for at least one task to complete
                done, pending_tasks = await asyncio.wait(
                    pending_tasks, 
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                # Process completed tasks
                for completed_task in done:
                    result = await completed_task
                    node_id = task_to_node[completed_task]
                    
                    if result:
                        yield result
                        # Track completed main components for accurate progress
                        if node_id in main_component_indices:
                            completed_main_components += 1
                    
                    executing_nodes.remove(node_id)
                    completed_nodes.add(node_id)
                    print(f"[EXECUTION] Completed node {node_id}")
        
        # Send complete event
        yield {
            "type": "complete",
            "execution_results": execution_results,
            "result_nodes": result_nodes,
            "execution_order": execution_order,
            "total_execution_time_ms": round((time.time() - start_time) * 1000),
            "timestamp": time.time()
        }
        
        return
    
    async def _execute_node_streaming(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        nodes: Dict,
        edges: List,
        node_outputs: Dict,
        execution_results: Dict,
        result_nodes: Dict,
        result_node_values: Optional[Dict],
        main_component_index: int,  # Index in main components (-1 if not a main component)
        total_main_components: int,  # Total count of main components
        completed_main_components: int,  # Number of main components completed so far
        start_node_id: str,
        params: Optional[Dict] = None,
        timeout_sec: int = 30,
        halt_on_error: bool = True
    ):
        """Execute a single node and return streaming result"""
        try:
            # Prepare input data
            input_data = None
            target_handles = {}
            
            # Collect inputs from edges
            incoming_edges = [
                {
                    "source": edge["source"],
                    "targetHandle": edge.get("targetHandle"),
                    "sourceHandle": edge.get("sourceHandle")
                }
                for edge in edges
                if edge["target"] == node_id and edge["source"] in node_outputs
            ]
            
            if incoming_edges:
                if len(incoming_edges) == 1:
                    # Single input
                    edge_info = incoming_edges[0]
                    source = edge_info["source"]
                    source_output = node_outputs[source]
                    
                    # Check if source_output is a reference and unwrap it first
                    source_output_unwrapped = source_output
                    if isinstance(source_output, dict) and source_output.get("type") == "reference":
                        print(f"[CHECK] Source output is reference, unwrapping...")
                        source_output_unwrapped = self._unwrap_input(project_id, source_output)
                    
                    # Extract value based on sourceHandle
                    value = source_output_unwrapped
                    if isinstance(source_output_unwrapped, dict) and edge_info["sourceHandle"]:
                        print(f"[CHECK] node={node_id}, sourceHandle={edge_info['sourceHandle']}, keys={list(source_output_unwrapped.keys())[:10]}")
                        if edge_info["sourceHandle"] in source_output_unwrapped:
                            value = source_output_unwrapped[edge_info["sourceHandle"]]
                            print(f"[CHECK] Successfully extracted '{edge_info['sourceHandle']}': {str(value)[:100]}")
                        else:
                            print(f"[CHECK] sourceHandle '{edge_info['sourceHandle']}' not found in output")
                    else:
                        print(f"[CHECK] No extraction: type={type(source_output_unwrapped)}, sourceHandle={edge_info.get('sourceHandle')}")
                    
                    # If targetHandle is specified, wrap in dict
                    if edge_info["targetHandle"]:
                        input_data = {edge_info["targetHandle"]: value}
                        target_handles[source] = edge_info["targetHandle"]
                    else:
                        input_data = value
                else:
                    # Multiple inputs
                    input_data = {}
                    for edge_info in incoming_edges:
                        source = edge_info["source"]
                        source_output = node_outputs.get(source)
                        
                        if source_output is None:
                            continue
                        
                        # Extract specific output if sourceHandle specified
                        value = source_output
                        if isinstance(source_output, dict) and edge_info["sourceHandle"]:
                            if edge_info["sourceHandle"] in source_output:
                                value = source_output[edge_info["sourceHandle"]]
                        
                        # Use targetHandle as key if specified
                        if edge_info["targetHandle"]:
                            input_data[edge_info["targetHandle"]] = value
                            target_handles[source] = edge_info["targetHandle"]
                        else:
                            input_data[f"input_{source}"] = value
            elif node_id == start_node_id and params:
                input_data = params
            
            # Execute node
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._execute_node_isolated,
                project_id,
                node_id,
                nodes[node_id],
                input_data,
                timeout_sec,
                target_handles if target_handles else None,
                result_node_values,
            )
            
            execution_results[node_id] = result
            
            # Store output for downstream nodes
            if result["status"] == "success":
                node_outputs[node_id] = result.get("output")
                
                # Handle result nodes
                if node_data.get("type") == "result":
                    result_nodes[node_id] = result.get("output")
            
            # Return node completion event
            # Send updates for all nodes including Result nodes for real-time updates
            # Only exclude Start and TextInput nodes from progress updates
            if node_data.get("type") == "result":
                # For Result nodes, send event but don't increment progress counter
                # Use the current completed count (not incremented for Result nodes)
                return {
                    "type": "node_complete",
                    "node_id": node_id,
                    "node_title": node_data.get("data", {}).get("title", "Unknown"),
                    "node_index": completed_main_components,  # Use current progress
                    "total_nodes": total_main_components,
                    "result": result,
                    "timestamp": time.time()
                }
            elif main_component_index >= 0:
                # For main components, use their actual index
                return {
                    "type": "node_complete",
                    "node_id": node_id,
                    "node_title": node_data.get("data", {}).get("title", "Unknown"),
                    "node_index": main_component_index + 1,  # 1-based index for display
                    "total_nodes": total_main_components,
                    "result": result,
                    "timestamp": time.time()
                }
            else:
                # For auxiliary nodes (start, text input), don't send progress update
                return None
            
        except Exception as e:
            # Return error event
            error_result = {
                "status": "error",
                "error": str(e),
                "execution_time_ms": 0,
                "logs": ""
            }
            execution_results[node_id] = error_result
            
            # Only send error events for main components
            if main_component_index >= 0:
                return {
                    "type": "node_complete",
                    "node_id": node_id,
                    "node_title": node_data.get("data", {}).get("title", "Unknown"),
                    "node_index": main_component_index + 1,
                    "total_nodes": total_main_components,
                    "result": error_result,
                    "timestamp": time.time()
                }
            else:
                return None
    
    def get_store_info(self, project_id: str) -> Dict:
        """Get information about the object store for debugging"""
        
        if project_id not in self.object_stores:
            return {"exists": False, "count": 0, "refs": []}
        
        store = self.object_stores[project_id]
        return {
            "exists": True,
            "count": len(store),
            "refs": [
                {
                    "ref": ref,
                    "type": type(obj).__name__,
                    "size": sys.getsizeof(obj) if hasattr(obj, '__sizeof__') else None
                }
                for ref, obj in store.items()
            ]
        }
    
    def analyze_node_signature(self, project_id: str, node_id: str, node_data: Dict) -> Dict:
        """Analyze a node's RunScript function signature for metadata"""
        
        try:
            # Get node file path
            file_name = node_data.get("data", {}).get("file")
            if not file_name:
                title = node_data.get("data", {}).get("title", f"Node_{node_id}")
                sanitized_title = "".join(
                    c if c.isalnum() or c == "_" else "_" for c in title
                )
                file_name = f"{node_id}_{sanitized_title}.py"
            
            file_path = self.projects_root / project_id / file_name
            
            if not file_path.exists():
                return {
                    "mode": "unknown",
                    "inputs": [],
                    "outputs": [],
                    "error": f"Node file '{file_name}' not found"
                }
            
            # Read and parse the node code
            with open(file_path, 'r', encoding='utf-8') as f:
                node_code = f.read()
            
            # Parse the AST to find RunScript function
            try:
                tree = ast.parse(node_code)
            except SyntaxError as e:
                return {
                    "mode": "unknown",
                    "inputs": [],
                    "outputs": [],
                    "error": f"Syntax error in node code: {e}"
                }
            
            # Find RunScript function
            runscript_node = None
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == "RunScript":
                    runscript_node = node
                    break
            
            # Determine mode and extract metadata
            if runscript_node:
                # Python Script Mode - has RunScript function
                inputs = self._extract_function_inputs(runscript_node, node_code)
                outputs = self._extract_function_outputs(runscript_node, node_code)
                
                return {
                    "mode": "script",
                    "inputs": inputs,
                    "outputs": outputs,
                    "function_name": "RunScript"
                }
            else:
                # Check for main function as fallback
                main_node = None
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef) and node.name == "main":
                        main_node = node
                        break
                
                if main_node:
                    inputs = self._extract_function_inputs(main_node, node_code)
                    outputs = self._extract_function_outputs(main_node, node_code)
                    
                    return {
                        "mode": "basic",
                        "inputs": inputs,
                        "outputs": outputs,
                        "function_name": "main"
                    }
                else:
                    # No RunScript or main - basic mode
                    return {
                        "mode": "basic",
                        "inputs": [{"name": "input_data", "type": "Any", "default": None}],
                        "outputs": [{"name": "output", "type": "Any"}],
                        "function_name": None
                    }
                    
        except Exception as e:
            return {
                "mode": "unknown",
                "inputs": [],
                "outputs": [],
                "error": str(e)
            }
    
    def _extract_function_inputs(self, func_node: ast.FunctionDef, source_code: str) -> List[Dict]:
        """Extract input parameters from a function AST node"""
        
        inputs = []
        args = func_node.args
        
        # Get default values (they're aligned to the right)
        defaults = args.defaults or []
        num_args = len(args.args)
        num_defaults = len(defaults)
        
        for i, arg in enumerate(args.args):
            param_info = {
                "name": arg.arg,
                "type": "Any",  # Default type
                "default": None,
                "required": True
            }
            
            # Check if this parameter has a default value
            default_index = i - (num_args - num_defaults)
            if default_index >= 0:
                default_node = defaults[default_index]
                param_info["required"] = False
                param_info["default"] = self._extract_default_value(default_node)
            
            # Extract type annotation if available
            if arg.annotation:
                param_info["type"] = self._extract_type_annotation(arg.annotation)
            
            inputs.append(param_info)
        
        return inputs
    
    def _extract_function_outputs(self, func_node: ast.FunctionDef, source_code: str) -> List[Dict]:
        """Extract output keys from return statements in function"""
        
        outputs = []
        
        # Find all return statements
        for node in ast.walk(func_node):
            if isinstance(node, ast.Return) and node.value:
                # Check if return value is a dict literal
                if isinstance(node.value, ast.Dict):
                    for key in node.value.keys:
                        if isinstance(key, ast.Constant):
                            output_name = key.value
                            if output_name not in [o["name"] for o in outputs]:
                                outputs.append({
                                    "name": output_name,
                                    "type": "Any"
                                })
                # Check if return value is a dict() call
                elif isinstance(node.value, ast.Call):
                    if isinstance(node.value.func, ast.Name) and node.value.func.id == "dict":
                        # Extract keys from dict(key=value) syntax
                        for keyword in node.value.keywords:
                            if keyword.arg:
                                if keyword.arg not in [o["name"] for o in outputs]:
                                    outputs.append({
                                        "name": keyword.arg,
                                        "type": "Any"
                                    })
        
        # If no outputs found, assume single output
        if not outputs:
            outputs = [{"name": "output", "type": "Any"}]
        
        return outputs
    
    def _extract_type_annotation(self, annotation_node) -> str:
        """Extract type annotation as string"""
        
        if isinstance(annotation_node, ast.Name):
            return annotation_node.id
        elif isinstance(annotation_node, ast.Constant):
            return str(annotation_node.value)
        elif isinstance(annotation_node, ast.Subscript):
            # Handle Generic types like List[int], Optional[str], Literal["a","b"]
            base = self._extract_type_annotation(annotation_node.value)
            
            # Special handling for Literal
            if base == "Literal":
                if isinstance(annotation_node.slice, ast.Tuple):
                    values = []
                    for elt in annotation_node.slice.elts:
                        if isinstance(elt, ast.Constant):
                            values.append(elt.value)
                    return f"Literal{values}"
                elif isinstance(annotation_node.slice, ast.Constant):
                    return f"Literal[{annotation_node.slice.value}]"
            
            # Handle other generic types
            if isinstance(annotation_node.slice, ast.Name):
                return f"{base}[{annotation_node.slice.id}]"
            elif isinstance(annotation_node.slice, ast.Constant):
                return f"{base}[{annotation_node.slice.value}]"
            else:
                return base
        else:
            return "Any"
    
    def _extract_default_value(self, default_node):
        """Extract default value from AST node"""
        
        if isinstance(default_node, ast.Constant):
            return default_node.value
        elif isinstance(default_node, ast.Name):
            # Handle True, False, None
            if default_node.id in ["True", "False", "None"]:
                return {"True": True, "False": False, "None": None}[default_node.id]
            return default_node.id
        elif isinstance(default_node, ast.UnaryOp) and isinstance(default_node.op, ast.USub):
            # Handle negative numbers
            if isinstance(default_node.operand, ast.Constant):
                return -default_node.operand.value
        elif isinstance(default_node, ast.List):
            return []
        elif isinstance(default_node, ast.Dict):
            return {}
        elif isinstance(default_node, ast.Tuple):
            return ()
        
        return None