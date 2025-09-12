import React from "react";
import { createPortal } from "react-dom";

interface DeleteCheckProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  projectName: string;
  isDeleting?: boolean;
}

const DeleteCheck: React.FC<DeleteCheckProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-sm bg-black/50 animate-fadeIn"
      onClick={handleBackgroundClick}
    >
      <div
        className="bg-neutral-900 rounded-xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-slideUp max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-white text-xl font-semibold text-center mb-2">
          Delete Project
        </h2>

        {/* Message */}
        <p className="text-neutral-300 text-center mb-2">
          Do you really want to delete this project?
        </p>
        <p className="text-neutral-400 text-sm text-center mb-6">
          <span className="font-semibold text-white">{projectName}</span> will
          be permanently deleted.
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin-reverse" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DeleteCheck;
