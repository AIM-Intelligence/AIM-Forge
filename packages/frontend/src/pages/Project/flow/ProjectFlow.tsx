import { useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
  PanOnScrollMode,
  SelectionMode,
  type NodeTypes,
  type EdgeTypes,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DefaultNodeType } from "../../../components/nodes/DefaultNode";
import type { StartNodeType } from "../../../components/nodes/flow-control/StartNode";
import type { ResultNodeType } from "../../../components/nodes/flow-control/ResultNode";
import type { TextInputNodeType } from "../../../components/nodes/params/TextInputNode";
import DefaultNode from "../../../components/nodes/DefaultNode";
import StartNode from "../../../components/nodes/flow-control/StartNode";
import ResultNode from "../../../components/nodes/flow-control/ResultNode";
import TextInputNode from "../../../components/nodes/params/TextInputNode";
import DefaultEdge from "../../../components/edges/DefaultEdge";

// Union type for all node types
type AnyNodeType = DefaultNodeType | StartNodeType | ResultNodeType | TextInputNodeType;

interface ProjectFlowProps {
  nodes: AnyNodeType[];
  edges: Edge[];
  onNodesChange: OnNodesChange<AnyNodeType>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Edge | Connection) => boolean;
  onInit?: (reactFlowInstance: any) => void;
  children?: ReactNode;
}

// Inner component that has access to React Flow context
function ProjectFlowInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onInit,
  children,
}: ProjectFlowProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const pendingUpdatesRef = useRef(new Set<string>());
  const rafRef = useRef<number>(0);
  const reactFlowInstance = useReactFlow();
  
  // Pass React Flow instance to parent when ready
  useEffect(() => {
    if (onInit && reactFlowInstance) {
      onInit(reactFlowInstance);
    }
  }, [onInit, reactFlowInstance]);
  
  // Queue updateNodeInternals calls to batch them
  const queueUpdateInternals = useCallback((nodeId: string) => {
    pendingUpdatesRef.current.add(nodeId);
    
    // Cancel any pending frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Schedule batch update on next frame
    rafRef.current = requestAnimationFrame(() => {
      const updates = Array.from(pendingUpdatesRef.current);
      pendingUpdatesRef.current.clear();
      rafRef.current = 0;
      
      console.log(`Batch updating node internals for: ${updates.join(', ')}`);
      updates.forEach(id => {
        try {
          updateNodeInternals(id);
        } catch (error) {
          console.warn(`Failed to update node internals for ${id}:`, error);
        }
      });
    });
  }, [updateNodeInternals]);
  
  // Listen for custom event to update node internals
  useEffect(() => {
    const handleUpdateNodeInternals = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      queueUpdateInternals(nodeId);
    };
    
    window.addEventListener('reactFlowUpdateNodeInternals' as any, handleUpdateNodeInternals);
    return () => {
      window.removeEventListener('reactFlowUpdateNodeInternals' as any, handleUpdateNodeInternals);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [queueUpdateInternals]);

  // Define node types
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      custom: DefaultNode,
      start: StartNode,
      result: ResultNode,
      textInput: TextInputNode,
    }),
    []
  );

  // Define edge types
  const edgeTypes = useMemo<EdgeTypes>(
    () => ({
      custom: DefaultEdge,
    }),
    []
  );

  // MiniMap node color function
  const nodeColor = () => {
    return "#1e293b";
  };

  return (
    <ReactFlow
        nodes={nodes as any}
        edges={edges}
        onNodesChange={onNodesChange as any}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          type: "custom",
        }}
        style={{ backgroundColor: "transparent" }}
        className="react-flow-transparent"
        deleteKeyCode={null} // Disable delete key
        // Panning configuration
        panOnDrag={[1, 2]} // Middle mouse button (1) and right mouse button (2) for panning
        panOnScroll={true} // Enable panning with scroll (trackpad two-finger swipe)
        panOnScrollMode={PanOnScrollMode.Free} // Allow panning in any direction
        panOnScrollSpeed={1.0} // Normal panning speed
        // Zoom configuration
        zoomOnScroll={false} // Disable zoom on scroll (use pinch or Ctrl+scroll instead)
        zoomOnPinch={true} // Enable pinch-to-zoom for trackpad
        zoomOnDoubleClick={false} // Disable double-click zoom
        // Selection configuration
        selectionOnDrag={true} // Enable selection box by dragging on empty canvas
        selectNodesOnDrag={true} // Allow dragging selected nodes together
        selectionMode={SelectionMode.Partial} // Select nodes partially inside selection box
      >
        <Background
          variant={BackgroundVariant.Cross}
          gap={20}
          size={1}
          color="#374151"
          bgColor="#000000"
        />

        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="#374151"
          nodeStrokeWidth={2}
          className="bg-neutral-900 border-2 border-neutral-700"
          maskColor="rgba(0, 0, 0, 0.5)"
          pannable
          zoomable
        />

        {children && (
          <Panel
            position="top-left"
            className="bg-neutral-800 p-3.5 rounded-lg border border-neutral-700"
          >
            {children}
          </Panel>
        )}
      </ReactFlow>
  );
}

// Main component that wraps everything in ReactFlowProvider
export default function ProjectFlow(props: ProjectFlowProps) {
  return (
    <div
      style={{ width: "100vw", height: "100vh", backgroundColor: "#0a0a0a" }}
    >
      <ReactFlowProvider>
        <ProjectFlowInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
