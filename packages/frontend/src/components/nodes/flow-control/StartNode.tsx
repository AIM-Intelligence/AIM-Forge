import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import clsx from "clsx";
import { useExecutionStore } from "../../../stores/executionStore";
import { useNodeValueStore } from "../../../stores/nodeValueStore";
import { useParams } from "react-router-dom";
import { projectApi } from "../../../utils/api";
import LoadingModal from "../../modal/LoadingModal";

// Define ExecutionResult interface locally
interface ExecutionResult {
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  execution_time_ms?: number;
  logs?: string;
}

export type StartNodeType = Node<{
  title: string;
  description: string;
  file?: string; // File path reference for the node's Python code
}>;

export default function StartNode(props: NodeProps<StartNodeType>) {
  const [hovering, setHovering] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    status: "loading" | "success" | "error";
    message: string;
    errorDetails?: string;
  }>({
    isOpen: false,
    status: "loading",
    message: "",
    errorDetails: undefined,
  });
  const { projectId } = useParams<{ projectId: string }>();
  const setExecuting = useExecutionStore((state) => state.setExecuting);
  const setToastMessage = useExecutionStore((state) => state.setToastMessage);
  const setRunId = useExecutionStore((state) => state.setRunId);
  const getResultNodeValues = useExecutionStore((state) => state.getResultNodeValues);
  const getAllNodeValues = useNodeValueStore((state) => state.getAllNodeValues);

  const handleRunFlow = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!projectId) {
      setModalState({
        isOpen: true,
        status: "error",
        message: "Project ID not found",
        errorDetails:
          "Unable to identify the current project. Please refresh the page and try again.",
      });
      return;
    }

    // Generate new run ID for this execution
    const newRunId = `run-${Date.now()}`;
    setRunId(newRunId);

    setIsRunning(true);
    setExecuting(true);
    setModalState({
      isOpen: true,
      status: "loading",
      message: "Starting flow execution...",
      errorDetails: undefined,
    });

    // Don't clear results to preserve values between flows
    // useExecutionStore.getState().clearResults();

    // Get all node values (TextInput nodes from nodeValueStore)
    const textInputValues = getAllNodeValues();
    
    // Get Result node values from executionStore
    const resultNodeValues = getResultNodeValues();
    
    // Combine both types of values
    const allNodeValues = {
      ...textInputValues,
      ...resultNodeValues
    };

    try {
      // Use SSE for streaming results
      await projectApi.executeFlowStream(
        {
          project_id: projectId,
          start_node_id: props.id,
          params: {},
          node_values: allNodeValues,  // Use all node values instead of just resultNodes
          max_workers: 4,
          timeout_sec: 30,
          halt_on_error: true,
        },
        (event) => {
          const store = useExecutionStore.getState();
          
          switch (event.type) {
            case 'start':
              // Set nodes in this pipeline as executing
              const affectedNodes = (event as any).affected_nodes;
              const inputResultNodes = (event as any).input_result_nodes || [];
              
              
              if (affectedNodes) {
                store.setExecutingNodes(affectedNodes);
                
                // Only clear output Result nodes and non-Result nodes
                // Preserve input Result nodes that are being used as inputs
                const nodesToClear = affectedNodes.filter((nodeId: string) => 
                  !inputResultNodes.includes(nodeId)
                );
                
                store.clearNodeResults(nodesToClear);
              }
              
              store.setExecutionProgress(0, event.total_nodes || 0);
              // Don't clear all results, only affected nodes are cleared above
              // Get the current state AFTER clearing
              const currentState = useExecutionStore.getState();
              
              store.setExecutionResults({
                execution_results: currentState.executionResults,  // Keep existing results after clear
                result_nodes: currentState.resultNodes,  // Keep existing results after clear
                execution_order: event.execution_order || [],
                total_execution_time_ms: 0,
                run_id: newRunId,
              });
              setModalState({
                isOpen: true,
                status: "loading",
                message: `Executing ${event.total_nodes} nodes...`,
                errorDetails: undefined,
              });
              break;
              
            case 'node_complete':
              if (event.node_id && event.result) {
                store.updateNodeResult(event.node_id, event.result as ExecutionResult);
                store.setExecutionProgress(event.node_index || 0, event.total_nodes || 0);
                
                setModalState({
                  isOpen: true,
                  status: "loading",
                  // message: `Running flow... (${event.node_index}/${event.total_nodes}) ${event.node_title || ''}`,
                  message: `Running flow... (${event.node_index}/${event.total_nodes})`,
                  errorDetails: undefined,
                });
              }
              break;
              
            case 'complete':
              // Clear executing nodes when complete
              store.setExecutingNodes([]);
              
              if (event.execution_results && event.result_nodes) {
                store.setExecutionResults({
                  execution_results: event.execution_results as Record<string, ExecutionResult>,
                  result_nodes: event.result_nodes as Record<string, unknown>,
                  execution_order: event.execution_order || [],
                  total_execution_time_ms: event.total_execution_time_ms || 0,
                  run_id: newRunId,
                });
              }
              
              const nodeCount = event.execution_order?.length || 0;
              const timeMs = event.total_execution_time_ms || 0;
              
              setModalState({
                isOpen: false,
                status: "success",
                message: "",
                errorDetails: undefined,
              });
              
              setToastMessage(`Flow executed successfully! (${nodeCount} nodes in ${timeMs}ms)`);
              setTimeout(() => setToastMessage(null), 3000);
              
              setIsRunning(false);
              setExecuting(false);
              break;
              
            case 'error':
              setModalState({
                isOpen: true,
                status: "error",
                message: "Flow execution failed",
                errorDetails: event.error || "Unknown error",
              });
              setIsRunning(false);
              setExecuting(false);
              break;
          }
        },
        (error) => {
          console.error('SSE error:', error);
          setModalState({
            isOpen: true,
            status: "error",
            message: "Flow execution failed",
            errorDetails: error.message,
          });
          setIsRunning(false);
          setExecuting(false);
        }
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";

      setModalState({
        isOpen: true,
        status: "error",
        message: "Failed to execute flow",
        errorDetails: `Error: ${errorMessage}${
          errorStack ? "\n\nStack trace:\n" + errorStack : ""
        }`,
      });

      console.error("Flow execution error:", error);
      setIsRunning(false);
      setExecuting(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 부모 컴포넌트에서 처리하도록 이벤트 전달
    const deleteEvent = new CustomEvent("deleteNode", {
      detail: { id: props.id },
      bubbles: true,
    });
    e.currentTarget.dispatchEvent(deleteEvent);
  };

  return (
    <>
      
      {/* Error modal only */}
      <LoadingModal
        isOpen={modalState.isOpen}
        status={modalState.status}
        position="top" // 상단 중앙에 표시
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        notice={{
          loading: modalState.message,
          success: modalState.message,
          error: modalState.message,
          errorDetails: modalState.errorDetails,
        }}
      />
      <div
        className={clsx(
          "bg-black rounded-lg border-2 border-neutral-500 p-4 min-w-[100px] relative flex flex-col items-center justify-center",
          hovering && "border-red-400 shadow-lg"
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* 삭제 버튼 */}
        {hovering && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
          >
            ✕
          </button>
        )}

        <div className="w-full flex flex-col items-center justify-center">
          <h3 className="text-white font-semibold text-sm mb-2">Start</h3>
          <button
            className={clsx(
              "text-xs text-white px-2 py-1 rounded transition-colors",
              isRunning
                ? "bg-neutral-600 cursor-not-allowed"
                : "bg-red-800 hover:bg-red-700"
            )}
            onClick={handleRunFlow}
            disabled={isRunning}
          >
            {isRunning ? "Running..." : "⏵ Run Flow"}
          </button>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3"
          style={{
            right: -11.5,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
    </>
  );
}
