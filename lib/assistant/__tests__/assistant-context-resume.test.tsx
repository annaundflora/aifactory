// @vitest-environment jsdom
/**
 * Tests for Slice 10: Assistant Frontend -- Session Resume with single prompt field
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-3: Backwards-Compatibility fuer alte Sessions mit 3 Feldern
 * - AC-4: Neue Sessions mit prompt-Key
 * - AC-5: Null draft_prompt bleibt null
 *
 * Mocking Strategy: mock_external (as specified in Slice-Spec).
 * fetch is mocked to avoid real backend calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  PromptAssistantProvider,
  usePromptAssistant,
  type PromptAssistantContextValue,
} from "../assistant-context";

// ---------------------------------------------------------------------------
// Mock workspace-state to avoid needing WorkspaceStateProvider wrapper
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

const mockToastError = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Test data: Backend API responses
// ---------------------------------------------------------------------------

function makeSessionDetailResponse(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      id: "session-S1",
      title: "Test Session",
      status: "active",
      message_count: 4,
      has_draft: false,
      last_message_at: "2026-03-11T10:00:00Z",
      created_at: "2026-03-11T09:00:00Z",
      updated_at: "2026-03-11T10:00:00Z",
    },
    state: {
      messages: [
        { role: "human", content: "Erstelle ein Portraet von einer Katze" },
        {
          role: "assistant",
          content: "Ich erstelle ein Portraet einer Katze fuer dich.",
        },
        { role: "human", content: "Mache es im Aquarell-Stil" },
        {
          role: "assistant",
          content: "Ich passe den Stil auf Aquarell an.",
        },
      ],
      draft_prompt: null,
    },
    ...overrides,
  };
}

/** Old 3-field format for backwards-compat testing (AC-3) */
function makeSessionWithOldDraftFormat() {
  return makeSessionDetailResponse({
    state: {
      messages: [
        { role: "human", content: "Ein Katzenbild" },
        { role: "assistant", content: "Hier ist mein Vorschlag." },
      ],
      draft_prompt: {
        motiv: "old motiv text",
        style: "oil painting",
        negative_prompt: "blurry",
      },
    },
  });
}

/** New single-field format (AC-4) */
function makeSessionWithNewDraftFormat() {
  return makeSessionDetailResponse({
    state: {
      messages: [
        { role: "human", content: "Ein Katzenbild" },
        { role: "assistant", content: "Hier ist mein Vorschlag." },
      ],
      draft_prompt: {
        prompt: "new format prompt",
      },
    },
  });
}

/** Null draft (AC-5) */
function makeSessionWithNullDraft() {
  return makeSessionDetailResponse({
    state: {
      messages: [
        { role: "human", content: "Hallo" },
        { role: "assistant", content: "Wie kann ich helfen?" },
      ],
      draft_prompt: null,
    },
  });
}

