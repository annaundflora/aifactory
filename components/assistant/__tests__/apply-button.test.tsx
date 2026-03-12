// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { ApplyButton } from "@/components/assistant/apply-button";
import type { PromptAssistantContextValue } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// Mock PromptAssistantContext to control draftPrompt and applyToWorkspace
// ---------------------------------------------------------------------------

const mockApplyToWorkspace = vi.fn();

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
    applyToWorkspace: mockApplyToWorkspace,
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

describe("ApplyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // AC-2: Button shows "Applied!" with Checkmark for 2 seconds after click
  // ---------------------------------------------------------------------------
  it("AC-2: should show Applied! text with check icon for 2 seconds after click", () => {
    /**
     * AC-2: GIVEN der User hat auf Apply geklickt
     *       WHEN der Apply-Vorgang abgeschlossen ist
     *       THEN zeigt der Button fuer genau 2 Sekunden den Text "Applied!" mit einem Checkmark-Icon
     */
    currentMockValue = createMockContextValue({
      draftPrompt: {
        motiv: "A woman in autumn forest",
        style: "photorealistic, golden hour",
        negativePrompt: "low quality, blurry",
      },
      hasCanvas: true,
    });

    render(<ApplyButton />);

    const button = screen.getByTestId("apply-button");
    expect(button).toHaveTextContent("Apply");

    fireEvent.click(button);

    // After click, button should show "Applied!" text
    expect(button).toHaveTextContent("Applied!");
    // Check icon should be present (Lucide Check renders as SVG)
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-2: Button reverts to "Apply" text after 2 seconds
  // ---------------------------------------------------------------------------
  it("AC-2: should revert to Apply text after 2 seconds", () => {
    /**
     * AC-2: GIVEN der Button zeigt "Applied!" nach einem Klick
     *       WHEN 2 Sekunden vergehen
     *       THEN kehrt der Button zum Text "Apply" zurueck
     */
    currentMockValue = createMockContextValue({
      draftPrompt: {
        motiv: "A woman in autumn forest",
        style: "photorealistic",
        negativePrompt: "",
      },
      hasCanvas: true,
    });

    render(<ApplyButton />);

    const button = screen.getByTestId("apply-button");
    fireEvent.click(button);

    expect(button).toHaveTextContent("Applied!");

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveTextContent("Apply");
    // SVG check icon should no longer be present
    const svg = button.querySelector("svg");
    expect(svg).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // AC-6: Button disabled when draftPrompt is null
  // ---------------------------------------------------------------------------
  it("AC-6: should be disabled when draftPrompt is null", () => {
    /**
     * AC-6: GIVEN draftPrompt im PromptAssistantContext ist null (kein Draft vorhanden)
     *       WHEN das Canvas-Panel gerendert wird
     *       THEN ist der Apply-Button disabled (nicht klickbar)
     */
    currentMockValue = createMockContextValue({
      draftPrompt: null,
      hasCanvas: false,
    });

    render(<ApplyButton />);

    const button = screen.getByTestId("apply-button");
    expect(button).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // AC-7: Button disabled during the 2-second applied feedback state
  // ---------------------------------------------------------------------------
  it("AC-7: should be disabled during the 2-second applied feedback state", () => {
    /**
     * AC-7: GIVEN der Apply-Button befindet sich im "Applied!"-Zustand (2-Sekunden-Feedback)
     *       WHEN der User erneut auf den Button klickt
     *       THEN passiert nichts (Button ist waehrend des Feedback-Zustands disabled)
     */
    currentMockValue = createMockContextValue({
      draftPrompt: {
        motiv: "A woman in autumn forest",
        style: "photorealistic",
        negativePrompt: "low quality",
      },
      hasCanvas: true,
    });

    render(<ApplyButton />);

    const button = screen.getByTestId("apply-button");

    // First click triggers apply
    fireEvent.click(button);
    expect(mockApplyToWorkspace).toHaveBeenCalledTimes(1);

    // Button should now be disabled during the feedback state
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Applied!");

    // Attempting another click should not trigger applyToWorkspace again
    fireEvent.click(button);
    expect(mockApplyToWorkspace).toHaveBeenCalledTimes(1);

    // After 2 seconds, button should re-enable
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("Apply");
  });
});
