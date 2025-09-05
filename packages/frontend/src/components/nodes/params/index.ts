/**
 * Parameter Components
 * Components for user input and parameter configuration
 */

import TextInputNode from './TextInputNode';
import NoteNode from './NoteNode';

// Export components
export { TextInputNode, NoteNode };

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
  {
    id: "note",
    name: "Note",
    description: "Canvas note for annotations and documentation",
    icon: "📌",
    template: null, // No backend template needed
    nodeType: "custom",
    componentType: "Note",
    component: NoteNode,
  },
  // Future components:
  // { id: "number-input", name: "Number Input", ... },
  // { id: "boolean-input", name: "Boolean Input", ... },
  // { id: "select-input", name: "Select Input", ... },
];