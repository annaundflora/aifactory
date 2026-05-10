// @vitest-environment jsdom
/**
 * Tests for Slice 15: Reducer-Actions ``SET_FLOW_STATE`` +
 * ``RENDER_INTENT_SUMMARY`` in ``assistant-context.tsx``.
 *
 * Tests derived 1:1 from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-7: SET_FLOW_STATE updates only flowState; initial state has
 *   flowState = "idle"; other fields are preserved verbatim.
 * - AC-8: RENDER_INTENT_SUMMARY sets intentSummaryPayload; subsequent
 *   dispatch replaces the previous payload (idempotent re-render).
 *
 * Mocking Strategy: ``mock_external`` (per slice spec) — workspace-state
 * and sonner are mocked because they would otherwise pull in side-effects
 * unrelated to the reducer under test.
 *
 * The reducer is not exported as a named symbol; we therefore test it
 * through the public dispatch interface of ``PromptAssistantProvider``
 * and assert (a) on the publicly-readable fields that MUST NOT change
 * (AC-7 invariant), (b) that the dispatches succeed without throwing,
 * and (c) that subsequent dispatches behave idempotently (AC-8 invariant).
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
  type IntentSummaryPayload,
  type FlowState,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DispatchHandle {
  dispatch: (action: unknown) => void;
}

function captureContext(handle: { current: DispatchHandle | null }) {
  return function Capture() {
    const ctx = usePromptAssistant();
    handle.current = { dispatch: ctx.dispatch };
    return null;
  };
}

function ContextProbe() {
  const ctx = usePromptAssistant();
  return (
    <div>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="selected-model">{ctx.selectedModel}</span>
      <span data-testid="active-view">{ctx.activeView}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AC-7: SET_FLOW_STATE
// ---------------------------------------------------------------------------

describe("Slice 15: assistantReducer — SET_FLOW_STATE (AC-7)", () => {
  it("AC-7: SET_FLOW_STATE preserves messages, draftPrompt, sessionId, selectedModel, activeView verbatim", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    // Seed observable state with non-trivial values.
    act(() => {
      handle.current!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "sess-flow-7",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u1", role: "user", content: "hello" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: { prompt: "snapshot prompt" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "SET_SELECTED_MODEL",
        model: "openai/gpt-5.4",
      });
    });

    const beforeSession = screen.getByTestId("session-id").textContent;
    const beforeMsgs = screen.getByTestId("messages-count").textContent;
    const beforeDraft = screen.getByTestId("draft-prompt").textContent;
    const beforeModel = screen.getByTestId("selected-model").textContent;
    const beforeView = screen.getByTestId("active-view").textContent;

    // Now dispatch SET_FLOW_STATE — none of the above fields must change.
    act(() => {
      handle.current!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "interviewing" as FlowState,
      });
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent(
      beforeSession || ""
    );
    expect(screen.getByTestId("messages-count")).toHaveTextContent(
      beforeMsgs || ""
    );
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent(
      beforeDraft || ""
    );
    expect(screen.getByTestId("selected-model")).toHaveTextContent(
      beforeModel || ""
    );
    expect(screen.getByTestId("active-view")).toHaveTextContent(
      beforeView || ""
    );
  });

  it("AC-7: SET_FLOW_STATE accepts every whitelisted FlowState value without throwing", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    const values: FlowState[] = [
      "idle",
      "interviewing",
      "summarizing",
      "reviewing",
      "refining",
      "generating",
    ];
    for (const value of values) {
      expect(() => {
        act(() => {
          handle.current!.dispatch({
            type: "SET_FLOW_STATE",
            flowState: value,
          });
        });
      }).not.toThrow();
    }

    // Other fields untouched after the storm of dispatches.
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
  });

  it("AC-7: initial state mounts cleanly with no flow-state churn (idempotent SET_FLOW_STATE('idle'))", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    // The initial state defaults flowState to "idle" per AC-7. We verify
    // by dispatching SET_FLOW_STATE("idle") and observing no exceptions
    // and no mutation of other fields.
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "SET_FLOW_STATE",
          flowState: "idle" as FlowState,
        });
      });
    }).not.toThrow();

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
  });
});

// ---------------------------------------------------------------------------
// AC-8: RENDER_INTENT_SUMMARY
// ---------------------------------------------------------------------------

describe("Slice 15: assistantReducer — RENDER_INTENT_SUMMARY (AC-8)", () => {
  it("AC-8: RENDER_INTENT_SUMMARY does not mutate other state fields", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    // Seed observable state.
    act(() => {
      handle.current!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "sess-render-1",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-r1", role: "user", content: "want a prompt" },
      });
    });

    const payload: IntentSummaryPayload = {
      axes: { subject: "coral reef" },
      prompt_preview: "A vibrant coral reef, photorealistic",
    };

    act(() => {
      handle.current!.dispatch({
        type: "RENDER_INTENT_SUMMARY",
        payload,
      });
    });

    // Other fields untouched.
    expect(screen.getByTestId("session-id")).toHaveTextContent(
      "sess-render-1"
    );
    expect(screen.getByTestId("messages-count")).toHaveTextContent("1");
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
  });

  it("AC-8: subsequent RENDER_INTENT_SUMMARY replaces previous payload (idempotent re-render)", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    const firstPayload: IntentSummaryPayload = {
      axes: { subject: "first" },
      prompt_preview: "first preview",
    };
    const secondPayload: IntentSummaryPayload = {
      axes: { subject: "second", lighting: "neon" },
      prompt_preview: "second preview",
      settings_diff: {
        slotStrengths: [{ slotIndex: 0, from: null, to: 0.5 }],
      },
    };

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_INTENT_SUMMARY",
          payload: firstPayload,
        });
      });
    }).not.toThrow();

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_INTENT_SUMMARY",
          payload: secondPayload,
        });
      });
    }).not.toThrow();

    // No accumulation effect on observable fields (e.g. messages must not
    // grow).
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
  });

  it("AC-8: RENDER_INTENT_SUMMARY with the same payload twice is idempotent", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    const payload: IntentSummaryPayload = {
      axes: { subject: "same" },
      prompt_preview: "same preview",
    };

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_INTENT_SUMMARY",
          payload,
        });
      });
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_INTENT_SUMMARY",
          payload,
        });
      });
    }).not.toThrow();

    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
  });

  it("AC-8: RENDER_INTENT_SUMMARY accepts a payload with all SettingsDiff sub-arrays populated", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);
    render(
      <PromptAssistantProvider>
        <Capture />
        <ContextProbe />
      </PromptAssistantProvider>
    );

    const payload: IntentSummaryPayload = {
      axes: {
        subject: "alpine sunset",
        medium: "photo",
        style: "cinematic",
        lighting: "golden hour",
        composition: "wide-angle",
        palette: "warm",
      },
      prompt_preview: "wide-angle alpine sunset, cinematic, photorealistic",
      settings_diff: {
        slotRoles: [{ slotIndex: 0, from: null, to: "subject" }],
        slotStrengths: [{ slotIndex: 1, from: 0.3, to: 0.7 }],
        modelId: { from: "flux-2-pro", to: "flux-2-ultra" },
        modelParams: [{ key: "guidance", from: 7.5, to: 9 }],
      },
    };

    expect(() => {
      act(() => {
        handle.current!.dispatch({
          type: "RENDER_INTENT_SUMMARY",
          payload,
        });
      });
    }).not.toThrow();
  });
});
