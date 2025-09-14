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
    id: "gpt-chat",
    name: "GPT Chat",
    description: "대화 기록을 유지하는 GPT 모델",
    icon: "💬",
    template: "models/gpt_chat",
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
  {
    id: "together-model",
    name: "Together AI",
    description: "오픈소스 모델 호출 (Llama, Mixtral 등)",
    icon: "🤝",
    template: "models/together_model",
    nodeType: "custom",
    // No special component needed, uses DefaultNode
  },
  // Future components:
  // { id: "gemini-model", name: "Gemini Model", ... },
];