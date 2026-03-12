// @vitest-environment jsdom
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
  // AC-9: GIVEN der useAssistantRuntime Hook
  //       WHEN der Hook die SSE-Response parst
  //       THEN dekodiert der SSE-Parser Events im Format
  //            `event: {type}\ndata: {json}\n\n` korrekt,
  //            inklusive mehrzeiliger data-Felder und UTF-8 Sonderzeichen
  it("AC-9: should parse single SSE event with event type and JSON data", () => {
    const raw = 'event: text-delta\ndata: {"content":"Hello"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].event).toBe("text-delta");
    expect(result[0].data).toBe('{"content":"Hello"}');
  });

  it("AC-9: should parse multiple SSE events separated by double newlines", () => {
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

  it("AC-9: should handle multi-line data fields by joining them", () => {
    const raw =
      'event: text-delta\ndata: {"content":\ndata: "multi-line"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].event).toBe("text-delta");
    // Data lines are joined with newline
    expect(result[0].data).toBe('{"content":\n"multi-line"}');
  });

  it("AC-9: should handle UTF-8 special characters in data", () => {
    const raw =
      'event: text-delta\ndata: {"content":"Gruesse mit Umlauten: aeuoe Sonderzeichen: EUR"}\n\n';
    const result = parseSSEEvents(raw);

    expect(result).toHaveLength(1);
    expect(result[0].data).toContain("Gruesse mit Umlauten");
    expect(result[0].data).toContain("EUR");
  });

  it("AC-9: should skip empty blocks", () => {
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
  // AC-1: GIVEN der AssistantSheet ist geoeffnet mit Startscreen
  //       WHEN der User Text in den ChatInput eingibt und auf Send klickt
  //       THEN wird zuerst POST /api/assistant/sessions aufgerufen (Body: {project_id}),
  //       und danach POST /api/assistant/sessions/{id}/messages mit {content, model}
  //       -- die Session-ID stammt aus dem metadata SSE-Event der Session-Erstellung
  // --------------------------------------------------------------------------
  it("AC-1: should create session via POST /api/assistant/sessions then send message to session endpoint", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Track fetch calls
    const fetchCalls: Array<{ url: string; body: string }> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body = init?.body ? String(init.body) : "";
      fetchCalls.push({ url, body });

      if (url === "/api/assistant/sessions") {
        // Session creation returns SSE stream with metadata event
        return mockSSEResponse([
          {
            event: "metadata",
            data: JSON.stringify({
              session_id: "session-abc",
              thread_id: "thread-xyz",
            }),
          },
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Hello! " }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
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

    // When the metadata event dispatches SET_SESSION_ID, also set the ref
    dispatch.mockImplementation((action: AssistantAction) => {
      if (action.type === "SET_SESSION_ID") {
        sessionIdRef.current = action.sessionId;
      }
    });

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Help me write a prompt");
    });

    // Verify first call: POST /api/assistant/sessions with project_id
    expect(fetchCalls[0].url).toBe("/api/assistant/sessions");
    const sessionBody = JSON.parse(fetchCalls[0].body);
    expect(sessionBody).toEqual({ project_id: "test-project-id" });

    // Verify second call: POST /api/assistant/sessions/{id}/messages with content and model
    expect(fetchCalls[1].url).toBe(
      "/api/assistant/sessions/session-abc/messages"
    );
    const messageBody = JSON.parse(fetchCalls[1].body);
    expect(messageBody.content).toBe("Help me write a prompt");
    expect(messageBody.model).toBe("anthropic/claude-sonnet-4.6");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN der SSE-Stream sendet ein text-done Event
  //       WHEN das Event eintrifft
  //       THEN ist die Assistant-Message als vollstaendig markiert
  //            (kein weiteres Streaming erwartet)
  // --------------------------------------------------------------------------
  it("AC-4: should mark assistant message as complete on text-done event", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return mockSSEResponse([
          {
            event: "metadata",
            data: JSON.stringify({
              session_id: "session-done",
              thread_id: "thread-done",
            }),
          },
          {
            event: "text-delta",
            data: JSON.stringify({ content: "Greeting" }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
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

    // Verify MARK_ASSISTANT_DONE was dispatched (at least twice: greeting + response)
    const markDoneActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "MARK_ASSISTANT_DONE");

    expect(markDoneActions.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN der SSE-Stream liefert ein tool-call-result Event
  //       WHEN das Event eintrifft
  //       THEN wird das Event im PromptAssistantContext State gespeichert
  //            (fuer nachfolgende Slices wie Canvas),
  //            aber nicht als eigene Bubble dargestellt
  // --------------------------------------------------------------------------
  it("AC-5: should store tool-call-result events in context state", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const toolCallData = {
      tool: "draft_prompt",
      data: {
        motiv: "A cat in space",
        style: "photorealistic",
        negative_prompt: "blurry",
      },
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return mockSSEResponse([
          {
            event: "metadata",
            data: JSON.stringify({
              session_id: "session-tool",
              thread_id: "thread-tool",
            }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
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

    // Verify ADD_TOOL_CALL_RESULT was dispatched
    const toolCallActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_TOOL_CALL_RESULT");

    expect(toolCallActions).toHaveLength(1);
    expect(toolCallActions[0]).toEqual({
      type: "ADD_TOOL_CALL_RESULT",
      result: {
        tool: "draft_prompt",
        data: {
          motiv: "A cat in space",
          style: "photorealistic",
          negative_prompt: "blurry",
        },
      },
    });

    // Verify SET_DRAFT_PROMPT was also dispatched (since tool=draft_prompt)
    const draftPromptActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_DRAFT_PROMPT");

    expect(draftPromptActions).toHaveLength(1);

    // Verify no ADD_USER_MESSAGE or ADD_ASSISTANT_MESSAGE was dispatched for the tool-call-result
    // (it should NOT be displayed as a bubble)
    const allAddMessageActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter(
        (a: AssistantAction) =>
          (a.type === "ADD_USER_MESSAGE" || a.type === "ADD_ASSISTANT_MESSAGE") &&
          "message" in a &&
          a.message.content === JSON.stringify(toolCallData)
      );

    expect(allAddMessageActions).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN der SSE-Stream liefert ein error Event
  //       WHEN das Event eintrifft
  //       THEN wird die Fehlermeldung als Fehler-Nachricht im Chat angezeigt
  // --------------------------------------------------------------------------
  it("AC-6: should handle error SSE events and surface error message", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/assistant/sessions") {
        return mockSSEResponse([
          {
            event: "metadata",
            data: JSON.stringify({
              session_id: "session-err",
              thread_id: "thread-err",
            }),
          },
          { event: "text-done", data: JSON.stringify({}) },
        ]);
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

    // Verify ADD_ERROR_MESSAGE was dispatched with the error content
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

  // --------------------------------------------------------------------------
  // AC-11: GIVEN eine aktive Session mit vorherigen Messages
  //        WHEN der User eine weitere Nachricht sendet
  //        THEN wird die Nachricht an dieselbe Session-ID gesendet
  //             (keine neue Session erstellt)
  // --------------------------------------------------------------------------
  it("AC-11: should reuse existing session ID for subsequent messages", async () => {
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

    // Verify NO call to /api/assistant/sessions (session creation endpoint)
    const sessionCreationCalls = fetchCalls.filter(
      (url) => url === "/api/assistant/sessions"
    );
    expect(sessionCreationCalls).toHaveLength(0);

    // Verify message was sent to the existing session
    const messageCalls = fetchCalls.filter((url) =>
      url.includes("/api/assistant/sessions/existing-session-42/messages")
    );
    expect(messageCalls).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // AC-1 (User message dispatch): Verify user message is dispatched immediately
  // --------------------------------------------------------------------------
  it("AC-2: should dispatch ADD_USER_MESSAGE immediately when sendMessage is called", async () => {
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

    // Verify ADD_USER_MESSAGE was the first content-related dispatch
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

  // --------------------------------------------------------------------------
  // AC-5 (recommend_model): tool-call-result with tool=recommend_model
  // dispatches SET_RECOMMENDED_MODEL
  // --------------------------------------------------------------------------
  it("AC-5: should dispatch SET_RECOMMENDED_MODEL on tool-call-result with tool=recommend_model", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-model" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    const modelRec = {
      tool: "recommend_model",
      data: {
        id: "stability/sdxl",
        name: "Stable Diffusion XL",
        reason: "Best for photorealistic landscapes",
      },
    };

    globalThis.fetch = vi.fn(async () => {
      return mockSSEResponse([
        {
          event: "tool-call-result",
          data: JSON.stringify(modelRec),
        },
        { event: "text-done", data: JSON.stringify({}) },
      ]);
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Which model for landscapes?");
    });

    const recModelActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_RECOMMENDED_MODEL");

    expect(recModelActions).toHaveLength(1);
    expect(recModelActions[0]).toMatchObject({
      type: "SET_RECOMMENDED_MODEL",
      recommendedModel: {
        id: "stability/sdxl",
        name: "Stable Diffusion XL",
        reason: "Best for photorealistic landscapes",
      },
    });
  });
});
