// @vitest-environment jsdom
/**
 * Tests for Slice 10: Assistant Frontend -- applyToWorkspace with single prompt field
 *
 * Tests derived from GIVEN/WHEN/THEN Acceptance Criteria:
 * - AC-2: applyToWorkspace maps draftPrompt.prompt to promptMotiv
 *         AND does NOT pass promptStyle or negativePrompt to setVariation
 *
 * Mocking Strategy: mock_external (per slice spec).
 * useWorkspaceVariation and sonner toast are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React, { createElement, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocking Strategy: mock_external (per slice spec)
// Mock useWorkspaceVariation (workspace-state) and sonner toast
// ---------------------------------------------------------------------------

const mockSetVariation = vi.fn();
const mockClearVariation = vi.fn();
let mockVariationData: Record<string, unknown> | null = null;

vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: mockVariationData,
    setVariation: mockSetVariation,
    clearVariation: mockClearVariation,
  }),
}));

const mockToast = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(
    (...args: unknown[]) => mockToast(...args),
    { error: vi.fn() }
  ),
}));

// Import AFTER mocks are set up
import {
  PromptAssistantProvider,
  usePromptAssistant,
  type DraftPrompt,
} from "@/lib/assistant/assistant-context";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    PromptAssistantProvider,
    null,
    children
  );
}

describe("PromptAssistantContext - Apply Logic (Slice 10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN der State enthaelt ein draftPrompt mit { prompt: "A majestic mountain landscape" }
  //       WHEN applyToWorkspace() aufgerufen wird
  //       THEN wird setVariation mit promptMotiv: "A majestic mountain landscape" aufgerufen
  //       AND die Properties promptStyle und negativePrompt werden NICHT an setVariation uebergeben
  // ---------------------------------------------------------------------------
  it("AC-2: should apply draftPrompt.prompt to workspace as promptMotiv", () => {
    /**
     * AC-2: applyToWorkspace maps draftPrompt.prompt to setVariation({ promptMotiv }).
     * Verifies that the single prompt field is correctly forwarded to promptMotiv.
     */
    mockVariationData = {
      promptMotiv: "",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set a draft prompt with the new single-field format
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          prompt: "A majestic mountain landscape",
        },
      });
    });

    // Auto-apply fires via useEffect when draftVersion increments.
    // Verify setVariation was called with the correct mapped field.
    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "A majestic mountain landscape",
      })
    );
  });

  it("AC-2: should not pass promptStyle or negativePrompt to setVariation", () => {
    /**
     * AC-2: Verifies that the old fields promptStyle and negativePrompt
     * are NOT included in the setVariation call.
     */
    mockVariationData = {
      promptMotiv: "",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set draft prompt
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          prompt: "A majestic mountain landscape",
        },
      });
    });

    // Get the actual call arguments
    const callArgs = mockSetVariation.mock.calls[0][0];

    // Verify promptStyle and negativePrompt are NOT present in the call
    expect(callArgs).not.toHaveProperty("promptStyle");
    expect(callArgs).not.toHaveProperty("negativePrompt");

    // Verify the expected properties ARE present
    expect(callArgs).toHaveProperty("promptMotiv", "A majestic mountain landscape");
    expect(callArgs).toHaveProperty("modelId");
    expect(callArgs).toHaveProperty("modelParams");
  });

  // ---------------------------------------------------------------------------
  // Undo: Snapshot and restore for single-field format
  // ---------------------------------------------------------------------------
  it("AC-2: should snapshot only promptMotiv before applying new prompt", () => {
    /**
     * Verifies that the undo snapshot only contains promptMotiv
     * (no promptStyle or negativePrompt).
     */
    mockVariationData = {
      promptMotiv: "old motiv",
      modelId: "model-1",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set draft
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          prompt: "new prompt text",
        },
      });
    });

    // Auto-apply fires (first setVariation call)
    expect(mockSetVariation).toHaveBeenCalledTimes(1);

    // Undo
    act(() => {
      result.current.undoApply();
    });

    // Undo call restores old values (second call)
    expect(mockSetVariation).toHaveBeenCalledTimes(2);
    const undoArgs = mockSetVariation.mock.calls[1][0];
    expect(undoArgs.promptMotiv).toBe("old motiv");

    // No old promptStyle or negativePrompt in undo
    expect(undoArgs).not.toHaveProperty("promptStyle");
    expect(undoArgs).not.toHaveProperty("negativePrompt");

    // isApplied should be false after undo
    expect(result.current.isApplied).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Edge: applyToWorkspace does nothing when draftPrompt is null
  // ---------------------------------------------------------------------------
  it("should not call setVariation when draftPrompt is null", () => {
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // draftPrompt is null by default
    act(() => {
      result.current.applyToWorkspace();
    });

    expect(mockSetVariation).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // isApplied is set to true after apply
  // ---------------------------------------------------------------------------
  it("should set isApplied to true after apply", () => {
    mockVariationData = {
      promptMotiv: "",
      modelId: "",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          prompt: "test",
        },
      });
    });

    // Auto-apply fires via useEffect
    expect(result.current.isApplied).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Toast with undo action
  // ---------------------------------------------------------------------------
  it("should show toast with undo action on apply", () => {
    mockVariationData = {
      promptMotiv: "",
      modelId: "",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          prompt: "new prompt",
        },
      });
    });

    // Auto-apply fires and calls toast
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
});
