// @vitest-environment jsdom
/**
 * Tests for Slice 10: Assistant Frontend -- Session Persistence with single prompt field
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-3: Persistence mit altem Format (backwards-compat)
 *
 * Mocking Strategy: mock_external (per slice spec).
 * fetch and useWorkspaceVariation are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import type { PromptAssistantContextValue } from "../assistant-context";

// ---------------------------------------------------------------------------
// Mock workspace-state
// ---------------------------------------------------------------------------

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import {
  PromptAssistantProvider,
  usePromptAssistant,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

/** Old 3-field format for backwards-compat testing (AC-3) */
function makeSessionResponseOldFormat(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      id: "session-persist-1",
      title: "Persisted Session",
      status: "active",
      message_count: 2,
      has_draft: true,
    },
    state: {
      messages: [
        { role: "human", content: "Erstelle ein Bild" },
        { role: "assistant", content: "Hier ist mein Vorschlag." },
      ],
      draft_prompt: {
        motiv: "A sunset over the ocean",
        style: "oil painting",
        negative_prompt: "blurry",
      },
      ...overrides,
    },
  };
}

/** New single-field format */
function makeSessionResponseNewFormat() {
  return {
    session: {
      id: "session-persist-1",
      title: "Persisted Session",
      status: "active",
      message_count: 2,
      has_draft: true,
    },
    state: {
      messages: [
        { role: "human", content: "Erstelle ein Bild" },
        { role: "assistant", content: "Hier ist mein Vorschlag." },
      ],
      draft_prompt: {
        prompt: "A sunset over the ocean",
      },
    },
  };
}

function makeSessionResponseNoDraft() {
  return {
    session: {
      id: "session-persist-1",
      title: "No Draft Session",
      status: "active",
      message_count: 2,
      has_draft: false,
    },
    state: {
      messages: [
        { role: "human", content: "Hallo" },
        { role: "assistant", content: "Wie kann ich helfen?" },
      ],
      draft_prompt: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper Component: Exposes context values and actions
// ---------------------------------------------------------------------------

let latestCtx: PromptAssistantContextValue | null = null;

function PersistenceConsumer() {
  const ctx = usePromptAssistant();
  latestCtx = ctx;

  return (
    <div>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="active-view">{ctx.activeView}</span>
      <span data-testid="is-applied">{String(ctx.isApplied)}</span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="messages-json">
        {JSON.stringify(ctx.messages.map((m) => ({ role: m.role, content: m.content })))}
      </span>
      <button
        data-testid="set-session-id"
        onClick={() =>
          ctx.dispatch({ type: "SET_SESSION_ID", sessionId: "session-persist-1" })
        }
      />
      <button
        data-testid="load-session"
        onClick={() => ctx.loadSession("session-persist-1")}
      />
      <button
        data-testid="reset-session"
        onClick={() => ctx.dispatch({ type: "RESET_SESSION" })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  latestCtx = null;
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptAssistantContext - Session Persistence (Slice 10)", () => {
  // ---------------------------------------------------------------------------
  // AC-3: GIVEN eine persisted Session mit altem 3-Feld Draft Format
  //       WHEN die Session geladen wird
  //       THEN wird draftPrompt auf { prompt: motiv } gemappt
  //       AND style und negative_prompt werden verworfen
  // ---------------------------------------------------------------------------
  it("AC-3: should handle persisted sessions with old 3-field draft format", async () => {
    /**
     * AC-3: Backwards-compat: persisted sessions that have the old
     * { motiv, style, negative_prompt } format should be mapped to
     * { prompt: motiv }, discarding style and negative_prompt.
     */
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponseOldFormat(),
    });

    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Simulate sheet open -> loadSession
    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    // Verify draft is mapped to new format
    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      prompt: "A sunset over the ocean",
    });

    // Old keys must NOT be present
    expect(parsed).not.toHaveProperty("motiv");
    expect(parsed).not.toHaveProperty("style");
    expect(parsed).not.toHaveProperty("negativePrompt");
    expect(parsed).not.toHaveProperty("negative_prompt");

    // Messages are loaded
    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
    expect(screen.getByTestId("active-view")).toHaveTextContent("chat");
  });

  // ---------------------------------------------------------------------------
  // Persistence: New format loads correctly
  // ---------------------------------------------------------------------------
  it("should load persisted session with new single-field draft format", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponseNewFormat(),
    });

    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      prompt: "A sunset over the ocean",
    });
  });

  // ---------------------------------------------------------------------------
  // Persistence: Session with null draft
  // ---------------------------------------------------------------------------
  it("should handle persisted session with null draft_prompt", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponseNoDraft(),
    });

    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
  });

  // ---------------------------------------------------------------------------
  // Session persistence: sessionId retained after load
  // ---------------------------------------------------------------------------
  it("should retain sessionId in context after session load", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponseNewFormat(),
    });

    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");

    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-persist-1");
    expect(latestCtx!.sessionId).toBe("session-persist-1");
  });

  // ---------------------------------------------------------------------------
  // LOAD_SESSION with isApplied flag
  // ---------------------------------------------------------------------------
  it("should restore isApplied flag from LOAD_SESSION action", async () => {
    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("is-applied")).toHaveTextContent("false");

    await act(async () => {
      latestCtx!.dispatch({
        type: "LOAD_SESSION",
        sessionId: "session-persist-1",
        messages: [
          { id: "m1", role: "user", content: "Test" },
          { id: "m2", role: "assistant", content: "Response" },
        ],
        draftPrompt: {
          prompt: "A sunset over the ocean",
        },
        isApplied: true,
      });
    });

    expect(screen.getByTestId("is-applied")).toHaveTextContent("true");
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-persist-1");
  });

  it("should default isApplied to false when LOAD_SESSION omits it", async () => {
    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      latestCtx!.dispatch({
        type: "LOAD_SESSION",
        sessionId: "session-persist-1",
        messages: [{ id: "m1", role: "user", content: "Test" }],
        draftPrompt: null,
      });
    });

    expect(screen.getByTestId("is-applied")).toHaveTextContent("false");
  });

  // ---------------------------------------------------------------------------
  // Startscreen when no session
  // ---------------------------------------------------------------------------
  it("should show startscreen when no active sessionId exists", () => {
    render(
      <PromptAssistantProvider>
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("active-view")).toHaveTextContent("startscreen");
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
  });
});
