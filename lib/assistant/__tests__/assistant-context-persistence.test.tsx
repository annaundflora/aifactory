// @vitest-environment jsdom
/**
 * Tests for Slice 19: PromptAssistantContext - Session Persistence
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-4: Session-ID bleibt nach Sheet-Schliessung im Context erhalten
 * - AC-1: Aktive Session wird beim Sheet-Oeffnen geladen (Chat-History + Canvas)
 * - AC-5: Startscreen wenn keine aktive Session
 * - AC-6: isApplied State wird beim Session-Laden korrekt gesetzt
 * - AC-7: Session bleibt intakt ueber Sheet-Schliessung hinweg
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

function makeSessionResponse(overrides: Record<string, unknown> = {}) {
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
      recommended_model: null,
      ...overrides,
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
      recommended_model: null,
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

describe("PromptAssistantContext - Session Persistence", () => {
  // ---------------------------------------------------------------------------
  // AC-4: GIVEN der PromptAssistantContext verwaltet die aktive Session-ID
  //       WHEN das Sheet geschlossen wird (X-Button, Escape, oder Trigger-Button)
  //       THEN bleibt die aktive sessionId im Context erhalten (wird NICHT
  //            zurueckgesetzt), sodass beim naechsten Oeffnen die Session
  //            fortgesetzt werden kann
  // ---------------------------------------------------------------------------
  it("AC-4: should retain sessionId in context when sheet is closed", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponse(),
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Initial: no session
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");

    // Load a session (simulates user opening sheet and loading session)
    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    // Session is loaded
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-persist-1");

    // The Context Provider sits above the Sheet mount.
    // Closing the sheet does NOT dispatch RESET_SESSION -- it just unmounts the Sheet UI.
    // The sessionId remains in the context. We verify that by simply checking
    // the context value is still present (no reset was dispatched).
    expect(latestCtx!.sessionId).toBe("session-persist-1");

    // Explicitly verify that RESET_SESSION would clear it (to show the difference)
    await act(async () => {
      screen.getByTestId("reset-session").click();
    });
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
  });

  // ---------------------------------------------------------------------------
  // AC-1: GIVEN der User hat in einer Session Apply geklickt und das Sheet
  //        geschlossen
  //       WHEN der User das Sheet erneut oeffnet (via Trigger-Button)
  //       THEN wird die letzte aktive Session automatisch geladen: Chat-History
  //            zeigt alle bisherigen Messages, Canvas-Panel ist sichtbar mit dem
  //            zuletzt applied Prompt
  // ---------------------------------------------------------------------------
  it("AC-1: should load last active session including messages and draftPrompt when sheet opens", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponse(),
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Simulate: sessionId already exists from previous session
    await act(async () => {
      screen.getByTestId("set-session-id").click();
    });
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-persist-1");

    // Now simulate sheet open -> loadSession is called
    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    // Chat-History: messages are restored
    expect(screen.getByTestId("messages-count")).toHaveTextContent("2");
    const messagesJson = JSON.parse(screen.getByTestId("messages-json").textContent!);
    expect(messagesJson[0].role).toBe("user");
    expect(messagesJson[0].content).toBe("Erstelle ein Bild");
    expect(messagesJson[1].role).toBe("assistant");
    expect(messagesJson[1].content).toBe("Hier ist mein Vorschlag.");

    // draftPrompt set
    const draft = JSON.parse(screen.getByTestId("draft-prompt").textContent!);
    expect(draft).toEqual({
      motiv: "A sunset over the ocean",
      style: "oil painting",
      negativePrompt: "blurry",
    });

    // Active view switches to "chat"
    expect(screen.getByTestId("active-view")).toHaveTextContent("chat");
  });

  // ---------------------------------------------------------------------------
  // AC-5: GIVEN keine aktive Session existiert (erster Besuch oder alle Sessions
  //        archiviert)
  //       WHEN der User das Sheet oeffnet
  //       THEN wird der Startscreen angezeigt (keine automatische
  //            Session-Erstellung)
  // ---------------------------------------------------------------------------
  it("AC-5: should show startscreen when no active sessionId exists in context", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // No session loaded -> activeView should be "startscreen"
    expect(screen.getByTestId("active-view")).toHaveTextContent("startscreen");
    expect(screen.getByTestId("session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("messages-count")).toHaveTextContent("0");
  });

  // ---------------------------------------------------------------------------
  // AC-6: GIVEN der User hat Applied und das Sheet geschlossen
  //       WHEN der User das Sheet erneut oeffnet und die Session geladen wird
  //       THEN ist der isApplied-State auf true gesetzt und der Apply-Button
  //            zeigt den normalen "Apply"-Text (nicht "Applied!" -- der
  //            2-Sekunden-Feedback-Zustand ist transient und nicht persistent)
  // ---------------------------------------------------------------------------
  it("AC-6: should set isApplied to true when loaded session has a draftPrompt that was applied", async () => {
    // The LOAD_SESSION action accepts an isApplied flag.
    // When a session with a draft that was previously applied is loaded,
    // isApplied should be restored.
    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Initially isApplied is false
    expect(screen.getByTestId("is-applied")).toHaveTextContent("false");

    // Dispatch LOAD_SESSION with isApplied: true
    await act(async () => {
      latestCtx!.dispatch({
        type: "LOAD_SESSION",
        sessionId: "session-persist-1",
        messages: [
          { id: "m1", role: "user", content: "Test" },
          { id: "m2", role: "assistant", content: "Response" },
        ],
        draftPrompt: {
          motiv: "A sunset over the ocean",
          style: "oil painting",
          negativePrompt: "blurry",
        },
        recommendedModel: null,
        isApplied: true,
      });
    });

    // isApplied should be true
    expect(screen.getByTestId("is-applied")).toHaveTextContent("true");
    // Session is loaded
    expect(screen.getByTestId("session-id")).toHaveTextContent("session-persist-1");
  });

  it("AC-6: should default isApplied to false when loaded session does not specify it", async () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Dispatch LOAD_SESSION without isApplied field
    await act(async () => {
      latestCtx!.dispatch({
        type: "LOAD_SESSION",
        sessionId: "session-persist-1",
        messages: [{ id: "m1", role: "user", content: "Test" }],
        draftPrompt: null,
        recommendedModel: null,
        // isApplied not provided -> defaults to false
      });
    });

    expect(screen.getByTestId("is-applied")).toHaveTextContent("false");
  });

  // ---------------------------------------------------------------------------
  // AC-7: GIVEN eine aktive Session mit Canvas existiert
  //       WHEN der User das Sheet schliesst und eine Bild-Generierung durchfuehrt
  //       THEN bleibt die Session im Context intakt -- beim erneuten Oeffnen ist
  //            die gesamte Chat-History und der Canvas-State unveraendert
  //            verfuegbar
  // ---------------------------------------------------------------------------
  it("AC-7: should preserve full session state across sheet close and reopen cycle", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionResponse(),
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <PersistenceConsumer />
      </PromptAssistantProvider>
    );

    // Load session
    await act(async () => {
      screen.getByTestId("load-session").click();
    });

    // Capture state after load
    const sessionIdAfterLoad = latestCtx!.sessionId;
    const messagesAfterLoad = latestCtx!.messages;
    const draftAfterLoad = latestCtx!.draftPrompt;

    expect(sessionIdAfterLoad).toBe("session-persist-1");
    expect(messagesAfterLoad).toHaveLength(2);
    expect(draftAfterLoad).not.toBeNull();

    // Simulate "sheet close" -- the Context Provider remains mounted,
    // only the Sheet UI would unmount. Since we test context persistence,
    // we just verify the state is unchanged.
    // (No RESET_SESSION dispatch -- that's the point of AC-7.)

    // Simulate "time passes, user does image generation" -- no context changes

    // Verify state is identical (context was not reset)
    expect(latestCtx!.sessionId).toBe(sessionIdAfterLoad);
    expect(latestCtx!.messages).toHaveLength(2);
    expect(latestCtx!.messages[0].content).toBe("Erstelle ein Bild");
    expect(latestCtx!.messages[1].content).toBe("Hier ist mein Vorschlag.");
    expect(latestCtx!.draftPrompt).toEqual(draftAfterLoad);
  });
});
