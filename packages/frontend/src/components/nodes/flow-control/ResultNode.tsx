import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
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
  display_metadata?: ResultDisplayMetadata;
}

interface ResultDisplayMetadata {
  display: unknown;
  full_ref?: string | null;
  is_truncated?: boolean;
  raw_value?: unknown;
}

interface StructuredErrorInfo {
  _error?: boolean;
  error?: string;
  error_type?: 'primary' | string;
  logs?: string;
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
  const [isFocused, setIsFocused] = useState(false);
  const [hasScrollbar, setHasScrollbar] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorType, setErrorType] = useState<'primary' | 'skipped' | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const didInitCache = useRef(false);
  const resultMetadataRef = useRef<{ fullDataRef: string | null; rawValue: unknown; isTruncated: boolean }>({
    fullDataRef: null,
    rawValue: undefined,
    isTruncated: false,
  });
  const { projectId } = useParams<{ projectId: string }>();
  const { getZoom } = useReactFlow();
  
  // Storage key for dimensions only
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
    } catch {
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

  // ✅ Initialize text as empty on mount
  useEffect(() => {
    if (didInitCache.current) return;
    didInitCache.current = true;
    
    // Start with empty text - only execution results will populate it
    setUserText("");
  }, []);
  
  // ✅ Clear display when this node's result is cleared (output nodes)
  useEffect(() => {
    // If this node is executing and has no result (was cleared), clear the display
    // This happens when StartNode clears output Result nodes but preserves input Result nodes
    if (isMyPipelineExecuting && nodeExecutionResult === undefined) {
      setUserText("");
      setHasError(false);  // Reset error state for clean execution
      setErrorType(null);  // Clear error type so "Executing..." shows in green
    }
  }, [isMyPipelineExecuting, nodeExecutionResult]);

  // ✅ Reset error colors when execution starts
  useEffect(() => {
    if (isMyPipelineExecuting) {
      setHasError(false);
      setErrorType(null);
    }
  }, [isMyPipelineExecuting]);

  // ✅ Update when real-time execution result arrives
  useEffect(() => {
    if (!nodeExecutionResult) return;
    
    // Check if this is an error result
    if (nodeExecutionResult.status === 'error') {
      // Check error type from backend
      const errorInfo = nodeExecutionResult.output as StructuredErrorInfo | undefined;
      if (errorInfo?._error) {
        if (errorInfo.error_type === 'primary') {
          // Format primary error display with full details
          const errorDisplay = [
            '❌ ERROR',
            '─'.repeat(50),
            '',
            '💡 Error Message:',
            nodeExecutionResult.error || errorInfo.error || 'Unknown error',
            '',
            '📋 Full Traceback:',
            '─'.repeat(50),
            nodeExecutionResult.logs || errorInfo.logs || 'No traceback available',
          ].join('\n');
          // Set all states together to avoid flicker
          setHasError(true);
          setErrorType('primary');
          setUserText(errorDisplay);
        } else {
          // This should not happen with the new logic, but handle just in case
          setHasError(true);
          setErrorType('primary');
          setUserText('Error: ' + (nodeExecutionResult.error || 'Unknown error'));
        }
      } else {
        // Fallback for non-structured errors
        const errorDisplay = [
          '❌ ERROR',
          '─'.repeat(50),
          '',
          '💡 Error Message:',
          nodeExecutionResult.error || 'Unknown error',
          '',
          '📋 Full Traceback:',
          '─'.repeat(50),
          nodeExecutionResult.logs || 'No traceback available',
        ].join('\n');
        // Set all states together
        setHasError(true);
        setErrorType('primary');
        setUserText(errorDisplay);
      }
      
      // Clear stored value on error
      clearNodeValue(props.id);
      return;
    }
    
    // Check if this node was skipped
    if (nodeExecutionResult.status === 'skipped') {
      // Format skipped display
      const skippedDisplay = [
        '⏭️ SKIPPED',
        '─'.repeat(50),
        '',
        nodeExecutionResult.error || 'Execution stopped due to upstream error',
      ].join('\n');
      
      // Set all states together to avoid flicker
      setHasError(true);
      setErrorType('skipped');
      setUserText(skippedDisplay);
      
      // Clear stored value when skipped
      clearNodeValue(props.id);
      return;
    }
    
    // Success case - reset error state
    setHasError(false);
    setErrorType(null);
    
    // Extract the actual value from execution result
    let actualValue = nodeExecutionResult.output;
    let displayValue = actualValue;
    
    // Check for display metadata (backend truncation)
    if (nodeExecutionResult.display_metadata) {
      const metadata = nodeExecutionResult.display_metadata;
      displayValue = metadata.display;
      actualValue = nodeExecutionResult.output;

      // Store metadata for download functionality
      resultMetadataRef.current = {
        fullDataRef: metadata.full_ref ?? null,
        rawValue: metadata.raw_value ?? actualValue,
        isTruncated: Boolean(metadata.is_truncated),
      };
    } else {
      // No metadata, use direct value
      resultMetadataRef.current = {
        fullDataRef: null,
        rawValue: actualValue,
        isTruncated: false,
      };
    }
    
    // Format and display
    const preview = formatPreview(displayValue);
    setUserText(preview);
    
    // Update node value store for data flow
    setNodeValue(props.id, actualValue);
  }, [nodeExecutionResult, formatPreview, setNodeValue, clearNodeValue, props.id]);

  // Monitor scrollbar changes with ResizeObserver
  useEffect(() => {
    if (!textRef.current) return;
    
    const checkScrollbar = () => {
      const el = textRef.current;
      if (el) {
        const newHasScrollbar = el.scrollHeight > el.clientHeight;
        setHasScrollbar(newHasScrollbar);
      }
    };
    
    // Initial check
    checkScrollbar();
    
    // Set up ResizeObserver to monitor changes
    const resizeObserver = new ResizeObserver(checkScrollbar);
    resizeObserver.observe(textRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [userText]); // Re-setup when text changes
  
  // Handle focus for scrolling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocused) {
        setIsFocused(false);
        console.log('Focus deactivated via ESC');
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (isFocused && nodeRef.current && !nodeRef.current.contains(e.target as HTMLElement)) {
        setIsFocused(false);
        console.log('Focus deactivated via outside click');
      }
    };
    
    // Handle global focus events - only one ResultNode can be focused at a time
    const handleGlobalFocus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.nodeId !== props.id && isFocused) {
        setIsFocused(false);
        console.log('Focus deactivated by another ResultNode');
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resultNodeFocus', handleGlobalFocus);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resultNodeFocus', handleGlobalFocus);
    };
  }, [isFocused, props.id]);

  // Handle node deletion
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Clear localStorage for dimensions
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

    const { isTruncated, fullDataRef, rawValue } = resultMetadataRef.current;

    let fullData: unknown = null;
    
    // If truncated and has reference, fetch full data from backend
    if (isTruncated && fullDataRef && projectId) {
      try {
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`;
        const response = await fetch(`${apiUrl}/api/project/${projectId}/node/${props.id}/full-result`);
        const result = await response.json();

        if (result.success) {
          // Use raw data without any formatting to preserve full content
          fullData = result.data;
        }
      } catch (error) {
        console.error("Failed to fetch full data:", error);
      }
    } else if (rawValue !== undefined && rawValue !== null) {
      // Use raw value directly without formatting
      fullData = rawValue;
    }

    // If still no data, try using displayed text as fallback
    if (!fullData && userText) {
      fullData = userText;
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
    // Only handle left click for resize
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;
    const zoom = getZoom();

    let finalWidth = startWidth;
    let finalHeight = startHeight;

    const handleMouseMove = (e: MouseEvent) => {
      // Account for zoom level in delta calculation
      const deltaX = (e.clientX - startX) / zoom;
      const deltaY = (e.clientY - startY) / zoom;
      
      finalWidth = Math.min(900, Math.max(50, startWidth + deltaX));
      finalHeight = Math.min(600, Math.max(50, startHeight + deltaY));
      
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
          "bg-neutral-900 rounded-lg border relative select-none",
          // Focus states
          isFocused && !hasError && "border-green-500",
          isFocused && hasError && errorType === 'primary' && "border-red-500",
          isFocused && hasError && errorType === 'skipped' && "border-gray-400",
          // Default unfocused (all types)
          !isFocused && "border-neutral-600",
          // Hover state
          hovering && !isResizing && !isFocused && "border-neutral-400",
          // Resize state
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
        <div className="flex flex-col h-full overflow-hidden rounded-lg relative">
          {/* Top buttons - Delete and Download */}
          {hovering && (
            <>
              {/* Download button */}
              {userText && (
                <button
                  onClick={handleGetResult}
                  className={clsx(
                    "absolute top-2 w-5 h-5 bg-neutral-600/80 text-white rounded flex items-center justify-center text-xs hover:bg-green-600 transition-colors z-10",
                    hasScrollbar ? "right-10" : "right-8"
                  )}
                  title="Download"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3"
                  >
                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                  </svg>
                </button>
              )}
              
              {/* Delete button */}
              <button
                onClick={handleDelete}
                className={clsx(
                  "absolute top-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10",
                  hasScrollbar ? "right-3.5" : "right-2"
                )}
              >
                ✕
              </button>
            </>
          )}

          {/* Focus overlay - when not focused and has content (text or error) */}
          {!isFocused && (userText || hasError) && (
            <div
              className="absolute inset-0 z-[5] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('resultNodeFocus', { 
                  detail: { nodeId: props.id } 
                }));
                setIsFocused(true);
                console.log('Focus activated on ResultNode:', props.id);
              }}
            />
          )}

          {/* Read-only text area */}
          <textarea
            ref={textRef}
            className={clsx(
              "flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none overscroll-contain",
              // Color based on text content, not state
              userText?.startsWith('❌ ERROR') && "text-red-400",
              userText?.startsWith('⏭️ SKIPPED') && "text-gray-400",
              (!userText || userText === "" || (!userText.startsWith('❌') && !userText.startsWith('⏭️'))) && "text-green-400",
              // Force green color for placeholder during execution
              isMyPipelineExecuting && !userText && "!text-green-400 placeholder:!text-green-400",
              // Pointer events control based on focus
              isFocused ? "pointer-events-auto" : "pointer-events-none",
              !isFocused && "select-none",
              // Custom scrollbar styling
              "[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-neutral-800",
              "[&::-webkit-scrollbar-thumb]:bg-neutral-600",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb:hover]:bg-neutral-500",
              // Apply blocking classes when focused (nodrag always, nowheel only when scrollable)
              isFocused && (hasScrollbar ? "nowheel nodrag" : "nodrag"),
              // Always show scrollbar when content overflows
              "overflow-y-auto"
            )}
            value={userText}
            readOnly
            placeholder={isMyPipelineExecuting ? "Executing..." : "Run the flow to see results..."}
            onWheelCapture={(e) => {
              // Use capture phase to intercept before React Flow
              if (isFocused && hasScrollbar) {
                e.stopPropagation();
              }
            }}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResize}
          onPointerDown={(e) => {
            // Only block left click for resize
            if (e.button === 0) {
              e.stopPropagation();
            }
          }}
          onMouseEnter={() => {
            document.body.style.cursor = 'nwse-resize';
          }}
          onMouseLeave={() => {
            if (!isResizing) {
              document.body.style.cursor = '';
            }
          }}
          className="nodrag absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group z-20"
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
