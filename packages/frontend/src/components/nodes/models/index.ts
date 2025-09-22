/**
 * Model Components
 * AI model integration components for LLM interactions
 */

// Export components (none with custom UI yet)
export {};

// Export metadata for component library
export const modelsComponents = [
  {
    id: "gpt-model",
    name: "GPT Model",
    description: "Call OpenAI models with API key",
    icon: "🤖",
    template: "models/gpt_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  {
    id: "gpt-chat",
    name: "GPT Chat",
    description: "Chat GPT that keeps conversation history",
    icon: "💬",
    template: "models/gpt_chat",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  {
    id: "claude-model",
    name: "Claude Model",
    description: "Call Claude models your API key",
    icon: "🧠",
    template: "models/claude_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  {
    id: "together-model",
    name: "Together AI",
    description: "Call OSS models hosted by Together AI",
    icon: "🤝",
    template: "models/together_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "gemini-model", name: "Gemini Model", ... },
];
