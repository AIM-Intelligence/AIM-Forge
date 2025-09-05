import { useState, useRef } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useParams } from "react-router-dom";
import { useNodeData } from "../../../hooks/useNodeData";

export type NoteNodeType = Node<{
  title?: string;
  content?: string;
  fontSize?: 'small' | 'medium' | 'large';
  isBold?: boolean;
}>;

interface NoteNodeData {
  content: string;
  fontSize: 'small' | 'medium' | 'large';
  isBold: boolean;
  dimensions: { width: number; height: number };
}

export default function NoteNode(props: NodeProps<NoteNodeType>) {
  const { projectId } = useParams<{ projectId: string }>();
  const [hovering, setHovering] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Font size mapping
  const fontSizeMap = {
    small: '24px',
    medium: '32px',
    large: '40px'
  };

  // Use unified data management hook
  const { data, setData, isSaving } = useNodeData<NoteNodeData>({
    projectId,
    nodeId: props.id,
    storageKey: 'note_data',
    defaultValue: {
      content: '',
      fontSize: 'medium',
      isBold: false,
      dimensions: { width: 250, height: 200 }
    },
    serverData: props.data,
    debounceMs: 500,
  });

  // Handle text change
  const handleTextChange = (newText: string) => {
    setData(prev => ({ ...prev, content: newText }));
  };

  // Handle font size toggle
  const toggleFontSize = () => {
    const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(data.fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setData(prev => ({ ...prev, fontSize: sizes[nextIndex] }));
  };

  // Handle bold toggle
  const toggleBold = () => {
    setData(prev => ({ ...prev, isBold: !prev.isBold }));
  };

  // Handle resize
  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = data.dimensions.width;
    const startHeight = data.dimensions.height;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        const finalWidth = Math.min(600, Math.max(150, startWidth + e.clientX - startX));
        const finalHeight = Math.min(800, Math.max(100, startHeight + e.clientY - startY));
        setData(prev => ({ 
          ...prev, 
          dimensions: { width: finalWidth, height: finalHeight } 
        }));
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'nwse-resize';
  };

  // Handle delete
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Dispatch delete event (localStorage cleanup handled by hook)
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  return (
    <div
      ref={nodeRef}
      className={clsx(
        "relative select-none",
        "transition-all duration-200"
      )}
      style={{
        width: `${data.dimensions.width}px`,
        height: `${data.dimensions.height}px`,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onDoubleClick={() => {
        setIsEditing(true);
        setTimeout(() => textAreaRef.current?.focus(), 0);
      }}
    >
      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute -top-6 right-0 text-xs text-gray-500">
          Saving...
        </div>
      )}

      {/* Inner container with transparent background */}
      <div className="flex flex-col h-full relative">
        {/* Header with controls - positioned above the text area */}
        {hovering && (
          <div className="absolute -top-8 left-0 right-0 flex items-center justify-between px-2 py-1 z-10">
            <div className="flex items-center gap-1">
              {/* Font size toggle */}
              <button
                onClick={toggleFontSize}
                className="p-1 bg-white/90 hover:bg-white rounded text-xs transition-all shadow-sm"
                title={`Font size: ${data.fontSize}`}
              >
                {data.fontSize === 'small' ? 'S' : data.fontSize === 'medium' ? 'M' : 'L'}
              </button>
              
              {/* Bold toggle */}
              <button
                onClick={toggleBold}
                className={clsx(
                  "px-1.5 py-1 rounded text-xs transition-all font-bold shadow-sm",
                  data.isBold ? "bg-gray-700 text-white" : "bg-white/90 hover:bg-white text-gray-700"
                )}
                title="Toggle bold"
              >
                B
              </button>
            </div>

            {/* Delete button */}
            <button
              onClick={handleDelete}
              className="w-5 h-5 bg-red-500/90 text-white rounded flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Note content area - transparent background */}
        {isEditing ? (
          <textarea
            ref={textAreaRef}
            className={clsx(
              "flex-1 p-2 resize-none outline-none",
              "bg-transparent text-white placeholder-gray-400",
              data.isBold && "font-semibold"
            )}
            style={{
              fontSize: fontSizeMap[data.fontSize],
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}
            value={data.content}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            placeholder="Type your note here..."
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className={clsx(
              "flex-1 p-2 overflow-y-auto cursor-text",
              "text-white",
              data.isBold && "font-semibold",
              !data.content && "text-gray-400"
            )}
            onClick={() => {
              setIsEditing(true);
              setTimeout(() => textAreaRef.current?.focus(), 0);
            }}
            style={{
              fontSize: fontSizeMap[data.fontSize],
              textShadow: data.content ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
            }}
          >
            {data.content || "Double-click to add note..."}
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
        className={clsx(
          "nodrag absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize group z-20",
          "transition-opacity duration-200",
          hovering || isResizing ? "opacity-100" : "opacity-30"
        )}
        style={{ pointerEvents: 'auto' }}
      >
        <div className="absolute bottom-0 right-0 w-full h-full pointer-events-none">
          {/* Three dots pattern for resize handle */}
          <svg className="w-full h-full" viewBox="0 0 16 16">
            <circle cx="12" cy="12" r="1.5" fill="#9CA3AF"/>
            <circle cx="8" cy="12" r="1.5" fill="#9CA3AF"/>
            <circle cx="12" cy="8" r="1.5" fill="#9CA3AF"/>
          </svg>
        </div>
      </div>

      {/* No handles - this is just a note, not part of the flow */}
    </div>
  );
}