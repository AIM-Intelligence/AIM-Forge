import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { componentLibrary, type ComponentTemplate } from "../../../config/componentLibrary";
import PackageManagerPanel from "./PackageManagerPanel";
import TerminalModal from "../../../components/modal/TerminalModal";
import ProjectTerminal from "../../../components/terminal/ProjectTerminal";
import DeleteCheck from "../../../components/modal/DeleteCheck";
import { userComponentApi } from "../../../utils/api";
import type { UserComponentMetadata } from "../../../types";

const USER_TEMPLATE_PREFIX = "user:";

interface ProjectPanelProps {
  projectId: string;
  projectTitle: string;
  nodeCount: number;
  edgeCount: number;
  onComponentSelect: (component: ComponentTemplate) => void;
}

export default function ProjectPanel({
  projectId,
  projectTitle,
  nodeCount,
  edgeCount,
  onComponentSelect,
}: ProjectPanelProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPackagePanelOpen, setIsPackagePanelOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([...componentLibrary.map(cat => cat.id), "user-components"])
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [userComponents, setUserComponents] = useState<UserComponentMetadata[]>([]);
  const [isLoadingUserComponents, setIsLoadingUserComponents] = useState(false);
  const [userComponentsError, setUserComponentsError] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    component: UserComponentMetadata | null;
  }>({ isOpen: false, component: null });
  const [isDeletingComponent, setIsDeletingComponent] = useState(false);

  const userComponentsById = useMemo(() => {
    return new Map(userComponents.map(component => [component.id, component]));
  }, [userComponents]);

  const fetchUserComponents = useCallback(async () => {
    setIsLoadingUserComponents(true);
    setUserComponentsError(null);

    try {
      const components = await userComponentApi.listUserComponents();
      setUserComponents(components);
    } catch (error) {
      console.error("Failed to load user components:", error);
      setUserComponentsError("Failed to load user components");
    } finally {
      setIsLoadingUserComponents(false);
    }
  }, []);

  useEffect(() => {
    void fetchUserComponents();
  }, [fetchUserComponents]);

  useEffect(() => {
    const handleUpdated = () => {
      void fetchUserComponents();
    };

    window.addEventListener("userComponentsUpdated", handleUpdated);
    return () => {
      window.removeEventListener("userComponentsUpdated", handleUpdated);
    };
  }, [fetchUserComponents]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleDeleteComponent = useCallback(async () => {
    const target = deleteModal.component;
    if (!target) return;

    setIsDeletingComponent(true);
    try {
      await userComponentApi.deleteUserComponent(target.id);
      setDeleteModal({ isOpen: false, component: null });
      await fetchUserComponents();
    } catch (error) {
      console.error("Failed to delete user component:", error);
      setUserComponentsError("Failed to delete user component");
    } finally {
      setIsDeletingComponent(false);
    }
  }, [deleteModal.component, fetchUserComponents]);

  const userCategory = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (component: UserComponentMetadata) => (
      component.name.toLowerCase().includes(searchLower) ||
      (component.description ?? "").toLowerCase().includes(searchLower)
    );

    const components = userComponents
      .filter(matchesSearch)
      .map<ComponentTemplate>((component) => ({
        id: component.id,
        name: component.name,
        description: component.description ?? "",
        icon: "🧩",
        template: `${USER_TEMPLATE_PREFIX}${component.id}`,
        category: "user-components",
        componentType: "user-template",
        userTemplateId: component.id,
        metadata: component.metadata,
      }));

    return {
      id: "user-components",
      name: "User Components",
      icon: "🧩",
      components,
    };
  }, [searchTerm, userComponents]);

  // Filter components based on search
  const filteredLibrary = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();

    const baseCategories = componentLibrary
      .map(category => ({
        ...category,
        components: category.components.filter(comp =>
          comp.name.toLowerCase().includes(searchLower) ||
          (comp.description ?? "").toLowerCase().includes(searchLower)
        ),
      }))
      .filter(category => category.components.length > 0);

    return [...baseCategories, userCategory];
  }, [searchTerm, userCategory]);

  return (
    <div className="flex flex-col gap-1 items-center w-[360px]">
      {/* Header Section */}
      <button
        className="flex flex-row items-center w-full justify-start hover:cursor-pointer"
        onClick={() => navigate("/")}
      >
        <img
          src="/arrow-back.svg"
          alt="back"
          className="flex items-center justify-center w-5 h-5"
        />
        <h2 className="text-white text-lg text-center mb-0.5">Home</h2>
      </button>
      <h1 className="text-white text-2xl font-semibold mb-1">
        {projectTitle}
      </h1>
      <div className="text-neutral-400 text-sm mb-2">
        Nodes: {nodeCount} | Edges: {edgeCount}
      </div>

      {/* Component Library Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 border border-neutral-600"
      >
        <span className="font-medium">Components</span>
        <img 
          src="/aim-red.png" 
          alt="AIM RedLab" 
          className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {/* Component Library Section - Always rendered but height controlled */}
      <div className={`w-full bg-neutral-900 border border-neutral-700 rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out ${!isExpanded ? 'max-h-0 opacity-0 border-transparent' : 'max-h-[60vh] opacity-100'}`}>
        {/* Search */}
        <div className="p-3 border-b border-neutral-700">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 bg-neutral-800 text-white rounded border border-neutral-600 focus:border-red-500 focus:outline-none text-sm"
          />
        </div>

        {/* Categories */}
        <div className="max-h-[50vh] overflow-y-auto p-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
          {!filteredLibrary.some(category => category.components.length > 0) && (
            <div className="text-neutral-500 text-center py-4 text-sm">
              No components found
            </div>
          )}

          {filteredLibrary.map(category => {
            const isUserCategory = category.id === "user-components";
            const componentCount = category.components.length;

            return (
              <div key={category.id} className="mb-2">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-neutral-800 rounded transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 text-xs">
                      {expandedCategories.has(category.id) ? "▼" : "▶"}
                    </span>
                    {category.icon && (
                      <span className="text-base">{category.icon}</span>
                    )}
                    <span className="text-white text-xs font-medium">
                      {category.name}
                    </span>
                  </div>
                  <span className="text-neutral-500 text-xs">
                    {componentCount}
                  </span>
                </button>

                {/* Components */}
                {expandedCategories.has(category.id) && (
                  <div className="ml-4 mt-1">
                    {isUserCategory ? (
                      isLoadingUserComponents ? (
                        <div className="text-neutral-500 text-xs py-2">
                          Loading user components...
                        </div>
                      ) : userComponentsError ? (
                        <div className="text-red-500 text-xs py-2">
                          {userComponentsError}
                        </div>
                      ) : componentCount === 0 ? (
                        <div className="text-neutral-500 text-xs py-2 pl-3">
                          {searchTerm ? "No user components match this search" : "No user components saved yet"}
                        </div>
                      ) : (
                        category.components.map(component => {
                          const hasDescription = Boolean(component.description && component.description.trim().length > 0);
                          const userComponentMetadata = userComponentsById.get(component.userTemplateId ?? component.id);
                          return (
                            <div
                              key={component.id}
                              className="group flex items-center gap-2 rounded px-2 py-2 transition-colors hover:bg-neutral-800"
                            >
                              <button
                                type="button"
                                onClick={() => onComponentSelect(component)}
                                className="flex-1 flex items-center gap-2 text-left focus:outline-none"
                              >
                                <span className="text-base">{component.icon}</span>
                                <div className="flex-1 min-w-0 grid text-left">
                                  <div
                                    className={`min-w-0 self-center flex flex-col gap-0.5${hasDescription ? "" : " justify-center min-h-[34px]"}`}
                                  >
                                    <div className="text-white text-xs transition-colors group-hover:text-red-400 break-words">
                                      {component.name}
                                    </div>
                                    {hasDescription && (
                                      <div className="text-neutral-500 text-xs break-words">
                                        {component.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!userComponentMetadata) {
                                    console.warn("Missing metadata for user component", component.id);
                                    return;
                                  }
                                  setDeleteModal({ isOpen: true, component: userComponentMetadata });
                                }}
                                className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity transition-colors text-neutral-400 hover:text-red-500 hover:bg-neutral-700 focus:outline-none p-1.5 rounded-lg"
                                title="Delete user component"
                                disabled={!userComponentMetadata}
                              >
                                <svg
                                  className="w-4 h-4"
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
                              </button>
                            </div>
                          );
                        })
                      )
                      ) : (
                        category.components.map(component => {
                          const hasDescription = Boolean(component.description && component.description.trim().length > 0);
                          return (
                            <button
                              key={component.id}
                              onClick={() => onComponentSelect(component)}
                              className="w-full flex items-center gap-2 px-2 py-2 hover:bg-neutral-800 rounded transition-colors group"
                            >
                              <span className="text-base">{component.icon}</span>
                              <div className="flex-1 min-w-0 grid text-left">
                                <div className="min-w-0 self-center">
                                  <div className="text-white text-xs group-hover:text-red-400 transition-colors break-words">
                                    {component.name}
                                  </div>
                                  {hasDescription && (
                                    <div className="text-neutral-500 text-xs break-words">
                                      {component.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>

      <button
        onClick={() => setIsPackagePanelOpen(!isPackagePanelOpen)}
        className="w-full px-3 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 border border-neutral-600"
      >
        <span className="font-medium">Packages</span>
        <img
          src="/aim-red.png"
          alt="AIM RedLab"
          className={`w-4 h-4 transition-transform duration-300 ${isPackagePanelOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {isPackagePanelOpen && (
        <div className="w-full">
          <PackageManagerPanel projectId={projectId} />
        </div>
      )}

      <button
        onClick={() => setIsTerminalOpen(true)}
        className="w-full px-3 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2 border border-neutral-600"
      >
        <span className="font-medium">Terminal</span>
        <span className="text-sm" role="img" aria-hidden="true">⌨️</span>
      </button>

      <DeleteCheck
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, component: null })}
        onConfirm={handleDeleteComponent}
        projectName={deleteModal.component?.name ?? ""}
        isDeleting={isDeletingComponent}
        title="Delete User Component"
        description="Do you really want to delete this user component?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <TerminalModal
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        title={`Terminal · ${projectTitle}`}
      >
        <ProjectTerminal
          projectId={projectId}
          onExit={() => setIsTerminalOpen(false)}
        />
      </TerminalModal>
    </div>
  );
}
