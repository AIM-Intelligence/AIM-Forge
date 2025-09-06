import { useCallback, useEffect, useRef } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeChange,
} from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { projectApi } from "../utils/api";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { StartNodeType } from "../components/nodes/flow-control/StartNode";
import type { ResultNodeType } from "../components/nodes/flow-control/ResultNode";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType;

interface UseNodeOperationsProps {
  projectId: string | undefined;
  initialNodes: AnyNodeType[];
  initialEdges: Edge[];
  nodeIdCounter: number;
  setNodeIdCounter: React.Dispatch<React.SetStateAction<number>>;
  onNodeClick: (nodeId: string, title: string) => void;
}

interface UseNodeOperationsReturn {
  nodes: AnyNodeType[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<AnyNodeType[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: OnNodesChange<AnyNodeType>;
  onEdgesChange: OnEdgesChange<Edge>;
  addNewNode: (nodeData: {
    title: string;
    description: string;
    nodeType: "custom" | "start" | "result";
  }) => Promise<void>;
}

export function useNodeOperations({
  projectId,
  initialNodes,
  initialEdges,
  nodeIdCounter,
  setNodeIdCounter,
  onNodeClick,
}: UseNodeOperationsProps): UseNodeOperationsReturn {
  const [nodes, setNodes, onNodesChangeInternal] =
    useNodesState<AnyNodeType>(initialNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPortUpdateRef = useRef<{ nodeId: string; timestamp: number; hash: string } | null>(null);

  // Update nodes when initialNodes change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when initialEdges change
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Type for tracking edge relinks
  type Relink = { 
    edgeId: string; 
    side: 'source' | 'target'; 
    newHandle: string;
  };

  // Listen for node port updates
  useEffect(() => {
    const handleUpdateNodePorts = (event: CustomEvent) => {
      const { nodeId, metadata } = event.detail;
      
      // Deduplicate events - ignore if same update within 100ms
      const eventHash = JSON.stringify({ nodeId, inputs: metadata.inputs, outputs: metadata.outputs });
      const now = Date.now();
      
      if (lastPortUpdateRef.current) {
        const { nodeId: lastNodeId, timestamp, hash } = lastPortUpdateRef.current;
        if (lastNodeId === nodeId && hash === eventHash && (now - timestamp) < 100) {
          console.log(`Skipping duplicate updateNodePorts event for node ${nodeId}`);
          return;
        }
      }
      
      lastPortUpdateRef.current = { nodeId, timestamp: now, hash: eventHash };
      console.log("Processing updateNodePorts event:", { nodeId, metadata });
      
      // Process metadata
      const hasValidInputs = metadata.inputs && Array.isArray(metadata.inputs) && metadata.inputs.length > 0;
      const hasValidOutputs = metadata.outputs && Array.isArray(metadata.outputs) && metadata.outputs.length > 0;
      
      if (!hasValidInputs && !hasValidOutputs) {
        return; // Nothing to update
      }
      
      const newInputs = hasValidInputs ? metadata.inputs : [];
      const newOutputs = hasValidOutputs ? metadata.outputs : [];
      
      // Get current node to see old ports
      let oldInputs: any[] = [];
      let oldOutputs: any[] = [];
      
      setNodes((currentNodes) => {
        const node = currentNodes.find(n => n.id === nodeId);
        if (node?.data) {
          oldInputs = (node.data as any).inputs || [];
          oldOutputs = (node.data as any).outputs || [];
        }
        return currentNodes; // Return unchanged
      });
      
      // Create mapping from old to new handle names
      const inputMapping = new Map<string, string>();
      const outputMapping = new Map<string, string>();
      
      // Map by position when counts match (use name as both old and new ID)
      if (oldInputs.length === newInputs.length) {
        oldInputs.forEach((old, i) => {
          if (newInputs[i]) {
            // Map from old id to new name (which becomes the new id)
            inputMapping.set(old.id, newInputs[i].name);
          }
        });
      } else if (newInputs.length === 1 && oldInputs.length > 0) {
        // If only one new input, map all old to it
        oldInputs.forEach(old => {
          inputMapping.set(old.id, newInputs[0].name);
        });
      }
      
      if (oldOutputs.length === newOutputs.length) {
        oldOutputs.forEach((old, i) => {
          if (newOutputs[i]) {
            // Map from old id to new name (which becomes the new id)
            outputMapping.set(old.id, newOutputs[i].name);
          }
        });
      } else if (newOutputs.length === 1 && oldOutputs.length > 0) {
        // If only one new output, map all old to it
        oldOutputs.forEach(old => {
          outputMapping.set(old.id, newOutputs[0].name);
        });
      }
      
      // Track edges that need relinking after DOM update
      const relinks: Relink[] = [];
      
      // Prepare the new nodes data
      const nextNodesProducer = (nodes: AnyNodeType[]) => {
        return nodes.map((node) => {
          if (node.id === nodeId) {
            console.log(`Updating node ${nodeId} with metadata:`, metadata);
            
            const inputs = hasValidInputs 
              ? metadata.inputs.map((input: any) => ({
                  id: input.name, // ID is set to name value - this is what Handle will use
                  label: input.name,
                  type: input.type,
                  required: input.required !== false,
                  default: input.default,
                }))
              : (node.data as any).inputs;
            
            const outputs = hasValidOutputs
              ? metadata.outputs.map((output: any) => ({
                  id: output.name, // ID is set to name value - this is what Handle will use
                  label: output.name,
                  type: output.type,
                  required: false,
                  default: undefined,
                }))
              : (node.data as any).outputs;
            
            return {
              ...node,
              data: {
                ...node.data,
                mode: metadata.mode || (node.data as any).mode,
                inputs: inputs,
                outputs: outputs,
                updateKey: Date.now(), // Force re-render
              },
            };
          }
          return node;
        });
      };
      
      // Phase 1: Neutralize edges (remove handles that will be remapped)
      const nextEdgesPhase1 = (edges: Edge[]) => {
        return edges.map((edge) => {
          let updatedEdge = { ...edge };
          
          // Check target handle
          if (edge.target === nodeId && edge.targetHandle) {
            const newHandle = inputMapping.get(edge.targetHandle);
            if (newHandle && newHandle !== edge.targetHandle) {
              // Neutralize: remove handle temporarily
              console.log(`Phase 1: Neutralizing edge ${edge.id} targetHandle: ${edge.targetHandle}`);
              relinks.push({ 
                edgeId: edge.id, 
                side: 'target', 
                newHandle: newHandle 
              });
              updatedEdge.targetHandle = undefined;
            } else if (!newHandle) {
              // Check if handle already exists in new inputs
              const alreadyValid = newInputs.some((input: any) => input.name === edge.targetHandle);
              if (!alreadyValid) {
                console.warn(`Edge ${edge.id} has unmapped target handle: ${edge.targetHandle}`);
                updatedEdge.targetHandle = undefined;
              }
            }
          }
          
          // Check source handle
          if (edge.source === nodeId && edge.sourceHandle) {
            const newHandle = outputMapping.get(edge.sourceHandle);
            if (newHandle && newHandle !== edge.sourceHandle) {
              // Neutralize: remove handle temporarily
              console.log(`Phase 1: Neutralizing edge ${edge.id} sourceHandle: ${edge.sourceHandle}`);
              relinks.push({ 
                edgeId: edge.id, 
                side: 'source', 
                newHandle: newHandle 
              });
              updatedEdge.sourceHandle = undefined;
            } else if (!newHandle) {
              // Check if handle already exists in new outputs
              const alreadyValid = newOutputs.some((output: any) => output.name === edge.sourceHandle);
              if (!alreadyValid) {
                console.warn(`Edge ${edge.id} has unmapped source handle: ${edge.sourceHandle}`);
                updatedEdge.sourceHandle = undefined;
              }
            }
          }
          
          return updatedEdge;
        });
      };
      
      // Phase 1: Apply node updates and neutralize edges in single batch
      unstable_batchedUpdates(() => {
        setNodes(nextNodesProducer);  // Update node ports (new handles in DOM)
        setEdges(nextEdgesPhase1);    // Neutralize edges (remove old handles)
      });
      
      // Frame 1: Trigger updateNodeInternals after DOM update
      requestAnimationFrame(() => {
        console.log(`Frame 1: Triggering updateNodeInternals for node ${nodeId}`);
        const updateInternalsEvent = new CustomEvent("reactFlowUpdateNodeInternals", {
          detail: { nodeId },
          bubbles: true,
        });
        window.dispatchEvent(updateInternalsEvent);
        
        // Frame 2: Reattach handles to edges after internals are updated
        requestAnimationFrame(() => {
          console.log(`Frame 2: Reattaching ${relinks.length} edge handles`);
          
          if (relinks.length > 0) {
            // Phase 2: Reattach new handles to edges
            setEdges((edges) => {
              return edges.map((edge) => {
                // Find relink instructions for this edge
                const targetRelink = relinks.find(r => r.edgeId === edge.id && r.side === 'target');
                const sourceRelink = relinks.find(r => r.edgeId === edge.id && r.side === 'source');
                
                if (!targetRelink && !sourceRelink) {
                  return edge; // No changes needed
                }
                
                // Reattach handles
                const reattached = {
                  ...edge,
                  targetHandle: targetRelink ? targetRelink.newHandle : edge.targetHandle,
                  sourceHandle: sourceRelink ? sourceRelink.newHandle : edge.sourceHandle,
                };
                
                if (targetRelink) {
                  console.log(`Phase 2: Reattached edge ${edge.id} targetHandle: ${targetRelink.newHandle}`);
                }
                if (sourceRelink) {
                  console.log(`Phase 2: Reattached edge ${edge.id} sourceHandle: ${sourceRelink.newHandle}`);
                }
                
                return reattached;
              });
            });
            
            // Update backend with edge changes
            if (projectId) {
              relinks.forEach(relink => {
                // Find the edge to get both handles
                setEdges((edges) => {
                  const edge = edges.find(e => e.id === relink.edgeId);
                  if (edge) {
                    projectApi.updateEdge({
                      project_id: projectId,
                      edge_id: edge.id,
                      source_handle: edge.sourceHandle,
                      target_handle: edge.targetHandle,
                    }).catch(error => {
                      console.error(`Failed to update edge ${edge.id} in backend:`, error);
                    });
                  }
                  return edges; // Return unchanged
                });
              });
            }
          }
        });
      });
    };

    window.addEventListener("updateNodePorts" as any, handleUpdateNodePorts);
    return () => {
      window.removeEventListener("updateNodePorts" as any, handleUpdateNodePorts);
    };
  }, [setNodes, setEdges, projectId]);

  // Custom handler for node changes that persists position updates
  const onNodesChange = useCallback<OnNodesChange<AnyNodeType>>(
    (changes: NodeChange<AnyNodeType>[]) => {
      // Apply changes to local state first
      onNodesChangeInternal(changes as any);

      // Check if any position changes occurred
      const positionChanges = changes.filter(
        (change) => change.type === "position" && change.dragging === false
      );

      if (positionChanges.length > 0 && projectId) {
        // Clear existing timeout
        if (positionUpdateTimeoutRef.current) {
          clearTimeout(positionUpdateTimeoutRef.current);
        }

        // Debounce position updates to avoid too many API calls
        positionUpdateTimeoutRef.current = setTimeout(() => {
          positionChanges.forEach(async (change) => {
            if (change.type === "position" && change.position) {
              try {
                await projectApi.updateNodePosition({
                  project_id: projectId,
                  node_id: change.id,
                  position: change.position,
                });
                console.log(`Position updated for node ${change.id}`);
              } catch (error) {
                console.error(`Failed to update position for node ${change.id}:`, error);
              }
            }
          });
        }, 500); // Wait 500ms after drag ends before updating
      }
    },
    [onNodesChangeInternal, projectId]
  );

  // Add new node
  const addNewNode = useCallback(
    async (nodeData: {
      title: string;
      description: string;
      nodeType: "custom" | "start" | "result";
    }) => {
      if (!projectId) return;

      const nodeId = nodeIdCounter.toString();
      const position = {
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
      };

      try {
        // Call API to create node on backend
        const response = await projectApi.createNode({
          project_id: projectId,
          node_id: nodeId,
          node_type: nodeData.nodeType,
          position: position,
          data: {
            title: nodeData.title,
            description: nodeData.description,
          },
        });

        if (response.success) {
          // Add node to frontend after successful backend creation
          let newNode: AnyNodeType;

          if (nodeData.nodeType === "custom") {
            // Create DefaultNode with viewCode
            newNode = {
              id: nodeId,
              type: "custom",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
                file: response.node.data.file,
                viewCode: () => onNodeClick(nodeId, nodeData.title),
              },
            } as DefaultNodeType;
          } else if (nodeData.nodeType === "start") {
            // Create StartNode without viewCode
            newNode = {
              id: nodeId,
              type: "start",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
                file: response.node.data.file,
              },
            } as StartNodeType;
          } else {
            // Create ResultNode without viewCode or file
            newNode = {
              id: nodeId,
              type: "result",
              position: position,
              data: {
                title: nodeData.title,
                description: nodeData.description,
              },
            } as ResultNodeType;
          }

          setNodes((nds) => [...nds, newNode]);
          setNodeIdCounter((id) => id + 1);
        }
      } catch (error) {
        console.error("Failed to create node:", error);
        alert(
          `Failed to create node: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    [nodeIdCounter, setNodes, projectId, setNodeIdCounter, onNodeClick]
  );

  // Node deletion handler
  useEffect(() => {
    const deleteNodeAsync = async (nodeId: string) => {
      if (!projectId) return;

      // Store current state for rollback
      const previousNodes = nodes;
      const previousEdges = edges;

      // Optimistic update - immediately remove from UI
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );

      try {
        // Call API to delete node on backend
        const response = await projectApi.deleteNode({
          project_id: projectId,
          node_id: nodeId,
        });

        if (!response.success) {
          // Rollback on failure
          setNodes(previousNodes);
          setEdges(previousEdges);
          alert("Failed to delete node");
        }
      } catch (error) {
        // Rollback on error
        setNodes(previousNodes);
        setEdges(previousEdges);
        console.error("Failed to delete node:", error);
        alert(
          `Failed to delete node: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    };

    const handleDeleteNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string }>;
      const nodeId = customEvent.detail.id;
      deleteNodeAsync(nodeId);
    };

    document.addEventListener("deleteNode", handleDeleteNode);
    return () => {
      document.removeEventListener("deleteNode", handleDeleteNode);
    };
  }, [setNodes, setEdges, projectId, nodes, edges]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
    };
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    addNewNode,
  };
}
