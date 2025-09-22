import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { NodeData } from "../../../types";

export interface MarkdownNoteNodeData extends NodeData {
  content: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  onCommit?: (value: string) => void;
  onDelete?: (id: string) => void;
}

export type MarkdownNoteNodeType = Node<MarkdownNoteNodeData>;

type MarkdownNoteNodeProps = NodeProps<MarkdownNoteNodeType>;

type MarkdownCodeProps = ComponentProps<'code'> & ExtraProps & {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
};

const DEFAULT_CONTENT = "여기에 설명을 입력하세요.";

const renderCode: Components['code'] = ({ node, inline, className, children, ...rest }: MarkdownCodeProps) => {
  void node;
  if (inline) {
    return (
      <code
        className="bg-neutral-900/70 text-red-300 px-1.5 py-0.5 rounded-md text-sm font-mono"
        {...rest}
      >
        {children}
      </code>
    );
  }

  return (
    <pre className="bg-neutral-900/80 border border-neutral-700 rounded-md p-3 overflow-x-auto text-sm font-mono text-neutral-200 my-3">
      <code className={className} {...rest}>
        {children}
      </code>
    </pre>
  );
};

const markdownComponents: Components = {
  h1: ({ node, ...props }) => {
    void node;
    return <h1 className="text-5xl font-bold text-neutral-50 mt-0 mb-4" {...props} />;
  },
  h2: ({ node, ...props }) => {
    void node;
    return <h2 className="text-4xl font-semibold text-neutral-100 mt-5 mb-3" {...props} />;
  },
  h3: ({ node, ...props }) => {
    void node;
    return <h3 className="text-3xl font-semibold text-neutral-100 mt-4 mb-2" {...props} />;
  },
  p: ({ node, ...props }) => {
    void node;
    return <p className="my-2" {...props} />;
  },
  ul: ({ node, ...props }) => {
    void node;
    return <ul className="list-disc ml-5 my-2 space-y-1" {...props} />;
  },
  ol: ({ node, ...props }) => {
    void node;
    return <ol className="list-decimal ml-5 my-2 space-y-1" {...props} />;
  },
  li: ({ node, ...props }) => {
    void node;
    return <li className="leading-relaxed" {...props} />;
  },
  code: renderCode,
  blockquote: ({ node, ...props }) => {
    void node;
    return <blockquote className="border-l-4 border-neutral-600 pl-3 italic text-neutral-300 my-3" {...props} />;
  },
  a: ({ node, ...props }) => {
    void node;
    return <a className="text-red-400 underline underline-offset-4" {...props} />;
  },
};

function MarkdownNoteNode(props: MarkdownNoteNodeProps) {
  const { data, id } = props;
  const sourceContent = useMemo(() => {
    return data.content ?? "";
  }, [data.content]);

  const [displayContent, setDisplayContent] = useState(sourceContent);
  const [draft, setDraft] = useState(sourceContent);
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(isEditing);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    if (isEditingRef.current) return;
    setDisplayContent(sourceContent);
    setDraft(sourceContent);
  }, [sourceContent]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      setDraft(displayContent);
      setIsEditing(true);
    },
    [displayContent]
  );

  const commitDraft = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const next = trimmed.length > 0 ? value : "";
      setDisplayContent(next);
      setDraft(next);
      setIsEditing(false);
      if (typeof data.onCommit === "function") {
        data.onCommit(next);
      }
    },
    [data]
  );

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLTextAreaElement>) => {
      const wrapper = wrapperRef.current;
      // If focus moves to elements inside the wrapper, skip commit and keep editing
      if (wrapper && event.relatedTarget instanceof globalThis.Node && wrapper.contains(event.relatedTarget)) {
        return;
      }
      commitDraft(draft);
    },
    [commitDraft, draft]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.key === "Enter" && (event.metaKey || event.ctrlKey)) || event.key === "Escape") {
        event.preventDefault();
        commitDraft(event.key === "Escape" ? displayContent : draft);
      }
    },
    [commitDraft, draft, displayContent]
  );

  const fontSize = typeof data.fontSize === "number" ? data.fontSize : 16;
  const fontWeight = data.fontWeight === "bold" ? "bold" : "normal";

  const handleMouseDownCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isEditing) {
        const textarea = wrapperRef.current?.querySelector("textarea");
        if (textarea) {
          textarea.focus();
        }
        event.stopPropagation();
      }
    },
    [isEditing]
  );

  const effectiveFontSize = Number.isFinite(fontSize) ? fontSize : 16;
  const renderedDisplay = displayContent && displayContent.trim().length > 0 ? displayContent : DEFAULT_CONTENT;
  const renderedDraft = draft && draft.trim().length > 0 ? draft : DEFAULT_CONTENT;
  const isPlaceholder = !displayContent || displayContent.trim().length === 0;
  const [isHovering, setIsHovering] = useState(false);
  const isActive = isEditing || isHovering;

  useEffect(() => {
    if (!isEditing) return;

    const handlePointerDown = (event: PointerEvent) => {
      const wrapper = wrapperRef.current;
      const target = event.target;
      if (wrapper && target instanceof globalThis.Node && !wrapper.contains(target)) {
        event.stopPropagation();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isEditing]);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto cursor-text text-neutral-100 relative"
      style={{
        fontSize: effectiveFontSize,
        fontWeight,
        maxWidth: 520,
        minWidth: 180,
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDownCapture={handleMouseDownCapture}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="relative">
        {isActive && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (typeof data.onDelete === "function") {
                data.onDelete(id);
              } else {
                const deleteEvent = new CustomEvent("deleteNode", {
                  detail: { id },
                  bubbles: true,
                });
                event.currentTarget.dispatchEvent(deleteEvent);
              }
            }}
            className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white hover:bg-red-600 flex items-center justify-center text-xs"
            aria-label="노드 삭제"
          >
            ✕
          </button>
        )}
        <div
          className={`rounded-md px-3 py-2 transition-colors ${
            isActive ? "border border-neutral-400/70 bg-neutral-900/50" : "border border-transparent"
          }`}
          style={{
            fontSize: effectiveFontSize,
            fontWeight,
          }}
        >
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full h-32 bg-transparent text-neutral-100 focus:outline-none focus:ring-0 resize-none leading-relaxed border border-neutral-700/70 rounded-md p-2"
                style={{
                  fontSize: effectiveFontSize,
                  fontWeight,
                  fontFamily: "inherit",
                }}
              />
              <div className="markdown-note rounded-md p-3 bg-neutral-900/40 space-y-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {renderedDraft}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div
              className={`markdown-note space-y-2 ${
                isPlaceholder ? "text-neutral-500 italic" : ""
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {renderedDisplay}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MarkdownNoteNode);
