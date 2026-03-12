// @vitest-environment jsdom
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
    { projectId: "test-project" } as Record<string, unknown>,
    children
  );
}

describe("PromptAssistantContext - Apply Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariationData = null;
  });

  // ---------------------------------------------------------------------------
  // AC-1: applyToWorkspace function is provided in context
  // ---------------------------------------------------------------------------
  it("AC-1: should provide applyToWorkspace function in context", () => {
    /**
     * AC-1: GIVEN der PromptAssistantContext ist verfuegbar
     *       WHEN usePromptAssistant() aufgerufen wird
     *       THEN ist applyToWorkspace als Funktion im Context vorhanden
     */
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    expect(result.current.applyToWorkspace).toBeDefined();
    expect(typeof result.current.applyToWorkspace).toBe("function");
  });

  // ---------------------------------------------------------------------------
  // AC-1: applyToWorkspace maps canvas fields to workspace fields
  // ---------------------------------------------------------------------------
  it("AC-1: should call setVariation with mapped fields when applyToWorkspace is called", () => {
    /**
     * AC-1: GIVEN das Canvas-Panel ist sichtbar mit draftPrompt
     *       WHEN applyToWorkspace aufgerufen wird
     *       THEN wird setVariation mit den gemappten Feldern aufgerufen
     *       (motiv -> promptMotiv, style -> promptStyle, negativePrompt -> negativePrompt)
     */
    mockVariationData = {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set a draft prompt first
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "A woman in autumn forest",
          style: "photorealistic, golden hour",
          negativePrompt: "low quality, blurry",
        },
      });
    });

    // Now apply
    act(() => {
      result.current.applyToWorkspace();
    });

    expect(mockSetVariation).toHaveBeenCalledWith({
      promptMotiv: "A woman in autumn forest",
      promptStyle: "photorealistic, golden hour",
      negativePrompt: "low quality, blurry",
      modelId: "flux-2-pro",
      modelParams: { aspect_ratio: "1:1" },
    });
  });

  // ---------------------------------------------------------------------------
  // AC-4: Previous values are snapshotted before apply
  // ---------------------------------------------------------------------------
  it("AC-4: should snapshot current workspace values before applying new ones", () => {
    /**
     * AC-4: GIVEN der Workspace hatte vorher die Werte
     *       { promptMotiv: "old motiv", promptStyle: "old style", negativePrompt: "old negative" }
     *       WHEN applyToWorkspace aufgerufen wird
     *       THEN werden die vorherigen Werte gesnapshoted (fuer Undo)
     */
    mockVariationData = {
      promptMotiv: "old motiv",
      promptStyle: "old style",
      negativePrompt: "old negative",
      modelId: "model-1",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set draft
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "new motiv",
          style: "new style",
          negativePrompt: "new negative",
        },
      });
    });

    // Apply
    act(() => {
      result.current.applyToWorkspace();
    });

    // Verify new values were set
    expect(mockSetVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "new motiv",
        promptStyle: "new style",
        negativePrompt: "new negative",
      })
    );

    // Verify toast was called (which contains the undo with snapshot)
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
  // AC-4: undoApply restores snapshot values
  // ---------------------------------------------------------------------------
  it("AC-4: should restore snapshot values when undoApply is called", () => {
    /**
     * AC-4: GIVEN der User hat Apply geklickt und der Snapshot wurde gespeichert
     *       WHEN undoApply aufgerufen wird
     *       THEN werden die gespeicherten vorherigen Werte via setVariation wiederhergestellt
     */
    mockVariationData = {
      promptMotiv: "old motiv",
      promptStyle: "old style",
      negativePrompt: "old negative",
      modelId: "model-1",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // Set draft
    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "new motiv",
          style: "new style",
          negativePrompt: "",
        },
      });
    });

    // Apply (creates snapshot)
    act(() => {
      result.current.applyToWorkspace();
    });

    expect(mockSetVariation).toHaveBeenCalledTimes(1);

    // Undo
    act(() => {
      result.current.undoApply();
    });

    // Second call should restore old values
    expect(mockSetVariation).toHaveBeenCalledTimes(2);
    expect(mockSetVariation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        promptMotiv: "old motiv",
        promptStyle: "old style",
        negativePrompt: "old negative",
      })
    );

    // isApplied should be false after undo
    expect(result.current.isApplied).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-1: applyToWorkspace does nothing when draftPrompt is null
  // ---------------------------------------------------------------------------
  it("AC-1: should not call setVariation when draftPrompt is null", () => {
    /**
     * AC-6 (related): GIVEN draftPrompt ist null
     *       WHEN applyToWorkspace aufgerufen wird
     *       THEN passiert nichts (kein setVariation Aufruf)
     */
    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    // draftPrompt is null by default
    act(() => {
      result.current.applyToWorkspace();
    });

    expect(mockSetVariation).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-3: isApplied is set to true after apply
  // ---------------------------------------------------------------------------
  it("AC-3: should set isApplied to true after apply", () => {
    /**
     * AC-3: GIVEN applyToWorkspace wurde ausgefuehrt
     *       WHEN der State geprueft wird
     *       THEN ist isApplied true
     */
    mockVariationData = {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      modelId: "",
      modelParams: {},
    };

    const { result } = renderHook(() => usePromptAssistant(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: "SET_DRAFT_PROMPT",
        draftPrompt: {
          motiv: "test",
          style: "test",
          negativePrompt: "",
        },
      });
    });

    act(() => {
      result.current.applyToWorkspace();
    });

    expect(result.current.isApplied).toBe(true);
  });
});
