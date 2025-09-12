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
    description: "OpenAI GPT 모델 호출 (GPT-3.5/4)",
    icon: "🤖",
    template: "models/gpt_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  {
    id: "claude-model",
    name: "Claude Model",
    description: "Anthropic Claude 모델 호출",
    icon: "🧠",
    template: "models/claude_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "llama-model", name: "Llama Model", ... },
  // { id: "gemini-model", name: "Gemini Model", ... },
];