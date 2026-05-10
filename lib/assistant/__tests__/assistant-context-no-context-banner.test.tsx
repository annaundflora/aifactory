// @vitest-environment jsdom
/**
 * Acceptance Tests for Slice 10 — assistant-context reducer extensions
 *
 * Source: specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *         slices/slice-10-no-context-banner.md
 * Test-Strategy: Mocking Strategy = `mock_external` (per slice spec).
 *   - Reducer is exercised through the real Provider/Hook (no internal mocks).
 *   - `useWorkspaceVariation` and `sonner` are stubbed out — they are not part
 *     of Slice 10's contract but are required by the Provider.
 *
 * Reducer-level coverage for:
 *   - AC-3: DISMISS_NO_CONTEXT_BANNER sets noContextBannerDismissed = true
 *   - AC-5: initialState has noContextBannerDismissed = false (no persistence)
 *   - AC-4: RESET_SESSION does NOT reset the flag (tab-session scope per
 *           architecture.md "Frontend State Machine Wiring", line 465)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock workspace-state to avoid needing WorkspaceStateProvider wrapper.
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
// Helper consumer — exposes flag value + dispatches actions on demand
// ---------------------------------------------------------------------------

function FlagConsumer({
  onValue,
}: {
  onValue?: (ctx: PromptAssistantContextValue) => void;
}) {
  const ctx = usePromptAssistant();
  if (onValue) onValue(ctx);

  return (
    <div>
      <span data-testid="flag-value">
        {String(ctx.noContextBannerDismissed)}
      </span>
      <button
        data-testid="dispatch-dismiss"
        onClick={() => ctx.dispatch({ type: "DISMISS_NO_CONTEXT_BANNER" })}
      />
      <button
        data-testid="dispatch-reset-session"
        onClick={() => ctx.dispatch({ type: "RESET_SESSION" })}
      />
      <button
        data-testid="dispatch-set-session"
        onClick={() =>
          ctx.dispatch({ type: "SET_SESSION_ID", sessionId: "session-xyz" })
        }
      />
      <button
        data-testid="dispatch-add-msg"
        onClick={() =>
          ctx.dispatch({
            type: "ADD_USER_MESSAGE",
            message: { id: "msg-1", role: "user", content: "hi" },
          })
        }
      />
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AC-5: Initial-State has noContextBannerDismissed = false
// ---------------------------------------------------------------------------

describe("assistant-context reducer — Slice 10 AC-5 initialState", () => {
  /**
   * AC-5: GIVEN provider mountet (Tab-Reload, Provider re-mount)
   * WHEN initialState durchlaufen wird
   * THEN noContextBannerDismissed === false (kein localStorage / Cookie /
   *   Server-Persist).
   */
  it("AC-5: initialState has noContextBannerDismissed = false (no persistence)", () => {
    let captured: PromptAssistantContextValue | null = null;

    render(
      <PromptAssistantProvider>
        <FlagConsumer
          onValue={(ctx) => {
            captured = ctx;
          }}
        />
      </PromptAssistantProvider>,
    );

    expect(captured).not.toBeNull();
    expect(captured!.noContextBannerDismissed).toBe(false);
    expect(screen.getByTestId("flag-value")).toHaveTextContent("false");
  });
});

// ---------------------------------------------------------------------------
// AC-3: DISMISS_NO_CONTEXT_BANNER sets flag = true
// ---------------------------------------------------------------------------

describe("assistant-context reducer — Slice 10 AC-3 DISMISS_NO_CONTEXT_BANNER", () => {
  /**
   * AC-3: GIVEN initial state (flag = false)
   * WHEN dispatch({ type: "DISMISS_NO_CONTEXT_BANNER" })
   * THEN noContextBannerDismissed === true
   */
  it("AC-3: reducer DISMISS_NO_CONTEXT_BANNER action sets noContextBannerDismissed = true", () => {
    render(
      <PromptAssistantProvider>
        <FlagConsumer />
      </PromptAssistantProvider>,
    );

    expect(screen.getByTestId("flag-value")).toHaveTextContent("false");

    act(() => {
      screen.getByTestId("dispatch-dismiss").click();
    });

    expect(screen.getByTestId("flag-value")).toHaveTextContent("true");
  });

  /**
   * Idempotency: dispatching DISMISS twice is safe — flag stays true.
   */
  it("AC-3: DISMISS_NO_CONTEXT_BANNER is idempotent (multiple dispatches keep flag = true)", () => {
    render(
      <PromptAssistantProvider>
        <FlagConsumer />
      </PromptAssistantProvider>,
    );

    act(() => {
      screen.getByTestId("dispatch-dismiss").click();
      screen.getByTestId("dispatch-dismiss").click();
      screen.getByTestId("dispatch-dismiss").click();
    });

    expect(screen.getByTestId("flag-value")).toHaveTextContent("true");
  });
});

