import { useState, useEffect, useCallback } from "react";
import { projectApi, codeApi } from "../utils/api";
import type { ProjectStructure, ProjectNode, ProjectEdge, Position, NodeData, PortInfo } from "../types";
import type { Edge, MarkerType, Node as FlowNode } from "@xyflow/react";

type AnyNodeType = FlowNode<NodeData>;

interface MetadataPort {
  name: string;
  type?: string;
  required?: boolean;
  default?: unknown;
}

interface NodeMetadata {
  inputs?: MetadataPort[];
  outputs?: MetadataPort[];
  mode?: "basic" | "script" | string;
}

function isNodeMetadata(value: unknown): value is NodeMetadata {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  const isPortArray = (ports: unknown): ports is MetadataPort[] =>
    Array.isArray(ports) && ports.every((port) => typeof port === "object" && port !== null && typeof (port as MetadataPort).name === "string");

  const inputsValid = candidate.inputs === undefined || isPortArray(candidate.inputs);
  const outputsValid = candidate.outputs === undefined || isPortArray(candidate.outputs);

  return inputsValid && outputsValid;
}

interface UseProjectDataReturn {
  projectData: ProjectStructure | null;
  projectTitle: string;
  isLoading: boolean;
  error: string | null;
  isInvalidProject: boolean;
  transformedNodes: AnyNodeType[];
  transformedEdges: Edge[];
  maxNodeId: number;
  updateStoredNodePosition: (nodeId: string, position: Position) => void;
}

