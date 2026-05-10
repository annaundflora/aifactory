// @vitest-environment jsdom
/**
 * Tests for Slice 15: SSE Events ``flow-state`` + ``intent-summary``.
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-5: flow-state event dispatches SET_FLOW_STATE
 * - AC-6: intent-summary event dispatches RENDER_INTENT_SUMMARY
 * - AC-9: invalid flow_state value rejected with console.warn
 * - AC-10: malformed intent-summary payload silently ignored
 *
 * Mocking Strategy: ``mock_external`` per slice spec — fetch is mocked to
 * simulate SSE streams; the dispatch is captured via vi.fn().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type {
  AssistantAction,
  IntentSummaryPayload,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Helpers (mock_external strategy per spec)
// ---------------------------------------------------------------------------

function createSSEStream(events: Array<{ event: string; data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map(
    (e) => `event: ${e.event}\ndata: ${e.data}\n\n`
  );
  let index = 0;
  return new ReadableStream<Uint8Array>({
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

function mockSSEResponse(
  events: Array<{ event: string; data: string }>,
  status = 200
): Response {
  return new Response(createSSEStream(events), {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createHookOptions(
  overrides?: Partial<UseAssistantRuntimeOptions>
): UseAssistantRuntimeOptions {
  return {
    projectId: "test-project-id",
    dispatch: vi.fn(),
    sessionIdRef: { current: null },
    selectedModel: "anthropic/claude-sonnet-4.6",
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    ...overrides,
  };
}

/** Build a stub fetch that returns a session id then the requested SSE events. */
function buildFetchStub(
  sessionId: string,
  sseEvents: Array<{ event: string; data: string }>
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/assistant/sessions") {
      return new Response(JSON.stringify({ id: sessionId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/messages")) {
      return mockSSEResponse(sseEvents);
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Slice 15: SSE flow-state event handling", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-5: GIVEN der Frontend-SSE-Handler in use-assistant-runtime.ts empfaengt
   *  ein Event ``event: flow-state\ndata: {"flow_state":"summarizing"}``
   *       WHEN das Event geparst wird
   *       THEN dispatcht der Handler genau eine Reducer-Action
   *  ``{ type: "SET_FLOW_STATE", flowState: "summarizing" }`` und
   *  keine anderen Actions (zu diesem Event).
   */
  it("AC-5: dispatches SET_FLOW_STATE on flow-state event with whitelisted value", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac5", [
      {
        event: "flow-state",
        data: JSON.stringify({ flow_state: "summarizing" }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const flowStateActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a: AssistantAction) => a.type === "SET_FLOW_STATE");

    expect(flowStateActions).toHaveLength(1);
    expect(flowStateActions[0]).toEqual({
      type: "SET_FLOW_STATE",
      flowState: "summarizing",
    });
  });

  it("AC-5: each whitelisted flow_state value (idle/interviewing/summarizing/reviewing/refining/generating) is accepted", async () => {
    const whitelist = [
      "idle",
      "interviewing",
      "summarizing",
      "reviewing",
      "refining",
      "generating",
    ] as const;

    for (const value of whitelist) {
      const dispatch = vi.fn();
      const sessionIdRef = { current: null as string | null };
      const options = createHookOptions({ dispatch, sessionIdRef });

      globalThis.fetch = buildFetchStub(`session-${value}`, [
        {
          event: "flow-state",
          data: JSON.stringify({ flow_state: value }),
        },
        { event: "text-done", data: JSON.stringify({}) },
      ]);

      dispatch.mockImplementation((action: AssistantAction) => {
        if (action.type === "SET_SESSION_ID") {
          sessionIdRef.current = action.sessionId;
        }
      });

      const { result } = renderHook(() => useAssistantRuntime(options));
      await act(async () => {
        await result.current.sendMessage("hi");
      });

      const flowActions = dispatch.mock.calls
        .map(([a]: [AssistantAction]) => a)
        .filter((a: AssistantAction) => a.type === "SET_FLOW_STATE");
      expect(flowActions).toHaveLength(1);
      expect((flowActions[0] as { flowState: string }).flowState).toBe(value);
    }
  });

  /**
   * AC-9: GIVEN ein unbekannter flow_state-String (z.B. "unknown_phase")
   *       WHEN das Event geparst wird
   *       THEN wird der Wert verworfen, kein SET_FLOW_STATE dispatcht;
   *            ein console.warn wird geloggt.
   */
  it("AC-9: ignores flow-state event with unknown flow_state value and warns", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac9", [
      {
        event: "flow-state",
        data: JSON.stringify({ flow_state: "unknown_phase" }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const flowActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a: AssistantAction) => a.type === "SET_FLOW_STATE");

    expect(flowActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    // Verify the warn message references the flow_state contract — at
    // minimum it should mention the offending value or "flow-state".
    const warnArgs = warnSpy.mock.calls.map((c) => c.join(" "));
    expect(
      warnArgs.some((s) => /flow.?state|unknown_phase/i.test(s))
    ).toBe(true);

    warnSpy.mockRestore();
  });

  it("AC-9: ignores flow-state event with non-string flow_state value", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac9b", [
      {
        event: "flow-state",
        // numeric value should be rejected
        data: JSON.stringify({ flow_state: 42 }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const flowActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a: AssistantAction) => a.type === "SET_FLOW_STATE");
    expect(flowActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("Slice 15: SSE intent-summary event handling", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-6: GIVEN ein intent-summary Event mit IntentSummaryPayload
   *       WHEN das Event geparst wird
   *       THEN dispatcht der Handler genau eine Reducer-Action
   *  ``{ type: "RENDER_INTENT_SUMMARY", payload: <IntentSummaryPayload> }``
   *  und die Felder ``axes``, ``prompt_preview``, ``settings_diff?`` werden
   *  1:1 aus dem SSE-data-Payload uebernommen.
   */
  it("AC-6: dispatches RENDER_INTENT_SUMMARY with axes + prompt_preview + settings_diff", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const wirePayload = {
      axes: { subject: "coral reef", lighting: "golden hour" },
      prompt_preview: "A vibrant coral reef at golden hour, photorealistic",
      settings_diff: {
        slotStrengths: [{ slotIndex: 0, from: null, to: 0.6 }],
        modelId: { from: "flux-2-pro", to: "flux-2-ultra" },
      },
    };

    globalThis.fetch = buildFetchStub("session-ac6a", [
      {
        event: "intent-summary",
        data: JSON.stringify(wirePayload),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("finalize");
    });

    const renderActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "RENDER_INTENT_SUMMARY"
      );

    expect(renderActions).toHaveLength(1);
    const action = renderActions[0] as {
      type: "RENDER_INTENT_SUMMARY";
      payload: IntentSummaryPayload;
    };
    // Field names MUST be 1:1 (snake_case ``prompt_preview`` / ``settings_diff``,
    // no camelCase transformation).
    expect(action.payload).toMatchObject({
      axes: { subject: "coral reef", lighting: "golden hour" },
      prompt_preview:
        "A vibrant coral reef at golden hour, photorealistic",
      settings_diff: {
        slotStrengths: [{ slotIndex: 0, from: null, to: 0.6 }],
        modelId: { from: "flux-2-pro", to: "flux-2-ultra" },
      },
    });

    // Defensive: the camelCase variant ``promptPreview`` MUST NOT exist.
    expect(action.payload).not.toHaveProperty("promptPreview");
    expect(action.payload).not.toHaveProperty("settingsDiff");
  });

  it("AC-6: dispatches RENDER_INTENT_SUMMARY without settings_diff when omitted by backend", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Backend omits settings_diff entirely (per AC-3).
    const wirePayload = {
      axes: { subject: "alpine sunset" },
      prompt_preview: "a sunset over the alps, wide-angle",
    };

    globalThis.fetch = buildFetchStub("session-ac6b", [
      {
        event: "intent-summary",
        data: JSON.stringify(wirePayload),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("finalize");
    });

    const renderActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "RENDER_INTENT_SUMMARY"
      );
    expect(renderActions).toHaveLength(1);
    const action = renderActions[0] as {
      type: "RENDER_INTENT_SUMMARY";
      payload: IntentSummaryPayload;
    };
    expect(action.payload.axes).toEqual({ subject: "alpine sunset" });
    expect(action.payload.prompt_preview).toBe(
      "a sunset over the alps, wide-angle"
    );
    // settings_diff MUST be absent (not null) since the wire payload
    // omitted it and the handler MUST NOT fabricate one.
    expect(action.payload.settings_diff).toBeUndefined();
  });

  /**
   * AC-10: GIVEN ein malformed JSON-Payload fuer intent-summary
   *  (fehlendes prompt_preview oder axes ist kein Object)
   *        WHEN das Event geparst wird
   *        THEN wird der Handler defensiv: kein Dispatch, ein console.warn
   *  mit der Event-Quelle wird geloggt; der Stream-Konsum laeuft weiter.
   */
  it("AC-10: ignores intent-summary event with missing prompt_preview and warns", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac10a", [
      {
        event: "intent-summary",
        // prompt_preview missing on purpose
        data: JSON.stringify({ axes: { subject: "x" } }),
      },
      // The handler MUST keep consuming after a malformed event.
      { event: "text-delta", data: JSON.stringify({ content: "ok" }) },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const renderActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "RENDER_INTENT_SUMMARY"
      );
    expect(renderActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();

    // Stream MUST keep consuming — the subsequent text-delta event must
    // still be dispatched.
    const textDeltaActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "APPEND_ASSISTANT_DELTA"
      );
    expect(textDeltaActions.length).toBeGreaterThanOrEqual(1);

    warnSpy.mockRestore();
  });

  it("AC-10: ignores intent-summary event with non-object axes and warns", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac10b", [
      {
        event: "intent-summary",
        // axes is a string, not an object
        data: JSON.stringify({
          axes: "not-an-object",
          prompt_preview: "anything",
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const renderActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "RENDER_INTENT_SUMMARY"
      );
    expect(renderActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("AC-10: ignores intent-summary event with axes as array (defensive)", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac10c", [
      {
        event: "intent-summary",
        // axes is an array — array typeof === "object" so we need the
        // explicit Array.isArray guard.
        data: JSON.stringify({ axes: [], prompt_preview: "anything" }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    const renderActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter(
        (a: AssistantAction) => a.type === "RENDER_INTENT_SUMMARY"
      );
    expect(renderActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
