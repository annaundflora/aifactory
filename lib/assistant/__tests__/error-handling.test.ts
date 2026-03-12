// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
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
// Frontend Error Handling Tests (Slice 22)
// ---------------------------------------------------------------------------

describe("Frontend Error Handling", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN das Backend ist nicht erreichbar (Netzwerkfehler / HTTP 502)
  //       WHEN der Frontend-SSE-Fetch fehlschlaegt
  //       THEN wird ein Toast (sonner) angezeigt: "Assistent nicht verfuegbar"
  //            und im Chat erscheint eine ErrorMessage
  // --------------------------------------------------------------------------
  it("AC-6: should add error message to chat when backend is unreachable (network error)", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Simulate network error -- fetch throws TypeError for network failures
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Test message");
    });

    // Verify ADD_ERROR_MESSAGE was dispatched (ErrorMessage shown in chat)
    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-6: should add error message when existing session fetch fails with network error", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "existing-session" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Simulate network error on message send
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Hello");
    });

    // Verify error is dispatched to chat
    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);
  });

  it("AC-6: should add error message when backend returns HTTP 502", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-502" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Simulate HTTP 502 response
    globalThis.fetch = vi.fn(async () => {
      return new Response("Bad Gateway", { status: 502 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Test");
    });

    // Verify ADD_ERROR_MESSAGE was dispatched
    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN eine Session mit message_count >= 100
  //       WHEN der User eine weitere Nachricht senden will
  //       THEN antwortet das Backend mit HTTP 400 und
  //            {"detail": "Session-Limit erreicht. Bitte starte eine neue Session."}
  //            und das Frontend zeigt eine Hinweis-Nachricht im Chat
  //            (nicht rot, sondern informativ)
  // --------------------------------------------------------------------------
  it("AC-7: should show informational session limit message when backend returns 400 with limit detail", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-limit" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Simulate HTTP 400 with session limit detail
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          detail: "Session-Limit erreicht. Bitte starte eine neue Session.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Message 101");
    });

    // Verify an error/info message was dispatched to chat
    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);

    // The error message should contain the status code (400)
    const limitMessage = errorActions.find(
      (a: AssistantAction) =>
        a.type === "ADD_ERROR_MESSAGE" && a.content.includes("400")
    );
    expect(limitMessage).toBeDefined();
  });

  it("AC-7: should handle session limit on session creation too", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: null as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    // Simulate session creation returning 400
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          detail: "Session-Limit erreicht. Bitte starte eine neue Session.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("First message");
    });

    // Verify error was dispatched
    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // AC-6 (SSE error event): Error event in SSE stream dispatches error message
  // --------------------------------------------------------------------------
  it("AC-6: should dispatch ADD_ERROR_MESSAGE when SSE stream contains error event", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-sse-err" as string | null };
    const options = createHookOptions({ dispatch, sessionIdRef });

    globalThis.fetch = vi.fn(async () => {
      return mockSSEResponse([
        {
          event: "error",
          data: JSON.stringify({
            message: "Der KI-Dienst ist momentan nicht erreichbar.",
          }),
        },
      ]);
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Trigger error");
    });

    const errorActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_ERROR_MESSAGE");

    expect(errorActions.length).toBeGreaterThanOrEqual(1);

    const sseError = errorActions.find(
      (a: AssistantAction) =>
        a.type === "ADD_ERROR_MESSAGE" &&
        a.content === "Der KI-Dienst ist momentan nicht erreichbar."
    );
    expect(sseError).toBeDefined();
  });
});