export function useProjectData(
  projectId: string | undefined,
  onNodeClick: (nodeId: string, title: string, file?: string) => void
): UseProjectDataReturn {
  const [projectData, setProjectData] = useState<ProjectStructure | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInvalidProject, setIsInvalidProject] = useState(false);
  const [transformedNodes, setTransformedNodes] = useState<AnyNodeType[]>([]);
  const [transformedEdges, setTransformedEdges] = useState<Edge[]>([]);
  const [maxNodeId, setMaxNodeId] = useState(1);

  const updateMarkdownContent = useCallback((nodeId: string, content: string) => {
    setTransformedNodes(prev => {
      const index = prev.findIndex(node => node.id === nodeId && node.type === 'markdownNote');
      if (index === -1) return prev;

      const next = [...prev];
      const target = next[index];
      next[index] = {
        ...target,
        data: {
          ...target.data,
          content,
        },
      } satisfies AnyNodeType;
      return next;
    });
  }, []);

  const dispatchDeleteEvent = useCallback((nodeId: string) => {
    const event = new CustomEvent("deleteNode", {
      detail: { id: nodeId },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, []);

  const persistMarkdownContent = useCallback(
    async (nodeId: string, content: string) => {
      updateMarkdownContent(nodeId, content);

      if (!projectId) return;

      try {
        await projectApi.updateNodeData({
          project_id: projectId,
          node_id: nodeId,
          data: { content },
        });
      } catch (err) {
        console.error(`Failed to update markdown note ${nodeId}:`, err);
      }
    },
    [projectId, updateMarkdownContent]
  );

  const updateStoredNodePosition = useCallback((nodeId: string, position: Position) => {
    setTransformedNodes(prev => {
      const index = prev.findIndex(node => node.id === nodeId);
      if (index === -1) return prev;

      const next = [...prev];
      next[index] = {
        ...next[index],
        position,
      } satisfies AnyNodeType;
      return next;
    });
  }, []);

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
                } satisfies AnyNodeType;
              } else if (nodeType === 'result') {
                return {
                  id: node.id,
                  type: 'result',
                  position: node.position,
                  data: {
                    ...baseData,
                    dimensions: node.data.dimensions,
                  },
                } satisfies AnyNodeType;
              } else if (node.data.componentType === 'MarkdownNote') {
                return {
                  id: node.id,
                  type: 'markdownNote',
                  position: node.position,
                  data: {
                    title: baseData.title,
                    content: typeof node.data.content === 'string' ? node.data.content : '',
                    fontSize: typeof node.data.fontSize === 'number' ? node.data.fontSize : undefined,
                    fontWeight: node.data.fontWeight === 'bold' ? 'bold' : 'normal',
                    componentType: node.data.componentType,
                    onCommit: (value: string) => {
                      persistMarkdownContent(node.id, value);
                    },
                    onDelete: (nodeId: string) => {
                      dispatchDeleteEvent(nodeId);
                    },
                  },
                } satisfies AnyNodeType;
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
                      onNodeClick(node.id, node.data.title || `Node ${node.id}`, node.data.file);
                    },
                  },
                } satisfies AnyNodeType;
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
                  
                  if (metadataResult.success && isNodeMetadata(metadataResult.metadata)) {
                    const metadata = metadataResult.metadata;
                    
                    // Convert metadata to port format
                    const inputs = metadata.inputs?.map((input) => ({
                      id: input.name,
                      label: input.name,
                      type: input.type,
                      required: input.required !== false,
                      default: input.default,
                    }));
                    
                    const outputs = metadata.outputs?.map((output) => ({
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
          const validatedEdges = edges.map((edge) => {
            const validatedEdge = { ...edge, hidden: false };
            let handleChanged = false;

            const targetNode = nodesWithMetadata.find((n) => n.id === edge.target);
            const sourceNode = nodesWithMetadata.find((n) => n.id === edge.source);

            if (edge.targetHandle && targetNode?.type === 'custom') {
              const targetInputs: PortInfo[] = targetNode.data.inputs ?? [];
              const targetHandleExists = targetInputs.some((input) => input.id === edge.targetHandle);

              if (!targetHandleExists) {
                if (targetInputs.length > 0) {
                  const fallbackHandle = targetInputs[0].id;
                  console.warn(
                    `Edge ${edge.id} has invalid targetHandle "${edge.targetHandle}", mapping to "${fallbackHandle}"`
                  );
                  validatedEdge.targetHandle = fallbackHandle;
                  handleChanged = true;
                } else {
                  console.warn(
                    `Edge ${edge.id} has invalid targetHandle "${edge.targetHandle}" and no inputs available`
                  );
                  validatedEdge.targetHandle = undefined;
                  handleChanged = true;
                }
              }
            }

            if (edge.sourceHandle && sourceNode?.type === 'custom') {
              const sourceOutputs: PortInfo[] = sourceNode.data.outputs ?? [];
              const sourceHandleExists = sourceOutputs.some((output) => output.id === edge.sourceHandle);

              if (!sourceHandleExists) {
                if (sourceOutputs.length > 0) {
                  const fallbackHandle = sourceOutputs[0].id;
                  console.warn(
                    `Edge ${edge.id} has invalid sourceHandle "${edge.sourceHandle}", mapping to "${fallbackHandle}"`
                  );
                  validatedEdge.sourceHandle = fallbackHandle;
                  handleChanged = true;
                } else {
                  console.warn(
                    `Edge ${edge.id} has invalid sourceHandle "${edge.sourceHandle}" and no outputs available`
                  );
                  validatedEdge.sourceHandle = undefined;
                  handleChanged = true;
                }
              }
            }

            if (handleChanged) {
              const timestamp = Date.now();
              const baseId = edge.id.split('-')[0];
              validatedEdge.id = `${baseId}-validated-${timestamp}`;
              console.log(
                `Changed edge ID from ${edge.id} to ${validatedEdge.id} after handle validation`
              );
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
  }, [projectId, onNodeClick, persistMarkdownContent, dispatchDeleteEvent]);

  return {
    projectData,
    projectTitle,
    isLoading,
    error,
    isInvalidProject,
    transformedNodes,
    transformedEdges,
    maxNodeId,
    updateStoredNodePosition,
  };
}
