// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { ModelRecommendation } from "@/components/assistant/model-recommendation";
import type { PromptAssistantContextValue } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// Mock PromptAssistantContext and useWorkspaceVariation
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
const mockVariationData = {
  promptMotiv: "A cat on a beach",
  promptStyle: "photorealistic",
  negativePrompt: "blurry",
  modelId: "stability-ai/sdxl",
  modelParams: {},
};

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
    updateDraftField: vi.fn(),
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    applyToWorkspace: vi.fn(),
    undoApply: vi.fn(),
    dispatch: vi.fn(),
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

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariationOptional: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: vi.fn(),
  }),
}));

describe("ModelRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Badge nicht sichtbar ohne Empfehlung
  // ---------------------------------------------------------------------------
  it("AC-1: should not render when recommendedModel is null", () => {
    /**
     * AC-1: GIVEN der PromptAssistantContext hat recommendedModel als null
     *       WHEN das Canvas-Panel sichtbar ist
     *       THEN ist die Model-Recommendation Badge NICHT sichtbar
     */
    currentMockValue = createMockContextValue({
      recommendedModel: null,
    });

    const { container } = render(<ModelRecommendation />);

    expect(container.innerHTML).toBe("");
    expect(
      screen.queryByTestId("model-recommendation")
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-3: Badge zeigt Modellname, Begruendung und Action-Link
  // ---------------------------------------------------------------------------
  it("AC-3: should render model name, reason, and action link when recommendedModel is set", () => {
    /**
     * AC-3: GIVEN recommendedModel ist gesetzt mit { id: "black-forest-labs/flux-1.1-pro",
     *            name: "Flux Pro 1.1", reason: "Ideal fuer fotorealistische Portraits" }
     *       WHEN das Canvas-Panel gerendert wird
     *       THEN zeigt die Badge den Modellnamen "Flux Pro 1.1" und die Begruendung
     *            "Ideal fuer fotorealistische Portraits" und einen klickbaren Action-Link
     *            mit dem Text "Modell verwenden"
     */
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "black-forest-labs/flux-1.1-pro",
        name: "Flux Pro 1.1",
        reason: "Ideal fuer fotorealistische Portraits",
      },
    });

    render(<ModelRecommendation />);

    expect(screen.getByTestId("model-recommendation")).toBeInTheDocument();
    expect(screen.getByTestId("model-recommendation-name")).toHaveTextContent(
      "Flux Pro 1.1"
    );
    expect(
      screen.getByTestId("model-recommendation-reason")
    ).toHaveTextContent("Ideal fuer fotorealistische Portraits");

    const actionButton = screen.getByTestId("model-recommendation-action");
    expect(actionButton).toBeInTheDocument();
    expect(actionButton).toHaveTextContent("Modell verwenden");
    expect(actionButton.tagName).toBe("BUTTON");
  });

  // ---------------------------------------------------------------------------
  // AC-4: Klick auf "Modell verwenden" setzt modelId im Workspace
  // ---------------------------------------------------------------------------
  it("AC-4: should call setVariation with correct modelId when action link is clicked", () => {
    /**
     * AC-4: GIVEN die Model-Recommendation Badge ist sichtbar mit id: "black-forest-labs/flux-1.1-pro"
     *       WHEN der User auf "Modell verwenden" klickt
     *       THEN wird useWorkspaceVariation().setVariation() aufgerufen mit einem Objekt
     *            das modelId: "black-forest-labs/flux-1.1-pro" enthaelt (andere Felder bleiben unveraendert)
     */
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "black-forest-labs/flux-1.1-pro",
        name: "Flux Pro 1.1",
        reason: "Ideal fuer fotorealistische Portraits",
      },
    });

    render(<ModelRecommendation />);

    const actionButton = screen.getByTestId("model-recommendation-action");
    fireEvent.click(actionButton);

    expect(mockSetVariation).toHaveBeenCalledTimes(1);
    const callArg = mockSetVariation.mock.calls[0][0];
    expect(callArg.modelId).toBe("black-forest-labs/flux-1.1-pro");
    // Verify existing workspace fields are preserved
    expect(callArg.promptMotiv).toBe(mockVariationData.promptMotiv);
    expect(callArg.promptStyle).toBe(mockVariationData.promptStyle);
    expect(callArg.negativePrompt).toBe(mockVariationData.negativePrompt);
  });

  // ---------------------------------------------------------------------------
  // AC-5: Badge aktualisiert sich bei neuem Event
  // ---------------------------------------------------------------------------
  it("AC-5: should update display when recommendedModel changes", () => {
    /**
     * AC-5: GIVEN der Agent sendet ein neues recommend_model Event mit
     *            { id: "stability-ai/sdxl", name: "SDXL", reason: "Stark bei kuenstlerischen Illustrationen" }
     *       WHEN das Canvas bereits eine vorherige Empfehlung anzeigt
     *       THEN wird die Badge aktualisiert und zeigt "SDXL" mit der neuen Begruendung
     */
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "black-forest-labs/flux-1.1-pro",
        name: "Flux Pro 1.1",
        reason: "Ideal fuer fotorealistische Portraits",
      },
    });

    const { rerender } = render(<ModelRecommendation />);

    expect(screen.getByTestId("model-recommendation-name")).toHaveTextContent(
      "Flux Pro 1.1"
    );

    // Simulate context update with new recommendation
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "stability-ai/sdxl",
        name: "SDXL",
        reason: "Stark bei kuenstlerischen Illustrationen",
      },
    });

    rerender(<ModelRecommendation />);

    expect(screen.getByTestId("model-recommendation-name")).toHaveTextContent(
      "SDXL"
    );
    expect(
      screen.getByTestId("model-recommendation-reason")
    ).toHaveTextContent("Stark bei kuenstlerischen Illustrationen");
  });

  // ---------------------------------------------------------------------------
  // AC-6: Action-Link ist per Tab fokussierbar
  // ---------------------------------------------------------------------------
  it("AC-6: should make action link focusable via keyboard", async () => {
    /**
     * AC-6: GIVEN die Model-Recommendation Badge ist sichtbar
     *       WHEN der User per Tastatur navigiert (Tab)
     *       THEN ist der "Modell verwenden" Link fokussierbar
     */
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "black-forest-labs/flux-1.1-pro",
        name: "Flux Pro 1.1",
        reason: "Ideal fuer fotorealistische Portraits",
      },
    });

    render(<ModelRecommendation />);

    const actionButton = screen.getByTestId("model-recommendation-action");

    // Simulate Tab navigation to focus the button
    await userEvent.tab();

    expect(actionButton).toHaveFocus();
    // Verify it is a button (not an anchor) for accessibility
    expect(actionButton.tagName).toBe("BUTTON");
    expect(actionButton).toHaveAttribute("type", "button");
  });

  // ---------------------------------------------------------------------------
  // AC-7: Badge erscheint mit Einblend-Animation
  // ---------------------------------------------------------------------------
  it("AC-7: should render with opacity transition class when appearing", () => {
    /**
     * AC-7: GIVEN recommendedModel ist null und das Canvas-Panel ist sichtbar
     *       WHEN spaeter ein recommend_model Event empfangen wird
     *       THEN erscheint die Badge mit einer dezenten Einblend-Animation (opacity transition)
     */
    currentMockValue = createMockContextValue({
      recommendedModel: null,
    });

    const { rerender } = render(<ModelRecommendation />);

    // Badge should not exist initially
    expect(
      screen.queryByTestId("model-recommendation")
    ).not.toBeInTheDocument();

    // Now recommendation arrives
    currentMockValue = createMockContextValue({
      recommendedModel: {
        id: "black-forest-labs/flux-1.1-pro",
        name: "Flux Pro 1.1",
        reason: "Ideal fuer fotorealistische Portraits",
      },
    });

    rerender(<ModelRecommendation />);

    const badge = screen.getByTestId("model-recommendation");
    expect(badge).toBeInTheDocument();
    // Verify transition-opacity class is applied for animation
    expect(badge.className).toContain("transition-opacity");
  });
});
