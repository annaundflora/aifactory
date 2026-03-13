"use client";

// ---------------------------------------------------------------------------
// CanvasChatService
// SSE client for Canvas Agent: session creation (POST), message sending
// (POST + SSE stream parsing), typed events, 60s timeout.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DTOs (matching architecture.md API Design > DTOs)
// ---------------------------------------------------------------------------

export interface CanvasImageContext {
  image_url: string;
  prompt: string;
  model_id: string;
  model_params: Record<string, unknown>;
  generation_id: string;
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
// SSE Line Parser (reuses pattern from use-assistant-runtime.ts)
// ---------------------------------------------------------------------------

function parseSSEChunk(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let eventType = "";
  let dataLines: string[] = [];

  const flush = () => {
    if (eventType && dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join("\n") });
    }
    eventType = "";
    dataLines = [];
  };

  for (const line of lines) {
    if (line === "") {
      flush();
    } else if (line.startsWith("event:")) {
      if (eventType && dataLines.length > 0) {
        flush();
      }
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  flush();
  return events;
}

// ---------------------------------------------------------------------------
// parseSSEEvent — maps raw event type + data string to typed CanvasSSEEvent
// ---------------------------------------------------------------------------

function parseSSEEvent(
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
// AC-1: POST /api/assistant/canvas/sessions with project_id + image_context
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
// AC-2: POST /api/assistant/canvas/sessions/{id}/messages
// AC-3/4/6/8/9: Returns AsyncGenerator yielding typed SSE events with 60s timeout
// ---------------------------------------------------------------------------

export async function* sendMessage(
  sessionId: string,
  content: string,
  imageContext: CanvasImageContext
): AsyncGenerator<CanvasSSEEvent> {
  const response = await fetch(
    `${CANVAS_SESSIONS_URL}/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        image_context: imageContext,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to send canvas message: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  // AC-8: 60s timeout — emits timeout error event when no SSE event received within 60s
  let timedOut = false;
  let lastEventAt = Date.now();

  try {
    // Use a timeout-checked read loop
    while (true) {
      // Check for timeout before each read
      if (Date.now() - lastEventAt >= SSE_TIMEOUT_MS) {
        timedOut = true;
        break;
      }

      // Race the read() against a timeout slice
      const timeRemaining = SSE_TIMEOUT_MS - (Date.now() - lastEventAt);
      const timeoutPromise = new Promise<{ done: true; value: undefined }>(
        (resolve) =>
          setTimeout(
            () => resolve({ done: true as const, value: undefined }),
            timeRemaining
          )
      );
      const readPromise = reader.read();

      const result = await Promise.race([readPromise, timeoutPromise]);

      if (result.done) {
        // Either stream ended or timeout fired
        if (Date.now() - lastEventAt >= SSE_TIMEOUT_MS) {
          timedOut = true;
        }
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });

      const normalized = buffer.replace(/\r\n/g, "\n");
      const lastBoundary = normalized.lastIndexOf("\n\n");

      if (lastBoundary === -1) continue;

      const complete = normalized.slice(0, lastBoundary + 2);
      buffer = normalized.slice(lastBoundary + 2);

      const rawEvents = parseSSEChunk(complete);
      for (const { event, data } of rawEvents) {
        const parsed = parseSSEEvent(event, data);
        if (parsed !== null) {
          lastEventAt = Date.now(); // reset timeout on each valid event
          yield parsed;
        }
      }
    }

    // Process remaining buffer after stream ends
    if (!timedOut && buffer.trim()) {
      const rawEvents = parseSSEChunk(buffer);
      for (const { event, data } of rawEvents) {
        const parsed = parseSSEEvent(event, data);
        if (parsed !== null) {
          yield parsed;
        }
      }
    }

    // AC-8: Emit timeout error event
    if (timedOut) {
      yield {
        type: "error",
        message: "Keine Antwort. Bitte erneut versuchen.",
      } satisfies SSEErrorEvent;
    }
  } finally {
    reader.releaseLock();
  }
}
