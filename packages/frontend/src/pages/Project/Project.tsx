import { useState, useCallback, useEffect, useRef } from "react";
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
import type { PortInfo } from "../../types";
import type { ReactFlowInstance } from "@xyflow/react";

interface MetadataPort {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
}

interface NodeMetadata {
  inputs?: MetadataPort[];
  outputs?: MetadataPort[];
}

function isMetadata(value: unknown): value is NodeMetadata {
  if (typeof value !== "object" || value === null) return false;
  const maybe = value as Record<string, unknown>;
  const validArray = (arr: unknown): arr is MetadataPort[] =>
    Array.isArray(arr) && arr.every((item) =>
      typeof item === "object" && item !== null && typeof (item as MetadataPort).name === "string" && typeof (item as MetadataPort).type === "string"
    );
  const inputsValid = maybe.inputs === undefined || validArray(maybe.inputs);
  const outputsValid = maybe.outputs === undefined || validArray(maybe.outputs);
  return inputsValid && outputsValid;
}

export default function Project() {
  const { projectId } = useParams<{ projectId: string }>();
  const toastMessage = useExecutionStore((state) => state.toastMessage);
  const setToastMessage = useExecutionStore((state) => state.setToastMessage);
  const clearResults = useExecutionStore((state) => state.clearResults);
  const loadFromLocalStorage = useNodeValueStore((state) => state.loadFromLocalStorage);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Load node values from localStorage when project loads
  useEffect(() => {
    if (projectId) {
      // Clear execution results when switching projects to prevent cross-project contamination
      clearResults();
      loadFromLocalStorage(projectId);
    }
  }, [projectId, loadFromLocalStorage, clearResults]);

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
    updateStoredNodePosition,
  } = useProjectData(projectId, handleNodeClick);

  // Initialize node counter with max ID
  if (maxNodeId > nodeIdCounter) {
    setNodeIdCounter(maxNodeId);
  }

  // Node operations
  const { nodes, setNodes, edges, setEdges, onNodesChange, onEdgesChange } =
    useNodeOperations({
      projectId,
      initialNodes: transformedNodes,
      initialEdges: transformedEdges,
      nodeIdCounter,
      setNodeIdCounter,
      onNodeClick: handleNodeClick,
      reactFlowInstance: reactFlowInstanceRef,
      onNodePositionUpdate: updateStoredNodePosition,
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
          let inputs: PortInfo[] | undefined;
          let outputs: PortInfo[] | undefined;
          
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
            
            if (metadataResult.success && isMetadata(metadataResult.metadata)) {
              const metadata = metadataResult.metadata;
              
              // Convert metadata to port format
              if (metadata.inputs?.length > 0) {
                inputs = metadata.inputs.map((input) => ({
                  id: input.name,
                  label: input.name,
                  type: input.type,
                  required: input.required !== false,
                  default: input.default,
                }));
              }
              
              if (metadata.outputs?.length > 0) {
                outputs = metadata.outputs.map((output) => ({
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
          
          // Calculate position at viewport center
          let position = { x: 250, y: 100 }; // Default fallback
          
          if (reactFlowInstanceRef.current) {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            position = reactFlowInstanceRef.current.screenToFlowPosition({
              x: centerX,
              y: centerY
            });

            // Add small random offset to prevent exact overlap when adding multiple nodes
            position.x += (Math.random() - 0.5) * 50;
            position.y += (Math.random() - 0.5) * 50;
          }
          
          // Create new node without page refresh
          const newNode = {
            id: newNodeId,
            type: component.nodeType || "custom",
            position,
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
          setNodes((currentNodes) => [...currentNodes, newNode]);
        } else {
          console.error("Failed to create node from template");
        }
      } catch (error) {
        console.error("Error creating node from template:", error);
      }
    },
    [projectId, nodeIdCounter, setNodeIdCounter, setNodes, handleNodeClick]
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
        onInit={(instance) => { reactFlowInstanceRef.current = instance; }}
      >
        <ProjectPanel
          projectId={projectId!}
          projectTitle={projectTitle}
          nodeCount={(() => {
            const filtered = nodes.filter(node => {
              // Define excluded node types
              const excludedTypes = ['start', 'result', 'textInput'];
              if (node.type && excludedTypes.includes(node.type)) {
                return false;
              }
              
              // Define excluded component types (for input components)
              const excludedComponentTypes = ['TextInput'];
              const componentType = node.data.componentType;
              if (componentType && excludedComponentTypes.includes(componentType)) {
                return false;
              }

              // Define excluded title patterns (as a safety net)
              const excludedTitlePatterns = ['Text Input', 'Start Node', 'Result Node'];
              const title = node.data.title ?? '';
              if (excludedTitlePatterns.some(pattern => title.includes(pattern))) {
                return false;
              }
              
              // Only count custom nodes that passed all filters
              // These are the actual processing nodes like CSV Loader, GCG Attack, ASR, etc.
              return node.type === 'custom';
            });
            
            return filtered.length;
          })()}
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
