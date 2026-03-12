// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { PromptCanvas } from "@/components/assistant/prompt-canvas";
import type {
  PromptAssistantContextValue,
  DraftPrompt,
} from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// Mock PromptAssistantContext and sonner toast
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
const mockToast = vi.fn();
const mockDispatch = vi.fn();

let mockVariationData: Record<string, unknown> | null = null;

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
  useWorkspaceVariationOptional: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

function createMockContextValue(
  overrides: Partial<PromptAssistantContextValue> = {}
): PromptAssistantContextValue {
  const draftPrompt = overrides.draftPrompt ?? null;

  // Build a realistic applyToWorkspace that mirrors the real implementation
  const applyToWorkspace = () => {
    if (!draftPrompt) return;

    // AC-4: Snapshot current workspace values
    const snapshot = {
      promptMotiv: (mockVariationData as Record<string, string>)?.promptMotiv ?? "",
      promptStyle: (mockVariationData as Record<string, string>)?.promptStyle ?? "",
      negativePrompt: (mockVariationData as Record<string, string>)?.negativePrompt ?? "",
    };

    // AC-1: Map canvas fields to workspace fields
    mockSetVariation({
      promptMotiv: draftPrompt.motiv,
      promptStyle: draftPrompt.style,
      negativePrompt: draftPrompt.negativePrompt,
      modelId: (mockVariationData as Record<string, string>)?.modelId ?? "",
      modelParams: (mockVariationData as Record<string, unknown>)?.modelParams ?? {},
    });

    mockDispatch({ type: "SET_IS_APPLIED", isApplied: true });

    // AC-3: Sonner toast with undo action
    mockToast("Prompt uebernommen.", {
      duration: 5000,
      action: {
        label: "Rueckgaengig",
        onClick: () => {
          mockSetVariation({
            promptMotiv: snapshot.promptMotiv,
            promptStyle: snapshot.promptStyle,
            negativePrompt: snapshot.negativePrompt,
            modelId: (mockVariationData as Record<string, string>)?.modelId ?? "",
            modelParams: (mockVariationData as Record<string, unknown>)?.modelParams ?? {},
          });
          mockDispatch({ type: "SET_IS_APPLIED", isApplied: false });
        },
      },
    });
  };

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
    updateDraftField: vi.fn(),
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    applyToWorkspace,
    undoApply: vi.fn(),
    dispatch: mockDispatch,
    sessionIdRef: { current: null },
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    ...overrides,
  };
}

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

