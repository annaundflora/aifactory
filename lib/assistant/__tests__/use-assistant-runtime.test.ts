// @vitest-environment jsdom
/**
 * Tests for Slice 10: Assistant Frontend -- SSE Parsing with single prompt field
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-8: SSE draft_prompt parsed als { prompt }
 * - AC-9: SSE refine_prompt parsed als { prompt }
 *
 * Mocking Strategy: mock_external (per slice spec).
 * fetch is mocked to simulate SSE streams.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
  parseSSEEvents,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type { AssistantAction } from "../assistant-context";

// ---------------------------------------------------------------------------
// Helpers: SSE stream simulation (mock_external strategy per spec)
// ---------------------------------------------------------------------------

/**
 * Creates a ReadableStream that emits SSE-formatted text in chunks.
 */
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

/**
 * Creates a mock Response with an SSE stream body.
 */
function mockSSEResponse(
  events: Array<{ event: string; data: string }>,
  status = 200
): Response {
  const stream = createSSEStream(events);
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/**
 * Default hook options with mocked dispatch and refs.
 */
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

// ---------------------------------------------------------------------------
// Tests: parseSSEEvents (pure function -- Unit)
// ---------------------------------------------------------------------------

describe("parseSSEEvents", () => {
  it("should parse single SSE event with event type and JSON data", () => {
    const raw = 'event: text-delta\ndata: {"content":"Hello"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].event).toBe("text-delta");
    expect(result[0].data).toBe('{"content":"Hello"}');
  });

  it("should parse multiple SSE events separated by double newlines", () => {
    const raw =
      'event: metadata\ndata: {"session_id":"s1","thread_id":"t1"}\n\n' +
      'event: text-delta\ndata: {"content":"Hi"}\n\n' +
      "event: text-done\ndata: {}\n\n";
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(3);
    expect(result[0].event).toBe("metadata");
    expect(result[1].event).toBe("text-delta");
    expect(result[2].event).toBe("text-done");
  });

  it("should handle multi-line data fields by joining them", () => {
    const raw =
      'event: text-delta\ndata: {"content":\ndata: "multi-line"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].event).toBe("text-delta");
    expect(result[0].data).toBe('{"content":\n"multi-line"}');
  });

  it("should handle UTF-8 special characters in data", () => {
    const raw =
      'event: text-delta\ndata: {"content":"Gruesse mit Umlauten: aeuoe Sonderzeichen: EUR"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].data).toContain("Gruesse mit Umlauten");
    expect(result[0].data).toContain("EUR");
  });

  it("should skip empty blocks", () => {
    const raw = "\n\n\n\nevent: text-done\ndata: {}\n\n\n\n";
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].event).toBe("text-done");
  });
});

// ---------------------------------------------------------------------------
// Tests: useAssistantRuntime hook
// ---------------------------------------------------------------------------

