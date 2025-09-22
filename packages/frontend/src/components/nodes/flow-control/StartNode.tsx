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

interface FlowStartEvent {
  type: 'start';
  affected_nodes?: string[];
  input_result_nodes?: string[];
  total_nodes?: number;
  execution_order?: string[];
}

interface FlowNodeCompleteEvent {
  type: 'node_complete';
  node_id?: string;
  result?: ExecutionResult;
  node_index?: number;
  total_nodes?: number;
  node_title?: string;
}

interface FlowCompleteEvent {
  type: 'complete';
  execution_results?: Record<string, ExecutionResult>;
  result_nodes?: Record<string, unknown>;
  execution_order?: string[];
  total_execution_time_ms?: number;
}

interface FlowErrorEvent {
  type: 'error';
  error?: string;
}

type FlowStreamEvent = FlowStartEvent | FlowNodeCompleteEvent | FlowCompleteEvent | FlowErrorEvent;

function toFlowEvent(event: unknown): FlowStreamEvent | null {
  if (!event || typeof event !== 'object') return null;
  const candidate = event as { type?: string };
  if (candidate.type === 'start' || candidate.type === 'node_complete' || candidate.type === 'complete' || candidate.type === 'error') {
    return candidate as FlowStreamEvent;
  }
  return null;
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
        (rawEvent) => {
          const store = useExecutionStore.getState();
          const event = toFlowEvent(rawEvent);
          if (!event) {
            console.warn('Received unknown flow event:', rawEvent);
            return;
          }

          switch (event.type) {
            case 'start': {
              const affectedNodes = event.affected_nodes ?? [];
              const inputResultNodes = event.input_result_nodes ?? [];

              if (affectedNodes.length > 0) {
                store.setExecutingNodes(affectedNodes);

                const nodesToClear = affectedNodes.filter((nodeId) => !inputResultNodes.includes(nodeId));
                if (nodesToClear.length > 0) {
                  store.clearNodeResults(nodesToClear);
                }
              }

              store.setExecutionProgress(0, event.total_nodes || 0);

              const currentState = useExecutionStore.getState();

              store.setExecutionResults({
                execution_results: currentState.executionResults,
                result_nodes: currentState.resultNodes,
                execution_order: event.execution_order || [],
                total_execution_time_ms: 0,
                run_id: newRunId,
              });
              setModalState({
                isOpen: true,
                status: "loading",
                message: `Executing ${event.total_nodes || 0} nodes...`,
                errorDetails: undefined,
              });
              break;
            }

            case 'node_complete': {
              if (event.node_id && event.result) {
                store.updateNodeResult(event.node_id, event.result);
                store.setExecutionProgress(event.node_index || 0, event.total_nodes || 0);

                setModalState({
                  isOpen: true,
                  status: "loading",
                  message: `Running flow... (${event.node_index}/${event.total_nodes})`,
                  errorDetails: undefined,
                });
              }
              break;
            }

            case 'complete': {
              store.setExecutingNodes([]);

              if (event.execution_results && event.result_nodes) {
                store.setExecutionResults({
                  execution_results: event.execution_results,
                  result_nodes: event.result_nodes,
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
            }

            case 'error': {
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
          }
        },
        (error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('SSE error:', error);
          setModalState({
            isOpen: true,
            status: "error",
            message: "Flow execution failed",
            errorDetails: message,
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
