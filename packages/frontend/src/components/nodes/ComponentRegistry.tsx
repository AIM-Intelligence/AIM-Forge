import type { ComponentType } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

import * as Params from './params';
import * as Annotations from './annotations';

/**
 * Component Registry for extensible node system
 * Automatically builds registry from category exports
 */

type RegisteredNode = Node<Record<string, unknown>>;
type RegisteredNodeProps = NodeProps<RegisteredNode>;

type Registry = Record<string, ComponentType<RegisteredNodeProps>>;

const entries: Array<[string, ComponentType<RegisteredNodeProps>]> = [];

if (Params.TextInputNode) {
  entries.push(['TextInput', Params.TextInputNode as unknown as ComponentType<RegisteredNodeProps>]);
}

if (Annotations.MarkdownNoteNode) {
  entries.push(['MarkdownNote', Annotations.MarkdownNoteNode as unknown as ComponentType<RegisteredNodeProps>]);
}

export const componentRegistry: Registry = Object.fromEntries(entries);

/**
 * Get component by type
 * @param componentType - The component type string
 * @returns The React component or undefined if not found
 */
export function getComponent(componentType: string): ComponentType<RegisteredNodeProps> | undefined {
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