describe("useAssistantRuntime", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-8: GIVEN ein SSE tool-call-result Event mit tool: "draft_prompt"
  //        und data: { prompt: "A vibrant coral reef" }
  //       WHEN das Event in use-assistant-runtime.ts geparst wird
  //       THEN wird SET_DRAFT_PROMPT dispatched mit
  //            draftPrompt: { prompt: "A vibrant coral reef" }
  //       AND es wird NICHT auf motiv, style oder negative_prompt
  //            im SSE-Payload zugegriffen
  // --------------------------------------------------------------------------
  it("AC-8: should dispatch SET_DRAFT_PROMPT with single prompt field from SSE", async () => {
    /**
     * AC-8: SSE tool-call-result with tool="draft_prompt" dispatches
     * SET_DRAFT_PROMPT with draftPrompt: { prompt: "A vibrant coral reef" }.
     * The payload uses the new single-field format { prompt }.
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const toolCallData = {
      tool: "draft_prompt",
      data: {
        prompt: "A vibrant coral reef",
      },
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-ac8" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Here is your prompt:" }),
          },
          {
            event: "tool-call-result",
            data: JSON.stringify(toolCallData),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Write me a prompt about coral reefs");
    });

    // Verify SET_DRAFT_PROMPT was dispatched with the new single-field format
    const draftPromptActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_DRAFT_PROMPT");

    expect(draftPromptActions).toHaveLength(1);
    expect(draftPromptActions[0]).toEqual({
      type: "SET_DRAFT_PROMPT",
      draftPrompt: {
        prompt: "A vibrant coral reef",
      },
    });

    // Verify the dispatched draftPrompt does NOT have old fields
    const dispatchedDraft = (draftPromptActions[0] as { type: "SET_DRAFT_PROMPT"; draftPrompt: Record<string, unknown> }).draftPrompt;
    expect(dispatchedDraft).not.toHaveProperty("motiv");
    expect(dispatchedDraft).not.toHaveProperty("style");
    expect(dispatchedDraft).not.toHaveProperty("negative_prompt");
    expect(dispatchedDraft).not.toHaveProperty("negativePrompt");
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN ein SSE tool-call-result Event mit tool: "refine_prompt"
  //        und data: { prompt: "refined version" }
  //       WHEN das Event in use-assistant-runtime.ts geparst wird
  //       THEN wird REFINE_DRAFT dispatched mit
  //            draftPrompt: { prompt: "refined version" }
  // --------------------------------------------------------------------------
  it("AC-9: should dispatch REFINE_DRAFT with single prompt field from SSE", async () => {
    /**
     * AC-9: SSE tool-call-result with tool="refine_prompt" dispatches
     * REFINE_DRAFT with draftPrompt: { prompt: "refined version" }.
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const toolCallData = {
      tool: "refine_prompt",
      data: {
        prompt: "refined version",
      },
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-ac9" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "I've refined your prompt:" }),
          },
          {
            event: "tool-call-result",
            data: JSON.stringify(toolCallData),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Refine my prompt");
    });

    // Verify REFINE_DRAFT was dispatched with the new single-field format
    const refineDraftActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "REFINE_DRAFT");

    expect(refineDraftActions).toHaveLength(1);
    expect(refineDraftActions[0]).toEqual({
      type: "REFINE_DRAFT",
      draftPrompt: {
        prompt: "refined version",
      },
    });

    // Verify the dispatched draftPrompt does NOT have old fields
    const dispatchedDraft = (refineDraftActions[0] as { type: "REFINE_DRAFT"; draftPrompt: Record<string, unknown> }).draftPrompt;
    expect(dispatchedDraft).not.toHaveProperty("motiv");
    expect(dispatchedDraft).not.toHaveProperty("style");
    expect(dispatchedDraft).not.toHaveProperty("negative_prompt");
    expect(dispatchedDraft).not.toHaveProperty("negativePrompt");
  });

  // --------------------------------------------------------------------------
  // Existing tests: Session creation and message flow
  // --------------------------------------------------------------------------
  it("should create session via POST then send message to session endpoint", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const fetchCalls: Array<{ url: string; body: string }> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = init?.body ? String(init.body) : "";
      fetchCalls.push({ url, body });

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === "/api/assistant/sessions/session-abc/messages") {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Response text" }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Help me write a prompt");
    });

    expect(fetchCalls[0].url).toBe("/api/assistant/sessions");
    const sessionBody = JSON.parse(fetchCalls[0].body);
    expect(sessionBody).toEqual({ project_id: "test-project-id" });

    expect(fetchCalls[1].url).toBe(
      "/api/assistant/sessions/session-abc/messages"
    );
    const messageBody = JSON.parse(fetchCalls[1].body);
    expect(messageBody.content).toBe("Help me write a prompt");
    expect(messageBody.model).toBe("anthropic/claude-sonnet-4.6");
  });

  it("should mark assistant message as complete on text-done event", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-done" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Answer" }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Test");
    });

    const markDoneActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "MARK_ASSISTANT_DONE");

    expect(markDoneActions.length).toBeGreaterThanOrEqual(1);
  });

  it("should store tool-call-result events via ADD_TOOL_CALL_RESULT dispatch", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const toolCallData = {
      tool: "draft_prompt",
      data: {
        prompt: "A cat in space",
      },
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-tool" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Here is your prompt:" }),
          },
          {
            event: "tool-call-result",
            data: JSON.stringify(toolCallData),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Write me a prompt");
    });

    const toolCallActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_TOOL_CALL_RESULT");

    expect(toolCallActions).toHaveLength(1);
    expect(toolCallActions[0]).toEqual({
      type: "ADD_TOOL_CALL_RESULT",
      result: {
        tool: "draft_prompt",
        data: {
          prompt: "A cat in space",
        },
      },
    });
  });

  it("should handle error SSE events and surface error message", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return new Response(JSON.stringify({ id: "session-err" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "error",
            data: JSON.stringify({
              message: "Rate limit exceeded. Please try again.",
            }),
          },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);

    const errorWithMessage = errorActions.find(
      (a: AssistantAction) =>
        a.type === "ADD_ERROR_MESSAGE" &&
        a.content === "Rate limit exceeded. Please try again."
    );
    expect(errorWithMessage).toBeDefined();
  });

  it("should reuse existing session ID for subsequent messages", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "existing-session-42" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const fetchCalls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      if (url.includes("/messages")) {
        return mockSSEResponse([
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Response" }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Follow-up question");
    });

    const sessionCreationCalls = fetchCalls.filter(
      (url) => url === "/api/assistant/sessions"
    );
    expect(sessionCreationCalls).toHaveLength(0);

    const messageCalls = fetchCalls.filter((url) =>
      url.includes("/api/assistant/sessions/existing-session-42/messages")
    );
    expect(messageCalls).toHaveLength(1);
  });

  it("should dispatch ADD_USER_MESSAGE immediately when sendMessage is called", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-x" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async () => {
      return mockSSEResponse([
        { event: "text-delta", data: JSON.stringify({ content: "ok" }) },
        { event: "text-done", data: JSON.stringify({}) },
      ]);
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("User typed this");
    });

    const userMsgActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_USER_MESSAGE");

    expect(userMsgActions).toHaveLength(1);
    expect(userMsgActions[0]).toMatchObject({
      type: "ADD_USER_MESSAGE",
      message: expect.objectContaining({
        role: "user",
        content: "User typed this",
      }),
    });
  });
});
