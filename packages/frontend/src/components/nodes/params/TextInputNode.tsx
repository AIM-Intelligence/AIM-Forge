import { useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";
import { useNodeData } from "../../../hooks/useNodeData";

export type TextInputNodeType = Node<{
  title: string;
  description: string;
  projectTitle?: string;
  file?: string;
}>;

interface TextInputData {
  value: string;
  dimensions: { width: number; height: number };
}

export default function TextInputNode(props: NodeProps<TextInputNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);

  // Use unified data management hook
  const { data, setData } = useNodeData<TextInputData>({
    projectId,
    nodeId: props.id,
    storageKey: 'textInput_data',
    defaultValue: {
      value: '',
      dimensions: { width: 300, height: 150 }
    },
    serverData: props.data,
    debounceMs: 500,
  });

  // Initialize execution store value
  useEffect(() => {
    setNodeResult(props.id, data.value);
  }, [props.id, data.value, setNodeResult]);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setData(prev => ({ ...prev, value: newText }));
    // Store in execution store for flow execution
    setNodeResult(props.id, newText);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear from execution store
    setNodeResult(props.id, null);
    
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
    const startWidth = data.dimensions.width;
    const startHeight = data.dimensions.height;

    let finalWidth = startWidth;
    let finalHeight = startHeight;

    const handleMouseMove = (e: MouseEvent) => {
      finalWidth = Math.min(900, Math.max(50, startWidth + e.clientX - startX));
      finalHeight = Math.min(600, Math.max(50, startHeight + e.clientY - startY));
      
      setData(prev => ({ ...prev, dimensions: { width: finalWidth, height: finalHeight } }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
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
          width: `${data.dimensions.width}px`,
          height: `${data.dimensions.height}px`,
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
            value={data.value}
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