// API utility functions using the defined interfaces

import type {
  CreateProjectRequest,
  CreateProjectResponse,
  GetAllProjectsResponse,
  GetProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  CreateNodeRequest,
  CreateNodeResponse,
  DeleteNodeRequest,
  DeleteNodeResponse,
  CreateEdgeRequest,
  CreateEdgeResponse,
  DeleteEdgeRequest,
  DeleteEdgeResponse,
  CodeExecutionRequest,
  CodeExecutionResponse,
  GetNodeCodeRequest,
  GetNodeCodeResponse,
  SaveNodeCodeRequest,
  SaveNodeCodeResponse,
  ExecuteFlowRequest,
  ExecuteFlowResponse,
  AnalyzeFlowRequest,
  AnalyzeFlowResponse,
  ErrorResponse,
} from "../types";

const API_BASE_URL = "/api";

// Helper function for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // Try to parse error response, but handle cases where it's not JSON
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error: ErrorResponse = await response.json();
        errorMessage = error.detail || errorMessage;
      }
    } catch (e) {
      // If parsing fails, use the default error message
      console.error("Failed to parse error response:", e);
    }
    throw new Error(errorMessage);
  }

  // Check if response has content before trying to parse
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  
  // If response is empty or not JSON, return empty object
  if (contentLength === "0" || !response.body) {
    return {} as T;
  }
  
  // Check if response is JSON
  if (!contentType || !contentType.includes("application/json")) {
    console.warn(`Expected JSON response but got ${contentType}`);
    return {} as T;
  }

  // Try to parse JSON response
  try {
    return await response.json();
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    return {} as T;
  }
}

// ==================== Project APIs ====================

export const projectApi = {
  // Get all projects
  async getAllProjects(): Promise<GetAllProjectsResponse> {
    return apiCall<GetAllProjectsResponse>("/project/");
  },

  // Get single project
  async getProject(projectId: string): Promise<GetProjectResponse> {
    return apiCall<GetProjectResponse>(`/project/${projectId}`);
  },

  // Create project
  async createProject(
    data: CreateProjectRequest
  ): Promise<CreateProjectResponse> {
    return apiCall<CreateProjectResponse>("/project/make", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete project
  async deleteProject(
    data: DeleteProjectRequest
  ): Promise<DeleteProjectResponse> {
    return apiCall<DeleteProjectResponse>("/project/delete", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },

  // Create node
  async createNode(data: CreateNodeRequest): Promise<CreateNodeResponse> {
    return apiCall<CreateNodeResponse>("/project/makenode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete node
  async deleteNode(data: DeleteNodeRequest): Promise<DeleteNodeResponse> {
    return apiCall<DeleteNodeResponse>("/project/deletenode", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },

  // Update node position
  async updateNodePosition(data: {
    project_id: string;
    node_id: string;
    position: { x: number; y: number };
  }): Promise<{
    success: boolean;
    message: string;
    node_id: string;
    position: { x: number; y: number };
  }> {
    return apiCall("/project/updatenode/position", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Update node data (value, dimensions, etc.)
  async updateNodeData(data: {
    project_id: string;
    node_id: string;
    data: Record<string, unknown>;
  }): Promise<{ success: boolean; message?: string; data?: Record<string, unknown> }> {
    return apiCall("/project/updatenode/data", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Create edge
  async createEdge(data: CreateEdgeRequest): Promise<CreateEdgeResponse> {
    return apiCall<CreateEdgeResponse>("/project/makeedge", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Delete edge
  async deleteEdge(data: DeleteEdgeRequest): Promise<DeleteEdgeResponse> {
    return apiCall<DeleteEdgeResponse>("/project/deleteedge", {
      method: "DELETE",
      body: JSON.stringify(data),
    });
  },

  // Update edge handles
  async updateEdge(data: {
    project_id: string;
    edge_id: string;
    source_handle?: string | null;
    target_handle?: string | null;
  }): Promise<{ success: boolean; message?: string }> {
    return apiCall("/project/updateedge", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Execute flow
  async executeFlow(data: ExecuteFlowRequest): Promise<ExecuteFlowResponse> {
    return apiCall<ExecuteFlowResponse>("/project/execute-flow", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Execute flow with streaming
  async executeFlowStream(
    data: ExecuteFlowRequest,
    onEvent: (event: {
      type: 'start' | 'node_complete' | 'complete' | 'error';
      node_id?: string;
      node_title?: string;
      node_index?: number;
      total_nodes?: number;
      result?: unknown;
      execution_results?: unknown;
      result_nodes?: unknown;
      execution_order?: string[];
      total_execution_time_ms?: number;
      error?: string;
      timestamp?: number;
    }) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const url = `${API_BASE_URL}/project/execute-flow-stream`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data);
              onEvent(event);
              
              // Stop reading if we get a complete or error event
              if (event.type === 'complete' || event.type === 'error') {
                reader.cancel();
                return;
              }
            } catch (error) {
              console.error('Failed to parse SSE event:', error, data);
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE streaming error:', error);
      if (onError) onError(error as Error);
    }
  },

  // Analyze flow
  async analyzeFlow(data: AnalyzeFlowRequest): Promise<AnalyzeFlowResponse> {
    return apiCall<AnalyzeFlowResponse>("/project/analyze-flow", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ==================== Code APIs ====================

export const codeApi = {
  // Execute code
  async executeCode(
    data: CodeExecutionRequest
  ): Promise<CodeExecutionResponse> {
    return apiCall<CodeExecutionResponse>("/code/execute", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get node code
  async getNodeCode(data: GetNodeCodeRequest): Promise<GetNodeCodeResponse> {
    return apiCall<GetNodeCodeResponse>("/code/getcode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Save node code
  async saveNodeCode(data: SaveNodeCodeRequest): Promise<SaveNodeCodeResponse> {
    return apiCall<SaveNodeCodeResponse>("/code/savecode", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Execute single node
  async executeNode(data: {
    project_id: string;
    node_id: string;
    input_data?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    output?: unknown;
    error?: string;
    traceback?: string;
    output_raw?: string;
    node_id: string;
  }> {
    return apiCall("/code/execute-node", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Get node metadata (RunScript signature)
  async getNodeMetadata(data: {
    project_id: string;
    node_id: string;
    node_data?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    project_id: string;
    node_id: string;
    metadata: {
      mode: "script" | "basic" | "unknown";
      inputs: Array<{
        name: string;
        type: string;
        default?: unknown;
        required?: boolean;
      }>;
      outputs: Array<{
        name: string;
        type: string;
      }>;
      function_name?: string;
      error?: string;
    };
    error?: string;
  }> {
    return apiCall("/code/node/metadata", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

};

// Export all API functions
export default {
  project: projectApi,
  code: codeApi,
};
