// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import AFTER mocks
import {
  createSession,
  sendMessage,
  parseSSEEvent,
  type CanvasImageContext,
  type CanvasSSEEvent,
} from "@/lib/canvas-chat-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageContext(
  overrides: Partial<CanvasImageContext> = {}
): CanvasImageContext {
  return {
    image_url: overrides.image_url ?? "https://example.com/image.png",
    prompt: overrides.prompt ?? "a test prompt",
    model_id: overrides.model_id ?? "flux-2-max",
    model_params: overrides.model_params ?? {},
    generation_id: overrides.generation_id ?? "gen-1",
  };
}

/**
 * Creates a ReadableStream from a series of SSE text chunks.
 * Each chunk is encoded as UTF-8 bytes via TextEncoder.
 */
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Collects all events from the callback-based sendMessage.
 */
async function collectEvents(
  sessionId: string,
  content: string,
  imageContext: CanvasImageContext,
  signal?: AbortSignal
): Promise<CanvasSSEEvent[]> {
  const events: CanvasSSEEvent[] = [];
  await sendMessage(
    sessionId,
    content,
    imageContext,
    (event) => events.push(event),
    signal
  );
  return events;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // AC-1: Session erstellen
  // -------------------------------------------------------------------------

  it("AC-1: should create a canvas session via POST with project_id and image_context", async () => {
    const imageContext = makeImageContext();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "session-abc-123" }),
    });

    const sessionId = await createSession("project-42", imageContext);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/assistant/canvas/sessions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "project-42",
          image_context: imageContext,
        }),
      })
    );
    expect(sessionId).toBe("session-abc-123");
  });

  it("AC-1: should throw when session creation fails (non-ok response)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      createSession("project-42", makeImageContext())
    ).rejects.toThrow("Failed to create canvas session: 500 Internal Server Error");
  });

  it("AC-1: should throw when session response is missing id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(
      createSession("project-42", makeImageContext())
    ).rejects.toThrow("Canvas session response missing id");
  });

  // -------------------------------------------------------------------------
  // AC-2: Nachricht senden und SSE-Stream oeffnen
  // -------------------------------------------------------------------------

  it("AC-2: should send message via POST with content and image_context", async () => {
    vi.useRealTimers();

    const imageContext = makeImageContext();
    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"OK"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("session-xyz", "mach den Hintergrund blauer", imageContext);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/assistant/canvas/sessions/session-xyz/messages",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "mach den Hintergrund blauer",
          image_context: imageContext,
        }),
      })
    );
    expect(events.length).toBeGreaterThan(0);
  });

  it("AC-2: should throw when send message response is not ok", async () => {
    vi.useRealTimers();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(
      collectEvents("session-xyz", "test", makeImageContext())
    ).rejects.toThrow("Failed to send canvas message: 404 Not Found");
  });

  it("AC-2: should throw when response body is null", async () => {
    vi.useRealTimers();

    mockFetch.mockResolvedValueOnce({ ok: true, body: null });

    await expect(
      collectEvents("session-xyz", "test", makeImageContext())
    ).rejects.toThrow("Response body is null");
  });

  // -------------------------------------------------------------------------
  // AC-3: text-delta Events parsen
  // -------------------------------------------------------------------------

  it("AC-3: should parse text-delta SSE events and yield incremental text chunks", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"Hello"}\n\n',
      'event:text-delta\ndata:{"content":" world"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    const textDeltas = events.filter((e) => e.type === "text-delta");
    expect(textDeltas).toHaveLength(2);
    expect(textDeltas[0]).toEqual({ type: "text-delta", content: "Hello" });
    expect(textDeltas[1]).toEqual({ type: "text-delta", content: " world" });
  });

  it("AC-3: should handle text-delta with missing content gracefully", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    const textDeltas = events.filter((e) => e.type === "text-delta");
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]).toEqual({ type: "text-delta", content: "" });
  });

  // -------------------------------------------------------------------------
  // AC-4: text-done Event parsen
  // -------------------------------------------------------------------------

  it("AC-4: should parse text-done SSE event", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"Done"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    const textDone = events.filter((e) => e.type === "text-done");
    expect(textDone).toHaveLength(1);
    expect(textDone[0]).toEqual({ type: "text-done" });
  });

  // -------------------------------------------------------------------------
  // AC-6: canvas-generate Event parsen
  // -------------------------------------------------------------------------

  it("AC-6: should parse canvas-generate SSE event", async () => {
    vi.useRealTimers();

    const generateData = JSON.stringify({
      action: "variation",
      prompt: "blue sky background",
      model_id: "flux-2-max",
      params: { steps: 30 },
    });

    const sseBody = createSSEStream([
      `event:canvas-generate\ndata:${generateData}\n\n`,
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "canvas-generate",
      action: "variation",
      prompt: "blue sky background",
      model_id: "flux-2-max",
      params: { steps: 30 },
    });
  });

  it("AC-6: should default params to empty object when missing", async () => {
    vi.useRealTimers();

    const generateData = JSON.stringify({
      action: "img2img",
      prompt: "test prompt",
      model_id: "model-x",
    });

    const sseBody = createSSEStream([
      `event:canvas-generate\ndata:${generateData}\n\n`,
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "canvas-generate",
      action: "img2img",
      prompt: "test prompt",
      model_id: "model-x",
      params: {},
    });
  });

  // -------------------------------------------------------------------------
  // AC-8: Timeout nach 60s
  // -------------------------------------------------------------------------

  it("AC-8: should emit timeout error when no SSE event received within 60 seconds", async () => {
    vi.useRealTimers();

    // Create a stream that never sends data
    const neverResolvingStream = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise<void>(() => {});
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: neverResolvingStream });

    // Mock Date.now to jump forward past timeout
    const baseTime = Date.now();
    let callCount = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      if (callCount === 1) return baseTime;
      return baseTime + 61_000;
    });

    const events = await collectEvents("s1", "test", makeImageContext());

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({
      type: "error",
      message: "Keine Antwort. Bitte erneut versuchen.",
    });

    vi.spyOn(Date, "now").mockRestore();
  });

  // -------------------------------------------------------------------------
  // AC-9: error Event parsen
  // -------------------------------------------------------------------------

  it("AC-9: should parse error SSE event", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:error\ndata:{"message":"Rate limit exceeded"}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "error", message: "Rate limit exceeded" });
  });

  it("AC-9: should use default error message when missing", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream(['event:error\ndata:{}\n\n']);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "error", message: "Ein Fehler ist aufgetreten." });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it("should handle multiple events in a single chunk", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"A"}\n\nevent:text-delta\ndata:{"content":"B"}\n\nevent:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "text-delta", content: "A" });
    expect(events[1]).toEqual({ type: "text-delta", content: "B" });
    expect(events[2]).toEqual({ type: "text-done" });
  });

  it("should handle events split across multiple chunks", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      "event:text-delta\n",
      'data:{"content":"split"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    const textDeltas = events.filter((e) => e.type === "text-delta");
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]).toEqual({ type: "text-delta", content: "split" });
  });

  it("should ignore unknown event types", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:unknown-type\ndata:{"foo":"bar"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text-done" });
  });

  it("should handle malformed JSON data gracefully", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      "event:text-delta\ndata:not-valid-json\n\n",
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents("s1", "test", makeImageContext());

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text-done" });
  });

  it("should pass AbortSignal to fetch", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream(['event:text-done\ndata:{}\n\n']);
    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const controller = new AbortController();
    await collectEvents("s1", "test", makeImageContext(), controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});

// ---------------------------------------------------------------------------
// parseSSEEvent (canvas-specific event mapping)
// ---------------------------------------------------------------------------

describe("parseSSEEvent", () => {
  it("maps text-delta event", () => {
    const result = parseSSEEvent("text-delta", '{"content":"hi"}');
    expect(result).toEqual({ type: "text-delta", content: "hi" });
  });

  it("maps text-done event", () => {
    const result = parseSSEEvent("text-done", "{}");
    expect(result).toEqual({ type: "text-done" });
  });

  it("maps canvas-generate event", () => {
    const result = parseSSEEvent(
      "canvas-generate",
      '{"action":"variation","prompt":"test","model_id":"m1","params":{"s":1}}'
    );
    expect(result).toEqual({
      type: "canvas-generate",
      action: "variation",
      prompt: "test",
      model_id: "m1",
      params: { s: 1 },
    });
  });

  it("maps error event", () => {
    const result = parseSSEEvent("error", '{"message":"fail"}');
    expect(result).toEqual({ type: "error", message: "fail" });
  });

  it("returns null for unknown event type", () => {
    const result = parseSSEEvent("unknown", "{}");
    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const result = parseSSEEvent("text-delta", "not-json");
    expect(result).toBeNull();
  });
});
