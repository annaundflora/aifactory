// @vitest-environment jsdom
/**
 * Tests for Slice 19: AssistantSheet - Session Resume
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-1: Chat-History und Canvas nach Sheet-Reopen sichtbar
 * - AC-2: User kann Feedback senden nach Session-Resume
 * - AC-3: Re-Apply funktioniert nach Agent-Anpassung
 * - AC-5: Startscreen ohne aktive Session
 *
 * Mocking Strategy: mock_external (per slice spec).
 * PromptAssistantContext, fetch, and useWorkspaceVariation are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { AssistantSheet } from "../assistant-sheet";

// ---------------------------------------------------------------------------
// Mock workspace-state
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
let mockVariationData: Record<string, unknown> | null = null;

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------

const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { error: vi.fn(), success: vi.fn(), info: vi.fn() }
  ),
}));

// ---------------------------------------------------------------------------
// Import context AFTER mocks
// ---------------------------------------------------------------------------

import {
  PromptAssistantProvider,
  usePromptAssistant,
  type PromptAssistantContextValue,
} from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Helper: Inner component that exposes context + renders Sheet conditionally
// ---------------------------------------------------------------------------

let latestCtx: PromptAssistantContextValue | null = null;

function SheetResumeHarness({ sheetOpen }: { sheetOpen: boolean }) {
  const ctx = usePromptAssistant();
  latestCtx = ctx;

  // hasCanvas is derived from draftPrompt presence (not a direct context property)
  const hasCanvas = !!ctx.draftPrompt;

  return (
    <div>
      <AssistantSheet
        open={sheetOpen}
        onOpenChange={() => {}}
        hasCanvas={hasCanvas}
        onOpen={() => {
          // AC-1: When sheet opens with active sessionId, load the session
          if (ctx.sessionId) {
            ctx.loadSession(ctx.sessionId);
          }
        }}
        canvasSlot={
          hasCanvas ? (
            <div data-testid="canvas-slot">Canvas visible</div>
          ) : null
        }
      >
        {ctx.activeView === "startscreen" ? (
          <div data-testid="startscreen-view">Startscreen</div>
        ) : (
          <div data-testid="chat-view">
            {ctx.messages.map((m) => (
              <div key={m.id} data-testid={`msg-${m.role}`}>
                {m.content}
              </div>
            ))}
          </div>
        )}
      </AssistantSheet>
      {/* Expose state for assertions */}
      <span data-testid="ctx-session-id">{ctx.sessionId ?? "null"}</span>
      <span data-testid="ctx-active-view">{ctx.activeView}</span>
      <span data-testid="ctx-is-applied">{String(ctx.isApplied)}</span>
      <span data-testid="ctx-has-canvas">{String(hasCanvas)}</span>
      <span data-testid="ctx-messages-count">{ctx.messages.length}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function makeSessionWithDraftResponse() {
  return {
    session: {
      id: "session-resume-1",
      title: "Resume Session",
      status: "active",
      message_count: 3,
      has_draft: true,
    },
    state: {
      messages: [
        { role: "human", content: "Erstelle einen Prompt fuer Sonnenuntergang" },
        { role: "assistant", content: "Hier ist der Vorschlag." },
        { role: "human", content: "Mache es waermer" },
      ],
      draft_prompt: {
        motiv: "A warm sunset over the mountains",
        style: "impressionist, warm tones",
        negative_prompt: "cold, blue",
      },
      recommended_model: null,
    },
  };
}

