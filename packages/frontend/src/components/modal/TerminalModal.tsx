import type { PropsWithChildren, ReactNode } from "react";

interface TerminalModalProps {
  isOpen: boolean;
  title?: ReactNode;
  onClose: () => void;
}

export default function TerminalModal({
  isOpen,
  title,
  onClose,
  children,
}: PropsWithChildren<TerminalModalProps>) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex h-[70vh] w-[70vw] min-h-[360px] min-w-[640px] flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div className="text-sm font-semibold text-white">
            {title ?? "Terminal"}
          </div>
          <button
            onClick={onClose}
            className="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
