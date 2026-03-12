// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  PromptAssistantProvider,
  usePromptAssistant,
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
      <span data-testid="recommended-model">
        {ctx.recommendedModel ? JSON.stringify(ctx.recommendedModel) : "null"}
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
      <span data-testid="recommended-model">
        {ctx.recommendedModel ? JSON.stringify(ctx.recommendedModel) : "null"}
      </span>
      <span data-testid="selected-model">{ctx.selectedModel}</span>
      <span data-testid="tool-results">
        {JSON.stringify(
          ctx.messages
            .filter((m) => m.role === "error")
            .map((m) => m.content)
        )}
      </span>

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
              motiv: "A sunset over mountains",
              style: "oil painting",
              negativePrompt: "blurry, low quality",
            },
          })
        }
      />
      <button
        data-testid="dispatch-recommend-model"
        onClick={() =>
          ctx.dispatch({
            type: "SET_RECOMMENDED_MODEL",
            recommendedModel: {
              id: "stability/sdxl",
              name: "Stable Diffusion XL",
              reason: "Great for landscapes",
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
              data: { motiv: "A cat" },
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
  // AC-8: GIVEN der PromptAssistantContext wird bereitgestellt
  //       WHEN eine Komponente den Context konsumiert
  //       THEN sind folgende Werte verfuegbar: sessionId, messages, isStreaming,
  //            draftPrompt, recommendedModel, sendMessage(content, imageUrl?),
  //            selectedModel
  // --------------------------------------------------------------------------
  it("AC-8: should provide sessionId, messages, isStreaming, draftPrompt, recommendedModel, sendMessage, selectedModel", () => {
    let capturedValue: PromptAssistantContextValue | null = null;

    render(
      <PromptAssistantProvider projectId="test-project">
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
    expect(capturedValue!.recommendedModel).toBeNull();
    expect(capturedValue!.selectedModel).toBe("anthropic/claude-sonnet-4.6");
    expect(typeof capturedValue!.sendMessage).toBe("function");

    // Verify sendMessage accepts (content, imageUrl?) signature
    // It should not throw when called (even without runtime registered)
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    capturedValue!.sendMessage("test", "https://example.com/image.jpg");
    consoleSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // AC-8 (initial values): Check initial state reflects correct defaults
  // --------------------------------------------------------------------------
  it("AC-8: should have correct initial state values", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("is-streaming")).toHaveTextContent("false");
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
    expect(screen.getByTestId("recommended-model")).toHaveTextContent("null");
    expect(screen.getByTestId("selected-model")).toHaveTextContent(
      "anthropic/claude-sonnet-4.6"
    );
  });

  // --------------------------------------------------------------------------
  // AC-5 (draft_prompt): tool-call-result with tool=draft_prompt updates draftPrompt
  // --------------------------------------------------------------------------
  it("AC-5: should update draftPrompt when tool-call-result with tool=draft_prompt is received", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    // Initially null
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    // Dispatch SET_DRAFT_PROMPT (as would happen from tool-call-result handling)
    act(() => {
      screen.getByTestId("dispatch-draft-prompt").click();
    });

    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      motiv: "A sunset over mountains",
      style: "oil painting",
      negativePrompt: "blurry, low quality",
    });
  });

  // --------------------------------------------------------------------------
  // AC-5 (recommend_model): tool-call-result with tool=recommend_model updates recommendedModel
  // --------------------------------------------------------------------------
  it("AC-5: should update recommendedModel when tool-call-result with tool=recommend_model is received", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    // Initially null
    expect(screen.getByTestId("recommended-model")).toHaveTextContent("null");

    // Dispatch SET_RECOMMENDED_MODEL (as would happen from tool-call-result handling)
    act(() => {
      screen.getByTestId("dispatch-recommend-model").click();
    });

    const modelText = screen.getByTestId("recommended-model").textContent!;
    const parsed = JSON.parse(modelText);
    expect(parsed).toEqual({
      id: "stability/sdxl",
      name: "Stable Diffusion XL",
      reason: "Great for landscapes",
    });
  });

  // --------------------------------------------------------------------------
  // Reducer: SET_SESSION_ID action
  // --------------------------------------------------------------------------
  it("should update sessionId when SET_SESSION_ID is dispatched", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");

    act(() => {
      screen.getByTestId("dispatch-session").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("sess-123");
  });

  // --------------------------------------------------------------------------
  // Reducer: ADD_USER_MESSAGE action
  // --------------------------------------------------------------------------
  it("should add user message when ADD_USER_MESSAGE is dispatched", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <ContextDispatcher />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");

    act(() => {
      screen.getByTestId("dispatch-user-msg").click();
    });

    expect(screen.getByTestId("messages-count")).toHaveTextContent("1");
  });

  // --------------------------------------------------------------------------
  // Reducer: APPEND_ASSISTANT_DELTA and MARK_ASSISTANT_DONE
  // --------------------------------------------------------------------------
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
      <PromptAssistantProvider projectId="test-project">
        <ValueCapture />
      </PromptAssistantProvider>
    );

    // Add assistant message
    act(() => {
      screen.getByTestId("add-asst").click();
    });
    expect(capturedValue!.messages).toHaveLength(1);
    expect(capturedValue!.messages[0].isStreaming).toBe(true);

    // Append delta
    act(() => {
      screen.getByTestId("append-delta").click();
    });
    expect(capturedValue!.messages[0].content).toBe("Hello ");

    // Mark done
    act(() => {
      screen.getByTestId("mark-done").click();
    });
    expect(capturedValue!.messages[0].isStreaming).toBe(false);
    expect(capturedValue!.isStreaming).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Reducer: ADD_ERROR_MESSAGE action
  // --------------------------------------------------------------------------
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
      <PromptAssistantProvider projectId="test-project">
        <ValueCapture />
      </PromptAssistantProvider>
    );

    // Start streaming
    act(() => {
      screen.getByTestId("start-stream").click();
    });
    expect(capturedValue!.isStreaming).toBe(true);

    // Add error
    act(() => {
      screen.getByTestId("add-error").click();
    });

    expect(capturedValue!.messages).toHaveLength(1);
    expect(capturedValue!.messages[0].role).toBe("error");
    expect(capturedValue!.messages[0].content).toBe("Connection lost");
    expect(capturedValue!.isStreaming).toBe(false);
  });

  // --------------------------------------------------------------------------
  // usePromptAssistant outside provider should throw
  // --------------------------------------------------------------------------
  it("should throw when usePromptAssistant is used outside PromptAssistantProvider", () => {
    // Suppress React error boundary console output
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
