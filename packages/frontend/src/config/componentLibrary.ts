/**
 * Component Library Configuration
 * Defines available components that can be added to the flow
 */

export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  template: string;  // Template file name in backend
  category: string;
  nodeType?: "custom" | "start" | "result";
}

export interface ComponentCategory {
  id: string;
  name: string;
  icon: string;
  components: ComponentTemplate[];
}

export const componentLibrary: ComponentCategory[] = [
  {
    id: "flow-control",
    name: "Flow Control",
    icon: "🎮",
    components: [
      {
        id: "start-node",
        name: "Start Node",
        description: "Entry point for flow execution",
        icon: "▶️",
        template: "start_node",
        category: "flow-control",
        nodeType: "start",
      },
      {
        id: "result-node",
        name: "Result Node",
        description: "Display execution results",
        icon: "📊",
        template: "result_node",
        category: "flow-control",
        nodeType: "result",
      },
      {
        id: "custom-node",
        name: "Custom Node",
        description: "Blank Python node for custom logic",
        icon: "📝",
        template: "custom_node",
        category: "flow-control",
        nodeType: "custom",
      },
    ],
  },
  {
    id: "aim-inputs",
    name: "AIM Inputs",
    icon: "📥",
    components: [
      {
        id: "csv-loader",
        name: "CSV Loader",
        description: "Load CSV files from local filesystem",
        icon: "📁",
        template: "csv_loader",
        category: "aim-inputs",
      },
  
    ],
  },
  {
    id: "aim-attacks",
    name: "AIM Attacks",
    icon: "⚔️",
    components: [
      {
        id: "gcg-attack",
        name: "GCG Attack",
        description: "Greedy Coordinate Gradient attack",
        icon: "🎯",
        template: "gcg_attack",
        category: "aim-attacks",
      },
      {
        id: "aim-stinger",
        name: "AIM Stinger",
        description: "Multi-turn jailbreak attack via external API",
        icon: "🐝",
        template: "aim_stinger",
        category: "aim-attacks",
      },
    ],
  },
];

// Helper function to get component by template name
export function getComponentByTemplate(templateName: string): ComponentTemplate | undefined {
  for (const category of componentLibrary) {
    const component = category.components.find(c => c.template === templateName);
    if (component) return component;
  }
  return undefined;
}

// Helper function to get all components as flat array
export function getAllComponents(): ComponentTemplate[] {
  return componentLibrary.flatMap(category => category.components);
}