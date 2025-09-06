import { create } from 'zustand';

interface NodeValueState {
  // Store all node values (TextInput, ResultNode, etc.)
  nodeValues: Record<string, unknown>;
  
  // Actions
  getNodeValue: (nodeId: string) => unknown;
  setNodeValue: (nodeId: string, value: unknown) => void;
  getAllNodeValues: () => Record<string, unknown>;
  clearNodeValue: (nodeId: string) => void;
  clearAllValues: () => void;
  
  // Load from localStorage
  loadFromLocalStorage: (projectId: string) => void;
  // Save to localStorage
  saveToLocalStorage: (projectId: string, nodeId: string, value: unknown) => void;
}

export const useNodeValueStore = create<NodeValueState>((set, get) => ({
  nodeValues: {},

  getNodeValue: (nodeId) => {
    return get().nodeValues[nodeId];
  },

  setNodeValue: (nodeId, value) => set((state) => ({
    nodeValues: {
      ...state.nodeValues,
      [nodeId]: value,
    },
  })),

  getAllNodeValues: () => {
    return get().nodeValues;
  },

  clearNodeValue: (nodeId) => set((state) => {
    const newValues = { ...state.nodeValues };
    delete newValues[nodeId];
    return { nodeValues: newValues };
  }),

  clearAllValues: () => set({ nodeValues: {} }),

  loadFromLocalStorage: (projectId) => {
    const allKeys = Object.keys(localStorage);
    const nodeValues: Record<string, unknown> = {};
    
    // Load TextInput values
    const textInputPattern = new RegExp(`^textInput_${projectId}_(.+)$`);
    allKeys.forEach(key => {
      const match = key.match(textInputPattern);
      if (match) {
        const nodeId = match[1];
        const value = localStorage.getItem(key);
        if (value !== null) {
          nodeValues[nodeId] = value;
        }
      }
    });
    
    // Load ResultNode values
    const resultPattern = new RegExp(`^result_${projectId}_(.+)$`);
    allKeys.forEach(key => {
      const match = key.match(resultPattern);
      if (match) {
        const nodeId = match[1];
        const value = localStorage.getItem(key);
        if (value !== null) {
          try {
            nodeValues[nodeId] = JSON.parse(value);
          } catch {
            nodeValues[nodeId] = value;
          }
        }
      }
    });
    
    set({ nodeValues });
  },

  saveToLocalStorage: (projectId, nodeId, value) => {
    // Save based on node type (currently only TextInput uses localStorage)
    // This can be extended for other node types
    if (typeof value === 'string' || typeof value === 'number') {
      const key = `textInput_${projectId}_${nodeId}`;
      localStorage.setItem(key, String(value));
    }
  },
}));