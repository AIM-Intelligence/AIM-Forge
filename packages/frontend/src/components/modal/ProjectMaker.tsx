import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { projectApi } from "../../utils/api";
import X from "../buttons/modal/x";

interface ProjectMakerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectMaker({ isOpen, onClose }: ProjectMakerProps) {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    // Generate a unique project ID (fallback for browsers that don't support crypto.randomUUID)
    const projectId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID()
      : `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const data = await projectApi.createProject({
        project_name: projectName.trim(),
        project_description: projectDescription.trim() || "",
        project_id: projectId,
      });

      if (data.success) {
        // Navigate to the newly created project
        navigate(`/project/${projectId}`);

        // Close modal if onClose is provided
        if (onClose) {
          onClose();
        }
      } else {
        throw new Error("Failed to create project");
      }
    } catch (err) {
      console.error("Error creating project:", err);
      let errorMessage = "Failed to create project";
      
      if (err instanceof Error) {
        // Extract meaningful error message
        if (err.message.includes("already exists")) {
          errorMessage = "A project with this name already exists. Please choose a different name.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-sm bg-black/20 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative flex items-center justify-center flex-col bg-[#0a0a0a] rounded-xl max-w-[50vw] max-h-[75vh] overflow-auto animate-slideUp min-w-[400px] min-h-[200px] sm:min-w-[60vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex justify-end">
          <X onClose={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="w-7/8 space-y-4">
          <div>
            <label
              htmlFor="projectName"
              className="block text-sm font-medium text-neutral-300 mb-2"
            >
              Project Name *
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              className="w-full px-4 py-2 bg-neutral-800 text-white border border-neutral-600 rounded-lg focus:outline-none focus:border-red-800 transition-colors"
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          <div>
            <label
              htmlFor="projectDescription"
              className="block text-sm font-medium text-neutral-300 mb-2"
            >
              Project Description
            </label>
            <textarea
              id="projectDescription"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Enter project description (optional)"
              rows={4}
              className="w-full px-4 py-2 bg-neutral-800 text-white border border-neutral-600 rounded-lg focus:outline-none focus:border-red-800 transition-colors resize-none"
              disabled={isLoading}
              maxLength={500}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="w-full flex gap-3 py-4">
            <button
              type="submit"
              disabled={isLoading || !projectName.trim()}
              className="flex-1 px-6 py-3 bg-neutral-200 text-red-900 font-semibold rounded-lg hover:bg-white disabled:bg-neutral-500 disabled:text-neutral-200 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin-reverse h-5 w-5 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </span>
              ) : (
                "Start Project"
              )}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-3 bg-red-900 text-white font-semibold rounded-lg hover:bg-red-800 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
