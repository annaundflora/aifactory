// @vitest-environment jsdom
/**
 * Tests for Slice 24: SSE Frontend-Handler fuer Slot-Tools.
 *
 * Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria of
 * ``slice-24-slot-tool-frontend-handler.md``:
 *
 * - AC-1: tool-call-result(set_slot_role)   -> ADD_TOOL_CALL_RESULT + SET_SLOT_ROLE
 * - AC-2: tool-call-result(set_slot_strength) -> ADD_TOOL_CALL_RESULT + SET_SLOT_STRENGTH
 * - AC-3: tool-call-result(set_model_params)  -> ADD_TOOL_CALL_RESULT + SET_MODEL_PARAMS_PATCH
 * - AC-7: unknown tool -> only ADD_TOOL_CALL_RESULT (default branch unchanged)
 * - AC-8: malformed payload -> console.warn, no slot-tool action dispatched, no throw
 *
 * Mocking Strategy: ``mock_external`` per slice spec — fetch is mocked to
 * simulate SSE streams; dispatch is captured via vi.fn() and inspected.
 * Pattern follows ``use-assistant-runtime.test.ts`` (AC-8/AC-9 tests for
 * draft_prompt/refine_prompt) and ``use-assistant-runtime-flow-state.test.ts``.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type { AssistantAction } from "../assistant-context";

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

/** Drive sendMessage and propagate the SET_SESSION_ID into the ref. */
function bindSessionIdRef(
  dispatch: ReturnType<typeof vi.fn>,
  sessionIdRef: { current: string | null }
) {
  dispatch.mockImplementation((action: AssistantAction) => {
    if (action.type === "SET_SESSION_ID") {
      sessionIdRef.current = action.sessionId;
    }
  });
}

// ---------------------------------------------------------------------------
// AC-1: SSE tool-call-result(set_slot_role) -> SET_SLOT_ROLE
// ---------------------------------------------------------------------------

