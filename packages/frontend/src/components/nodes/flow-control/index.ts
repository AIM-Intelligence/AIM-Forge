/**
 * Flow Control Components
 * Core components for flow execution control
 */

import StartNode from './StartNode';
import ResultNode from './ResultNode';

// Export components
export { StartNode, ResultNode };

// Export metadata for component library
export const flowControlComponents = [
  {
    id: "start-node",
    name: "Start Node",
    description: "Entry point for flow execution",
    icon: "▶️",
    template: "flow_control/start_node",
    nodeType: "start",
    component: StartNode,
  },
  {
    id: "result-node",
    name: "Result Node",
    description: "Display execution results",
    icon: "📊",
    template: "flow_control/result_node",
    nodeType: "result",
    component: ResultNode,
  },
  {
    id: "custom-node",
    name: "Custom Node",
    description: "Blank Python node for custom logic",
    icon: "📝",
    template: "flow_control/custom_node",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
];