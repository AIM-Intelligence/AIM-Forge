import { useState, useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
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
  const [isFocused, setIsFocused] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const setNodeResult = useExecutionStore((state) => state.setNodeResult);
  const { setNodeValue } = useNodeValueStore();
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const { getZoom } = useReactFlow();

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

  // Check if textarea can scroll - calculate in real-time
  const canScroll = () => {
    const el = textRef.current;
    return !!el && el.scrollHeight > el.clientHeight;
  };

  // Handle focus for scrolling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocused) {
        setIsFocused(false);
      }
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (isFocused && nodeRef.current && !nodeRef.current.contains(e.target as HTMLElement)) {
        setIsFocused(false);
      }
    };
    
    // Handle global focus events - only one TextInputNode can be focused at a time
    const handleGlobalFocus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.nodeId !== props.id && isFocused) {
        setIsFocused(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('textInputNodeFocus', handleGlobalFocus);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('textInputNodeFocus', handleGlobalFocus);
    };
  }, [isFocused, props.id]);

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
          "bg-neutral-900 rounded-lg border relative select-none",
          isFocused ? "border-blue-500" : "border-neutral-600",
          hovering && !isResizing && !isFocused && "border-neutral-400",
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
          {/* Delete button */}
          {hovering && (
            <button
              onClick={handleDelete}
              className={clsx(
                "absolute top-2 w-5 h-5 bg-red-500/80 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10",
                canScroll() ? "right-3.5" : "right-2"
              )}
            >
              ✕
            </button>
          )}

          {/* Focus overlay - only when not focused */}
          {!isFocused && (
            <div
              className="absolute inset-0 z-[5] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('textInputNodeFocus', { 
                  detail: { nodeId: props.id } 
                }));
                setIsFocused(true);
                
                // Immediately focus the textarea for single-click editing
                setTimeout(() => {
                  if (textRef.current) {
                    textRef.current.focus();
                    // Place cursor at the end of text
                    textRef.current.setSelectionRange(userText.length, userText.length);
                  }
                }, 0);
              }}
            />
          )}

          {/* Editable text area - takes full space */}
          <textarea
            ref={textRef}
            className={clsx(
              "flex-1 p-3 bg-transparent text-sm text-blue-300 font-mono resize-none outline-none transition-all overscroll-contain",
              // Pointer events control based on focus
              isFocused ? "pointer-events-auto cursor-text" : "pointer-events-none",
              !isFocused && "select-none",
              // Custom scrollbar styling
              "[&::-webkit-scrollbar]:w-2",
              "[&::-webkit-scrollbar-track]:bg-neutral-800",
              "[&::-webkit-scrollbar-thumb]:bg-neutral-600",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb:hover]:bg-neutral-500",
              // Apply blocking classes when focused (nodrag always, nowheel only when scrollable)
              isFocused && (canScroll() ? "nowheel nodrag" : "nodrag"),
              // Always show scrollbar when content overflows
              "overflow-y-auto"
            )}
            value={userText}
            onChange={handleTextChange}
            placeholder="Enter text value..."
            onMouseDown={(e) => {
              if (e.button === 0 && isFocused) {
                // Prevent node dragging when focused
                e.stopPropagation();
              }
            }}
            onWheelCapture={(e) => {
              // Use capture phase to intercept before React Flow
              if (isFocused && canScroll()) {
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
