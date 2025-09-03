# Component Development Guide

This guide explains how to create new components for AIM-Forge. Components are the building blocks of your visual flow system.

## Table of Contents
- [Component Types](#component-types)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
- [Component Categories](#component-categories)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Component Types

There are two types of components you can create:

1. **Simple Components** - Use the default UI (DefaultNode)
   - Only need a backend Python template
   - Good for basic data processing

2. **Custom UI Components** - Have their own React component
   - Need both frontend component and backend template
   - Good for special UI requirements (like TextInput, Result nodes)

## Quick Start

### Creating a Simple Component (Default UI)

For a component that doesn't need special UI:

```bash
# 1. Create backend template
touch packages/backend/templates/{category}/{component_name}.py

# 2. Add to frontend index
# Edit: packages/frontend/src/components/nodes/{category}/index.ts
```

### Creating a Custom UI Component

For a component with special UI needs:

```bash
# 1. Create frontend component
touch packages/frontend/src/components/nodes/{category}/MyComponent.tsx

# 2. Create backend template
touch packages/backend/templates/{category}/my_component.py

# 3. Register in category index
# Edit: packages/frontend/src/components/nodes/{category}/index.ts
```

## Step-by-Step Guide

### Step 1: Choose Your Category

Decide which category your component belongs to:

- `flow-control` - Flow execution control (Start, Result, etc.)
- `params` - User input parameters (TextInput, NumberInput, etc.)
- `inputs` - Data input/loading (CSVLoader, JSONLoader, etc.)
- `dataops` - Data operations (Parser, Filter, Transform, etc.)
- `jailbreak` - AI security testing (Attacks, Prompts, etc.)
- `reports` - Analysis and reporting (Metrics, Visualizations, etc.)

### Step 2: Create Backend Template

All components need a backend Python template. Create a file in:
```
packages/backend/templates/{category}/{component_name}.py
```

#### Template Structure:

```python
"""
Component Name - Brief description
Detailed description of what this component does
"""

from typing import Dict, Any

def RunScript(
    # Input parameters (become input ports)
    param1: str = "default_value",
    param2: int = 0,
    param3: bool = True,
) -> Dict[str, Any]:
    """
    Main execution function for the component.
    
    Parameters:
        param1: Description of param1
        param2: Description of param2
        param3: Description of param3
        
    Returns:
        Dictionary with output values (keys become output ports)
    """
    
    # Your component logic here
    result = process_data(param1, param2, param3)
    
    # Return outputs as dictionary
    return {
        "output1": result,
        "output2": "another_value",
        "status": "success"
    }
```

**Important Notes:**
- Function MUST be named `RunScript`
- Parameters become input ports (handles on the left)
- Return dictionary keys become output ports (handles on the right)
- Use type hints for better port generation
- Provide default values for optional parameters

### Step 3A: For Simple Components (Using DefaultNode)

If your component only needs code editing UI, skip to Step 4.

### Step 3B: For Custom UI Components

Create a React component in:
```
packages/frontend/src/components/nodes/{category}/MyComponent.tsx
```

#### Component Template:

```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";

// Define your node type
export type MyComponentNodeType = Node<{
  title: string;
  description: string;
  componentType?: string;
}>;

export default function MyComponentNode(props: NodeProps<MyComponentNodeType>) {
  const [hovering, setHovering] = useState(false);
  const { projectId } = useParams<{ projectId: string }>();
  
  // For components that need to store values
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  
  // Your component logic here
  
  return (
    <div
      className={clsx(
        "bg-neutral-800 rounded-lg border-2 transition-colors",
        hovering ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-neutral-600"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Input handles - one for each parameter in RunScript */}
      <Handle
        type="target"
        position={Position.Left}
        id="param1"  // Must match parameter name
        style={{ top: "50%" }}
        className="w-3 h-3 bg-blue-500 border-2 border-neutral-900"
      />
      
      {/* Your UI here */}
      <div className="p-4">
        <h3 className="text-white text-sm font-medium">{props.data?.title}</h3>
        {/* Add your custom UI elements */}
      </div>
      
      {/* Output handles - one for each key in return dictionary */}
      <Handle
        type="source"
        position={Position.Right}
        id="output1"  // Must match return key
        style={{ top: "50%" }}
        className="w-3 h-3 bg-green-500 border-2 border-neutral-900"
      />
      
      {/* Delete button */}
      {hovering && props.data?.viewCode && (
        <button
          onClick={props.data.viewCode}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

### Step 4: Register Component in Category Index

Edit the index file for your category:
```
packages/frontend/src/components/nodes/{category}/index.ts
```

#### For Simple Components (DefaultNode):

```typescript
export const {category}Components = [
  // ... existing components
  {
    id: "my-component",
    name: "My Component",
    description: "What this component does",
    icon: "🎯",  // Choose an emoji icon
    template: "{category}/my_component",  // Path to Python template
    nodeType: "custom",
    // No component property needed - uses DefaultNode
  },
];
```

#### For Custom UI Components:

```typescript
// Import your component
import MyComponentNode from './MyComponentNode';

// Export it
export { MyComponentNode };

// Add to metadata
export const {category}Components = [
  // ... existing components
  {
    id: "my-component",
    name: "My Component",
    description: "What this component does",
    icon: "🎯",
    template: "{category}/my_component",
    nodeType: "custom",
    componentType: "MyComponent",  // This triggers custom rendering
    component: MyComponentNode,     // Reference to React component
  },
];
```

### Step 5: Register in ComponentRegistry (Custom UI Only)

If you created a custom UI component, register it in:
```
packages/frontend/src/components/nodes/ComponentRegistry.tsx
```

```typescript
export const componentRegistry: ComponentRegistry = {
  // ... existing components
  'MyComponent': MyComponentNode,
};
```

### Step 6: Test Your Component

1. Restart the dev server:
   ```bash
   pnpm dev
   ```

2. Open the UI and look for your component in the component library panel

3. Drag it to the canvas and test:
   - Input/output ports appear correctly
   - Can connect to other nodes
   - Executes when flow runs

## Component Categories

### Flow Control (`flow-control`)
Core components for controlling execution flow:
- Start Node - Entry point for execution
- Result Node - Display results with pass-through
- Custom Node - Generic Python code node
- Loop Node - Iteration control (future)
- Conditional Node - Branching logic (future)

### Parameters (`params`)
User input and configuration:
- TextInput - Persistent text storage
- NumberInput - Numeric values (future)
- BooleanInput - True/false toggles (future)
- SelectInput - Dropdown selection (future)
- SliderInput - Range selection (future)

### Inputs (`inputs`)
Data loading and acquisition:
- CSVLoader - Load CSV files
- JSONLoader - Load JSON files (future)
- ExcelLoader - Load Excel files (future)
- DatabaseConnector - SQL queries (future)
- APIFetcher - HTTP requests (future)

### Data Operations (`dataops`)
Data transformation and processing:
- JSONParser - Parse JSON strings (future)
- DataFilter - Filter arrays/objects (future)
- DataMapper - Transform data (future)
- DataAggregator - Aggregate statistics (future)

### Jailbreak (`jailbreak`)
AI security testing:
- AIMStinger - Multi-turn attacks
- GCGAttack - Gradient-based attacks
- PromptInjection - Injection attacks (future)
- AdversarialSuffix - Suffix attacks (future)

### Reports (`reports`)
Analysis and visualization:
- ASRMeasurement - Attack success rate
- ReportGenerator - PDF/HTML reports (future)
- DataVisualizer - Charts/graphs (future)
- MetricsDashboard - KPI display (future)

## Examples

### Example 1: Simple CSV Parser Component

**Backend** (`packages/backend/templates/dataops/csv_parser.py`):
```python
"""
CSV Parser - Parse CSV string into structured data
"""

from typing import Dict, Any, List
import csv
import io

def RunScript(
    csv_string: str = "",
    has_header: bool = True,
    delimiter: str = ",",
) -> Dict[str, Any]:
    """
    Parse CSV string into list of dictionaries.
    
    Parameters:
        csv_string: Raw CSV text
        has_header: Whether first row contains headers
        delimiter: Column separator
        
    Returns:
        Parsed data and metadata
    """
    if not csv_string:
        return {
            "data": [],
            "row_count": 0,
            "column_count": 0,
            "error": "No input provided"
        }
    
    try:
        reader = csv.DictReader(
            io.StringIO(csv_string),
            delimiter=delimiter
        ) if has_header else csv.reader(
            io.StringIO(csv_string),
            delimiter=delimiter
        )
        
        data = list(reader)
        
        return {
            "data": data,
            "row_count": len(data),
            "column_count": len(data[0]) if data else 0,
            "error": None
        }
    except Exception as e:
        return {
            "data": [],
            "row_count": 0,
            "column_count": 0,
            "error": str(e)
        }
```

**Frontend Registration** (`packages/frontend/src/components/nodes/dataops/index.ts`):
```typescript
export const dataopsComponents = [
  {
    id: "csv-parser",
    name: "CSV Parser",
    description: "Parse CSV string into structured data",
    icon: "📄",
    template: "dataops/csv_parser",
    nodeType: "custom",
  },
];
```

### Example 2: Number Input Component with Custom UI

**Backend** (`packages/backend/templates/params/number_input.py`):
```python
"""
Number Input - Store numeric values
"""

from typing import Dict, Any

def RunScript(stored_value: float = 0.0) -> float:
    """
    Pass through the stored numeric value.
    
    Parameters:
        stored_value: Number stored by user (managed by frontend)
        
    Returns:
        The numeric value
    """
    return stored_value
```

**Frontend** (`packages/frontend/src/components/nodes/params/NumberInputNode.tsx`):
```tsx
import { useState, useEffect } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";

export type NumberInputNodeType = Node<{
  title: string;
  description: string;
  componentType?: string;
}>;

export default function NumberInputNode(props: NodeProps<NumberInputNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [value, setValue] = useState<number>(0);
  const { projectId } = useParams<{ projectId: string }>();
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);

  // Load from localStorage
  useEffect(() => {
    if (projectId) {
      const storageKey = `numberInput_${projectId}_${props.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const num = parseFloat(saved);
        setValue(num);
        setNodeResult(props.id, num);
      }
    }
  }, [projectId, props.id, setNodeResult]);

  const handleChange = (newValue: number) => {
    setValue(newValue);
    setNodeResult(props.id, newValue);
    if (projectId) {
      const storageKey = `numberInput_${projectId}_${props.id}`;
      localStorage.setItem(storageKey, newValue.toString());
    }
  };

  return (
    <div
      className={clsx(
        "bg-neutral-800 rounded-lg border-2 transition-colors p-4 min-w-[200px]",
        hovering ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-neutral-600"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="text-white text-sm font-medium mb-2">
        {props.data?.title || "Number Input"}
      </div>
      
      <input
        type="number"
        value={value}
        onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-neutral-700 text-white px-2 py-1 rounded"
        placeholder="Enter number..."
      />
      
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-neutral-900"
      />
      
      {/* Delete button */}
      {hovering && props.data?.viewCode && (
        <button
          onClick={props.data.viewCode}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

**Registration**:
```typescript
// In params/index.ts
import NumberInputNode from './NumberInputNode';

export { TextInputNode, NumberInputNode };

export const paramsComponents = [
  // ... existing
  {
    id: "number-input",
    name: "Number Input",
    description: "Store and input numeric values",
    icon: "🔢",
    template: "params/number_input",
    nodeType: "custom",
    componentType: "NumberInput",
    component: NumberInputNode,
  },
];

// In ComponentRegistry.tsx
export const componentRegistry: ComponentRegistry = {
  'TextInput': TextInputNode,
  'NumberInput': NumberInputNode,  // Add this line
};
```

## Best Practices

### 1. Naming Conventions
- **File names**: Use snake_case for Python (`my_component.py`), PascalCase for React (`MyComponent.tsx`)
- **Component IDs**: Use kebab-case (`my-component`)
- **Component types**: Use PascalCase (`MyComponent`)
- **Template paths**: Use category/filename (`params/my_component`)

### 2. Input/Output Ports
- **Keep port names simple**: Use clear, descriptive names
- **Match exactly**: Port IDs must match parameter names and return keys
- **Document types**: Use type hints in Python for clarity
- **Provide defaults**: Always provide sensible default values

### 3. Error Handling
```python
def RunScript(data: str = "") -> Dict[str, Any]:
    try:
        result = process_data(data)
        return {
            "success": True,
            "result": result,
            "error": None
        }
    except Exception as e:
        return {
            "success": False,
            "result": None,
            "error": str(e)
        }
```

### 4. Performance
- **Avoid blocking operations**: Use async operations for long tasks
- **Limit data size**: Use object references for large data (>10KB)
- **Cache when possible**: Store computed values to avoid recalculation

### 5. UI Guidelines
- **Consistent styling**: Follow existing color schemes and spacing
- **Hover states**: Add hover effects for better UX
- **Responsive design**: Ensure components work at different sizes
- **Dark theme**: All components should use dark theme colors

## Troubleshooting

### Component doesn't appear in library
1. Check that you added it to the category index.ts
2. Verify the template file exists in the correct location
3. Restart the dev server

### Ports don't show up
1. Ensure RunScript function has proper type hints
2. Check that parameter names match handle IDs
3. Verify return dictionary keys match output handle IDs

### Custom UI not rendering
1. Check componentType is set in the metadata
2. Verify component is registered in ComponentRegistry.tsx
3. Ensure component is exported from category index.ts

### Execution errors
1. Check Python syntax in template file
2. Verify all required imports are included
3. Test with simple inputs first
4. Check browser console for error messages

### TypeScript errors
1. Ensure all imports use correct relative paths
2. Check that types are properly defined
3. Verify component props match NodeProps type

## Advanced Topics

### Using Object Store for Large Data

For data larger than 10KB, use the object store:

```python
def RunScript(large_data: Any = None) -> Dict[str, Any]:
    # Process large data
    if hasattr(large_data, '__ref__'):
        # Data is a reference, will be handled by executor
        pass
    
    result = process_large_data(large_data)
    
    # Return reference for large results
    return {
        "result": result,  # Automatically converted to reference if >10KB
        "size": len(str(result))
    }
```

### Dynamic Ports

To create components with dynamic ports based on configuration:

```python
def RunScript(**kwargs) -> Dict[str, Any]:
    """
    Accept any number of inputs dynamically.
    """
    results = {}
    for key, value in kwargs.items():
        results[f"output_{key}"] = process(value)
    return results
```

### Accessing Project Context

Components can access project information:

```python
import os

def RunScript() -> Dict[str, Any]:
    project_dir = os.getcwd()  # Project directory
    return {
        "project_path": project_dir,
        "files": os.listdir(project_dir)
    }
```

## Contributing

When contributing components:

1. Follow the naming conventions
2. Add comprehensive documentation
3. Include error handling
4. Test with various inputs
5. Update this guide if adding new categories

## Support

For questions or issues:
- Check existing components for examples
- Review the troubleshooting section
- Ask in the development team chat
- Create an issue in the repository

---

Happy component building! 🚀