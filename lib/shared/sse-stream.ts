// ---------------------------------------------------------------------------
// Shared SSE Utilities
// Parser + Stream Consumer for SSE (Server-Sent Events) streams.
// Used by Canvas-Chat and available for other SSE consumers.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SSEEventHandler = (eventType: string, rawData: string) => void;

export interface ConsumeSSEOptions {
  signal?: AbortSignal;
  /** Timeout in ms — emits error event if no SSE event received within this window */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// parseSSEEvents
// ---------------------------------------------------------------------------

/**
 * Parses a raw SSE text block into individual events.
 * SSE format: `event: {type}\ndata: {json}\n\n`
 *
 * Uses line-by-line parsing per the SSE spec: an empty line (or end of input)
 * signals the end of the current event. Correctly handles multiple events
 * in a single text block, regardless of how chunk boundaries align.
 */
export function parseSSEEvents(
  rawText: string
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

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
      // Flush previous event if a new event: field appears without separator
      if (eventType && dataLines.length > 0) {
        flush();
      }
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
    // Ignore comments (lines starting with ':') and unknown fields per spec
  }

  // Flush any trailing event that wasn't terminated by an empty line
  flush();

  return events;
}

// ---------------------------------------------------------------------------
// consumeSSEStream
// ---------------------------------------------------------------------------

/**
 * Consumes an SSE stream from a fetch Response, calling onEvent for each
 * parsed event. Handles buffering, UTF-8 decoding, and boundary detection.
 *
 * @param response - Fetch Response with readable body
 * @param onEvent - Called for each parsed SSE event (eventType, rawData JSON string)
 * @param options - Optional AbortSignal and timeout configuration
 */
export async function consumeSSEStream(
  response: Response,
  onEvent: SSEEventHandler,
  options?: ConsumeSSEOptions
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is null");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const timeoutMs = options?.timeoutMs;
  let lastEventAt = Date.now();
  let timedOut = false;

  try {
    while (true) {
      if (options?.signal?.aborted) break;

      // Check for timeout before reading
      if (timeoutMs && Date.now() - lastEventAt >= timeoutMs) {
        timedOut = true;
        break;
      }

      let result: ReadableStreamReadResult<Uint8Array>;

      if (timeoutMs) {
        // Race the read against a timeout
        const timeRemaining = timeoutMs - (Date.now() - lastEventAt);
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const timeoutPromise = new Promise<{ done: true; value: undefined }>(
          (resolve) => {
            timeoutId = setTimeout(
              () => resolve({ done: true as const, value: undefined }),
              timeRemaining
            );
          }
        );

        result = await Promise.race([reader.read(), timeoutPromise]);
        clearTimeout(timeoutId);

        if (result.done && Date.now() - lastEventAt >= timeoutMs) {
          timedOut = true;
          break;
        }
      } else {
        result = await reader.read();
      }

      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });

      // Find the last complete event boundary (\n\n)
      const normalized = buffer.replace(/\r\n/g, "\n");
      const lastBoundary = normalized.lastIndexOf("\n\n");

      if (lastBoundary === -1) continue;

      const complete = normalized.slice(0, lastBoundary + 2);
      buffer = normalized.slice(lastBoundary + 2);

      const events = parseSSEEvents(complete);
      for (const { event, data } of events) {
        lastEventAt = Date.now();
        onEvent(event, data);
      }
    }

    // Process remaining buffer after stream ends
    if (!timedOut && buffer.trim()) {
      const events = parseSSEEvents(buffer);
      for (const { event, data } of events) {
        onEvent(event, data);
      }
    }

    // Emit timeout error
    if (timedOut) {
      onEvent(
        "error",
        JSON.stringify({ message: "Keine Antwort. Bitte erneut versuchen." })
      );
    }
  } finally {
    reader.releaseLock();
  }
}
