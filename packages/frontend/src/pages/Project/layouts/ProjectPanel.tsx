import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { componentLibrary, type ComponentTemplate } from "../../../config/componentLibrary";
import PackageManagerPanel from "./PackageManagerPanel";

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(componentLibrary.map(cat => cat.id))
  );
  const [searchTerm, setSearchTerm] = useState("");

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

  // Filter components based on search
  const filteredLibrary = componentLibrary.map(category => ({
    ...category,
    components: category.components.filter(comp =>
      comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.components.length > 0);

  return (
    <div className="flex flex-col gap-1 items-center">
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
        <div className="max-h-[50vh] overflow-y-auto p-2">
            {filteredLibrary.length === 0 ? (
              <div className="text-neutral-500 text-center py-4 text-sm">
                No components found
              </div>
            ) : (
              filteredLibrary.map(category => (
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
                      <span className="text-base">{category.icon}</span>
                      <span className="text-white text-xs font-medium">
                        {category.name}
                      </span>
                    </div>
                    <span className="text-neutral-500 text-xs">
                      {category.components.length}
                    </span>
                  </button>

                  {/* Components */}
                  {expandedCategories.has(category.id) && (
                    <div className="ml-4 mt-1">
                      {category.components.map(component => (
                        <button
                          key={component.id}
                          onClick={() => onComponentSelect(component)}
                          className="w-full flex items-start gap-2 px-2 py-1.5 hover:bg-neutral-800 rounded transition-colors group"
                        >
                          <span className="text-base mt-0.5">{component.icon}</span>
                          <div className="flex-1 text-left">
                            <div className="text-white text-xs group-hover:text-red-400 transition-colors">
                              {component.name}
                            </div>
                            <div className="text-neutral-500 text-xs">
                              {component.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
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
    </div>
  );
}
