// API Request and Response Interfaces for AIM Red Toolkit

import { MarkerType } from "@xyflow/react";

// ==================== Common Types ====================

export interface Position {
  x: number;
  y: number;
}

export interface PortInfo {
  id: string;        // Port ID (parameter name)
  label: string;     // Display label
  type: string;      // Data type (float, int, str, etc.)
  required: boolean; // Whether required
  default?: any;     // Default value
}

export interface NodeData {
  title: string;
  description?: string;
  file?: string;
  mode?: "basic" | "script";  // Node mode
  inputs?: PortInfo[];         // Input ports
  outputs?: PortInfo[];        // Output ports
  viewCode?: () => void;       // Handler for view code button
  updateKey?: number;          // Force re-render when changed
  value?: string;             // For TextInput nodes
  dimensions?: {              // For resizable nodes
    width: number;
    height: number;
  };
  componentType?: string;     // Component type identifier
  [key: string]: unknown;     // Allow additional properties
}

export interface EdgeMarkerEnd {
  type: MarkerType | string;
}

// ==================== Health Check APIs ====================

export interface HealthResponse {
  status: string;
  service: string;
}

export interface VersionResponse {
  python_version: string;
  api_version: string;
}

// ==================== Code Management APIs ====================

// Execute Code
export interface CodeExecutionRequest {
  code: string;
  language?: string; // Default: "python"
  timeout?: number; // Default: 30 seconds
}

export interface CodeExecutionResponse {
  output: string;
  error: string | null;
  exit_code: number;
}

// Get Code
export interface GetNodeCodeRequest {
  project_id: string;
  node_id: string;
  node_title?: string;
}

export interface GetNodeCodeResponse {
  success: boolean;
  code: string;
  language: string;
  node_id: string;
  node_title?: string;
  message?: string; // Present when node not found
}

// Save Code
export interface SaveNodeCodeRequest {
  project_id: string;
  node_id: string;
  node_title?: string;
  code: string;
}

export interface SaveNodeCodeResponse {
  success: boolean;
  message: string;
  file_path: string;
}

// ==================== Project Management APIs ====================

// Project structure interfaces
export interface ProjectInfo {
  project_name: string;
  project_description: string;
  project_id: string;
}

export interface Projects {
  success: boolean;
  projects: ProjectInfo[];
}

export interface ProjectNode {
  id: string;
  type?: string;
  position: Position;
  data: NodeData;
}

export interface ProjectEdge {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  markerEnd?: EdgeMarkerEnd;
}

export interface ProjectStructure {
  project_name: string;
  project_description: string;
  project_id: string;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
}

// Get All Projects
export interface GetAllProjectsResponse {
  success: boolean;
  projects: ProjectInfo[];
}

// Get Single Project
export interface GetProjectResponse {
  success: boolean;
  project: ProjectStructure;
}

// Create Project
export interface CreateProjectRequest {
  project_name: string;
  project_description: string;
  project_id: string;
}

export interface CreateProjectResponse {
  success: boolean;
  message: string;
}

// Delete Project
export interface DeleteProjectRequest {
  project_name: string;
  project_id: string;
}

export interface DeleteProjectResponse {
  success: boolean;
  message: string;
}

// Create Node
export interface CreateNodeRequest {
  project_id: string;
  node_id: string;
  node_type?: string; // Default: "custom"
  position: Position;
  data: NodeData;
}

export interface CreateNodeResponse {
  success: boolean;
  message: string;
  node: ProjectNode;
}

// Delete Node
export interface DeleteNodeRequest {
  project_id: string;
  node_id: string;
}

export interface DeleteNodeResponse {
  success: boolean;
  message: string;
}

// Create Edge
export interface CreateEdgeRequest {
  project_id: string;
  edge_id: string;
  edge_type?: string; // Default: "bezier"
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  marker_end?: EdgeMarkerEnd;
}

export interface CreateEdgeResponse {
  success: boolean;
  message: string;
  edge: ProjectEdge;
}

// Delete Edge
export interface DeleteEdgeRequest {
  project_id: string;
  edge_id: string;
}

export interface DeleteEdgeResponse {
  success: boolean;
  message: string;
}

// ==================== Flow Execution ====================

// Execute Flow Request
export interface ExecuteFlowRequest {
  project_id: string;
  start_node_id?: string;
  params?: Record<string, unknown>;
  result_node_values?: Record<string, unknown>;
  max_workers?: number;
  timeout_sec?: number;
  halt_on_error?: boolean;
}

// Execute Flow Response
export interface ExecuteFlowResponse {
  success: boolean;
  run_id: string;
  execution_results: Record<string, {
    status: 'success' | 'error' | 'skipped';
    output?: unknown;
    error?: string;
    execution_time_ms?: number;
    logs?: string;
  }>;
  result_nodes: Record<string, unknown>;
  execution_order: string[];
  total_execution_time_ms: number;
}

// Analyze Flow Request
export interface AnalyzeFlowRequest {
  project_id: string;
}

// Analyze Flow Response
export interface AnalyzeFlowResponse {
  success: boolean;
  project_id: string;
  analysis: {
    total_nodes: number;
    total_edges: number;
    start_nodes: string[];
    result_nodes: string[];
    has_cycles: boolean;
    unreachable_nodes: string[];
    reachable_from_starts?: Record<string, string[]>;
    suggested_execution_order?: string[];
    parallel_execution_groups?: string[][];
    is_valid: boolean;
    validation_errors: string[];
  };
}

// ==================== Error Response ====================

export interface ErrorResponse {
  detail: string;
}

// ==================== Component Props Types ====================

// For components that use project data
export interface ProjectComponentProps {
  projectId: string;
  projectTitle?: string;
}

// For modal components
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// For IDE components
export interface IdeComponentProps extends ModalProps, ProjectComponentProps {
  nodeId: string;
  nodeTitle: string;
  initialCode?: string;
}

// ==================== Export all types ====================

export type {
  // Re-export all interfaces for convenience
  Position as PositionType,
  NodeData as NodeDataType,
  ProjectNode as ProjectNodeType,
  ProjectEdge as ProjectEdgeType,
  ProjectStructure as ProjectStructureType,
  ProjectInfo as ProjectInfoType,
};
