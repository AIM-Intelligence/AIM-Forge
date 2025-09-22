import type { ProjectNode, ProjectEdge } from "../types";
import type { DefaultNodeType } from "../components/nodes/DefaultNode";
import type { Edge, MarkerType } from "@xyflow/react";

/**
 * Transform backend node to ReactFlow node format
 */
export function transformNodeToReactFlow(
  node: ProjectNode,
  onNodeClick: (nodeId: string, title: string, file?: string) => void
): DefaultNodeType {
  return {
    id: node.id,
    type: node.type || "custom",
    position: node.position,
    data: {
      title: node.data.title || `Node ${node.id}`,
      description: node.data.description || "",
      file: node.data.file,
      viewCode: () => {
        onNodeClick(node.id, node.data.title || `Node ${node.id}`, node.data.file);
      },
    },
  };
}

/**
 * Transform backend edge to ReactFlow edge format
 */
export function transformEdgeToReactFlow(edge: ProjectEdge): Edge {
  return {
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
  };
}

/**
 * Calculate max node ID from existing nodes
 */
export function calculateMaxNodeId(nodes: ProjectNode[]): number {
  if (nodes.length === 0) return 4;
  
  const maxId = Math.max(
    ...nodes.map((n) => parseInt(n.id, 10) || 0)
  );
  return maxId + 1;
}