describe("Slice 24: SSE tool-call-result(set_slot_role) handling", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-1: GIVEN der SSE-Handler in lib/assistant/use-assistant-runtime.ts
   *       empfaengt ein tool-call-result-Event mit
   *       tool: "set_slot_role" und data: { slot_index: 1, role: "style" }
   *       WHEN handleSSEEvent("tool-call-result", JSON.stringify(...))
   *       aufgerufen wird
   *       THEN Reducer dispatcht (a) bestehende ADD_TOOL_CALL_RESULT-Action
   *       mit dem Tool-Result UND (b) neue SET_SLOT_ROLE-Action mit
   *       { slotIndex: 1, role: "style" } (snake_case -> camelCase Mapping
   *       erfolgt im Handler).
   */
  it("AC-1: should dispatch SET_SLOT_ROLE on tool-call-result(set_slot_role)", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac1", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_role",
          data: { slot_index: 1, role: "style" },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);

    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("change slot 1 to style");
    });

    const actions = dispatch.mock.calls.map(
      ([a]: [AssistantAction]) => a
    );

    // (a) bestehende ADD_TOOL_CALL_RESULT-Action MUST still fire.
    const addToolCalls = actions.filter(
      (a) => a.type === "ADD_TOOL_CALL_RESULT"
    );
    expect(addToolCalls).toHaveLength(1);
    expect((addToolCalls[0] as { result: unknown }).result).toEqual({
      tool: "set_slot_role",
      data: { slot_index: 1, role: "style" },
    });

    // (b) neue SET_SLOT_ROLE-Action mit camelCase-mapping.
    const slotRoleActions = actions.filter(
      (a) => a.type === "SET_SLOT_ROLE"
    );
    expect(slotRoleActions).toHaveLength(1);
    expect(slotRoleActions[0]).toEqual({
      type: "SET_SLOT_ROLE",
      slotIndex: 1,
      role: "style",
    });

    // The dispatched action MUST use camelCase ``slotIndex`` (frontend
    // convention), NOT the snake_case wire field.
    expect(slotRoleActions[0]).not.toHaveProperty("slot_index");
  });

  it("AC-1: should accept all three whitelisted role values (subject/style/composition)", async () => {
    const roles = ["subject", "style", "composition"] as const;

    for (const role of roles) {
      const dispatch = vi.fn();
      const sessionIdRef = { current: null as string | null };
      const options = createHookOptions({ dispatch, sessionIdRef });

      globalThis.fetch = buildFetchStub(`session-role-${role}`, [
        {
          event: "tool-call-result",
          data: JSON.stringify({
            tool: "set_slot_role",
            data: { slot_index: 0, role },
          }),
        },
        { event: "text-done", data: JSON.stringify({}) },
      ]);
      bindSessionIdRef(dispatch, sessionIdRef);

      const { result } = renderHook(() => useAssistantRuntime(options));
      await act(async () => {
        await result.current.sendMessage("set role");
      });

      const slotRoleActions = dispatch.mock.calls
        .map(([a]: [AssistantAction]) => a)
        .filter((a) => a.type === "SET_SLOT_ROLE");
      expect(slotRoleActions).toHaveLength(1);
      expect((slotRoleActions[0] as { role: string }).role).toBe(role);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: SSE tool-call-result(set_slot_strength) -> SET_SLOT_STRENGTH
// ---------------------------------------------------------------------------

describe("Slice 24: SSE tool-call-result(set_slot_strength) handling", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-2: GIVEN der SSE-Handler empfaengt tool-call-result mit
   *       tool: "set_slot_strength" und data: { slot_index: 2, strength: 0.7 }
   *       WHEN das Event verarbeitet wird
   *       THEN SET_SLOT_STRENGTH-Action wird dispatcht mit
   *       { slotIndex: 2, strength: 0.7 }.
   */
  it("AC-2: should dispatch SET_SLOT_STRENGTH on tool-call-result(set_slot_strength)", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac2", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_strength",
          data: { slot_index: 2, strength: 0.7 },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("change slot 2 strength");
    });

    const actions = dispatch.mock.calls.map(
      ([a]: [AssistantAction]) => a
    );

    // ADD_TOOL_CALL_RESULT still fires.
    expect(
      actions.filter((a) => a.type === "ADD_TOOL_CALL_RESULT")
    ).toHaveLength(1);

    const strengthActions = actions.filter(
      (a) => a.type === "SET_SLOT_STRENGTH"
    );
    expect(strengthActions).toHaveLength(1);
    expect(strengthActions[0]).toEqual({
      type: "SET_SLOT_STRENGTH",
      slotIndex: 2,
      strength: 0.7,
    });
    expect(strengthActions[0]).not.toHaveProperty("slot_index");
  });

  it("AC-2: accepts boundary values 0.0 and 1.0", async () => {
    for (const strength of [0, 1]) {
      const dispatch = vi.fn();
      const sessionIdRef = { current: null as string | null };
      const options = createHookOptions({ dispatch, sessionIdRef });

      globalThis.fetch = buildFetchStub(`session-strength-${strength}`, [
        {
          event: "tool-call-result",
          data: JSON.stringify({
            tool: "set_slot_strength",
            data: { slot_index: 0, strength },
          }),
        },
        { event: "text-done", data: JSON.stringify({}) },
      ]);
      bindSessionIdRef(dispatch, sessionIdRef);

      const { result } = renderHook(() => useAssistantRuntime(options));
      await act(async () => {
        await result.current.sendMessage("set strength");
      });

      const strengthActions = dispatch.mock.calls
        .map(([a]: [AssistantAction]) => a)
        .filter((a) => a.type === "SET_SLOT_STRENGTH");
      expect(strengthActions).toHaveLength(1);
      expect((strengthActions[0] as { strength: number }).strength).toBe(
        strength
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC-3: SSE tool-call-result(set_model_params) -> SET_MODEL_PARAMS_PATCH
// ---------------------------------------------------------------------------

describe("Slice 24: SSE tool-call-result(set_model_params) handling", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-3: GIVEN der SSE-Handler empfaengt tool-call-result mit
   *       tool: "set_model_params" und
   *       data: { params: { aspect_ratio: "16:9", guidance: 7 } }
   *       WHEN das Event verarbeitet wird
   *       THEN SET_MODEL_PARAMS_PATCH-Action wird dispatcht mit
   *       { modelParams: { aspect_ratio: "16:9", guidance: 7 } }.
   */
  it("AC-3: should dispatch SET_MODEL_PARAMS_PATCH on tool-call-result(set_model_params)", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac3", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_model_params",
          data: { params: { aspect_ratio: "16:9", guidance: 7 } },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("set 16:9");
    });

    const actions = dispatch.mock.calls.map(
      ([a]: [AssistantAction]) => a
    );

    // ADD_TOOL_CALL_RESULT still fires.
    expect(
      actions.filter((a) => a.type === "ADD_TOOL_CALL_RESULT")
    ).toHaveLength(1);

    const modelParamActions = actions.filter(
      (a) => a.type === "SET_MODEL_PARAMS_PATCH"
    );
    expect(modelParamActions).toHaveLength(1);
    expect(modelParamActions[0]).toEqual({
      type: "SET_MODEL_PARAMS_PATCH",
      modelParams: { aspect_ratio: "16:9", guidance: 7 },
    });

    // Wire field name ``params`` MUST be mapped to ``modelParams``.
    expect(modelParamActions[0]).not.toHaveProperty("params");
  });

  it("AC-3: accepts an empty params object", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac3-empty", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_model_params",
          data: { params: {} },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("clear params");
    });

    const modelParamActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_MODEL_PARAMS_PATCH");
    expect(modelParamActions).toHaveLength(1);
    expect(
      (modelParamActions[0] as { modelParams: Record<string, unknown> })
        .modelParams
    ).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// AC-7: Unknown tool name -> only ADD_TOOL_CALL_RESULT (default branch)
// ---------------------------------------------------------------------------

describe("Slice 24: SSE tool-call-result with unknown tool name", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-7: GIVEN ein tool-call-result-Event mit unbekanntem tool
   *       (z.B. "set_unknown_tool")
   *       WHEN das Event verarbeitet wird
   *       THEN nur die bestehende ADD_TOOL_CALL_RESULT-Action wird dispatcht;
   *       KEINE der drei neuen Actions wird ausgeloest (Default-Branch
   *       unveraendert).
   */
  it("AC-7: should not dispatch slot-tool actions for unknown tool name", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = buildFetchStub("session-ac7", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_unknown_tool",
          data: { foo: "bar" },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("unknown tool");
    });

    const actions = dispatch.mock.calls.map(
      ([a]: [AssistantAction]) => a
    );

    // ADD_TOOL_CALL_RESULT MUST still fire (default behaviour preserved).
    expect(
      actions.filter((a) => a.type === "ADD_TOOL_CALL_RESULT")
    ).toHaveLength(1);

    // None of the three new slot-tool actions must be dispatched.
    expect(
      actions.filter((a) => a.type === "SET_SLOT_ROLE")
    ).toHaveLength(0);
    expect(
      actions.filter((a) => a.type === "SET_SLOT_STRENGTH")
    ).toHaveLength(0);
    expect(
      actions.filter((a) => a.type === "SET_MODEL_PARAMS_PATCH")
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-8: Malformed payload -> console.warn + skip dispatch
// ---------------------------------------------------------------------------

describe("Slice 24: SSE tool-call-result with malformed payload", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * AC-8: GIVEN ein tool-call-result-Event mit tool: "set_slot_role"
   *       aber malformiertem data (z.B. { slot_index: "not_a_number" }
   *       oder fehlender role-Key)
   *       WHEN das Event verarbeitet wird
   *       THEN der Handler wirft KEINE unhandled Exception; eine
   *       console.warn-Zeile wird emittiert; KEINE der drei neuen Actions
   *       wird dispatcht.
   */
  it("AC-8: should warn and skip dispatch when set_slot_role.slot_index is not a number", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8a", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_role",
          data: { slot_index: "not_a_number", role: "style" },
        }),
      },
      // The handler MUST keep consuming after a malformed event.
      { event: "text-delta", data: JSON.stringify({ content: "ok" }) },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      // No throw expected.
      await result.current.sendMessage("malformed slot index");
    });

    const slotRoleActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_SLOT_ROLE");
    expect(slotRoleActions).toHaveLength(0);

    // Stream MUST keep consuming — text-delta after the bad event must
    // still be dispatched.
    const textDeltaActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "APPEND_ASSISTANT_DELTA");
    expect(textDeltaActions.length).toBeGreaterThanOrEqual(1);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("AC-8: should warn and skip dispatch when set_slot_role.role is missing", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8b", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_role",
          data: { slot_index: 0 }, // role missing
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("missing role");
    });

    const slotRoleActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_SLOT_ROLE");
    expect(slotRoleActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("AC-8: should warn and skip dispatch when set_slot_role.role is outside enum", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8c", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_role",
          data: { slot_index: 0, role: "not_in_enum" },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("bad role");
    });

    const slotRoleActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_SLOT_ROLE");
    expect(slotRoleActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("AC-8: should warn and skip dispatch when set_slot_strength.strength is out of [0,1]", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8d", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_slot_strength",
          data: { slot_index: 0, strength: 1.5 }, // > 1 invalid
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("bad strength");
    });

    const strengthActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_SLOT_STRENGTH");
    expect(strengthActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("AC-8: should warn and skip dispatch when set_model_params.params is null", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8e", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_model_params",
          data: { params: null },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("null params");
    });

    const modelParamActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_MODEL_PARAMS_PATCH");
    expect(modelParamActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("AC-8: should warn and skip dispatch when set_model_params.params is an array", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    globalThis.fetch = buildFetchStub("session-ac8f", [
      {
        event: "tool-call-result",
        data: JSON.stringify({
          tool: "set_model_params",
          // arrays are typeof "object" — explicit Array.isArray guard.
          data: { params: ["aspect_ratio", "16:9"] },
        }),
      },
      { event: "text-done", data: JSON.stringify({}) },
    ]);
    bindSessionIdRef(dispatch, sessionIdRef);

    const { result } = renderHook(() => useAssistantRuntime(options));
    await act(async () => {
      await result.current.sendMessage("array params");
    });

    const modelParamActions = dispatch.mock.calls
      .map(([a]: [AssistantAction]) => a)
      .filter((a) => a.type === "SET_MODEL_PARAMS_PATCH");
    expect(modelParamActions).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
