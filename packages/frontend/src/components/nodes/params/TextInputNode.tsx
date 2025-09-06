import { useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";
import { useNodeValueStore } from "../../../stores/nodeValueStore";
import { projectApi } from "../../../utils/api";

export type TextInputNodeType = Node<{
  title: string;
  description: string;
  projectTitle?: string;
  value?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  componentType?: string;
}>;

export default function TextInputNode(props: NodeProps<TextInputNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 300, height: 150 });
  const [isResizing, setIsResizing] = useState(false);
  const [userText, setUserText] = useState<string>("");
  const nodeRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  const { setNodeValue, getNodeValue } = useNodeValueStore();
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load saved dimensions from localStorage on mount
  useEffect(() => {
    if (projectId) {
      const dimensionsKey = `textInput_dimensions_${projectId}_${props.id}`;
      const savedDimensions = localStorage.getItem(dimensionsKey);
      if (savedDimensions) {
        try {
          const parsed = JSON.parse(savedDimensions);
          setDimensions(parsed);
        } catch (e) {
          console.error("Failed to parse saved dimensions:", e);
        }
      } else if (props.data?.dimensions) {
        // Use backend dimensions if no localStorage value
        setDimensions(props.data.dimensions);
        // Save to localStorage for consistency
        localStorage.setItem(dimensionsKey, JSON.stringify(props.data.dimensions));
      }
    }
  }, [projectId, props.id, props.data?.dimensions]);

  // Load saved value from localStorage on mount and when id changes
  useEffect(() => {
    if (projectId) {
      const storageKey = `textInput_${projectId}_${props.id}`;
      const savedValue = localStorage.getItem(storageKey);
      if (savedValue) {
        setUserText(savedValue);
        // Set in both stores for availability
        setNodeResult(props.id, savedValue);
        setNodeValue(props.id, savedValue);
      } else if (props.data?.value) {
        // Use backend value if no localStorage value
        setUserText(props.data.value);
        setNodeResult(props.id, props.data.value);
        setNodeValue(props.id, props.data.value);
        // Save to localStorage for consistency
        localStorage.setItem(storageKey, props.data.value);
      } else {
        // Even if no saved value, initialize with empty string
        setNodeResult(props.id, "");
        setNodeValue(props.id, "");
      }
    }
  }, [projectId, props.id, props.data?.value, setNodeResult]);

  // Sync data with backend (debounced)
  const syncWithBackend = useCallback(async (data: Record<string, unknown>) => {
    if (!projectId) return;
    
    try {
      await projectApi.updateNodeData({
        project_id: projectId,
        node_id: props.id,
        data: data
      });
    } catch (error) {
      console.error("Failed to sync with backend:", error);
    }
  }, [projectId, props.id]);

  // Handle text change and save to localStorage
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setUserText(newText);
    
    // Save to localStorage for persistence
    if (projectId) {
      const storageKey = `textInput_${projectId}_${props.id}`;
      localStorage.setItem(storageKey, newText);
    }
    
    // Store in both stores for flow execution
    setNodeResult(props.id, newText);
    setNodeValue(props.id, newText);

    // Debounced backend sync (500ms delay)
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    const timeout = setTimeout(() => {
      syncWithBackend({ value: newText });
    }, 500);
    setSaveTimeout(timeout);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear localStorage and nodeValueStore when deleting
    if (projectId) {
      const storageKey = `textInput_${projectId}_${props.id}`;
      localStorage.removeItem(storageKey);
      const dimensionsKey = `textInput_dimensions_${projectId}_${props.id}`;
      localStorage.removeItem(dimensionsKey);
    }
    // Clear from nodeValueStore
    useNodeValueStore.getState().clearNodeValue(props.id);
    
    // Dispatch delete event
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    let finalWidth = startWidth;
    let finalHeight = startHeight;

    const handleMouseMove = (e: MouseEvent) => {
      finalWidth = Math.min(900, Math.max(50, startWidth + e.clientX - startX));
      finalHeight = Math.min(600, Math.max(50, startHeight + e.clientY - startY));
      
      setDimensions({ width: finalWidth, height: finalHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      
      // Save final dimensions to localStorage
      if (projectId) {
        const dimensionsKey = `textInput_dimensions_${projectId}_${props.id}`;
        localStorage.setItem(dimensionsKey, JSON.stringify({ width: finalWidth, height: finalHeight }));
        
        // Also sync dimensions with backend
        syncWithBackend({ dimensions: { width: finalWidth, height: finalHeight } });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'nwse-resize';
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={clsx(
          "bg-neutral-900 rounded-lg border border-blue-600 relative",
          "select-none",
          hovering && !isResizing && "border-blue-400",
          isResizing && "shadow-xl border-blue-500"
        )}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Inner container with overflow control */}
        <div className="flex flex-col h-full overflow-hidden rounded-lg">
          {/* Delete button */}
          {hovering && (
            <button
              onClick={handleDelete}
              className="absolute top-2 right-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
            >
              ✕
            </button>
          )}

          {/* Editable text area - takes full space */}
          <textarea
            className="flex-1 p-3 bg-transparent text-sm text-blue-300 font-mono resize-none outline-none nowheel"
            value={userText}
            onChange={handleTextChange}
            placeholder="Enter text value..."
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResize}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'nwse-resize';
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            if (!isResizing) {
              document.body.style.cursor = '';
            }
          }}
          className="nodrag absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group z-20"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="absolute bottom-0 right-0 w-full h-full pointer-events-none">
            {/* Three dots pattern for better visibility */}
            <svg 
              className="w-full h-full" 
              viewBox="0 0 16 16"
              style={{ opacity: hovering || isResizing ? 1 : 0.5 }}
            >
              <circle cx="12" cy="12" r="1" fill="#3B82F6"/>
              <circle cx="8" cy="12" r="1" fill="#3B82F6"/>
              <circle cx="12" cy="8" r="1" fill="#3B82F6"/>
            </svg>
          </div>
          {/* Invisible larger hit area */}
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-transparent pointer-events-none" />
        </div>

        {/* Output handle only */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500"
          style={{
            right: -8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    </>
  );
}