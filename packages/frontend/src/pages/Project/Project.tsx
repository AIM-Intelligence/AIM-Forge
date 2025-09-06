import { useState, useCallback, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import IdeModal from "../../components/modal/Ide";
import Loading from "../../components/loading/Loading";
import WrongPath from "../WrongPath/WrongPath";
import ProjectPanel from "./layouts/ProjectPanel";
import ProjectError from "./errors/ProjectError";
import ProjectFlow from "./flow/ProjectFlow";
import { useProjectData } from "../../hooks/useProjectData";
import { useNodeOperations } from "../../hooks/useNodeOperations";
import { useEdgeOperations } from "../../hooks/useEdgeOperations";
import { type ComponentTemplate } from "../../config/componentLibrary";
import { codeApi } from "../../utils/api";
import { useExecutionStore } from "../../stores/executionStore";
import { useNodeValueStore } from "../../stores/nodeValueStore";

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();
  const toastMessage = useExecutionStore((state) => state.toastMessage);
  const setToastMessage = useExecutionStore((state) => state.setToastMessage);
  const loadFromLocalStorage = useNodeValueStore((state) => state.loadFromLocalStorage);

  // Load node values from localStorage when project loads
  useEffect(() => {
    if (projectId) {
      loadFromLocalStorage(projectId);
    }
  }, [projectId, loadFromLocalStorage]);

  // UI State
  const [isIdeModalOpen, setIsIdeModalOpen] = useState(false);
  const [selectedNodeData, setSelectedNodeData] = useState<{
    nodeId: string;
    title: string;
    file?: string;
  }>({
    nodeId: "1",
    title: "Python IDE",
    file: undefined,
  });
  const [nodeIdCounter, setNodeIdCounter] = useState(1);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, setToastMessage]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string, title: string, file?: string) => {
    setSelectedNodeData({
      nodeId,
      title,
      file,
    });
    setIsIdeModalOpen(true);
  }, []);

  // Fetch project data
  const {
    projectTitle,
    isLoading,
    error,
    isInvalidProject,
    transformedNodes,
    transformedEdges,
    maxNodeId,
  } = useProjectData(projectId, handleNodeClick);

  // Initialize node counter with max ID
  if (maxNodeId > nodeIdCounter) {
    setNodeIdCounter(maxNodeId);
  }

  // Node operations
  const { nodes, setNodes, edges, setEdges, onNodesChange, onEdgesChange, addNewNode } =
    useNodeOperations({
      projectId,
      initialNodes: transformedNodes,
      initialEdges: transformedEdges,
      nodeIdCounter,
      setNodeIdCounter,
      onNodeClick: handleNodeClick,
    });

  // Edge operations
  const { onConnect, isValidConnection } = useEdgeOperations({
    projectId,
    edges,
    setEdges,
    nodes,
  });

  // Handle component library selection
  const handleComponentSelect = useCallback(
    async (component: ComponentTemplate) => {
      if (!projectId) return;

      // Generate new node ID
      const newNodeId = String(nodeIdCounter);
      setNodeIdCounter(prev => prev + 1);

      try {
        // Create node from template
        const apiUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:8000' 
          : `http://${window.location.hostname}:8000`;
        const response = await fetch(`${apiUrl}/api/components/create-from-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            node_id: newNodeId,
            template_name: component.template,
            title: component.name,
            description: component.description,
            component_type: component.componentType, // Pass componentType if present
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          // Get metadata for the new node to extract inputs/outputs
          let inputs = undefined;
          let outputs = undefined;
          
          try {
            const metadataResult = await codeApi.getNodeMetadata({
              project_id: projectId,
              node_id: newNodeId,
              node_data: { 
                data: { 
                  file: result.file_name || `${newNodeId}_${component.name.replace(/\s+/g, '_')}.py` 
                } 
              }
            });
            
            if (metadataResult.success && metadataResult.metadata) {
              const metadata = metadataResult.metadata;
              
              // Convert metadata to port format
              if (metadata.inputs?.length > 0) {
                inputs = metadata.inputs.map((input: any) => ({
                  id: input.name,
                  label: input.name,
                  type: input.type,
                  required: input.required !== false,
                  default: input.default,
                }));
              }
              
              if (metadata.outputs?.length > 0) {
                outputs = metadata.outputs.map((output: any) => ({
                  id: output.name,
                  label: output.name,
                  type: output.type,
                  required: false,
                  default: undefined,
                }));
              }
            }
          } catch (error) {
            console.error(`Failed to fetch metadata for new node:`, error);
          }
          
          // Create new node without page refresh
          const newNode = {
            id: newNodeId,
            type: component.nodeType || "custom",
            position: { 
              x: 250 + Math.random() * 100, // Random offset to prevent overlap
              y: 100 + Math.random() * 100 
            },
            data: {
              title: component.name,
              description: component.description,
              file: result.file_name || `${newNodeId}_${component.name.replace(/\s+/g, '_')}.py`,
              viewCode: () => handleNodeClick(newNodeId, component.name, result.file_name || `${newNodeId}_${component.name.replace(/\s+/g, '_')}.py`),
              inputs: inputs,
              outputs: outputs,
              componentType: component.componentType,  // Add componentType for extensible rendering
            }
          };
          
          // Add node to React Flow
          setNodes(currentNodes => [...currentNodes, newNode]);
        } else {
          console.error("Failed to create node from template");
        }
      } catch (error) {
        console.error("Error creating node from template:", error);
      }
    },
    [projectId, nodeIdCounter, addNewNode]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  // Conditional rendering
  if (!projectId || isInvalidProject) {
    return <WrongPath />;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <ProjectError error={error} onRetry={handleRetry} />;
  }

  return (
    <>
      {/* Toast notification - Global */}
      {toastMessage && (
        <div 
          className="fixed top-6 left-1/2 z-[9999] transition-all duration-300"
          style={{
            transform: 'translateX(-50%)',
            animation: 'fadeInSlide 0.3s ease-out',
          }}
        >
          <div className="bg-neutral-900/95 backdrop-blur-sm text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2.5 border border-neutral-800">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span className="text-sm font-medium text-neutral-100">{toastMessage}</span>
          </div>
        </div>
      )}
      
      <ProjectFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
      >
        <ProjectPanel
          projectTitle={projectTitle}
          nodeCount={nodes.length}
          edgeCount={edges.length}
          onComponentSelect={handleComponentSelect}
        />
      </ProjectFlow>

      {/* IDE Modal */}
      <IdeModal
        isOpen={isIdeModalOpen}
        onClose={() => setIsIdeModalOpen(false)}
        projectId={projectId}
        nodeId={selectedNodeData.nodeId}
        nodeTitle={selectedNodeData.title}
        nodeFile={selectedNodeData.file}
      />
    </>
  );
}