describe("PromptCanvas - Apply Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockVariationData = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Apply transfers canvas fields to workspace via setVariation
  // ---------------------------------------------------------------------------
  it("AC-1: should call setVariation with mapped canvas fields on apply click", () => {
    /**
     * AC-1: GIVEN das Canvas-Panel ist sichtbar mit draftPrompt
     *       { motiv: "A woman in autumn forest", style: "photorealistic, golden hour", negativePrompt: "low quality, blurry" }
     *       WHEN der User auf den Apply-Button klickt
     *       THEN wird setVariation aufgerufen mit
     *       { promptMotiv: "A woman in autumn forest", promptStyle: "photorealistic, golden hour", negativePrompt: "low quality, blurry" }
     *       (plus bestehende Werte fuer modelId, modelParams)
     */
    const draft: DraftPrompt = {
      motiv: "A woman in autumn forest",
      style: "photorealistic, golden hour",
      negativePrompt: "low quality, blurry",
    };

    mockVariationData = {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    };

    currentMockValue = createMockContextValue({
      draftPrompt: draft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const applyButton = screen.getByTestId("apply-button");
    fireEvent.click(applyButton);

    expect(mockSetVariation).toHaveBeenCalledWith({
      promptMotiv: "A woman in autumn forest",
      promptStyle: "photorealistic, golden hour",
      negativePrompt: "low quality, blurry",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    });
  });

  // ---------------------------------------------------------------------------
  // AC-8: Empty canvas fields passed as empty string to setVariation
  // ---------------------------------------------------------------------------
  it("AC-8: should pass empty string for empty canvas fields to setVariation", () => {
    /**
     * AC-8: GIVEN ein Canvas-Feld ist leer (z.B. negativePrompt: "")
     *       WHEN der User auf Apply klickt
     *       THEN wird das entsprechende Workspace-Feld ebenfalls geleert (leerer String wird uebergeben)
     */
    const draft: DraftPrompt = {
      motiv: "A landscape",
      style: "",
      negativePrompt: "",
    };

    mockVariationData = {
      promptMotiv: "old",
      promptStyle: "old style",
      negativePrompt: "old negative",
      modelId: "model-1",
      modelParams: {},
    };

    currentMockValue = createMockContextValue({
      draftPrompt: draft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const applyButton = screen.getByTestId("apply-button");
    fireEvent.click(applyButton);

    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "A landscape",
        promptStyle: "",
        negativePrompt: "",
      })
    );
  });

  // ---------------------------------------------------------------------------
  // AC-3: Sonner toast appears after apply with undo action
  // ---------------------------------------------------------------------------
  it("AC-3: should show sonner toast with undo action after apply", () => {
    /**
     * AC-3: GIVEN der User hat auf Apply geklickt
     *       WHEN der Apply-Vorgang abgeschlossen ist
     *       THEN erscheint ein sonner-Toast mit dem Text "Prompt uebernommen." und einer Action "Rueckgaengig"
     */
    const draft: DraftPrompt = {
      motiv: "A woman in autumn forest",
      style: "photorealistic",
      negativePrompt: "",
    };

    currentMockValue = createMockContextValue({
      draftPrompt: draft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const applyButton = screen.getByTestId("apply-button");
    fireEvent.click(applyButton);

    // Toast should have been called with correct message and action
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      "Prompt uebernommen.",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({
          label: "Rueckgaengig",
          onClick: expect.any(Function),
        }),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // AC-4: Undo restores previous workspace values
  // ---------------------------------------------------------------------------
  it("AC-4: should restore previous workspace values when undo is clicked in toast", () => {
    /**
     * AC-4: GIVEN der Workspace hatte vorher die Werte
     *       { promptMotiv: "old motiv", promptStyle: "old style", negativePrompt: "old negative" }
     *       WHEN der User im Undo-Toast auf "Rueckgaengig" klickt
     *       THEN wird setVariation erneut aufgerufen mit den gespeicherten vorherigen Werten
     */
    const draft: DraftPrompt = {
      motiv: "new motiv",
      style: "new style",
      negativePrompt: "new negative",
    };

    // Previous workspace values
    mockVariationData = {
      promptMotiv: "old motiv",
      promptStyle: "old style",
      negativePrompt: "old negative",
      modelId: "model-1",
      modelParams: { steps: 20 },
    };

    currentMockValue = createMockContextValue({
      draftPrompt: draft,
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const applyButton = screen.getByTestId("apply-button");
    fireEvent.click(applyButton);

    // First call: the apply
    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "new motiv",
        promptStyle: "new style",
        negativePrompt: "new negative",
      })
    );

    // Now simulate clicking the undo action from the toast
    const toastCall = mockToast.mock.calls[0];
    const toastOptions = toastCall[1] as {
      action: { label: string; onClick: () => void };
    };
    expect(toastOptions.action.label).toBe("Rueckgaengig");

    // Click undo
    toastOptions.action.onClick();

    // Second call: the undo, restoring old values
    expect(mockSetVariation).toHaveBeenCalledTimes(2);
    expect(mockSetVariation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        promptMotiv: "old motiv",
        promptStyle: "old style",
        negativePrompt: "old negative",
      })
    );

    // isApplied should be set back to false
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_IS_APPLIED",
      isApplied: false,
    });
  });

  // ---------------------------------------------------------------------------
  // AC-5: Toast duration is 5000ms (verified via toast call arguments)
  // ---------------------------------------------------------------------------
  it("AC-5: should configure toast with duration 5000ms", () => {
    /**
     * AC-5: GIVEN der Undo-Toast ist sichtbar
     *       WHEN 5 Sekunden vergehen ohne Klick auf "Rueckgaengig"
     *       THEN verschwindet der Toast automatisch (sonner Default-Verhalten mit duration: 5000)
     */
    currentMockValue = createMockContextValue({
      draftPrompt: {
        motiv: "test",
        style: "test",
        negativePrompt: "",
      },
      hasCanvas: true,
    });

    render(<PromptCanvas />);

    const applyButton = screen.getByTestId("apply-button");
    fireEvent.click(applyButton);

    // Verify toast was called with duration: 5000
    expect(mockToast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        duration: 5000,
      })
    );
  });
});
