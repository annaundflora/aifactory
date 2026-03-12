// @vitest-environment jsdom
/**
 * Tests for Slice 13c: PromptAssistantContext - Session Resume
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-4:  Session laden stellt Messages wieder her
 * - AC-5:  Session laden setzt draftPrompt
 * - AC-6:  Session laden setzt recommendedModel
 * - AC-9:  Auto-Title nach erster Nachricht
 * - AC-10: Session-Wechsel ersetzt vorherigen State
 * - AC-11: Fehler beim Laden zeigt Toast
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
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
    info: vi.fn(),
  },
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
      recommended_model: null,
    },
    ...overrides,
  };
}

function makeSessionWithDraft() {
  return makeSessionDetailResponse({
    state: {
      messages: [
        { role: "human", content: "Ein Katzenbild" },
        { role: "assistant", content: "Hier ist mein Vorschlag." },
      ],
      draft_prompt: {
        motiv: "A cat sitting on a windowsill",
        style: "watercolor, soft edges",
        negative_prompt: "blurry, dark, low quality",
      },
      recommended_model: null,
    },
  });
}

function makeSessionWithModel() {
  return makeSessionDetailResponse({
    state: {
      messages: [
        { role: "human", content: "Landschaftsbild" },
        { role: "assistant", content: "Ein Modell passt besonders gut." },
      ],
      draft_prompt: null,
      recommended_model: {
        id: "stability/sdxl",
        name: "Stable Diffusion XL",
        reason: "Excellent for landscapes with high detail",
      },
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
      recommended_model: null,
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
      <span data-testid="recommended-model">
        {ctx.recommendedModel ? JSON.stringify(ctx.recommendedModel) : "null"}
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

describe("PromptAssistantContext - Session Resume", () => {
  // --------------------------------------------------------------------------
  // AC-4: GIVEN der User befindet sich in der Session-Liste und klickt auf
  //        Session "S1"
  //       WHEN die Session geladen wird
  //       THEN wechselt die Ansicht zum Chat-Thread, alle Messages aus
  //            state.messages werden als Bubbles angezeigt (Human rechts,
  //            Assistant links), und die sessionId im PromptAssistantContext
  //            ist "S1"
  // --------------------------------------------------------------------------
  it('AC-4: should restore messages from session state when loadSession is called and switch to "chat" view', async () => {
    const responseData = makeSessionDetailResponse();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Initial state: startscreen, no session
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
    expect(screen.getByTestId("active-view")).toHaveTextContent("startscreen");

    // Act: load session S1
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: session loaded, view changed, messages restored
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S1");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("4");
    expect(screen.getByTestId("active-view")).toHaveTextContent("chat");

    // Verify messages have correct roles (human -> user, assistant -> assistant)
    const messagesJson = JSON.parse(
      screen.getByTestId("messages-json").textContent!
    );
    expect(messagesJson[0].role).toBe("user");
    expect(messagesJson[0].content).toBe(
      "Erstelle ein Portraet von einer Katze"
    );
    expect(messagesJson[1].role).toBe("assistant");
    expect(messagesJson[1].content).toBe(
      "Ich erstelle ein Portraet einer Katze fuer dich."
    );
    expect(messagesJson[2].role).toBe("user");
    expect(messagesJson[3].role).toBe("assistant");

    // Verify fetch was called with the correct URL
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/assistant/sessions/session-S1"
    );
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN eine geladene Session die einen draft_prompt im State hat
  //       WHEN der Chat-Thread angezeigt wird
  //       THEN wird draftPrompt im PromptAssistantContext gesetzt
  // --------------------------------------------------------------------------
  it("AC-5: should set draftPrompt from session state when draft exists", async () => {
    const responseData = makeSessionWithDraft();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Initially no draft
    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");

    // Act: load session with draft
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: draftPrompt is set with correct fields (snake_case -> camelCase)
    const draftText = screen.getByTestId("draft-prompt").textContent!;
    const parsed = JSON.parse(draftText);
    expect(parsed).toEqual({
      motiv: "A cat sitting on a windowsill",
      style: "watercolor, soft edges",
      negativePrompt: "blurry, dark, low quality",
    });
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN eine geladene Session die ein recommended_model im State hat
  //       WHEN der Chat-Thread angezeigt wird
  //       THEN wird recommendedModel im PromptAssistantContext gesetzt
  // --------------------------------------------------------------------------
  it("AC-6: should set recommendedModel from session state when recommendation exists", async () => {
    const responseData = makeSessionWithModel();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Initially no model recommendation
    expect(screen.getByTestId("recommended-model")).toHaveTextContent("null");

    // Act: load session with model recommendation
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: recommendedModel is set
    const modelText = screen.getByTestId("recommended-model").textContent!;
    const parsed = JSON.parse(modelText);
    expect(parsed).toEqual({
      id: "stability/sdxl",
      name: "Stable Diffusion XL",
      reason: "Excellent for landscapes with high detail",
    });
  });

  // --------------------------------------------------------------------------
  // AC-10: GIVEN der PromptAssistantContext hat eine aktive Session "S1"
  //        WHEN der User eine Session "S2" aus der Liste laedt
  //        THEN wird die aktive Session auf "S2" gewechselt: sessionId ist
  //             "S2", messages enthaelt die Messages von S2, vorherige
  //             S1-Messages sind nicht mehr sichtbar
  // --------------------------------------------------------------------------
  it("AC-10: should replace current session state when switching to different session", async () => {
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
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Load session S1
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S1");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("4");

    // Switch to session S2
    await act(async () => {
      screen.getByTestId("load-session-S2").click();
    });

    // Assert: session switched to S2
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-S2");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
    expect(screen.getByTestId("active-view")).toHaveTextContent("chat");

    // Verify S1 messages are gone and S2 messages are present
    const messagesJson = JSON.parse(
      screen.getByTestId("messages-json").textContent!
    );
    expect(messagesJson).toHaveLength(2);
    expect(messagesJson[0].content).toBe("Ein Bild vom Meer");
    expect(messagesJson[1].content).toBe("Hier ist das Meerbild.");
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN eine Session wird geladen
  //        WHEN der fetch-Call fehlschlaegt (Netzwerk-Fehler oder 500)
  //        THEN wird eine Fehlermeldung angezeigt (Toast: "Session konnte
  //             nicht geladen werden") und der User bleibt auf der
  //             Session-Liste
  // --------------------------------------------------------------------------
  it("AC-11: should show error toast when session loading fails with network error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("Network failure"));

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Navigate to session-list first
    await act(async () => {
      screen.getByTestId("set-view-session-list").click();
    });
    expect(screen.getByTestId("active-view")).toHaveTextContent("session-list");

    // Try to load a session (will fail)
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: toast.error was called with the expected message
    expect(mockToastError).toHaveBeenCalledWith(
      "Session konnte nicht geladen werden"
    );

    // Assert: user stays on session-list (not switched to chat)
    // sessionId should NOT have changed
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    // isLoadingSession should be false again
    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("false");
  });

  it("AC-11: should show error toast when session loading fails with HTTP 500", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Navigate to session-list
    await act(async () => {
      screen.getByTestId("set-view-session-list").click();
    });

    // Try to load a session
    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    // Assert: toast error shown
    expect(mockToastError).toHaveBeenCalledWith(
      "Session konnte nicht geladen werden"
    );

    // Session should not have been set
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
  });

  it("AC-11: should show error toast when session loading fails with HTTP 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Session konnte nicht geladen werden"
    );
  });

  // --------------------------------------------------------------------------
  // AC-9: GIVEN der User sendet die erste Nachricht "Ein Portraet von einer
  //        Katze" in einer neuen Session
  //       WHEN die Nachricht erfolgreich gesendet wurde (SSE-Stream gestartet)
  //       THEN wird PATCH /api/assistant/sessions/{id}/title aufgerufen mit
  //            einem Titel abgeleitet aus der ersten User-Message
  // --------------------------------------------------------------------------
  it("AC-9: should trigger auto-title update after first user message is sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock;

    // Create a component that simulates the sendMessage flow with a session
    function AutoTitleConsumer() {
      const ctx = usePromptAssistant();
      latestCtx = ctx;
      return (
        <div>
          <span data-testid="session-id">{ctx.sessionId ?? "null"}</span>
          <button
            data-testid="set-session"
            onClick={() =>
              ctx.dispatch({
                type: "SET_SESSION_ID",
                sessionId: "sess-new-123",
              })
            }
          />
          <button
            data-testid="register-and-send"
            onClick={() => {
              // Register a dummy sendMessage implementation
              ctx.sendMessageRef.current = vi.fn();
              ctx.sendMessage("Ein Portraet von einer Katze");
            }}
          />
        </div>
      );
    }

    render(
      <PromptAssistantProvider projectId="test-project">
        <AutoTitleConsumer />
      </PromptAssistantProvider>
    );

    // Set session ID first (simulating that session was created)
    await act(async () => {
      screen.getByTestId("set-session").click();
    });

    expect(screen.getByTestId("session-id")).toHaveTextContent("sess-new-123");

    // Send first message
    await act(async () => {
      screen.getByTestId("register-and-send").click();
    });

    // Assert: PATCH was called for auto-title
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assistant/sessions/sess-new-123/title",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Ein Portraet von einer Katze" }),
        })
      );
    });
  });

  it("AC-9: should truncate auto-title to 80 characters for long messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock;

    const longMessage =
      "Ein sehr langes Portraet von einer Katze die auf einem Fensterbrett sitzt und in den Sonnenuntergang schaut waehrend der Wind weht";

    function TruncateTitleConsumer() {
      const ctx = usePromptAssistant();
      return (
        <div>
          <button
            data-testid="set-session"
            onClick={() =>
              ctx.dispatch({
                type: "SET_SESSION_ID",
                sessionId: "sess-long-title",
              })
            }
          />
          <button
            data-testid="register-and-send"
            onClick={() => {
              ctx.sendMessageRef.current = vi.fn();
              ctx.sendMessage(longMessage);
            }}
          />
        </div>
      );
    }

    render(
      <PromptAssistantProvider projectId="test-project">
        <TruncateTitleConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("set-session").click();
    });

    await act(async () => {
      screen.getByTestId("register-and-send").click();
    });

    // Assert: title is truncated to 80 chars
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/assistant/sessions/sess-long-title/title",
        expect.objectContaining({
          body: JSON.stringify({ title: longMessage.slice(0, 80) }),
        })
      );
    });
  });

  it("AC-9: should NOT trigger auto-title on second message in same session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock;

    function SecondMessageConsumer() {
      const ctx = usePromptAssistant();
      return (
        <div>
          <button
            data-testid="set-session"
            onClick={() =>
              ctx.dispatch({
                type: "SET_SESSION_ID",
                sessionId: "sess-no-double",
              })
            }
          />
          <button
            data-testid="send-first"
            onClick={() => {
              ctx.sendMessageRef.current = vi.fn();
              ctx.sendMessage("First message");
            }}
          />
          <button
            data-testid="send-second"
            onClick={() => {
              ctx.sendMessage("Second message");
            }}
          />
        </div>
      );
    }

    render(
      <PromptAssistantProvider projectId="test-project">
        <SecondMessageConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("set-session").click();
    });

    await act(async () => {
      screen.getByTestId("send-first").click();
    });

    // Clear the fetch mock calls
    fetchMock.mockClear();

    await act(async () => {
      screen.getByTestId("send-second").click();
    });

    // Assert: fetch was NOT called again for auto-title
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/title"),
      expect.anything()
    );
  });

  // --------------------------------------------------------------------------
  // Additional: Verify LOAD_SESSION reducer sets correct state
  // --------------------------------------------------------------------------
  it("AC-4: should set isLoadingSession to true during loading and false after", async () => {
    let resolveJson: (value: unknown) => void;
    const jsonPromise = new Promise((resolve) => {
      resolveJson = resolve;
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => jsonPromise,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    // Start loading (don't await)
    let loadPromise: Promise<void>;
    act(() => {
      loadPromise = latestCtx!.loadSession("session-S1");
    });

    // isLoadingSession should be true while waiting
    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("true");

    // Resolve the fetch
    await act(async () => {
      resolveJson!(makeSessionDetailResponse());
      await loadPromise!;
    });

    // isLoadingSession should be false after loading
    expect(screen.getByTestId("is-loading-session")).toHaveTextContent("false");
  });

  it("AC-5: should set draftPrompt to null when loaded session has no draft", async () => {
    const responseData = makeSessionDetailResponse();
    // Ensure no draft
    expect(responseData.state.draft_prompt).toBeNull();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(screen.getByTestId("draft-prompt")).toHaveTextContent("null");
  });

  it("AC-6: should set recommendedModel to null when loaded session has no recommendation", async () => {
    const responseData = makeSessionDetailResponse();
    expect(responseData.state.recommended_model).toBeNull();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => responseData,
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <ResumeConsumer />
      </PromptAssistantProvider>
    );

    await act(async () => {
      screen.getByTestId("load-session-S1").click();
    });

    expect(screen.getByTestId("recommended-model")).toHaveTextContent("null");
  });
});
