import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useExecutionStore } from "../../../stores/executionStore";
import { useNodeValueStore } from "../../../stores/nodeValueStore";
import { projectApi } from "../../../utils/api";

// Define ExecutionResult interface
interface ExecutionResult {
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  execution_time_ms?: number;
  logs?: string;
  display_metadata?: {
    display: unknown;
    full_ref?: string;
    is_truncated?: boolean;
    raw_value?: unknown;
  };
}

export type ResultNodeType = Node<{
  title: string;
  description: string;
  projectTitle?: string;
  dimensions?: {
    width: number;
    height: number;
  };
}>;

export default function ResultNode(props: NodeProps<ResultNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
  const [isResizing, setIsResizing] = useState(false);
  const [userText, setUserText] = useState<string>("");
  const nodeRef = useRef<HTMLDivElement>(null);
  const didInitCache = useRef(false);
  const { projectId } = useParams<{ projectId: string }>();
  
  // Storage keys
  const storageKey = useMemo(
    () => projectId ? `result_${projectId}_${props.id}` : null,
    [projectId, props.id]
  );
  const dimensionsKey = useMemo(
    () => projectId ? `result_dimensions_${projectId}_${props.id}` : null,
    [projectId, props.id]
  );

  // ✅ Subscribe to only this node's execution result with shallow comparison
  const nodeExecutionResult = useExecutionStore(
    state => state.executionResults[props.id]
  ) as ExecutionResult | undefined;
  const executingNodes = useExecutionStore(state => state.executingNodes);
  const isMyPipelineExecuting = executingNodes.has(props.id);
  const runId = useExecutionStore(state => state.runId);
  
  console.log(`[ResultNode ${props.id}] Render - isMyPipelineExecuting:`, isMyPipelineExecuting, 'executingNodes:', Array.from(executingNodes), 'userText length:', userText.length, 'nodeExecutionResult:', nodeExecutionResult);
  
  // Node value store for persistence
  const { setNodeValue, clearNodeValue } = useNodeValueStore();

  // Safe preview formatter with length limit and circular reference handling
  const formatPreview = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "";
    
    try {
      if (typeof value === "string") return value;
      
      // Handle circular references
      const seen = new WeakSet();
      const json = JSON.stringify(
        value,
        (_, v) => {
          if (typeof v === "object" && v !== null) {
            if (seen.has(v)) return "[Circular]";
            seen.add(v);
          }
          return v;
        },
        2
      );
      
      // Apply length limit
      const MAX_LENGTH = 20000;
      return json.length > MAX_LENGTH 
        ? json.slice(0, MAX_LENGTH) + "\n...[truncated]" 
        : json;
    } catch (error) {
      // Fallback to string conversion
      return String(value);
    }
  }, []);

  // ✅ Load dimensions on mount
  useEffect(() => {
    if (!dimensionsKey) return;
    
    const savedDimensions = localStorage.getItem(dimensionsKey);
    if (savedDimensions) {
      try {
        const parsed = JSON.parse(savedDimensions);
        setDimensions(parsed);
      } catch (e) {
        console.error("Failed to parse saved dimensions:", e);
      }
    } else if (props.data?.dimensions) {
      setDimensions(props.data.dimensions);
      localStorage.setItem(dimensionsKey, JSON.stringify(props.data.dimensions));
    }
  }, [dimensionsKey, props.data?.dimensions]);

  // ✅ Load cache ONLY ONCE on mount (if no execution result exists)
  useEffect(() => {
    if (didInitCache.current || !storageKey) return;
    didInitCache.current = true;
    
    // Only load cache if there's no execution result yet
    if (nodeExecutionResult == null) {
      const cached = localStorage.getItem(storageKey);
      console.log(`[ResultNode ${props.id}] Loading from localStorage:`, cached ? 'Found cached value' : 'No cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const preview = formatPreview(parsed);
          setUserText(preview);
          console.log(`[ResultNode ${props.id}] Set initial text from cache`);
        } catch {
          // If parsing fails, use as-is
          setUserText(cached);
          console.log(`[ResultNode ${props.id}] Set initial text from cache (raw)`);
        }
      }
    }
  }, [storageKey, nodeExecutionResult, formatPreview]);
  
  // ✅ Clear display when this node's result is cleared (output nodes)
  useEffect(() => {
    console.log(`[ResultNode ${props.id}] Clear check - isMyPipelineExecuting:`, isMyPipelineExecuting, 'nodeExecutionResult:', nodeExecutionResult, 'current userText length:', userText.length);
    
    // If this node is executing and has no result (was cleared), clear the display
    // This happens when StartNode clears output Result nodes but preserves input Result nodes
    if (isMyPipelineExecuting && nodeExecutionResult === undefined && userText.length > 0) {
      console.log(`[ResultNode ${props.id}] CLEARING display - output node in executing pipeline`);
      setUserText("");
    }
  }, [isMyPipelineExecuting, nodeExecutionResult]);

  // ✅ Update when real-time execution result arrives
  useEffect(() => {
    console.log(`[ResultNode ${props.id}] Execution result changed:`, nodeExecutionResult);
    if (!nodeExecutionResult) return;
    
    // Extract the actual value from execution result
    let actualValue = nodeExecutionResult.output;
    let displayValue = actualValue;
    
    // Check for display metadata (backend truncation)
    if (nodeExecutionResult.display_metadata) {
      const metadata = nodeExecutionResult.display_metadata;
      displayValue = metadata.display;
      actualValue = nodeExecutionResult.output;
      
      // Store metadata for download functionality
      (nodeRef.current as any)._fullDataRef = metadata.full_ref;
      (nodeRef.current as any)._rawValue = metadata.raw_value || actualValue;
      (nodeRef.current as any)._isTruncated = metadata.is_truncated;
    } else {
      // No metadata, use direct value
      (nodeRef.current as any)._fullDataRef = null;
      (nodeRef.current as any)._rawValue = actualValue;
      (nodeRef.current as any)._isTruncated = false;
    }
    
    // Format and display
    const preview = formatPreview(displayValue);
    setUserText(preview);
    
    // Update node value store for data flow
    setNodeValue(props.id, actualValue);
    
    // Save to localStorage for next session
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(actualValue));
      } catch {
        // Storage quota exceeded or other errors - ignore
      }
    }
  }, [nodeExecutionResult, formatPreview, setNodeValue, props.id, storageKey]);

  // Handle node deletion
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear localStorage
    if (storageKey) localStorage.removeItem(storageKey);
    if (dimensionsKey) localStorage.removeItem(dimensionsKey);
    
    // Clear from nodeValueStore
    clearNodeValue(props.id);
    
    // Dispatch delete event
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  // Handle result download
  const handleGetResult = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const isTruncated = (nodeRef.current as any)?._isTruncated;
    const fullDataRef = (nodeRef.current as any)?._fullDataRef;
    const rawValue = (nodeRef.current as any)?._rawValue;
    
    let fullData = userText || "";
    
    // If truncated and has reference, fetch full data from backend
    if (isTruncated && fullDataRef && projectId) {
      try {
        const response = await fetch(`/api/project/${projectId}/node/${props.id}/full-result`);
        const result = await response.json();
        
        if (result.success) {
          fullData = formatPreview(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch full data:", error);
      }
    } else if (rawValue !== undefined && rawValue !== null) {
      fullData = formatPreview(rawValue);
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

  // Sync dimensions with backend
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

  // Handle resize
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
      
      // Save final dimensions
      if (dimensionsKey) {
        localStorage.setItem(dimensionsKey, JSON.stringify({ width: finalWidth, height: finalHeight }));
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
          {/* Delete button */}
          {hovering && (
            <button
              onClick={handleDelete}
              className="absolute top-2 right-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
            >
              ✕
            </button>
          )}

          {/* Read-only text area */}
          <textarea
            className="flex-1 p-3 bg-transparent text-sm text-green-400 font-mono resize-none outline-none nowheel cursor-default"
            value={userText}
            readOnly
            placeholder={isMyPipelineExecuting ? "Executing..." : "Run the flow to see results..."}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          />

          {/* Download button */}
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