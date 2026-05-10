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
  /**
   * Slice 18: per-message marker for the ``result_message`` render variant.
   * When set, the chat-thread renders the message with an inline thumbnail
   * (left, ~120px square, rounded) of the just-generated image alongside
   * the assistant text (right). Click on the thumbnail opens the existing
   * detail-view (``components/canvas/canvas-detail-view.tsx``) for the
   * generation referenced by ``resultGenerationId``.
   *
   * **Single-attachment semantics:** the marker is set on EXACTLY ONE
   * assistant message — the FIRST proactive starter that arrives after a
   * successful generate cycle. Subsequent assistant turns in the same
   * review-loop do NOT carry the marker so the thumbnail is not repeated
   * in every bubble. The reducer field ``state.lastResultImageUrl`` keeps
   * the URL persistent so every outgoing user-message body still includes
   * ``last_result_image_url`` (multimodal pipeline).
   *
   * Architecture: ``architecture.md`` → "Multimodal Pipeline — Priority
   * Order & Budget" (Priority 2 = Result-Image); wireframes.md → "Screen:
   * Reviewing Turn" Annotation ①.
   */
  resultImageUrl?: string;
  /**
   * Slice 18: companion to ``resultImageUrl`` — the ``generations.id`` of
   * the just-completed generation. Used by the thumbnail click handler in
   * ``chat-thread.tsx`` to open the existing detail-view for exactly this
   * generation (AC-6: Reuse-Pflicht — no new modal).
   */
  resultGenerationId?: string;
}
