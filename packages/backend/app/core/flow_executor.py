"""
Flow Executor Module
Executes node-based Python code flows in isolated environments
"""

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict, deque

from .execute_code import execute_python_code
from . import venv_manager


class FlowExecutor:
    """Execute node-based Python flows with isolation and safety"""

    def __init__(self, projects_root: str):
        self.projects_root = Path(projects_root)

    def _execution_context(self, project_id: str) -> Tuple[str, Dict[str, str], Path]:
        """Return python executable, environment, and project path for execution."""
        project_path = self.projects_root / project_id
        python_path = venv_manager.python_bin(project_path)
        env = venv_manager.execution_env(project_path)
        return str(python_path), env, project_path

    def _load_structure(self, project_id: str) -> Tuple[Dict[str, Dict], List[Dict]]:
        """Load project structure from JSON file"""
        structure_file = self.projects_root / project_id / "structure.json"
        if not structure_file.exists():
            raise FileNotFoundError(f"Project {project_id} not found")

        with open(structure_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Convert nodes list to dict for easier access
        nodes = {node["id"]: node for node in data.get("nodes", [])}
        edges = data.get("edges", [])

        return nodes, edges

    def _find_start_node(self, nodes: Dict[str, Dict]) -> Optional[str]:
        """Find the start node in the project"""
        start_nodes = [
            node_id for node_id, node in nodes.items() if node.get("type") == "start"
        ]

        if len(start_nodes) == 0:
            return None
        elif len(start_nodes) == 1:
            return start_nodes[0]
        else:
            raise ValueError(f"Multiple start nodes found: {start_nodes}")

    def _extract_reachable_subgraph(
        self, start_id: str, nodes: Dict[str, Dict], edges: List[Dict]
    ) -> Tuple[Set[str], Dict[str, List[Tuple[str, Optional[str]]]]]:
        """Extract nodes reachable from start node"""
        # Build adjacency list
        adjacency = defaultdict(list)
        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            param = edge.get("data", {}).get("param") if edge.get("data") else None

            if source in nodes and target in nodes:
                adjacency[source].append((target, param))

        # BFS to find reachable nodes
        reachable = set()
        queue = deque([start_id])

        while queue:
            current = queue.popleft()
            if current in reachable:
                continue
            reachable.add(current)

            for target, _ in adjacency[current]:
                if target not in reachable:
                    queue.append(target)

        return reachable, adjacency

    def _topological_sort(
        self, nodes: Set[str], adjacency: Dict[str, List[Tuple[str, Optional[str]]]]
    ) -> List[str]:
        """Perform topological sort with cycle detection"""
        # Calculate in-degrees
        in_degree = {node: 0 for node in nodes}
        for node in nodes:
            for target, _ in adjacency[node]:
                if target in nodes:
                    in_degree[target] += 1

        # Kahn's algorithm
        queue = deque([node for node in nodes if in_degree[node] == 0])
        sorted_order = []

        while queue:
            current = queue.popleft()
            sorted_order.append(current)

            for target, _ in adjacency[current]:
                if target in nodes:
                    in_degree[target] -= 1
                    if in_degree[target] == 0:
                        queue.append(target)

        # Check for cycles
        if len(sorted_order) != len(nodes):
            raise ValueError("Cycle detected in the flow graph")

        return sorted_order

    def _execute_node_isolated(
        self,
        project_id: str,
        node_id: str,
        node_data: Dict,
        input_data: Any,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """Execute a single node in isolated environment"""
        node_type = node_data.get("type", "custom")

        # Skip execution for start nodes - they don't have code
        if node_type == "start":
            # Start nodes don't execute code, they just initiate the flow
            # They pass None to the next nodes as initial input
            return {
                "status": "success",
                "output": None,  # Start nodes don't produce output
                "execution_time_ms": 0,
                "logs": "Start node - flow initiated",
            }

        # Skip execution for result nodes (they just display data)
        if node_type == "result":
            # Result nodes just pass through the input data as-is
            # The input_data already contains the actual return value from the previous node
            return {
                "status": "success",
                "output": input_data,  # Pass through the actual value without wrapping
                "execution_time_ms": 0,
                "logs": "Result node - displaying input data",
            }

        # Get node file path (only custom nodes have files)
        file_name = node_data.get("data", {}).get("file")
        if not file_name:
            # Generate default file name for custom nodes
            title = node_data.get("data", {}).get("title", f"Node_{node_id}")
            sanitized_title = "".join(
                c if c.isalnum() or c == "_" else "_" for c in title
            )
            file_name = f"{node_id}_{sanitized_title}.py"

        project_path = self.projects_root / project_id
        file_path = project_path / file_name

        if not file_path.exists():
            # Log more details for debugging
            import os

            existing_files = (
                list(project_path.glob("*.py")) if project_path.exists() else []
            )
            file_list = (
                "\n".join([f.name for f in existing_files])
                if existing_files
                else "No Python files found"
            )

            return {
                "status": "error",
                "error": f"Node file '{file_name}' not found in project '{project_id}'",
                "logs": f"Looking for: {file_path}\n\nAvailable files in project:\n{file_list}",
            }

        # Read node code
        with open(file_path, "r", encoding="utf-8") as f:
            node_code = f.read()

        # Create wrapper code
        # Serialize input data first to avoid triple quote issues
        input_json_str = json.dumps(input_data) if input_data is not None else "null"

        wrapper_code = f"""
import json
import sys
import traceback

# Node original code
{node_code}

# Process input data
try:
    input_json = '''{input_json_str}'''
    if input_json != 'null':
        input_data = json.loads(input_json)
    else:
        input_data = None
    
    # Find and execute function
    # Priority: main > first callable function
    result = None
    function_found = False
    
    if 'main' in locals() and callable(main):
        # Check function signature to determine if it accepts arguments
        import inspect
        sig = inspect.signature(main)
        params = list(sig.parameters.keys())
        
        if len(params) == 0 or (input_data is None):
            result = main()
        else:
            result = main(input_data)
        function_found = True
    else:
        # Find first callable function
        for name, obj in list(locals().items()):
            if callable(obj) and not name.startswith('_') and name not in ['json', 'sys', 'traceback', 'inspect']:
                import inspect
                try:
                    sig = inspect.signature(obj)
                    params = list(sig.parameters.keys())
                    
                    if len(params) == 0 or (input_data is None):
                        result = obj()
                    else:
                        result = obj(input_data)
                    function_found = True
                    break
                except:
                    # Fallback for built-in functions or other callables
                    try:
                        if input_data is not None:
                            result = obj(input_data)
                        else:
                            result = obj()
                        function_found = True
                        break
                    except TypeError:
                        result = obj()
                        function_found = True
                        break
    
    if not function_found:
        # List available functions for debugging
        available = [name for name, obj in locals().items() if callable(obj) and not name.startswith('_')]
        raise RuntimeError(f"No callable function found in node. Available: {{available}}")
    
    # Output result
    print(json.dumps({{"success": True, "result": result}}))
    
except Exception as e:
    print(json.dumps({{
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }}))
"""

        # Execute with project-specific virtual environment
        start_time = time.time()
        try:
            python_exe, exec_env, project_path = self._execution_context(project_id)
        except venv_manager.VenvError as exc:
            return {
                "status": "error",
                "error": str(exc),
                "execution_time_ms": 0,
                "logs": "가상환경을 초기화할 수 없습니다.",
            }

        execution_result = execute_python_code(
            wrapper_code,
            timeout,
            python_executable=python_exe,
            working_dir=str(project_path),
            env=exec_env,
        )
        execution_time_ms = round((time.time() - start_time) * 1000)

        # Parse result
        if execution_result["exit_code"] == 0:
            try:
                output = json.loads(execution_result["output"])
                if output.get("success"):
                    return {
                        "status": "success",
                        "output": output.get("result"),
                        "execution_time_ms": execution_time_ms,
                        "logs": execution_result.get("error", ""),
                    }
                else:
                    return {
                        "status": "error",
                        "error": output.get("error", "Unknown error"),
                        "execution_time_ms": execution_time_ms,
                        "logs": output.get("traceback", ""),
                    }
            except json.JSONDecodeError:
                return {
                    "status": "error",
                    "error": "Failed to parse output",
                    "execution_time_ms": execution_time_ms,
                    "logs": execution_result["output"],
                }
        else:
            return {
                "status": "error",
                "error": execution_result.get("error", "Execution failed"),
                "execution_time_ms": execution_time_ms,
                "logs": execution_result.get("output", ""),
            }

    async def execute_flow(
        self,
        project_id: str,
        start_node_id: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
        max_workers: int = 4,
        timeout_sec: int = 30,
        halt_on_error: bool = True,
    ) -> Dict[str, Any]:
        """Execute the complete flow starting from start node"""

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

                # Prepare input data
                input_data = None

                # Collect inputs from edges
                incoming_edges = [
                    (
                        edge["source"],
                        edge.get("data", {}).get("param") if edge.get("data") else None,
                    )
                    for edge in edges
                    if edge["target"] == node_id and edge["source"] in node_outputs
                ]

                if incoming_edges:
                    if len(incoming_edges) == 1:
                        # Single input
                        source, param = incoming_edges[0]
                        input_data = node_outputs[source]
                    else:
                        # Multiple inputs - create dict
                        input_data = {}
                        for source, param in incoming_edges:
                            key = param if param else f"input_{source}"
                            input_data[key] = node_outputs[source]
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
                )

                execution_results[node_id] = result

                # Store output for downstream nodes
                if result["status"] == "success":
                    node_outputs[node_id] = result.get("output")

        # Execute nodes in order with parallelization
        executed = set()

        while len(executed) < len(execution_order):
            # Find nodes ready to execute
            ready_nodes = []
            for node_id in execution_order:
                if node_id in executed:
                    continue

                # Check if all dependencies are executed
                deps_ready = all(dep in executed for dep in dependencies[node_id])

                if deps_ready:
                    ready_nodes.append(node_id)

            if not ready_nodes:
                # No more nodes can be executed
                break

            # Execute ready nodes in parallel
            tasks = [execute_node_async(node_id) for node_id in ready_nodes]
            await asyncio.gather(*tasks)

            # Mark as executed
            executed.update(ready_nodes)

        # Collect result nodes
        result_nodes = {}
        for node_id, node in nodes.items():
            if node_id in reachable_nodes and node.get("type") == "result":
                if node_id in node_outputs:
                    result_nodes[node_id] = node_outputs[node_id]
                else:
                    # Result node might get its value from connected node
                    incoming = [
                        edge["source"]
                        for edge in edges
                        if edge["target"] == node_id and edge["source"] in node_outputs
                    ]
                    if incoming:
                        result_nodes[node_id] = node_outputs[incoming[0]]

        # Calculate total execution time
        total_time = sum(
            result.get("execution_time_ms", 0) for result in execution_results.values()
        )

        return {
            "success": all(
                result["status"] != "error" for result in execution_results.values()
            ),
            "run_id": f"{time.strftime('%Y-%m-%dT%H:%M:%SZ')}-{project_id}",
            "execution_results": execution_results,
            "result_nodes": result_nodes,
            "execution_order": execution_order,
            "total_execution_time_ms": total_time,
        }
