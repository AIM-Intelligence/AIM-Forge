import { create } from 'zustand';

interface ExecutionResult {
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  execution_time_ms?: number;
  logs?: string;
  display_metadata?: {
    display: unknown;
    full_ref?: string;
    is_truncated?: boolean;
    raw_value?: unknown;
  };
}

interface ExecutionState {
  isExecuting: boolean;
  executionResults: Record<string, ExecutionResult>;
  resultNodes: Record<string, unknown>;
  executionOrder: string[];
  totalExecutionTime: number;
  runId: string | null;
  toastMessage: string | null;
  currentExecutingNode: string | null;
  executingNodes: Set<string>;  // Nodes in currently executing pipeline
  executionProgress: {
    current: number;
    total: number;
  };
  
  // Actions
  setExecuting: (isExecuting: boolean) => void;
  setExecutionResults: (results: {
    execution_results: Record<string, ExecutionResult>;
    result_nodes: Record<string, unknown>;
    execution_order: string[];
    total_execution_time_ms: number;
    run_id: string;
  }) => void;
  updateNodeResult: (nodeId: string, result: ExecutionResult) => void;
  setExecutionProgress: (current: number, total: number) => void;
  setCurrentExecutingNode: (nodeId: string | null) => void;
  clearResults: () => void;
  getNodeResult: (nodeId: string) => unknown;
  setNodeResult: (nodeId: string, value: unknown) => void;
  setToastMessage: (message: string | null) => void;
  // New helpers for individual node subscription
  getNodeExecutionResult: (nodeId: string) => ExecutionResult | undefined;
  setRunId: (runId: string) => void;
  // Pipeline-specific execution management
  setExecutingNodes: (nodeIds: string[]) => void;
  clearNodeResults: (nodeIds: string[]) => void;
  getResultNodeValues: () => Record<string, unknown>;
  isNodeExecuting: (nodeId: string) => boolean;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  isExecuting: false,
  executionResults: {},
  resultNodes: {},
  executionOrder: [],
  totalExecutionTime: 0,
  runId: null,
  toastMessage: null,
  currentExecutingNode: null,
  executingNodes: new Set<string>(),
  executionProgress: {
    current: 0,
    total: 0,
  },

  setExecuting: (isExecuting) => set({ isExecuting }),

  setExecutionResults: (results) => set((state) => ({
    executionResults: {
      ...state.executionResults,  // 기존 결과 유지
      ...results.execution_results  // 새 결과로 덮어쓰기
    },
    resultNodes: {
      ...state.resultNodes,  // 기존 result nodes 유지
      ...results.result_nodes  // 새 result nodes로 덮어쓰기
    },
    executionOrder: results.execution_order,
    totalExecutionTime: results.total_execution_time_ms,
    runId: results.run_id,
    isExecuting: false,
  })),

  updateNodeResult: (nodeId, result) => set((state) => {
    const updatedResults = {
      ...state.executionResults,
      [nodeId]: result,
    };
    
    // If it's a result node and has output, update resultNodes
    let updatedResultNodes = state.resultNodes;
    if (result.status === 'success' && result.output !== undefined) {
      // Store successful result node values for reuse
      updatedResultNodes = {
        ...state.resultNodes,
        [nodeId]: result.output,
      };
    }
    
    return {
      executionResults: updatedResults,
      resultNodes: updatedResultNodes,
    };
  }),

  setExecutionProgress: (current, total) => set({
    executionProgress: { current, total }
  }),

  setCurrentExecutingNode: (nodeId) => set({
    currentExecutingNode: nodeId
  }),

  clearResults: () => set({
    executionResults: {},
    resultNodes: {},
    executionOrder: [],
    totalExecutionTime: 0,
    runId: null,
    currentExecutingNode: null,
    executionProgress: { current: 0, total: 0 },
  }),

  getNodeResult: (nodeId) => {
    const state = get();
    // First check if it's a result node
    if (state.resultNodes[nodeId] !== undefined) {
      return state.resultNodes[nodeId];
    }
    // Then check execution results
    if (state.executionResults[nodeId]) {
      return state.executionResults[nodeId].output;
    }
    return null;
  },

  setNodeResult: (nodeId, value) => set((state) => ({
    resultNodes: {
      ...state.resultNodes,
      [nodeId]: value,
    },
  })),

  setToastMessage: (message) => set({ toastMessage: message }),

  // New helpers for individual node subscription
  getNodeExecutionResult: (nodeId) => {
    return get().executionResults[nodeId];
  },

  setRunId: (runId) => set({ runId }),

  // Pipeline-specific execution management
  setExecutingNodes: (nodeIds) => {
    set({ 
      executingNodes: new Set(nodeIds) 
    });
  },

  clearNodeResults: (nodeIds) => set((state) => {
    const newExecutionResults = { ...state.executionResults };
    const newResultNodes = { ...state.resultNodes };
    
    nodeIds.forEach(nodeId => {
      delete newExecutionResults[nodeId];
      delete newResultNodes[nodeId];
    });
    
    return {
      executionResults: newExecutionResults,
      resultNodes: newResultNodes,
    };
  }),

  isNodeExecuting: (nodeId) => {
    return get().executingNodes.has(nodeId);
  },

  getResultNodeValues: () => {
    return get().resultNodes;
  },
}));