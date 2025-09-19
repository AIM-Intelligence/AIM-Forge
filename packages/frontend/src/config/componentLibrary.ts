/**
 * Component Library Configuration
 * Dynamically builds component library from category index files
 */

import { flowControlComponents } from '../components/nodes/flow-control';
import { paramsComponents } from '../components/nodes/params';
import { inputsComponents } from '../components/nodes/inputs';
import { dataopsComponents } from '../components/nodes/dataops';
import { modelsComponents } from '../components/nodes/models';
import { jailbreakComponents } from '../components/nodes/jailbreak';
import { reportsComponents } from '../components/nodes/reports';
import { annotationsComponents } from '../components/nodes/annotations';

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
const withCategory = (components: ComponentTemplate[], category: string) =>
  components.map(component => ({ ...component, category }));

export const componentLibrary: ComponentCategory[] = [
  {
    id: "flow-control",
    name: "Flow Control",
    icon: "🎮",
    components: withCategory(flowControlComponents as ComponentTemplate[], "flow-control"),
  },
  {
    id: "params",
    name: "Parameters",
    icon: "⚙️",
    components: withCategory(paramsComponents as ComponentTemplate[], "params"),
  },
  {
    id: "inputs",
    name: "Inputs",
    icon: "📥",
    components: withCategory(inputsComponents as ComponentTemplate[], "inputs"),
  },
  {
    id: "dataops",
    name: "Data Operations",
    icon: "🔄",
    components: withCategory(dataopsComponents as ComponentTemplate[], "dataops"),
  },
  {
    id: "models",
    name: "AI Models",
    icon: "🤖",
    components: withCategory(modelsComponents as ComponentTemplate[], "models"),
  },
  {
    id: "jailbreak",
    name: "Jailbreak",
    icon: "⚔️",
    components: withCategory(jailbreakComponents as ComponentTemplate[], "jailbreak"),
  },
  {
    id: "reports",
    name: "Reports",
    icon: "📊",
    components: withCategory(reportsComponents as ComponentTemplate[], "reports"),
  },
  {
    id: "annotations",
    name: "Annotations",
    icon: "🗒️",
    components: withCategory(annotationsComponents as ComponentTemplate[], "annotations"),
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