// ---------------------------------------------------------------------------
// AC-4: RESET_SESSION does NOT reset the flag (tab-session scope)
// ---------------------------------------------------------------------------

describe("assistant-context reducer — Slice 10 AC-4 RESET_SESSION preserves flag", () => {
  /**
   * AC-4: GIVEN flag = true (User dismissed banner)
   * WHEN dispatch({ type: "RESET_SESSION" }) (project switch / new session)
   * THEN noContextBannerDismissed remains true
   *   (Tab-Session-Scope per architecture.md line 465: "resets only on tab
   *    reload, NOT on project switch").
   */
  it("AC-4: RESET_SESSION action does NOT reset noContextBannerDismissed flag (tab-session scope)", () => {
    render(
      <PromptAssistantProvider>
        <FlagConsumer />
      </PromptAssistantProvider>,
    );

    // Set flag = true via DISMISS
    act(() => {
      screen.getByTestId("dispatch-dismiss").click();
    });
    expect(screen.getByTestId("flag-value")).toHaveTextContent("true");

    // Now dispatch RESET_SESSION (project / session switch)
    act(() => {
      screen.getByTestId("dispatch-reset-session").click();
    });

    // Flag MUST remain true (architecture.md: tab-session-scope)
    expect(screen.getByTestId("flag-value")).toHaveTextContent("true");
  });

  /**
   * AC-4 supplemental: RESET_SESSION clears OTHER state but preserves the flag.
   * Verifies the reducer's RESET_SESSION branch correctly merges the persisted
   * flag onto the initialState reset.
   */
  it("AC-4: RESET_SESSION clears session state but preserves noContextBannerDismissed", () => {
    let captured: PromptAssistantContextValue | null = null;

    render(
      <PromptAssistantProvider>
        <FlagConsumer
          onValue={(ctx) => {
            captured = ctx;
          }}
        />
      </PromptAssistantProvider>,
    );

    // Add some session state we can later assert was reset.
    act(() => {
      screen.getByTestId("dispatch-set-session").click();
    });
    act(() => {
      screen.getByTestId("dispatch-add-msg").click();
    });
    act(() => {
      screen.getByTestId("dispatch-dismiss").click();
    });

    // Sanity: state has session-id, messages, and flag=true
    expect(captured!.sessionId).toBe("session-xyz");
    expect(captured!.messages.length).toBe(1);
    expect(captured!.noContextBannerDismissed).toBe(true);

    // RESET_SESSION
    act(() => {
      screen.getByTestId("dispatch-reset-session").click();
    });

    // sessionId / messages reset, flag preserved
    expect(captured!.sessionId).toBeNull();
    expect(captured!.messages).toEqual([]);
    expect(captured!.noContextBannerDismissed).toBe(true);
  });

  /**
   * AC-4 negative: when flag was false BEFORE RESET, it stays false (i.e. the
   * "preserve" logic doesn't accidentally flip it).
   */
  it("AC-4: RESET_SESSION keeps flag=false when it was false before reset", () => {
    let captured: PromptAssistantContextValue | null = null;

    render(
      <PromptAssistantProvider>
        <FlagConsumer
          onValue={(ctx) => {
            captured = ctx;
          }}
        />
      </PromptAssistantProvider>,
    );

    expect(captured!.noContextBannerDismissed).toBe(false);

    act(() => {
      screen.getByTestId("dispatch-reset-session").click();
    });

    expect(captured!.noContextBannerDismissed).toBe(false);
  });
});
