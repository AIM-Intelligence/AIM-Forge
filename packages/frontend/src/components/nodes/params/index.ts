/**
 * Parameter Components
 * Components for user input and parameter configuration
 */

import TextInputNode from './TextInputNode';

// Export components
export { TextInputNode };

// Export metadata for component library
export const paramsComponents = [
  {
    id: "text-input",
    name: "Text Input",
    description: "Persistent text input for API keys, paths, etc.",
    icon: "📝",
    template: "params/text_input",
    nodeType: "custom",
    componentType: "TextInput",
    component: TextInputNode,
  },
  // Future components:
  // { id: "number-input", name: "Number Input", ... },
  // { id: "boolean-input", name: "Boolean Input", ... },
  // { id: "select-input", name: "Select Input", ... },
];