// ---------------------------------------------------------------------------
// Unified ChatMessage type for Canvas Chat AND Prompt Assistant
// Shared by: CanvasChatPanel, ChatThread, ChatInput, AssistantContext
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "separator";
  content: string;
  /** True when the assistant message is still streaming */
  isStreaming?: boolean;
  /** Image URLs attached to a user message */
  imageUrls?: string[];
  /** Clarification chips shown below an assistant message */
  chips?: string[];
  /** True when this assistant message represents an error */
  isError?: boolean;
}
