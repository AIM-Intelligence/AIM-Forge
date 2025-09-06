import { useState, useEffect } from "react";
import { projectApi, codeApi } from "../utils/api";
import type { ProjectStructure, ProjectNode, ProjectEdge } from "../types";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { StartNodeType } from "../components/nodes/flow-control/StartNode";
import type { ResultNodeType } from "../components/nodes/flow-control/ResultNode";
import type { Edge, MarkerType } from "@xyflow/react";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType;

interface UseProjectDataReturn {
  projectData: ProjectStructure | null;
  projectTitle: string;
  isLoading: boolean;
  error: string | null;
  isInvalidProject: boolean;
  transformedNodes: AnyNodeType[];
  transformedEdges: Edge[];
  maxNodeId: number;
}

export function useProjectData(
  projectId: string | undefined,
  onNodeClick: (nodeId: string, title: string) => void
): UseProjectDataReturn {
  const [projectData, setProjectData] = useState<ProjectStructure | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvalidProject, setIsInvalidProject] = useState(false);
  const [transformedNodes, setTransformedNodes] = useState<AnyNodeType[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<Edge[]>([]);
  const [maxNodeId, setMaxNodeId] = useState(1);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Validate projectId format (basic validation)
        if (!projectId.match(/^[a-zA-Z0-9_-]+$/)) {
          setIsInvalidProject(true);
          setIsLoading(false);
          return;
        }

        const data = await projectApi.getProject(projectId);

        if (data.success && data.project) {
          const project: ProjectStructure = data.project;
          setProjectData(project);

          // Set project title
          setProjectTitle(project.project_name || "");

          // Transform backend nodes to ReactFlow format
          const nodes: AnyNodeType[] = project.nodes.map(
            (node: ProjectNode): AnyNodeType => {
              const nodeType = node.type || "custom";
              const baseData = {
                title: node.data.title || `Node ${node.id}`,
                description: node.data.description || "",
              };

              if (nodeType === 'start') {
                return {
                  id: node.id,
                  type: 'start',
                  position: node.position,
                  data: {
                    ...baseData,
                    file: node.data.file,
                  },
                } as StartNodeType;
              } else if (nodeType === 'result') {
                return {
                  id: node.id,
                  type: 'result',
                  position: node.position,
                  data: {
                    ...baseData,
                    dimensions: node.data.dimensions,
                  },
                } as ResultNodeType;
              } else {
                // Check if this is a TextInput component
                const isTextInput = node.data.componentType === 'TextInput' || 
                                  node.data.title?.startsWith('Text Input');
                
                return {
                  id: node.id,
                  type: isTextInput ? 'textInput' : 'custom',
                  position: node.position,
                  data: {
                    ...baseData,
                    file: node.data.file,
                    value: node.data.value,
                    dimensions: node.data.dimensions,
                    componentType: node.data.componentType,
                    viewCode: () => {
                      onNodeClick(node.id, node.data.title || `Node ${node.id}`);
                    },
                  },
                } as DefaultNodeType;
              }
            }
          );

          // Transform backend edges to ReactFlow format
          // Initially hide edges to prevent React Flow warnings during metadata loading
          const edges: Edge[] = project.edges.map((edge: ProjectEdge) => ({
            id: edge.id,
            type: edge.type || "custom",
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || undefined,
            targetHandle: edge.targetHandle || undefined,
            style: { stroke: "#64748b", strokeWidth: 2 },
            markerEnd: edge.markerEnd
              ? {
                  type: edge.markerEnd.type as MarkerType,
                }
              : {
                  type: "arrowclosed" as MarkerType,
                },
            hidden: true, // Hide initially to prevent warnings
          }));

          // Fetch metadata for custom nodes
          const nodesWithMetadata = await Promise.all(
            nodes.map(async (node) => {
              if (node.type === 'custom') {
                try {
                  const metadataResult = await codeApi.getNodeMetadata({
                    project_id: projectId,
                    node_id: node.id,
                    node_data: { data: node.data }
                  });
                  
                  if (metadataResult.success && metadataResult.metadata) {
                    const metadata = metadataResult.metadata;
                    
                    // Convert metadata to port format
                    const inputs = metadata.inputs?.map((input: any) => ({
                      id: input.name,
                      label: input.name,
                      type: input.type,
                      required: input.required !== false,
                      default: input.default,
                    }));
                    
                    const outputs = metadata.outputs?.map((output: any) => ({
                      id: output.name,
                      label: output.name,
                      type: output.type,
                      required: false,
                      default: undefined,
                    }));
                    
                    // Return node with metadata
                    return {
                      ...node,
                      data: {
                        ...node.data,
                        mode: metadata.mode,
                        inputs: inputs,
                        outputs: outputs,
                      },
                    };
                  }
                } catch (error) {
                  console.error(`Failed to fetch metadata for node ${node.id}:`, error);
                }
              }
              return node;
            })
          );

          setTransformedNodes(nodesWithMetadata);
          
          // Validate edges against actual node ports before showing them
          const validatedEdges = edges.map(edge => {
            let validatedEdge = { ...edge, hidden: false };
            let handleChanged = false;
            
            // Find nodes to check their actual ports
            const targetNode = nodesWithMetadata.find(n => n.id === edge.target);
            const sourceNode = nodesWithMetadata.find(n => n.id === edge.source);
            
            // Validate target handle
            if (edge.targetHandle && targetNode?.type === 'custom') {
              const targetInputs = (targetNode.data as any).inputs || [];
              const targetHandleExists = targetInputs.some((input: any) => 
                input.id === edge.targetHandle
              );
              
              if (!targetHandleExists) {
                if (targetInputs.length > 0) {
                  // Map to first available input
                  console.warn(`Edge ${edge.id} has invalid targetHandle "${edge.targetHandle}", mapping to "${targetInputs[0].id}"`);
                  validatedEdge.targetHandle = targetInputs[0].id;
                  handleChanged = true;
                } else {
                  console.warn(`Edge ${edge.id} has invalid targetHandle "${edge.targetHandle}" and no inputs available`);
                  validatedEdge.targetHandle = undefined;
                  handleChanged = true;
                }
              }
            }
            
            // Validate source handle
            if (edge.sourceHandle && sourceNode?.type === 'custom') {
              const sourceOutputs = (sourceNode.data as any).outputs || [];
              const sourceHandleExists = sourceOutputs.some((output: any) => 
                output.id === edge.sourceHandle
              );
              
              if (!sourceHandleExists) {
                if (sourceOutputs.length > 0) {
                  // Map to first available output
                  console.warn(`Edge ${edge.id} has invalid sourceHandle "${edge.sourceHandle}", mapping to "${sourceOutputs[0].id}"`);
                  validatedEdge.sourceHandle = sourceOutputs[0].id;
                  handleChanged = true;
                } else {
                  console.warn(`Edge ${edge.id} has invalid sourceHandle "${edge.sourceHandle}" and no outputs available`);
                  validatedEdge.sourceHandle = undefined;
                  handleChanged = true;
                }
              }
            }
            
            // Force edge recreation if handles were changed during validation
            if (handleChanged) {
              const timestamp = Date.now();
              const baseId = edge.id.split('-')[0];
              validatedEdge.id = `${baseId}-validated-${timestamp}`;
              console.log(`Changed edge ID from ${edge.id} to ${validatedEdge.id} after handle validation`);
            }
            
            return validatedEdge;
          });
          
          setTransformedEdges(validatedEdges);

          // Update node counter based on existing nodes
          if (project.nodes.length > 0) {
            const maxId = Math.max(
              ...project.nodes.map((n: ProjectNode) => parseInt(n.id, 10) || 0)
            );
            setMaxNodeId(maxId + 1);
          }
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        // Check if it's a network or malformed URI error or 404
        if (err instanceof TypeError && err.message.includes("URI")) {
          setIsInvalidProject(true);
        } else if (err instanceof Error && err.message.includes("404")) {
          setIsInvalidProject(true);
        } else {
          setError(
            err instanceof Error ? err.message : "Failed to load project"
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjectData();
  }, [projectId, onNodeClick]);

  return {
    projectData,
    projectTitle,
    isLoading,
    error,
    isInvalidProject,
    transformedNodes,
    transformedEdges,
    maxNodeId,
  };
}