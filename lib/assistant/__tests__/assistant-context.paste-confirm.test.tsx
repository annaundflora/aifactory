// @vitest-environment jsdom
/**
 * Tests for Slice 27: Reducer-Actions ``RENDER_PASTE_CONFIRM`` +
 * ``DISMISS_PASTE_CONFIRM`` and the new ``pasteConfirmPayload`` state field.
 *
 * Source spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-27-paste-detect-card-component.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN):
 *   - AC-7: Default-State has ``pasteConfirmPayload === null``.
 *   - AC-8: ``RENDER_PASTE_CONFIRM`` sets ``state.pasteConfirmPayload`` to
 *           ``{ seedText }``; idempotent re-dispatch overwrites.
 *   - AC-9: ``DISMISS_PASTE_CONFIRM`` resets ``state.pasteConfirmPayload``
 *           back to ``null``.
 *
 * Mocking Strategy: ``mock_external`` (per slice spec) — ``workspace-state``
 * and ``sonner`` are mocked because they pull in side-effects unrelated to
 * the reducer under test. The reducer + dispatch chain are exercised
 * end-to-end via a real ``PromptAssistantProvider``.
 *
 * The reducer is not exported as a named symbol; we therefore verify
 * behaviour via:
 *   (a) the publicly-readable ``pasteConfirmPayload`` field exposed on the
 *       ``PromptAssistantContextValue`` (via ``ContextProbe``);
 *   (b) the ``dispatch`` function returned from ``usePromptAssistant``.
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

function PasteProbe() {
  const ctx = usePromptAssistant();
  return (
    <div>
      <span data-testid="paste-payload">
        {ctx.pasteConfirmPayload === null
          ? "null"
          : JSON.stringify(ctx.pasteConfirmPayload)}
      </span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="flow-state">{ctx.flowState}</span>
    </div>
  );
}

// ===========================================================================
// AC-7: Default state
// ===========================================================================

describe("Slice 27: assistantReducer — Default state (AC-7)", () => {
  // -------------------------------------------------------------------------
  // AC-7: GIVEN der Reducer wird mit Default-State initialisiert
  //       WHEN ``assistantReducer`` ohne Actions inspiziert wird
  //       THEN existiert ein neues State-Feld
  //            ``pasteConfirmPayload: { seedText: string } | null`` mit
  //            Initial-Wert ``null``.
  // -------------------------------------------------------------------------
  it("AC-7: initializes pasteConfirmPayload as null in default state", () => {
    render(
      <PromptAssistantProvider>
        <PasteProbe />
      </PromptAssistantProvider>
    );

    // Initial value must be exactly ``null`` — not undefined, not missing.
    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");
  });
});

// ===========================================================================
// AC-8: RENDER_PASTE_CONFIRM
// ===========================================================================

describe("Slice 27: assistantReducer — RENDER_PASTE_CONFIRM (AC-8)", () => {
  // -------------------------------------------------------------------------
  // AC-8: GIVEN Reducer-State ``pasteConfirmPayload === null``
  //       WHEN Action ``RENDER_PASTE_CONFIRM`` mit Payload ``{ seedText: "..." }``
  //            dispatcht wird
  //       THEN ist ``state.pasteConfirmPayload`` danach ``{ seedText: "..." }``;
  //            ein erneuter ``RENDER_PASTE_CONFIRM``-Dispatch in derselben
  //            Session wird vom Trigger-Layer (AC-2) blockiert, der Reducer
  //            selbst überschreibt aber idempotent (kein zweiter Card-Mount
  //            durch State-Logik).
  // -------------------------------------------------------------------------
  it("AC-8: sets pasteConfirmPayload to { seedText } on RENDER_PASTE_CONFIRM action", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");

    const seedText =
      "A lone wolf, oil painting, cinematic lighting, hyperrealistic, masterpiece, trending on artstation";

    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText },
      });
    });

    // Payload now contains exactly { seedText }.
    expect(screen.getByTestId("paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText })
    );
  });

  it("AC-8: RENDER_PASTE_CONFIRM does not mutate other state fields (messages, sessionId, flowState)", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    // Seed observable state with non-trivial values.
    act(() => {
      handle.current!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "sess-paste-8",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-paste-8", role: "user", content: "hello" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "interviewing",
      });
    });

    const beforeSession = screen.getByTestId("session-id").textContent;
    const beforeMsgs = screen.getByTestId("messages-count").textContent;
    const beforeFlow = screen.getByTestId("flow-state").textContent;

    // Now dispatch RENDER_PASTE_CONFIRM — none of those fields must change.
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: "some pasted prompt" },
      });
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent(
      beforeSession || ""
    );
    expect(screen.getByTestId("messages-count")).toHaveTextContent(
      beforeMsgs || ""
    );
    expect(screen.getByTestId("flow-state")).toHaveTextContent(
      beforeFlow || ""
    );
    // And the payload itself was set:
    expect(screen.getByTestId("paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: "some pasted prompt" })
    );
  });

  it("AC-8: a second RENDER_PASTE_CONFIRM dispatch overwrites the previous payload (idempotent reducer)", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: "first seed" },
      });
    });
    expect(screen.getByTestId("paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: "first seed" })
    );

    // A successive dispatch (would never happen at runtime per AC-2 guard
    // in the trigger-layer, but the reducer itself is idempotent — the
    // payload is replaced, not merged or rejected).
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: "second seed" },
      });
    });
    expect(screen.getByTestId("paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: "second seed" })
    );
  });
});

// ===========================================================================
// AC-9: DISMISS_PASTE_CONFIRM
// ===========================================================================

describe("Slice 27: assistantReducer — DISMISS_PASTE_CONFIRM (AC-9)", () => {
  // -------------------------------------------------------------------------
  // AC-9: GIVEN Reducer-State ``pasteConfirmPayload !== null``
  //       WHEN Action ``DISMISS_PASTE_CONFIRM`` dispatcht wird
  //       THEN ist ``state.pasteConfirmPayload`` danach ``null``; nachfolgende
  //            ``RENDER_PASTE_CONFIRM``-Actions in derselben Session werden
  //            weiterhin durch den Trigger-Layer (AC-2) blockiert.
  // -------------------------------------------------------------------------
  it("AC-9: resets pasteConfirmPayload to null on DISMISS_PASTE_CONFIRM action", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    // Arrange: payload set first.
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: "seed text to dismiss" },
      });
    });
    expect(screen.getByTestId("paste-payload")).toHaveTextContent(
      JSON.stringify({ seedText: "seed text to dismiss" })
    );

    // Act: dismiss.
    act(() => {
      handle.current!.dispatch({ type: "DISMISS_PASTE_CONFIRM" });
    });

    // Assert: payload is exactly null again.
    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");
  });

  it("AC-9: DISMISS_PASTE_CONFIRM is a no-op when payload is already null (does not throw, does not corrupt state)", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");

    expect(() => {
      act(() => {
        handle.current!.dispatch({ type: "DISMISS_PASTE_CONFIRM" });
      });
    }).not.toThrow();

    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");
  });

  it("AC-9: DISMISS_PASTE_CONFIRM does not mutate other state fields", () => {
    const handle: { current: DispatchHandle | null } = { current: null };
    const Capture = captureContext(handle);

    render(
      <PromptAssistantProvider>
        <Capture />
        <PasteProbe />
      </PromptAssistantProvider>
    );

    // Seed observable state.
    act(() => {
      handle.current!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "sess-dismiss",
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "ADD_USER_MESSAGE",
        message: { id: "u-dismiss", role: "user", content: "hi" },
      });
    });
    act(() => {
      handle.current!.dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: "seed" },
      });
    });

    const beforeSession = screen.getByTestId("session-id").textContent;
    const beforeMsgs = screen.getByTestId("messages-count").textContent;
    const beforeFlow = screen.getByTestId("flow-state").textContent;

    act(() => {
      handle.current!.dispatch({ type: "DISMISS_PASTE_CONFIRM" });
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent(
      beforeSession || ""
    );
    expect(screen.getByTestId("messages-count")).toHaveTextContent(
      beforeMsgs || ""
    );
    expect(screen.getByTestId("flow-state")).toHaveTextContent(
      beforeFlow || ""
    );
    expect(screen.getByTestId("paste-payload")).toHaveTextContent("null");
  });
});
