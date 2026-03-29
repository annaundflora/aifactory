"use client";

// ---------------------------------------------------------------------------
// CanvasChatService
// Thin layer over shared SSE utilities for Canvas Agent communication.
// Session creation (POST) + message sending with canvas-specific event mapping.
// ---------------------------------------------------------------------------

import { consumeSSEStream } from "@/lib/shared/sse-stream";

// ---------------------------------------------------------------------------
// DTOs (matching architecture.md API Design > DTOs)
// ---------------------------------------------------------------------------

export interface CanvasImageContext {
  image_url: string;
  prompt: string;
  model_id: string;
  model_params: Record<string, unknown>;
  generation_id: string;
  tier_models?: Record<string, string>;
  selected_tier?: string;
}

// ---------------------------------------------------------------------------
// SSE Event Types
// ---------------------------------------------------------------------------

export interface SSETextDeltaEvent {
  type: "text-delta";
  content: string;
}

export interface SSETextDoneEvent {
  type: "text-done";
}

export interface SSECanvasGenerateEvent {
  type: "canvas-generate";
  action: "variation" | "img2img";
  prompt: string;
  model_id: string;
  params: Record<string, unknown>;
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type CanvasSSEEvent =
  | SSETextDeltaEvent
  | SSETextDoneEvent
  | SSECanvasGenerateEvent
  | SSEErrorEvent;

// ---------------------------------------------------------------------------
// Session Response
// ---------------------------------------------------------------------------

export interface CanvasSessionResponse {
  id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SSE_TIMEOUT_MS = 60_000;
const CANVAS_SESSIONS_URL = "/api/assistant/canvas/sessions";

// ---------------------------------------------------------------------------
// parseSSEEvent — maps raw event type + data string to typed CanvasSSEEvent
// (Canvas-specific event mapping — stays here, not in shared)
// ---------------------------------------------------------------------------

export function parseSSEEvent(
  eventType: string,
  rawData: string
): CanvasSSEEvent | null {
  try {
    const data = JSON.parse(rawData);

    switch (eventType) {
      case "text-delta": {
        return {
          type: "text-delta",
          content: (data as { content: string }).content ?? "",
        };
      }

      case "text-done": {
        return { type: "text-done" };
      }

      case "canvas-generate": {
        const ev = data as {
          action: "variation" | "img2img";
          prompt: string;
          model_id: string;
          params: Record<string, unknown>;
        };
        return {
          type: "canvas-generate",
          action: ev.action,
          prompt: ev.prompt,
          model_id: ev.model_id,
          params: ev.params ?? {},
        };
      }

      case "error": {
        const err = data as { message?: string };
        return {
          type: "error",
          message: err.message ?? "Ein Fehler ist aufgetreten.",
        };
      }

      default:
        return null;
    }
  } catch {
    console.warn(
      "[canvasChatService] Failed to parse SSE event:",
      eventType,
      rawData
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// createSession
// POST /api/assistant/canvas/sessions with project_id + image_context
// ---------------------------------------------------------------------------

export async function createSession(
  projectId: string,
  imageContext: CanvasImageContext
): Promise<string> {
  const response = await fetch(CANVAS_SESSIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      image_context: imageContext,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to create canvas session: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as CanvasSessionResponse;

  if (!data.id) {
    throw new Error("Canvas session response missing id");
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// sendMessage
// POST /api/assistant/canvas/sessions/{id}/messages
// Uses shared consumeSSEStream with canvas-specific event mapping.
// Callback pattern: onEvent is called for each parsed CanvasSSEEvent.
// ---------------------------------------------------------------------------

export async function sendMessage(
  sessionId: string,
  content: string,
  imageContext: CanvasImageContext,
  onEvent: (event: CanvasSSEEvent) => void,
  signal?: AbortSignal,
  model?: string,
  imageUrl?: string
): Promise<void> {
  const response = await fetch(
    `${CANVAS_SESSIONS_URL}/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        image_context: imageContext,
        ...(model ? { model } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      }),
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to send canvas message: ${response.status} ${response.statusText}`
    );
  }

  await consumeSSEStream(
    response,
    (eventType, rawData) => {
      const parsed = parseSSEEvent(eventType, rawData);
      if (parsed !== null) {
        onEvent(parsed);
      }
    },
    { signal, timeoutMs: SSE_TIMEOUT_MS }
  );
}
