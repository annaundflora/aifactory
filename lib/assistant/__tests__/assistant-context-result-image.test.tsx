// @vitest-environment jsdom
/**
 * Tests for Slice 18: Reducer-Action ``SET_LAST_RESULT_IMAGE_URL`` in
 * ``assistant-context.tsx``.
 *
 * Tests derived 1:1 from GIVEN/WHEN/THEN Acceptance Criteria:
 *   AC-3: SET_LAST_RESULT_IMAGE_URL with a string URL sets
 *         ``state.lastResultImageUrl`` to that URL; all other fields stay
 *         unchanged; reducer-initial-state value is ``null``.
 *   AC-4: SET_LAST_RESULT_IMAGE_URL with ``url: null`` clears
 *         ``state.lastResultImageUrl`` (explicit-clear path for session
 *         reset / project switch).
 *
 * Mocking Strategy: ``mock_external`` (per slice spec) — ``workspace-state``
 * and ``sonner`` are mocked because they would otherwise pull in side
 * effects unrelated to the reducer under test. The reducer is not
 * exported as a named symbol; we exercise it through the public dispatch
 * interface of ``PromptAssistantProvider`` and assert on the publicly-
 * readable fields.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

import {
  PromptAssistantProvider,
  usePromptAssistant,
  type PromptAssistantContextValue,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Helper: capture context for state assertions + expose dispatch
// ---------------------------------------------------------------------------

interface DispatchHandle {
  dispatch: PromptAssistantContextValue["dispatch"];
  ctx: PromptAssistantContextValue;
}

function captureHandle(handle: { current: DispatchHandle | null }) {
  return function Capture() {
    const ctx = usePromptAssistant();
    handle.current = { dispatch: ctx.dispatch, ctx };
    return null;
  };
}

function StateProbe() {
  const ctx = usePromptAssistant();
  return (
    <div>
      <span data-testid="last-result-image-url">
        {ctx.lastResultImageUrl === null
          ? "null"
          : String(ctx.lastResultImageUrl)}
      </span>
      <span data-testid="last-result-generation-id">
        {ctx.lastResultGenerationId === null
          ? "null"
          : String(ctx.lastResultGenerationId)}
      </span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="flow-state">{ctx.flowState}</span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="intent-summary-payload">
        {ctx.intentSummaryPayload
          ? JSON.stringify(ctx.intentSummaryPayload)
          : "null"}
      </span>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="selected-model">{ctx.selectedModel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Slice 18: assistantReducer -- SET_LAST_RESULT_IMAGE_URL", () => {
  it("AC-3: lastResultImageUrl initial reducer value is null", () => {
    /**
     * AC-3 (Initialwert): GIVEN the PromptAssistantProvider mounts fresh
     *                     WHEN no SET_LAST_RESULT_IMAGE_URL action is dispatched
     *                     THEN state.lastResultImageUrl === null
     *                     AND state.lastResultGenerationId === null
     */
    render(
      <PromptAssistantProvider>
        <StateProbe />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "null"
    );
    expect(screen.getByTestId("last-result-generation-id")).toHaveTextContent(
      "null"
    );
  });

  it("AC-3: SET_LAST_RESULT_IMAGE_URL sets state.lastResultImageUrl to provided url and leaves other fields untouched", () => {
    /**
     * AC-3: GIVEN reducer state with non-empty messages, draftPrompt,
     *             flowState, intentSummaryPayload, sessionId
     *       WHEN  Reducer is dispatched with
     *             { type: "SET_LAST_RESULT_IMAGE_URL",
     *               url: "https://example.com/img.png",
     *               generationId: "gen-42" }
     *       THEN  state.lastResultImageUrl === "https://example.com/img.png"
     *             AND state.lastResultGenerationId === "gen-42"
     *             AND messages, flowState, intentSummaryPayload,
     *                 draftPrompt, sessionId stay verbatim.
     */
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureHandle(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <StateProbe />
      </PromptAssistantProvider>
    );

    // GIVEN: pre-populate the reducer with state across all the fields
    // listed in the AC so we can prove they stay untouched after dispatch.
    act(() => {
      handle.current!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "session-pre",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u1", role: "user", content: "test" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_ASSISTANT_MESSAGE",
        message: { id: "a1", role: "assistant", content: "reply" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: { prompt: "test prompt" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "reviewing",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_INTENT_SUMMARY",
        payload: {
          axes: { subject: "cat" },
          prompt_preview: "a cat",
        },
      });
    });

    // Snapshot publicly-observable fields BEFORE the action under test.
    const messagesBefore = screen.getByTestId("messages-count").textContent;
    const flowStateBefore = screen.getByTestId("flow-state").textContent;
    const draftBefore = screen.getByTestId("draft-prompt").textContent;
    const intentBefore = screen.getByTestId(
      "intent-summary-payload"
    ).textContent;
    const sessionBefore = screen.getByTestId("session-id").textContent;
    const modelBefore = screen.getByTestId("selected-model").textContent;

    expect(messagesBefore).toBe("2");
    expect(flowStateBefore).toBe("reviewing");
    expect(sessionBefore).toBe("session-pre");

    // WHEN: dispatch SET_LAST_RESULT_IMAGE_URL with a real URL.
    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: "https://example.com/img.png",
        generationId: "gen-42",
      });
    });

    // THEN: lastResultImageUrl + lastResultGenerationId reflect the action.
    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "https://example.com/img.png"
    );
    expect(screen.getByTestId("last-result-generation-id")).toHaveTextContent(
      "gen-42"
    );

    // AND: every other publicly-readable field is preserved byte-for-byte.
    expect(screen.getByTestId("messages-count").textContent).toBe(
      messagesBefore
    );
    expect(screen.getByTestId("flow-state").textContent).toBe(flowStateBefore);
    expect(screen.getByTestId("draft-prompt").textContent).toBe(draftBefore);
    expect(screen.getByTestId("intent-summary-payload").textContent).toBe(
      intentBefore
    );
    expect(screen.getByTestId("session-id").textContent).toBe(sessionBefore);
    expect(screen.getByTestId("selected-model").textContent).toBe(modelBefore);
  });

  it("AC-4: SET_LAST_RESULT_IMAGE_URL with url=null clears state.lastResultImageUrl", () => {
    /**
     * AC-4: GIVEN state.lastResultImageUrl is already set (e.g. from a
     *             prior successful generate)
     *       WHEN  Reducer is dispatched with
     *             { type: "SET_LAST_RESULT_IMAGE_URL", url: null }
     *       THEN  state.lastResultImageUrl === null
     *             (explicit-clear path for session reset / project switch)
     */
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureHandle(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <StateProbe />
      </PromptAssistantProvider>
    );

    // GIVEN: arm the field with a real URL first.
    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: "https://example.com/seed.png",
        generationId: "gen-seed",
      });
    });
    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "https://example.com/seed.png"
    );
    expect(screen.getByTestId("last-result-generation-id")).toHaveTextContent(
      "gen-seed"
    );

    // WHEN: explicit-clear with url=null.
    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: null,
      });
    });

    // THEN: the URL is cleared. The companion generationId is also cleared
    // by the reducer's documented behaviour — when url is explicitly null
    // and no generationId override is passed, both fields drop.
    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "null"
    );
    expect(screen.getByTestId("last-result-generation-id")).toHaveTextContent(
      "null"
    );
  });

  it("AC-3: subsequent SET_LAST_RESULT_IMAGE_URL replaces the previous URL (only-latest-result rule)", () => {
    /**
     * Discovery business rule line 286: only the LATEST result is kept.
     * The reducer must replace, not append. We prove this by dispatching
     * twice and asserting the second URL wins.
     */
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureHandle(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <StateProbe />
      </PromptAssistantProvider>
    );

    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: "https://example.com/first.png",
        generationId: "gen-first",
      });
    });
    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "https://example.com/first.png"
    );

    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: "https://example.com/second.png",
        generationId: "gen-second",
      });
    });
    expect(screen.getByTestId("last-result-image-url")).toHaveTextContent(
      "https://example.com/second.png"
    );
    expect(screen.getByTestId("last-result-generation-id")).toHaveTextContent(
      "gen-second"
    );
  });

  it("AC-3 (provides-to-others): lastResultImageUrlRef mirrors state.lastResultImageUrl", () => {
    /**
     * Slice 18 architecture / Provides-To-Other-Slices:
     * ``lastResultImageUrlRef`` is exposed via the context value and MUST
     * mirror ``state.lastResultImageUrl`` so that the runtime hook
     * (``use-assistant-runtime.ts``) can read the latest URL at request-
     * build time without re-subscribing on every change. We verify the
     * mirror relationship from a child component that reads both.
     */
    function MirrorProbe() {
      const ctx = usePromptAssistant();
      return (
        <div>
          <span data-testid="state-url">
            {ctx.lastResultImageUrl ?? "null"}
          </span>
          <span data-testid="ref-url">
            {ctx.lastResultImageUrlRef.current ?? "null"}
          </span>
        </div>
      );
    }

    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureHandle(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <MirrorProbe />
      </PromptAssistantProvider>
    );

    // Initial mirror.
    expect(screen.getByTestId("state-url")).toHaveTextContent("null");
    expect(screen.getByTestId("ref-url")).toHaveTextContent("null");

    // Set: state + ref both reflect the new URL.
    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: "https://cdn.example.com/r.png",
        generationId: "gen-r",
      });
    });
    expect(screen.getByTestId("state-url")).toHaveTextContent(
      "https://cdn.example.com/r.png"
    );
    expect(screen.getByTestId("ref-url")).toHaveTextContent(
      "https://cdn.example.com/r.png"
    );

    // Clear: both drop back to null.
    act(() => {
      handle.current!.dispatch({
        type: "SET_LAST_RESULT_IMAGE_URL",
        url: null,
      });
    });
    expect(screen.getByTestId("state-url")).toHaveTextContent("null");
    expect(screen.getByTestId("ref-url")).toHaveTextContent("null");
  });
});
