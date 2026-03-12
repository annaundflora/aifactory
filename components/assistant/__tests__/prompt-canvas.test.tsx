// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { PromptCanvas } from "@/components/assistant/prompt-canvas";
import type {
  PromptAssistantContextValue,
  DraftPrompt,
  DraftPromptField,
} from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// We mock the PromptAssistantContext to provide controlled state to PromptCanvas
// ---------------------------------------------------------------------------

const mockDispatch = vi.fn();
const mockUpdateDraftField = vi.fn();

function createMockContextValue(
  overrides: Partial<PromptAssistantContextValue> = {}
): PromptAssistantContextValue {
  return {
    sessionId: null,
    messages: [],
    isStreaming: false,
    draftPrompt: null,
    hasCanvas: false,
    canvasHighlight: false,
    recommendedModel: null,
    selectedModel: "anthropic/claude-sonnet-4.6",
    activeView: "chat",
    isLoadingSession: false,
    isApplied: false,
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    setSelectedModel: vi.fn(),
    updateDraftField: mockUpdateDraftField,
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    applyToWorkspace: vi.fn(),
    undoApply: vi.fn(),
    dispatch: mockDispatch,
    sessionIdRef: { current: null },
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    ...overrides,
  };
}

// Mock the usePromptAssistant hook so we can control context values
let currentMockValue: PromptAssistantContextValue;

vi.mock("@/lib/assistant/assistant-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/assistant/assistant-context")
  >("@/lib/assistant/assistant-context");
  return {
    ...actual,
    usePromptAssistant: () => currentMockValue,
  };
});

const sampleDraft: DraftPrompt = {
  motiv: "A woman in autumn forest",
  style: "photorealistic, golden hour",
  negativePrompt: "low quality, blurry",
};

