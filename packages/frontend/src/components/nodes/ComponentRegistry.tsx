import type { ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';

// Import all category modules
import * as Params from './params';
import * as Annotations from './annotations';

/**
 * Component Registry for extensible node system
 * Automatically builds registry from category exports
 */

// Define the registry type
type ComponentRegistry = {
  [key: string]: ComponentType<NodeProps<any>>;
};

// Build registry dynamically from category exports
export const componentRegistry: ComponentRegistry = {
  // Add components that have componentType defined
  ...(Params.TextInputNode ? { 'TextInput': Params.TextInputNode } : {}),
  ...(Annotations.MarkdownNoteNode ? { 'MarkdownNote': Annotations.MarkdownNoteNode } : {}),
  // Future components will be added automatically when they export with metadata
  // The pattern is: componentType -> Component mapping
};

/**
 * Get component by type
 * @param componentType - The component type string
 * @returns The React component or undefined if not found
 */
export function getComponent(componentType: string): ComponentType<NodeProps<any>> | undefined {
  return componentRegistry[componentType];
}

/**
 * Check if a component type is registered
 * @param componentType - The component type to check
 * @returns true if the component is registered
 */
export function hasComponent(componentType: string): boolean {
  return componentType in componentRegistry;
}

/**
 * Get all registered component types
 * @returns Array of component type strings
 */
export function getComponentTypes(): string[] {
  return Object.keys(componentRegistry);
}
