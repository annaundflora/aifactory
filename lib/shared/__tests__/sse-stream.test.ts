import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseSSEEvents,
  consumeSSEStream,
  type SSEEventHandler,
} from "../sse-stream";

// ---------------------------------------------------------------------------
// parseSSEEvents
// ---------------------------------------------------------------------------

describe("parseSSEEvents", () => {
  it("parses a single complete SSE event", () => {
    const raw = 'event: text-delta\ndata: {"content":"hello"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      { event: "text-delta", data: '{"content":"hello"}' },
    ]);
  });

  it("parses multiple events in one block", () => {
    const raw =
      'event: text-delta\ndata: {"content":"a"}\n\nevent: text-delta\ndata: {"content":"b"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      event: "text-delta",
      data: '{"content":"a"}',
    });
    expect(events[1]).toEqual({
      event: "text-delta",
      data: '{"content":"b"}',
    });
  });

  it("handles event without trailing newline (trailing flush)", () => {
    const raw = 'event: text-done\ndata: {}';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([{ event: "text-done", data: "{}" }]);
  });

  it("handles \\r\\n line endings", () => {
    const raw = 'event: text-delta\r\ndata: {"content":"x"}\r\n\r\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      { event: "text-delta", data: '{"content":"x"}' },
    ]);
  });

  it("handles multi-line data fields", () => {
    const raw = 'event: text-delta\ndata: line1\ndata: line2\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      { event: "text-delta", data: "line1\nline2" },
    ]);
  });

  it("ignores data without event type", () => {
    const raw = 'data: {"orphan": true}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([]);
  });

  it("ignores comments", () => {
    const raw =
      ': this is a comment\nevent: text-delta\ndata: {"content":"x"}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toEqual([
      { event: "text-delta", data: '{"content":"x"}' },
    ]);
  });

  it("handles back-to-back events without double-newline (malformed)", () => {
    const raw =
      'event: text-delta\ndata: {"content":"a"}\nevent: text-done\ndata: {}\n\n';
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("text-delta");
    expect(events[1].event).toBe("text-done");
  });

  it("returns empty array for empty input", () => {
    expect(parseSSEEvents("")).toEqual([]);
  });

  it("returns empty array for only newlines", () => {
    expect(parseSSEEvents("\n\n\n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// consumeSSEStream — helpers
// ---------------------------------------------------------------------------

function createMockReadableStream(
  chunks: string[]
): ReadableStream<Uint8Array> {
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

function createMockResponse(chunks: string[]): Response {
  return {
    body: createMockReadableStream(chunks),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// consumeSSEStream
// ---------------------------------------------------------------------------

describe("consumeSSEStream", () => {
  it("parses a single event from one chunk", async () => {
    const response = createMockResponse([
      'event: text-delta\ndata: {"content":"hi"}\n\n',
    ]);

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(response, (type, data) => {
      events.push({ type, data });
    });

    expect(events).toEqual([
      { type: "text-delta", data: '{"content":"hi"}' },
    ]);
  });

  it("parses events split across multiple chunks", async () => {
    const response = createMockResponse([
      'event: text-delta\ndata: {"con',
      'tent":"hello"}\n\n',
    ]);

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(response, (type, data) => {
      events.push({ type, data });
    });

    expect(events).toEqual([
      { type: "text-delta", data: '{"content":"hello"}' },
    ]);
  });

  it("handles multiple events across chunks", async () => {
    const response = createMockResponse([
      'event: text-delta\ndata: {"content":"a"}\n\nevent: text-',
      'delta\ndata: {"content":"b"}\n\n',
    ]);

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(response, (type, data) => {
      events.push({ type, data });
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "text-delta",
      data: '{"content":"a"}',
    });
    expect(events[1]).toEqual({
      type: "text-delta",
      data: '{"content":"b"}',
    });
  });

  it("flushes remaining buffer at stream end", async () => {
    // Event not terminated by \n\n but stream closes
    const response = createMockResponse([
      'event: text-done\ndata: {}',
    ]);

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(response, (type, data) => {
      events.push({ type, data });
    });

    expect(events).toEqual([{ type: "text-done", data: "{}" }]);
  });

  it("throws when response body is null", async () => {
    const response = { body: null } as unknown as Response;

    await expect(
      consumeSSEStream(response, () => {})
    ).rejects.toThrow("Response body is null");
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    const response = createMockResponse([
      'event: text-delta\ndata: {"content":"should not appear"}\n\n',
    ]);

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(
      response,
      (type, data) => {
        events.push({ type, data });
      },
      { signal: controller.signal }
    );

    expect(events).toEqual([]);
  });

  it("emits timeout error when no events within timeoutMs", async () => {
    // Create a stream that never sends data
    const stream = new ReadableStream<Uint8Array>({
      start() {
        // Never enqueue or close — simulates a hanging connection
      },
    });
    const response = { body: stream } as unknown as Response;

    const events: Array<{ type: string; data: string }> = [];
    await consumeSSEStream(
      response,
      (type, data) => {
        events.push({ type, data });
      },
      { timeoutMs: 50 }
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    const parsed = JSON.parse(events[0].data);
    expect(parsed.message).toContain("Keine Antwort");
  });

  it("resets timeout timer on each received event", async () => {
    // Two events with a gap shorter than timeout
    const encoder = new TextEncoder();
    const resolvers: Array<() => void> = [];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // First event immediately
        controller.enqueue(
          encoder.encode(
            'event: text-delta\ndata: {"content":"a"}\n\n'
          )
        );

        // Second event after 30ms (within 100ms timeout)
        setTimeout(() => {
          controller.enqueue(
            encoder.encode(
              'event: text-done\ndata: {}\n\n'
            )
          );
          // Close stream after second event
          setTimeout(() => controller.close(), 10);
        }, 30);
      },
    });

    const response = { body: stream } as unknown as Response;
    const events: Array<{ type: string; data: string }> = [];

    await consumeSSEStream(
      response,
      (type, data) => {
        events.push({ type, data });
      },
      { timeoutMs: 100 }
    );

    // Should get both events, no timeout error
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("text-delta");
    expect(events[1].type).toBe("text-done");
  });
});
