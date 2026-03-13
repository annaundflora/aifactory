// ---------------------------------------------------------------------------
// ChatMessage type for Canvas Chat
// Used by CanvasChatPanel, CanvasChatMessages, CanvasChatInput
// Consumer: slice-17-canvas-chat-frontend
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "bot" | "system" | "separator";
  content: string;
  chips?: string[];
  /** True when this bot message represents an error (SSE error event or timeout) */
  isError?: boolean;
}
