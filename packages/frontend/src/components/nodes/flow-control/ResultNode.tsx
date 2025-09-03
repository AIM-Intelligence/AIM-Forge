import { useState, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";

export type ResultNodeType = Node<{
  title: string;
  description: string;
  projectTitle?: string;
}>;

export default function ResultNode(props: NodeProps<ResultNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
  const [isResizing, setIsResizing] = useState(false);
  const [userText, setUserText] = useState<string>("");
  const nodeRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const getNodeResult = useExecutionStore((state) => state.getNodeResult);
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  const runId = useExecutionStore((state) => state.runId);
  const executionResults = useExecutionStore((state) => state.executionResults);

  // Load saved dimensions from localStorage on mount
  useEffect(() => {
    if (projectId) {
      const dimensionsKey = `result_dimensions_${projectId}_${props.id}`;
      const savedDimensions = localStorage.getItem(dimensionsKey);
      if (savedDimensions) {
        try {
          const parsed = JSON.parse(savedDimensions);
          setDimensions(parsed);
        } catch (e) {
          console.error("Failed to parse saved dimensions:", e);
        }
      }
    }
  }, [projectId, props.id]);

  // Update text when execution results change
  useEffect(() => {
    const result = getNodeResult(props.id);
    if (result !== null && result !== undefined) {
      // Check if result has the new format with display and full_ref
      let displayValue = result;
      
      if (typeof result === "object" && result !== null && "display" in result) {
        // New format with separate display and full data
        displayValue = result.display;
        // Store the full reference for download
        (nodeRef.current as any)._fullDataRef = result.full_ref;
        (nodeRef.current as any)._rawValue = result.raw_value;
        (nodeRef.current as any)._isTruncated = result.is_truncated;
      } else {
        // Old format or direct value
        (nodeRef.current as any)._fullDataRef = null;
        (nodeRef.current as any)._rawValue = result;
        (nodeRef.current as any)._isTruncated = false;
      }

      // Format result for display
      let preview = "";
      if (typeof displayValue === "object" && displayValue !== null) {
        preview = JSON.stringify(displayValue, null, 2);
      } else {
        preview = String(displayValue);
      }
      // Already truncated by backend if needed
      setUserText(preview);
    }
  }, [executionResults, props.id, getNodeResult]);

  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setUserText(newText);
    // Store the text as the node's result so it can be passed to next nodes
    setNodeResult(props.id, newText);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear localStorage dimensions when deleting
    if (projectId) {
      const dimensionsKey = `result_dimensions_${projectId}_${props.id}`;
      localStorage.removeItem(dimensionsKey);
    }
    // 부모 컴포넌트에서 처리하도록 이벤트 전달
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  const handleGetResult = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if we have truncated data and need to fetch full data
    const isTruncated = (nodeRef.current as any)?._isTruncated;
    const fullDataRef = (nodeRef.current as any)?._fullDataRef;
    const rawValue = (nodeRef.current as any)?._rawValue;
    
    let fullData = userText || "";
    
    // If truncated and has reference, fetch full data from backend
    if (isTruncated && fullDataRef) {
      try {
        const response = await fetch(`/api/project/${projectId}/node/${props.id}/full-result`);
        const result = await response.json();
        
        if (result.success) {
          // Format the full data
          if (typeof result.data === "object") {
            fullData = JSON.stringify(result.data, null, 2);
          } else {
            fullData = String(result.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch full data:", error);
        // Fall back to displayed text
      }
    } else if (rawValue !== undefined && rawValue !== null) {
      // Use raw value if available
      if (typeof rawValue === "object") {
        fullData = JSON.stringify(rawValue, null, 2);
      } else {
        fullData = String(rawValue);
      }
    }

    if (!fullData) {
      alert("No content to download.");
      return;
    }

    // Create JSON content with metadata
    const resultData = {
      node_id: props.id,
      node_title: props.data.title,
      project_title: props.data.projectTitle,
      run_id: runId,
      timestamp: new Date().toISOString(),
      is_truncated_display: isTruncated,
      result: fullData,
    };

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(resultData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `result_${props.id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        const dimensionsKey = `result_dimensions_${projectId}_${props.id}`;
        localStorage.setItem(dimensionsKey, JSON.stringify({ width: finalWidth, height: finalHeight }));
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
          "bg-neutral-900 rounded-lg border border-neutral-600 relative",
          "select-none",
          hovering && !isResizing && "border-neutral-400",
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
          {/* 삭제 버튼 */}
          {hovering && (
            <button
              onClick={handleDelete}
              className="absolute top-2 right-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
            >
              ✕
            </button>
          )}

          {/* Editable text area - takes most of the space */}
          <textarea
            className="flex-1 p-3 bg-transparent text-sm text-green-400 font-mono resize-none outline-none nowheel"
            value={userText}
            onChange={handleTextChange}
            placeholder="Type here or run the flow to see results..."
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          />

          {/* Download button - small and at the bottom */}
          {userText && (
            <div className="border-t border-neutral-700 p-2">
              <button
                className="text-xs px-2 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded transition-colors w-full"
                onClick={handleGetResult}
              >
                Download
              </button>
            </div>
          )}
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
              <circle cx="12" cy="12" r="1" fill="#737373"/>
              <circle cx="8" cy="12" r="1" fill="#737373"/>
              <circle cx="12" cy="8" r="1" fill="#737373"/>
            </svg>
          </div>
          {/* Invisible larger hit area */}
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-transparent pointer-events-none" />
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3"
          style={{
            left: -8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        
        {/* Output handle for passing data to next component */}
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3"
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
