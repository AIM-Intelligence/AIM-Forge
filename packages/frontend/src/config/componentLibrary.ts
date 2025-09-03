/**
 * Component Library Configuration
 * Dynamically builds component library from category index files
 */

import { flowControlComponents } from '../components/nodes/flow-control';
import { paramsComponents } from '../components/nodes/params';
import { inputsComponents } from '../components/nodes/inputs';
import { dataopsComponents } from '../components/nodes/dataops';
import { jailbreakComponents } from '../components/nodes/jailbreak';
import { reportsComponents } from '../components/nodes/reports';

export interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  template: string;  // Template file name in backend
  category?: string;
  nodeType?: "custom" | "start" | "result" | "textInput";
  componentType?: string;  // For extensible component system
}

export interface ComponentCategory {
  id: string;
  name: string;
  icon: string;
  components: ComponentTemplate[];
}

// Build component library from category exports
export const componentLibrary: ComponentCategory[] = [
  {
    id: "flow-control",
    name: "Flow Control",
    icon: "🎮",
    components: flowControlComponents.map(c => ({ ...c, category: "flow-control" })),
  },
  {
    id: "params",
    name: "Parameters",
    icon: "⚙️",
    components: paramsComponents.map(c => ({ ...c, category: "params" })),
  },
  {
    id: "inputs",
    name: "Inputs",
    icon: "📥",
    components: inputsComponents.map(c => ({ ...c, category: "inputs" })),
  },
  {
    id: "dataops",
    name: "Data Operations",
    icon: "🔄",
    components: dataopsComponents.map(c => ({ ...c, category: "dataops" })),
  },
  {
    id: "jailbreak",
    name: "Jailbreak",
    icon: "⚔️",
    components: jailbreakComponents.map(c => ({ ...c, category: "jailbreak" })),
  },
  {
    id: "reports",
    name: "Reports",
    icon: "📊",
    components: reportsComponents.map(c => ({ ...c, category: "reports" })),
  },
].filter(category => category.components.length > 0); // Only show categories with components

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