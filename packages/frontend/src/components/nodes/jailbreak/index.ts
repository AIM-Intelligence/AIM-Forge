/**
 * Jailbreak Components
 * AI security testing and red-teaming components
 */

// Export components (none with custom UI yet)
export {};

// Export metadata for component library
export const jailbreakComponents = [
  {
    id: "gcg-attack",
    name: "GCG Attack",
    description: "Greedy Coordinate Gradient attack",
    icon: "🎯",
    template: "jailbreak/gcg_attack",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  {
    id: "aim-stinger",
    name: "AIM Stinger",
    description: "Multi-turn jailbreak attack via external API",
    icon: "🐝",
    template: "jailbreak/aim_stinger",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "prompt-injection", name: "Prompt Injection", ... },
  // { id: "adversarial-suffix", name: "Adversarial Suffix", ... },
];