function makeSessionNoDraftResponse() {
  return {
    session: {
      id: "session-resume-1",
      title: "Resume Session",
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
// Setup / Teardown
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  latestCtx = null;
  originalFetch = globalThis.fetch;
  vi.clearAllMocks();
  mockVariationData = null;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssistantSheet - Session Resume", () => {
  // ---------------------------------------------------------------------------
  // AC-1: GIVEN der User hat in einer Session Apply geklickt und das Sheet
  //        geschlossen
  //       WHEN der User das Sheet erneut oeffnet (via Trigger-Button)
  //       THEN wird die letzte aktive Session automatisch geladen: Chat-History
  //            zeigt alle bisherigen Messages, Canvas-Panel ist sichtbar mit
  //            dem zuletzt applied Prompt
  // ---------------------------------------------------------------------------
  it("AC-1: should render chat history and canvas panel when reopening sheet with active session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionWithDraftResponse(),
    });

    // Render with sheet closed initially
    const { rerender } = render(
      <PromptAssistantProvider projectId="test-project">
        <SheetResumeHarness sheetOpen={false} />
      </PromptAssistantProvider>
    );

    // Set sessionId (simulates that a session was active before sheet close)
    await act(async () => {
      latestCtx!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "session-resume-1",
      });
    });

    expect(screen.getByTestId("ctx-session-id")).toHaveTextContent("session-resume-1");

    // Now open the sheet (triggers onOpen -> loadSession)
    rerender(
      <PromptAssistantProvider projectId="test-project">
        <SheetResumeHarness sheetOpen={true} />
      </PromptAssistantProvider>
    );

    // Wait for loadSession to complete
    await waitFor(() => {
      expect(screen.getByTestId("ctx-messages-count")).toHaveTextContent("3");
    });

    // Chat-History: messages are rendered
    expect(screen.getByTestId("chat-view")).toBeInTheDocument();

    // Canvas: hasCanvas should be true (draft_prompt was loaded)
    expect(screen.getByTestId("ctx-has-canvas")).toHaveTextContent("true");

    // Active view should be "chat" (not startscreen)
    expect(screen.getByTestId("ctx-active-view")).toHaveTextContent("chat");
  });

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN die Session wurde nach Sheet-Schliessung wiederhergestellt
  //       WHEN der User im Chat-Input "zu dunkel, aendere den Prompt" eingibt
  //        und sendet
  //       THEN wird die Nachricht an dieselbe Session-ID gesendet
  //            (POST /api/assistant/sessions/{id}/messages), der Agent antwortet
  //            und ruft refine_prompt auf, die Canvas-Felder werden aktualisiert
  // ---------------------------------------------------------------------------
  it("AC-2: should allow sending message to existing session after sheet reopen", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeSessionNoDraftResponse(),
    });

    render(
      <PromptAssistantProvider projectId="test-project">
        <SheetResumeHarness sheetOpen={true} />
      </PromptAssistantProvider>
    );

    // Load a session first
    await act(async () => {
      latestCtx!.dispatch({
        type: "SET_SESSION_ID",
        sessionId: "session-resume-1",
      });
    });

    await act(async () => {
      await latestCtx!.loadSession("session-resume-1");
    });

    // Session is loaded, verify sessionId
    expect(latestCtx!.sessionId).toBe("session-resume-1");
    expect(latestCtx!.messages).toHaveLength(2);

    // Register a mock sendMessage implementation to verify it is called
    const mockSendImpl = vi.fn();
    latestCtx!.sendMessageRef.current = mockSendImpl;

    // Send feedback message
    act(() => {
      latestCtx!.sendMessage("zu dunkel, aendere den Prompt");
    });

    // The sendMessage should be called with the feedback text
    expect(mockSendImpl).toHaveBeenCalledWith(
      "zu dunkel, aendere den Prompt",
      undefined
    );

    // Simulate agent response with REFINE_DRAFT
    await act(async () => {
      latestCtx!.dispatch({
        type: "REFINE_DRAFT",
        draftPrompt: {
          motiv: "A lighter sunset over the ocean",
          style: "warm, bright tones",
          negativePrompt: "dark, gloomy",
        },
      });
    });

    // Canvas should be updated
    expect(latestCtx!.draftPrompt).toEqual({
      motiv: "A lighter sunset over the ocean",
      style: "warm, bright tones",
      negativePrompt: "dark, gloomy",
    });
    // hasCanvas is derived from draftPrompt presence
    expect(latestCtx!.draftPrompt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // AC-3: GIVEN der Agent hat den Canvas via refine_prompt angepasst nach
  //        User-Feedback
  //       WHEN der User erneut auf Apply klickt
  //       THEN werden die aktualisierten Canvas-Felder in den Workspace
  //            uebertragen (identisches Verhalten wie Slice 15: setVariation()
  //            mit neuen Werten, Undo-Toast erscheint)
  // ---------------------------------------------------------------------------
  it("AC-3: should allow re-apply after agent refines prompt via feedback", async () => {
    mockVariationData = {
      promptMotiv: "old motiv",
      modelId: "flux-2-pro",
      modelParams: {},
    };

    render(
      <PromptAssistantProvider projectId="test-project">
        <SheetResumeHarness sheetOpen={true} />
      </PromptAssistantProvider>
    );

    // Simulate: session loaded with draft, agent refines via REFINE_DRAFT
    await act(async () => {
      latestCtx!.dispatch({
        type: "REFINE_DRAFT",
        draftPrompt: {
          prompt: "Refined sunset motif",
        },
      });
    });

    // Auto-apply fires via useEffect when draftVersion increments from REFINE_DRAFT,
    // so setVariation is already called and isApplied is true
    expect(latestCtx!.isApplied).toBe(true);

    // setVariation should have been called with the refined values (via auto-apply)
    // DraftPrompt.prompt maps to promptMotiv in the workspace
    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "Refined sunset motif",
      })
    );

    // Undo-Toast should appear
    expect(mockToast).toHaveBeenCalledWith(
      "Prompt uebernommen.",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Rueckgaengig",
          onClick: expect.any(Function),
        }),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // AC-5: GIVEN keine aktive Session existiert (erster Besuch oder alle Sessions
  //        archiviert)
  //       WHEN der User das Sheet oeffnet
  //       THEN wird der Startscreen angezeigt (keine automatische
  //            Session-Erstellung)
  // ---------------------------------------------------------------------------
  it("AC-5: should render startscreen when opening sheet without active session", () => {
    render(
      <PromptAssistantProvider projectId="test-project">
        <SheetResumeHarness sheetOpen={true} />
      </PromptAssistantProvider>
    );

    // No session -> startscreen view
    expect(screen.getByTestId("ctx-active-view")).toHaveTextContent("startscreen");
    expect(screen.getByTestId("ctx-session-id")).toHaveTextContent("null");
    expect(screen.getByTestId("startscreen-view")).toBeInTheDocument();
  });
});
