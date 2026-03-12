/**
 * Unit Tests for parseSSEEvents (Slice 11)
 *
 * Tests the SSE parser used by the streaming runtime.
 * This pure function is critical for AC-3 (text-delta text build-up)
 * and AC-9 (stream cancellation handling).
 */
import { describe, it, expect } from "vitest";
import { parseSSEEvents } from "@/lib/assistant/use-assistant-runtime";

describe("parseSSEEvents", () => {
  it("should parse a single SSE event with event type and JSON data", () => {
    const raw = "event: text-delta\ndata: {\"content\":\"Hello\"}\n\n";
    const events = parseSSEEvents(raw);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("text-delta");
    expect(events[0].data).toBe('{"content":"Hello"}');
  });

  it("should parse multiple SSE events separated by double newlines", () => {
    const raw = [
      "event: metadata\ndata: {\"session_id\":\"s1\",\"thread_id\":\"t1\"}\n\n",
      "event: text-delta\ndata: {\"content\":\"Hi\"}\n\n",
      "event: text-done\ndata: {}\n\n",
    ].join("");

    const events = parseSSEEvents(raw);

    expect(events).toHaveLength(3);
    expect(events[0].event).toBe("metadata");
    expect(events[1].event).toBe("text-delta");
    expect(events[2].event).toBe("text-done");
  });

  it("should handle empty blocks gracefully", () => {
    const raw = "\n\n\n\n";
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(0);
  });

  it("should ignore blocks without event type", () => {
    const raw = "data: {\"content\":\"orphan\"}\n\n";
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(0);
  });

  it("should ignore blocks without data lines", () => {
    const raw = "event: text-delta\n\n";
    const events = parseSSEEvents(raw);
    expect(events).toHaveLength(0);
  });

  it("should handle multi-line data fields by joining them", () => {
    const raw = "event: text-delta\ndata: {\"content\":\ndata: \"multi-line\"}\n\n";
    const events = parseSSEEvents(raw);

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("{\"content\":\n\"multi-line\"}");
  });

  it("should parse error events correctly", () => {
    const raw = "event: error\ndata: {\"message\":\"Rate limit exceeded\"}\n\n";
    const events = parseSSEEvents(raw);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("error");
    expect(JSON.parse(events[0].data)).toEqual({
      message: "Rate limit exceeded",
    });
  });

  it("should parse tool-call-result events correctly", () => {
    const raw =
      'event: tool-call-result\ndata: {"tool":"draft_prompt","data":{"motiv":"landscape","style":"oil painting","negative_prompt":""}}\n\n';
    const events = parseSSEEvents(raw);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("tool-call-result");
    const parsed = JSON.parse(events[0].data);
    expect(parsed.tool).toBe("draft_prompt");
    expect(parsed.data.motiv).toBe("landscape");
  });
});
