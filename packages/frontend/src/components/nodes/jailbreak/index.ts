/**
 * Jailbreak Components
 * AI security testing and red-teaming components
 */

// Export components (none with custom UI yet)
export {};

// Export metadata for component library
export const jailbreakComponents = [
  {
    id: "aim-stinger",
    name: "AIM Stinger",
    description: "Multi-turn jailbreak attack using AIM Stinger",
    icon: "🐝",
    template: "jailbreak/aim_stinger",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "prompt-injection", name: "Prompt Injection", ... },
  // { id: "adversarial-suffix", name: "Adversarial Suffix", ... },
];