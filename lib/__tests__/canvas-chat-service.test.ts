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
 * Collects all events from the sendMessage async generator.
 */
async function collectEvents(
  gen: AsyncGenerator<CanvasSSEEvent>
): Promise<CanvasSSEEvent[]> {
  const events: CanvasSSEEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
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

  /**
   * AC-1: GIVEN die CanvasDetailView ist mit einem Bild geoeffnet und das Chat-Panel ist expanded
   *       WHEN das Panel erstmals rendert
   *       THEN wird automatisch eine Canvas-Session via POST /api/assistant/canvas/sessions
   *            erstellt mit der project_id und dem aktuellen image_context
   */
  it("AC-1: should create a canvas session via POST with project_id and image_context", async () => {
    const imageContext = makeImageContext();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "session-abc-123" }),
    });

    const sessionId = await createSession("project-42", imageContext);

    // Verify POST call
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

    // Verify returned session ID
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

  /**
   * AC-2: GIVEN eine Canvas-Session existiert
   *       WHEN der User "mach den Hintergrund blauer" eingibt und Send klickt
   *       THEN wird POST /api/assistant/canvas/sessions/{id}/messages aufgerufen
   *            mit dem Nachrichten-Text und dem aktuellen image_context,
   *            und ein SSE-Stream wird geoeffnet
   */
  it("AC-2: should send message via POST with content and image_context and return SSE stream", async () => {
    vi.useRealTimers();

    const imageContext = makeImageContext();
    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"OK"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody,
    });

    const events = await collectEvents(
      sendMessage("session-xyz", "mach den Hintergrund blauer", imageContext)
    );

    // Verify POST call
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

    // Should have yielded events from the stream
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
      collectEvents(
        sendMessage("session-xyz", "test", makeImageContext())
      )
    ).rejects.toThrow("Failed to send canvas message: 404 Not Found");
  });

  it("AC-2: should throw when response body is null", async () => {
    vi.useRealTimers();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
    });

    await expect(
      collectEvents(
        sendMessage("session-xyz", "test", makeImageContext())
      )
    ).rejects.toThrow("Response body is null");
  });

  // -------------------------------------------------------------------------
  // AC-3: text-delta Events parsen
  // -------------------------------------------------------------------------

  /**
   * AC-3: GIVEN ein SSE-Stream laeuft
   *       WHEN text-delta Events empfangen werden
   *       THEN wird der Bot-Antwort-Text inkrementell in einer neuen Bot-Message-Bubble
   *            aufgebaut (Streaming-Indicator sichtbar waehrend des Streams)
   */
  it("AC-3: should parse text-delta SSE events and yield incremental text chunks", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"Hello"}\n\n',
      'event:text-delta\ndata:{"content":" world"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

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

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    const textDeltas = events.filter((e) => e.type === "text-delta");
    expect(textDeltas).toHaveLength(1);
    expect(textDeltas[0]).toEqual({ type: "text-delta", content: "" });
  });

  // -------------------------------------------------------------------------
  // AC-4: text-done Event parsen
  // -------------------------------------------------------------------------

  /**
   * AC-4: GIVEN ein SSE-Stream laeuft
   *       WHEN ein text-done Event empfangen wird
   *       THEN wird der Streaming-Indicator ausgeblendet und die Bot-Message
   *            als abgeschlossen markiert
   */
  it("AC-4: should parse text-done SSE event and signal stream completion", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"Done"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    const textDone = events.filter((e) => e.type === "text-done");
    expect(textDone).toHaveLength(1);
    expect(textDone[0]).toEqual({ type: "text-done" });
  });

  // -------------------------------------------------------------------------
  // AC-6: canvas-generate Event parsen
  // -------------------------------------------------------------------------

  /**
   * AC-6: GIVEN ein SSE-Stream ein canvas-generate Event liefert
   *       mit { action: "variation", prompt: "...", model_id: "flux-2-max", params: {} }
   *       WHEN das Event verarbeitet wird
   *       THEN wird generateImages() Server Action aufgerufen mit den Parametern aus dem Event
   */
  it("AC-6: should parse canvas-generate SSE event and return structured generation params", async () => {
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

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "canvas-generate",
      action: "variation",
      prompt: "blue sky background",
      model_id: "flux-2-max",
      params: { steps: 30 },
    });
  });

  it("AC-6: should default params to empty object when missing in canvas-generate event", async () => {
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

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

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

  /**
   * AC-8: GIVEN der SSE-Stream innerhalb von 60 Sekunden kein Event liefert
   *       WHEN der Timeout erkannt wird
   *       THEN wird eine Error-Message als Bot-Bubble angezeigt
   *            mit "Keine Antwort. Bitte erneut versuchen."
   */
  it("AC-8: should reject with timeout error when no SSE event received within 60 seconds", async () => {
    // The sendMessage function uses Promise.race between reader.read() and a setTimeout.
    // We use vi.useFakeTimers with shouldAdvanceTime so Date.now() advances automatically
    // and we can also manually advance the setTimeout via vi.advanceTimersByTime.
    vi.useRealTimers();

    // Create a stream whose read() never resolves (simulates no data arriving)
    const neverResolvingStream = new ReadableStream<Uint8Array>({
      pull() {
        // Return a promise that never resolves — simulates a hanging connection
        return new Promise<void>(() => {
          // intentionally never resolves
        });
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: neverResolvingStream });

    // Mock Date.now to jump forward in time.
    // The function checks `Date.now() - lastEventAt >= SSE_TIMEOUT_MS` and also
    // passes `timeRemaining` to setTimeout. If Date.now() is already past timeout
    // before the first read, timeRemaining will be <= 0 and the setTimeout fires immediately.
    const baseTime = Date.now();
    let callCount = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      // First call (in lastEventAt = Date.now()): return baseTime
      // Subsequent calls: return baseTime + 61s to trigger timeout
      if (callCount === 1) return baseTime;
      return baseTime + 61_000;
    });

    const gen = sendMessage("s1", "test", makeImageContext());
    const events = await collectEvents(gen);

    // Should have emitted a timeout error event
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({
      type: "error",
      message: "Keine Antwort. Bitte erneut versuchen.",
    });

    // Cleanup
    vi.spyOn(Date, "now").mockRestore();
  });

  // -------------------------------------------------------------------------
  // AC-9: error Event parsen
  // -------------------------------------------------------------------------

  /**
   * AC-9: GIVEN der SSE-Stream ein error Event liefert
   *       WHEN das Event verarbeitet wird
   *       THEN wird die Fehlerbeschreibung als Error-Bot-Bubble angezeigt
   *            und der Chat-Input wird wieder enabled
   */
  it("AC-9: should parse error SSE event and yield error with description", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:error\ndata:{"message":"Rate limit exceeded"}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      message: "Rate limit exceeded",
    });
  });

  it("AC-9: should use default error message when error event has no message field", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream(['event:error\ndata:{}\n\n']);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      message: "Ein Fehler ist aufgetreten.",
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases: SSE parsing
  // -------------------------------------------------------------------------

  it("should handle multiple events in a single chunk", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      'event:text-delta\ndata:{"content":"A"}\n\nevent:text-delta\ndata:{"content":"B"}\n\nevent:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "text-delta", content: "A" });
    expect(events[1]).toEqual({ type: "text-delta", content: "B" });
    expect(events[2]).toEqual({ type: "text-done" });
  });

  it("should handle events split across multiple chunks", async () => {
    vi.useRealTimers();

    // Split the event across two chunks (data line comes in second chunk)
    const sseBody = createSSEStream([
      "event:text-delta\n",
      'data:{"content":"split"}\n\n',
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

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

    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    // Only text-done should be parsed (unknown is skipped)
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text-done" });
  });

  it("should handle malformed JSON data gracefully (skip event)", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream([
      "event:text-delta\ndata:not-valid-json\n\n",
      'event:text-done\ndata:{}\n\n',
    ]);

    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    // Should not throw, just skip the malformed event
    const events = await collectEvents(
      sendMessage("s1", "test", makeImageContext())
    );

    // Only text-done should be present (malformed text-delta is skipped)
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text-done" });
  });

  it("should pass through AbortSignal to fetch", async () => {
    vi.useRealTimers();

    const sseBody = createSSEStream(['event:text-done\ndata:{}\n\n']);
    mockFetch.mockResolvedValueOnce({ ok: true, body: sseBody });

    const controller = new AbortController();
    const gen = sendMessage("s1", "test", makeImageContext(), controller.signal);

    await collectEvents(gen);

    // Verify signal was passed to fetch
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: controller.signal,
      })
    );
  });
});
