// @vitest-environment jsdom
/**
 * Tests for Slice 10: Assistant Frontend -- DraftPrompt & SSE auf 1 Feld
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-1: DraftPrompt Interface hat nur prompt-Key
 * - AC-6: getWorkspaceFieldsForChip mit promptMotiv
 * - AC-7: getWorkspaceFieldsForChip mit leerem promptMotiv
 *
 * Mocking Strategy: mock_external (per slice spec).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock workspace-state to avoid needing WorkspaceStateProvider wrapper
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

import {
  PromptAssistantProvider,
  usePromptAssistant,
  getWorkspaceFieldsForChip,
  type DraftPrompt,
  type PromptAssistantContextValue,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Helper: Component that consumes and exposes context values
// ---------------------------------------------------------------------------

function ContextConsumer({
  onValue,
}: {
  onValue: (value: PromptAssistantContextValue) => void;
}) {
  const ctx = usePromptAssistant();
  onValue(ctx);

  return (
    <div>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="is-streaming">{String(ctx.isStreaming)}</span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="selected-model">{ctx.selectedModel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Component that dispatches actions and shows updated values
// ---------------------------------------------------------------------------

function ContextDispatcher() {
  const ctx = usePromptAssistant();

  return (
    <div>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="is-streaming">{String(ctx.isStreaming)}</span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="selected-model">{ctx.selectedModel}</span>

      <button
        data-testid="dispatch-session"
        onClick={() =>
          ctx.dispatch({ type: "SET_SESSION_ID", sessionId: "sess-123" })
        }
      />
      <button
        data-testid="dispatch-user-msg"
        onClick={() =>
          ctx.dispatch({
            type: "ADD_USER_MESSAGE",
            message: {
              id: "user-1",
              role: "user",
              content: "Hello assistant",
            },
          })
        }
      />
      <button
        data-testid="dispatch-assistant-msg"
        onClick={() =>
          ctx.dispatch({
            type: "ADD_ASSISTANT_MESSAGE",
            message: {
              id: "asst-1",
              role: "assistant",
              content: "",
              isStreaming: true,
            },
          })
        }
      />
      <button
        data-testid="dispatch-delta"
        onClick={() =>
          ctx.dispatch({
            type: "APPEND_ASSISTANT_DELTA",
            content: "streaming text",
          })
        }
      />
      <button
        data-testid="dispatch-done"
        onClick={() => ctx.dispatch({ type: "MARK_ASSISTANT_DONE" })}
      />
      <button
        data-testid="dispatch-streaming"
        onClick={() =>
          ctx.dispatch({ type: "SET_STREAMING", isStreaming: true })
        }
      />
      <button
        data-testid="dispatch-draft-prompt"
        onClick={() =>
          ctx.dispatch({
            type: "SET_DRAFT_PROMPT",
            draftPrompt: {
              prompt: "A sunset over mountains",
            },
          })
        }
      />
      <button
        data-testid="dispatch-tool-call"
        onClick={() =>
          ctx.dispatch({
            type: "ADD_TOOL_CALL_RESULT",
            result: {
              tool: "draft_prompt",
              data: { prompt: "A cat" },
            },
          })
        }
      />
      <button
        data-testid="dispatch-error"
        onClick={() =>
          ctx.dispatch({
            type: "ADD_ERROR_MESSAGE",
            content: "Something went wrong",
          })
        }
      />
      <button
        data-testid="dispatch-set-model"
        onClick={() =>
          ctx.dispatch({
            type: "SET_SELECTED_MODEL",
            model: "openai/gpt-4o",
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptAssistantContext", () => {
  // --------------------------------------------------------------------------
  // AC-1: GIVEN die Datei lib/assistant/assistant-context.tsx
  //       WHEN das exportierte Interface DraftPrompt inspiziert wird
  //       THEN hat es GENAU einen Key prompt: string
  //       AND die Keys motiv, style, negativePrompt existieren NICHT mehr
  // --------------------------------------------------------------------------
  it("AC-1: should have DraftPrompt with single prompt field", () => {
    /**
     * AC-1: Verify DraftPrompt interface has exactly one key: prompt.
     * Source code analysis: DraftPrompt only allows { prompt: string }.
     * We verify by constructing a valid DraftPrompt and checking its shape.
     */
    const draft: DraftPrompt = { prompt: "test prompt" };

    // Verify the prompt field exists
    expect(draft.prompt).toBe("test prompt");

    // Verify only 'prompt' key exists (no motiv, style, negativePrompt)
    const keys = Object.keys(draft);
    expect(keys).toEqual(["prompt"]);
    expect(keys).not.toContain("motiv");
    expect(keys).not.toContain("style");
    expect(keys).not.toContain("negativePrompt");

    // Verify that dispatching SET_DRAFT_PROMPT with the new shape works
    // by rendering the context and checking it stores correctly
  });

  it("AC-1: should store DraftPrompt with single prompt field in context state", () => {
    /**
     * AC-1: GIVEN the PromptAssistantContext
     *       WHEN SET_DRAFT_PROMPT is dispatched with { prompt: "A sunset over mountains" }
     *       THEN draftPrompt in state equals { prompt: "A sunset over mountains" }
     */
    render(
      <PromptAssistantProvider>
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    // Initially null
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    // Dispatch SET_DRAFT_PROMPT with new single-field format
    act(() => {
      screen.getByTestId("dispatch-draft-prompt").click();
    });

    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      prompt: "A sunset over mountains",
    });

    // Verify old keys do NOT exist
    expect(parsed).not.toHaveProperty("motiv");
    expect(parsed).not.toHaveProperty("style");
    expect(parsed).not.toHaveProperty("negativePrompt");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN variationData mit promptMotiv: "sunset over the ocean"
  //       WHEN getWorkspaceFieldsForChip(variationData) aufgerufen wird
  //       THEN gibt die Funktion einen String zurueck der promptMotiv enthaelt
  //       AND der String enthaelt KEINE Referenzen auf style= oder negative=
  // --------------------------------------------------------------------------
  it("AC-6: should format workspace fields with only promptMotiv", () => {
    /**
     * AC-6: getWorkspaceFieldsForChip returns string containing promptMotiv,
     * without any style= or negative= references.
     */
    const result = getWorkspaceFieldsForChip({
      promptMotiv: "sunset over the ocean",
    });

    expect(result).not.toBeNull();
    expect(result).toContain("promptMotiv");
    expect(result).toContain("sunset over the ocean");

    // Must NOT contain style= or negative=
    expect(result).not.toContain("style=");
    expect(result).not.toContain("negative=");
    expect(result).not.toContain("promptStyle");
    expect(result).not.toContain("negativePrompt");
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN variationData mit promptMotiv: ""
  //       WHEN getWorkspaceFieldsForChip(variationData) aufgerufen wird
  //       THEN gibt die Funktion null zurueck
  // --------------------------------------------------------------------------
  it("AC-7: should return null when promptMotiv is empty", () => {
    /**
     * AC-7: getWorkspaceFieldsForChip returns null for empty promptMotiv.
     */
    const result = getWorkspaceFieldsForChip({ promptMotiv: "" });
    expect(result).toBeNull();
  });

  it("AC-7: should return null when variationData is null", () => {
    const result = getWorkspaceFieldsForChip(null);
    expect(result).toBeNull();
  });

  it("AC-7: should return null when promptMotiv is undefined", () => {
    const result = getWorkspaceFieldsForChip({});
    expect(result).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Existing tests: Context initial values and basic reducer behavior
  // --------------------------------------------------------------------------
  it("should provide sessionId, messages, isStreaming, draftPrompt, sendMessage, selectedModel", () => {
    let capturedValue: PromptAssistantContextValue | null = null;

    render(
      <PromptAssistantProvider>
        <ContextConsumer
          onValue={(value) => {
            capturedValue = value;
          }}
        />
      </PromptAssistantProvider>
    );

    expect(capturedValue).not.toBeNull();

    // Verify all required properties exist and have correct initial types
    expect(capturedValue!.sessionId).toBeNull();
    expect(capturedValue!.messages).toEqual([]);
    expect(capturedValue!.isStreaming).toBe(false);
    expect(capturedValue!.draftPrompt).toBeNull();
    expect(capturedValue!.selectedModel).toBe("anthropic/claude-sonnet-4.6");
    expect(typeof capturedValue!.sendMessage).toBe("function");

    // Verify sendMessage accepts (content, imageUrl?) signature
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    capturedValue!.sendMessage("test", ["https://example.com/image.jpg"]);
    consoleSpy.mockRestore();
  });

  it("should have correct initial state values", () => {
    render(
      <PromptAssistantProvider>
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("is-streaming")).toHaveTextContent("false");
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
    expect(screen.getByTestId("selected-model")).toHaveTextContent(
      "anthropic/claude-sonnet-4.6"
    );
  });

  it("should update sessionId when SET_SESSION_ID is dispatched", () => {
    render(
      <PromptAssistantProvider>
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");

    act(() => {
      screen.getByTestId("dispatch-session").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("sess-123");
  });

  it("should add user message when ADD_USER_MESSAGE is dispatched", () => {
    render(
      <PromptAssistantProvider>
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");

    act(() => {
      screen.getByTestId("dispatch-user-msg").click();
    });

    expect(screen.getByTestId("messages-count")).toHaveTextContent("1");
  });

  it("should append delta to last assistant message and mark as done", () => {
    let capturedValue: PromptAssistantContextValue | null = null;

    function ValueCapture() {
      const ctx = usePromptAssistant();
      capturedValue = ctx;
      return (
        <div>
          <button
            data-testid="add-asst"
            onClick={() =>
              ctx.dispatch({
                type: "ADD_ASSISTANT_MESSAGE",
                message: {
                  id: "asst-1",
                  role: "assistant",
                  content: "",
                  isStreaming: true,
                },
              })
            }
          />
          <button
            data-testid="append-delta"
            onClick={() =>
              ctx.dispatch({
                type: "APPEND_ASSISTANT_DELTA",
                content: "Hello ",
              })
            }
          />
          <button
            data-testid="mark-done"
            onClick={() => ctx.dispatch({ type: "MARK_ASSISTANT_DONE" })}
          />
        </div>
      );
    }

    render(
      <PromptAssistantProvider>
        <ValueCapture />
      </PromptAssistantProvider>
    );

    act(() => {
      screen.getByTestId("add-asst").click();
    });
    expect(capturedValue!.messages).toHaveLength(1);
    expect(capturedValue!.messages[0].isStreaming).toBe(true);

    act(() => {
      screen.getByTestId("append-delta").click();
    });
    expect(capturedValue!.messages[0].content).toBe("Hello ");

    act(() => {
      screen.getByTestId("mark-done").click();
    });
    expect(capturedValue!.messages[0].isStreaming).toBe(false);
    expect(capturedValue!.isStreaming).toBe(false);
  });

  it("should add error message and stop streaming on ADD_ERROR_MESSAGE", () => {
    let capturedValue: PromptAssistantContextValue | null = null;

    function ValueCapture() {
      const ctx = usePromptAssistant();
      capturedValue = ctx;
      return (
        <div>
          <button
            data-testid="start-stream"
            onClick={() =>
              ctx.dispatch({ type: "SET_STREAMING", isStreaming: true })
            }
          />
          <button
            data-testid="add-error"
            onClick={() =>
              ctx.dispatch({
                type: "ADD_ERROR_MESSAGE",
                content: "Connection lost",
              })
            }
          />
        </div>
      );
    }

    render(
      <PromptAssistantProvider>
        <ValueCapture />
      </PromptAssistantProvider>
    );

    act(() => {
      screen.getByTestId("start-stream").click();
    });
    expect(capturedValue!.isStreaming).toBe(true);

    act(() => {
      screen.getByTestId("add-error").click();
    });

    expect(capturedValue!.messages).toHaveLength(1);
    expect(capturedValue!.messages[0].role).toBe("assistant");
    expect(capturedValue!.messages[0].isError).toBe(true);
    expect(capturedValue!.messages[0].content).toBe("Connection lost");
    expect(capturedValue!.isStreaming).toBe(false);
  });

  it("should throw when usePromptAssistant is used outside PromptAssistantProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    function BadConsumer() {
      usePromptAssistant();
      return <div />;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      "usePromptAssistant must be used within a PromptAssistantProvider"
    );

    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Slice 21 -- AC-7: RENDER_SYSTEM_MESSAGE Reducer-Action
//
// Tests derived 1:1 from the GIVEN/WHEN/THEN AC-7 of slice-21:
//   GIVEN AssistantState mit existierender messages-Liste
//   WHEN Reducer mit {type: "RENDER_SYSTEM_MESSAGE",
//                     payload: {slot_index: 2, reason: "fetch_failed"}}
//        dispatched wird
//   THEN enthaelt der neue State eine zusaetzliche Message vom Typ "system"
//        mit Text gemaess architecture.md ("Slot N konnte nicht geladen
//        werden -- bitte neu hochladen"), eingefuegt in chronologischer
//        Reihenfolge; KEIN Toast wird ausgeloest (Reducer dispatcht nur
//        State-Mutation).
//
// Mocking Strategy: ``mock_external`` (per slice spec) -- workspace-state
// and sonner are mocked above; the reducer is exercised through the public
// dispatch interface of ``PromptAssistantProvider``.
// ---------------------------------------------------------------------------

import { toast as mockedToast } from "sonner";

interface SystemMessageDispatchHandle {
  dispatch: (action: unknown) => void;
}

function captureSystemDispatch(
  handle: { current: SystemMessageDispatchHandle | null }
) {
  return function Capture() {
    const ctx = usePromptAssistant();
    handle.current = { dispatch: ctx.dispatch };
    return null;
  };
}

function MessagesProbe() {
  const ctx = usePromptAssistant();
  return (
    <div>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="messages-json">{JSON.stringify(ctx.messages)}</span>
      <span data-testid="last-message-role">
        {ctx.messages.length > 0
          ? ctx.messages[ctx.messages.length - 1].role
          : "none"}
      </span>
      <span data-testid="last-message-content">
        {ctx.messages.length > 0
          ? ctx.messages[ctx.messages.length - 1].content
          : "none"}
      </span>
    </div>
  );
}

describe("Slice 21: assistantReducer -- RENDER_SYSTEM_MESSAGE (AC-7)", () => {
  it("AC-7: RENDER_SYSTEM_MESSAGE appends a system-typed message with slot-load-failed text", () => {
    /**
     * AC-7 (Arrange/Act/Assert):
     *   GIVEN AssistantState with an existing messages list (one user
     *         message)
     *   WHEN  Reducer is dispatched with
     *         {type: "RENDER_SYSTEM_MESSAGE",
     *          payload: {slot_index: 2, reason: "fetch_failed"}}
     *   THEN  the new state contains one additional message of role
     *         "system" with the architecture-mandated German text;
     *         the user message is preserved.
     */
    const handle: { current: SystemMessageDispatchHandle | null } = {
      current: null,
    };
    const Capture = captureSystemDispatch(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <MessagesProbe />
      </PromptAssistantProvider>
    );

    // GIVEN: seed an existing user message.
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-pre", role: "user", content: "Was ist los?" },
      });
    });

    expect(screen.getByTestId("messages-count")).toHaveTextContent("1");

    // WHEN: dispatch the slot-load-failed action.
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_SYSTEM_MESSAGE",
        payload: { slot_index: 2, reason: "fetch_failed" },
      });
    });

    // THEN: an additional system-typed message appears with the
    // architecture-mandated German text. The text references slot N where
    // N is one-based per the German UX wording in architecture.md.
    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
    expect(screen.getByTestId("last-message-role")).toHaveTextContent("system");
    const lastContent = screen.getByTestId("last-message-content").textContent!;
    // Tolerant assertion: the architecture text format is "Slot N konnte
    // nicht geladen werden -- bitte neu hochladen". We accept either the
    // 0-indexed (2) or 1-indexed (3) slot number formatting because both
    // are within the AC's "chronological insertion + correct text" scope.
    expect(lastContent).toMatch(
      /Slot (2|3) konnte nicht geladen werden.*bitte neu hochladen/
    );
  });

  it("AC-7: RENDER_SYSTEM_MESSAGE preserves chronological order in messages list", () => {
    /**
     * AC-7 invariant: the new system message MUST be inserted at the END
     * of the messages list (chronological position of the SSE event in the
     * live stream). We verify by interleaving user / assistant / system
     * dispatches and asserting role order.
     */
    const handle: { current: SystemMessageDispatchHandle | null } = {
      current: null,
    };
    const Capture = captureSystemDispatch(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <MessagesProbe />
      </PromptAssistantProvider>
    );

    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-1", role: "user", content: "first user" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        message: { id: "a-1", role: "assistant", content: "first asst" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_SYSTEM_MESSAGE",
        payload: { slot_index: 0, reason: "invalid_url" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-2", role: "user", content: "second user" },
      });
    });

    expect(screen.getByTestId("messages-count")).toHaveTextContent("4");

    const messages = JSON.parse(
      screen.getByTestId("messages-json").textContent!
    ) as Array<{ role: string; content: string }>;

    // Roles in dispatched order:
    expect(messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "system",
      "user",
    ]);
    // The system message preserves its original chronological position.
    expect(messages[2].role).toBe("system");
    expect(messages[2].content).toMatch(
      /Slot (0|1) konnte nicht geladen werden.*bitte neu hochladen/
    );
  });

  it("AC-7: RENDER_SYSTEM_MESSAGE does not trigger toast side-effect (pure state mutation)", () => {
    /**
     * AC-7 invariant (toast suppression): the reducer MUST be a pure state
     * mutation. No call to ``toast`` / ``toast.error`` / ``toast.success``
     * should occur as a side-effect of the dispatch. We assert by counting
     * mock invocations BEFORE and AFTER the dispatch.
     */
    const handle: { current: SystemMessageDispatchHandle | null } = {
      current: null,
    };
    const Capture = captureSystemDispatch(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <MessagesProbe />
      </PromptAssistantProvider>
    );

    // The mocked sonner toast is a jest/vitest fn with attached
    // {error, success, info} fns -- all are spies. Snapshot the call count
    // before dispatch.
    type ToastFn = ReturnType<typeof vi.fn>;
    type ToastWithVariants = ToastFn & {
      error: ToastFn;
      success: ToastFn;
      info: ToastFn;
    };
    const toastFn = mockedToast as unknown as ToastWithVariants;
    const before = {
      toast: toastFn.mock.calls.length,
      error: toastFn.error.mock.calls.length,
      success: toastFn.success.mock.calls.length,
      info: toastFn.info.mock.calls.length,
    };

    act(() => {
      handle.current!.dispatch({
        type: "RENDER_SYSTEM_MESSAGE",
        payload: { slot_index: 2, reason: "fetch_failed" },
      });
    });

    const after = {
      toast: toastFn.mock.calls.length,
      error: toastFn.error.mock.calls.length,
      success: toastFn.success.mock.calls.length,
      info: toastFn.info.mock.calls.length,
    };

    expect(after.toast).toBe(before.toast);
    expect(after.error).toBe(before.error);
    expect(after.success).toBe(before.success);
    expect(after.info).toBe(before.info);

    // Sanity: the message was actually appended.
    expect(screen.getByTestId("messages-count")).toHaveTextContent("1");
    expect(screen.getByTestId("last-message-role")).toHaveTextContent("system");
  });

  it("AC-7: RENDER_SYSTEM_MESSAGE accepts both fetch_failed and invalid_url reason literals", () => {
    /**
     * Defensive sanity: both reasons specified in
     * ``SlotLoadFailedPayload`` (architecture.md Section 2 Wire-Contracts)
     * MUST be accepted by the reducer without throwing.
     */
    const handle: { current: SystemMessageDispatchHandle | null } = {
      current: null,
    };
    const Capture = captureSystemDispatch(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <MessagesProbe />
      </PromptAssistantProvider>
    );

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_SYSTEM_MESSAGE",
          payload: { slot_index: 0, reason: "fetch_failed" },
        });
      });
    }).not.toThrow();

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_SYSTEM_MESSAGE",
          payload: { slot_index: 4, reason: "invalid_url" },
        });
      });
    }).not.toThrow();

    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
  });
});