function makeSessionS2() {
  return {
    session: {
      id: "session-S2",
      title: "Session S2",
      status: "active",
      message_count: 2,
      has_draft: false,
      last_message_at: "2026-03-12T10:00:00Z",
      created_at: "2026-03-12T09:00:00Z",
      updated_at: "2026-03-12T10:00:00Z",
    },
    state: {
      messages: [
        { role: "human", content: "Ein Bild vom Meer" },
        { role: "assistant", content: "Hier ist das Meerbild." },
      ],
      draft_prompt: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: Component that exposes context values and triggers loadSession
// ---------------------------------------------------------------------------

let latestCtx: PromptAssistantContextValue | null = null;

function ResumeConsumer() {
  const ctx = usePromptAssistant();
  latestCtx = ctx;

  return (
    <div>
      <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="messages-count">{ctx.messages.length}</span>
      <span data-testid="active-view">{ctx.activeView}</span>
      <span data-testid="is-loading-session">
        {String(ctx.isLoadingSession)}
      </span>
      <span data-testid="draft-prompt">
        {ctx.draftPrompt ? JSON.stringify(ctx.draftPrompt) : "null"}
      </span>
      <span data-testid="messages-json">
        {JSON.stringify(ctx.messages.map((m) => ({ role: m.role, content: m.content })))}
      </span>
      <button
        data-testid="load-session-S1"
        onClick={() => ctx.loadSession("session-S1")}
      />
      <button
        data-testid="load-session-S2"
        onClick={() => ctx.loadSession("session-S2")}
      />
      <button
        data-testid="set-view-session-list"
        onClick={() => ctx.setActiveView("session-list")}
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
  mockToastError.mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PromptAssistantContext - Session Resume (Slice 10)", () => {
  // --------------------------------------------------------------------------
  // AC-3: GIVEN eine Backend-Session-Response mit
  //        draft_prompt: { motiv: "old motiv text", style: "oil painting", negative_prompt: "blurry" }
  //       WHEN loadSession die Response verarbeitet (Backwards-Compatibility)
  //       THEN wird draftPrompt auf { prompt: "old motiv text" } gemappt
  //       AND die alten Keys style und negative_prompt werden verworfen
  // --------------------------------------------------------------------------
  it("AC-3: should map old 3-field draft_prompt to single prompt field using motiv", async () => {
    const responseData = makeSessionWithOldDraftFormat();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Initially no draft
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    // Act: load session with old 3-field draft
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: draftPrompt is mapped to single { prompt } field using motiv
    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      prompt: "old motiv text",
    });

    // Old keys must NOT be present
    expect(parsed).not.toHaveProperty("motiv");
    expect(parsed).not.toHaveProperty("style");
    expect(parsed).not.toHaveProperty("negativePrompt");
    expect(parsed).not.toHaveProperty("negative_prompt");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN eine Backend-Session-Response mit draft_prompt: { prompt: "new format prompt" }
  //       WHEN loadSession die Response verarbeitet
  //       THEN wird draftPrompt auf { prompt: "new format prompt" } gemappt
  // --------------------------------------------------------------------------
  it("AC-4: should map new draft_prompt format with prompt key directly", async () => {
    const responseData = makeSessionWithNewDraftFormat();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Initially no draft
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    // Act: load session with new format
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: draftPrompt maps directly
    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      prompt: "new format prompt",
    });
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN eine Backend-Session-Response mit draft_prompt: null
  //       WHEN loadSession die Response verarbeitet
  //       THEN ist draftPrompt gleich null
  // --------------------------------------------------------------------------
  it("AC-5: should set draftPrompt to null when backend returns null", async () => {
    const responseData = makeSessionWithNullDraft();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Act: load session with null draft
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: draftPrompt remains null
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
  });

  // --------------------------------------------------------------------------
  // Existing session resume tests (updated to work with new provider)
  // --------------------------------------------------------------------------
  it("should restore messages from session state when loadSession is called", async () => {
    const responseData = makeSessionDetailResponse();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("active-view")).toHaveTextContent("startscreen");

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S1");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("4");
    expect(screen.getByTestId("active-view")).toHaveTextContent("chat");

    const messagesJson = JSON.parse(
      screen.getByTestId("messages-json").textContent!
    );
    expect(messagesJson[0].role).toBe("user");
    expect(messagesJson[0].content).toBe(
      "Erstelle ein Portraet von einer Katze"
    );
    expect(messagesJson[1].role).toBe("assistant");
  });

  it("should replace current session state when switching to different session", async () => {
    const s1Response = makeSessionDetailResponse();
    const s2Response = makeSessionS2();

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => s1Response,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => s2Response,
      });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S1");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("4");

    await act(async () => {
      screen.getByTestId("load-session-S2").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S2");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
  });

  it("should show error toast when session loading fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Network failure"));

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("set-view-session-list").click();
    });

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Session konnte nicht geladen werden"
    );

    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("false");
  });

  it("should set isLoadingSession to true during loading and false after", async () => {
    let resolveJson: (value: unknown) => void;
    const jsonPromise = new Promise((resolve) => {
      resolveJson = resolve;
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => jsonPromise,
    });

    render(
      <PromptAssistantProvider>
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    let loadPromise: Promise<void>;
    act(() => {
      loadPromise = latestCtx!.loadSession("session-S1");
    });

    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("true");

    await act(async () => {
      resolveJson!(makeSessionDetailResponse());
      await loadPromise!;
    });

    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("false");
  });
});