describe("PromptCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN der PromptAssistantContext hat draftPrompt als null
   * WHEN das Sheet geoeffnet ist
   * THEN ist das Canvas-Panel nicht sichtbar und das Sheet bleibt bei 480px Breite
   */
  it("AC-1: should not render canvas panel when draftPrompt is null", () => {
    currentMockValue = createMockContextValue({
      draftPrompt: null,
      hasCanvas: false,
    });

    const { container } = render(<PromptCanvas />);

    // Canvas panel should not be rendered at all
    expect(screen.queryByTestId("prompt-canvas")).not.toBeInTheDocument();
    // No textareas should be present
    expect(screen.queryByTestId("canvas-motiv")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-style")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("canvas-negativePrompt")
    ).not.toBeInTheDocument();
    // Container should be empty (component returns null)
    expect(container.innerHTML).toBe("");
  });

  /**
   * AC-3: GIVEN hasCanvas wechselt von false auf true
   * WHEN das Sheet das Layout aktualisiert
   * THEN zeigt einen Split-View mit Canvas-Panel und drei Textareas
   */
  it("AC-3: should render canvas panel with three textareas when hasCanvas is true", () => {
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    // Canvas panel should be visible
    expect(screen.getByTestId("prompt-canvas")).toBeInTheDocument();

    // All three textareas should be rendered with correct values
    const motivField = screen.getByTestId("canvas-motiv");
    const styleField = screen.getByTestId("canvas-style");
    const negativeField = screen.getByTestId("canvas-negativePrompt");

    expect(motivField).toBeInTheDocument();
    expect(styleField).toBeInTheDocument();
    expect(negativeField).toBeInTheDocument();

    expect(motivField).toHaveValue("A woman in autumn forest");
    expect(styleField).toHaveValue("photorealistic, golden hour");
    expect(negativeField).toHaveValue("low quality, blurry");
  });

  /**
   * AC-4: GIVEN das Canvas-Panel ist sichtbar mit befuellten Feldern
   * WHEN der User den Inhalt des Motiv-Textareas aendert
   * THEN wird der lokale Canvas-State sofort aktualisiert (kein API-Call),
   *      draftPrompt.motiv im Context reflektiert den neuen Wert
   */
  it("AC-4: should update local state when user edits motiv textarea", async () => {
    const user = userEvent.setup();
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const motivField = screen.getByTestId("canvas-motiv");
    await user.clear(motivField);
    await user.type(motivField, "A man in spring garden");

    // updateDraftField should have been called for each character change
    expect(mockUpdateDraftField).toHaveBeenCalled();
    // The first call after clear should be for the "motiv" field
    const motivCalls = mockUpdateDraftField.mock.calls.filter(
      ([field]: [DraftPromptField, string]) => field === "motiv"
    );
    expect(motivCalls.length).toBeGreaterThan(0);
    // Each call should target the "motiv" field
    for (const [field] of motivCalls) {
      expect(field).toBe("motiv");
    }
  });

  /**
   * AC-4: GIVEN das Canvas-Panel ist sichtbar
   * WHEN der User den Style-Textarea aendert
   * THEN wird updateDraftField mit field="style" aufgerufen
   */
  it("AC-4: should update local state when user edits style textarea", async () => {
    const user = userEvent.setup();
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const styleField = screen.getByTestId("canvas-style");
    await user.clear(styleField);
    await user.type(styleField, "impressionist, soft lighting");

    const styleCalls = mockUpdateDraftField.mock.calls.filter(
      ([field]: [DraftPromptField, string]) => field === "style"
    );
    expect(styleCalls.length).toBeGreaterThan(0);
    for (const [field] of styleCalls) {
      expect(field).toBe("style");
    }
  });

  /**
   * AC-4: GIVEN das Canvas-Panel ist sichtbar
   * WHEN der User den Negative-Prompt-Textarea aendert
   * THEN wird updateDraftField mit field="negativePrompt" aufgerufen
   */
  it("AC-4: should update local state when user edits negative prompt textarea", async () => {
    const user = userEvent.setup();
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const negField = screen.getByTestId("canvas-negativePrompt");
    await user.clear(negField);
    await user.type(negField, "artifacts, noise");

    const negCalls = mockUpdateDraftField.mock.calls.filter(
      ([field]: [DraftPromptField, string]) => field === "negativePrompt"
    );
    expect(negCalls.length).toBeGreaterThan(0);
    for (const [field] of negCalls) {
      expect(field).toBe("negativePrompt");
    }
  });

  /**
   * AC-6: GIVEN das Canvas-Panel ist sichtbar
   * WHEN der User ein Canvas-Feld fokussiert
   * THEN erhaelt das Feld einen sichtbaren Focus-Border (Standard-Tailwind focus ring)
   */
  it("AC-6: should show focus ring when textarea receives focus", async () => {
    const user = userEvent.setup();
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const motivField = screen.getByTestId("canvas-motiv");
    await user.click(motivField);

    // The textarea should have focus
    expect(motivField).toHaveFocus();
    // The Textarea component uses focus-visible:border-ring and focus-visible:ring-[3px]
    // which is a standard Tailwind focus ring. We verify the element receives focus.
    // In jsdom, we cannot fully test CSS :focus-visible pseudo-class rendering,
    // but we verify the element is focusable and gets focus.
    expect(document.activeElement).toBe(motivField);
  });

  /**
   * AC-7: GIVEN der PromptAssistantContext empfaengt ein refine_prompt Event waehrend Streaming
   * WHEN die Canvas-Felder aktualisiert werden
   * THEN zeigen die Felder einen kurzen visuellen Highlight-Effekt
   */
  it("AC-7: should apply highlight CSS class when canvasHighlight is true", () => {
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
      canvasHighlight: true,
    });

    render(<PromptCanvas />);

    // When canvasHighlight is true, the textareas should have the animate-canvas-highlight class
    const motivField = screen.getByTestId("canvas-motiv");
    const styleField = screen.getByTestId("canvas-style");
    const negField = screen.getByTestId("canvas-negativePrompt");

    expect(motivField.className).toContain("animate-canvas-highlight");
    expect(styleField.className).toContain("animate-canvas-highlight");
    expect(negField.className).toContain("animate-canvas-highlight");
  });

  /**
   * AC-7 (inverse): canvasHighlight=false means no highlight class
   */
  it("AC-7: should not apply highlight CSS class when canvasHighlight is false", () => {
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
      canvasHighlight: false,
    });

    render(<PromptCanvas />);

    const motivField = screen.getByTestId("canvas-motiv");
    expect(motivField.className).not.toContain("animate-canvas-highlight");
  });

  /**
   * AC-8: GIVEN das Canvas-Panel mit drei Textareas
   * WHEN per Tastatur navigiert wird
   * THEN ist die Tab-Reihenfolge: Motiv -> Style -> Negative Prompt
   */
  it("AC-8: should follow tab order motiv then style then negative prompt", () => {
    currentMockValue = createMockContextValue({
      draftPrompt: sampleDraft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const motivField = screen.getByTestId("canvas-motiv");
    const styleField = screen.getByTestId("canvas-style");
    const negField = screen.getByTestId("canvas-negativePrompt");

    // Verify tabIndex ordering: Motiv=1, Style=2, Negative=3
    expect(motivField).toHaveAttribute("tabindex", "1");
    expect(styleField).toHaveAttribute("tabindex", "2");
    expect(negField).toHaveAttribute("tabindex", "3");
  });
});
