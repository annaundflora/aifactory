// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import {
  WorkspaceStateProvider,
  useWorkspaceVariation,
  type WorkspaceVariationState,
} from "../workspace-state";

/**
 * Unit tests for WorkspaceState (slice-14-variation-flow)
 *
 * Tests the WorkspaceStateProvider context and useWorkspaceVariation hook
 * with a real provider (no mocks). Validates state management for the
 * variation flow between LightboxModal and PromptArea.
 */

function wrapper({ children }: { children: ReactNode }) {
  return createElement(WorkspaceStateProvider, null, children);
}

describe("WorkspaceState", () => {
  // ---------------------------------------------------------------------------
  // AC-1: Variation-State setzen
  // ---------------------------------------------------------------------------
  it("should write prompt, modelId, and modelParams into variation state", () => {
    /**
     * AC-1: GIVEN eine geoeffnete Lightbox mit einer Generation
     *       WHEN der User auf den "Variation"-Button klickt
     *       THEN werden prompt, modelId und modelParams in den WorkspaceVariationState geschrieben
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    const variationData: WorkspaceVariationState = {
      prompt: "A fox in oil painting style",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { aspect_ratio: "1:1", num_inference_steps: 28 },
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    expect(result.current.variationData!.prompt).toBe(
      "A fox in oil painting style"
    );
    expect(result.current.variationData!.modelId).toBe(
      "black-forest-labs/flux-2-pro"
    );
    expect(result.current.variationData!.modelParams).toEqual({
      aspect_ratio: "1:1",
      num_inference_steps: 28,
    });
  });

  // ---------------------------------------------------------------------------
  // AC-3: Negativ-Prompt uebernehmen
  // ---------------------------------------------------------------------------
  it("should include negativePrompt in variation state when generation has a value", () => {
    /**
     * AC-3: GIVEN eine Generation mit negative_prompt: "blurry, low quality"
     *       WHEN der User auf "Variation" klickt
     *       THEN wird negativePrompt mit dem Wert "blurry, low quality" in den WorkspaceVariationState geschrieben
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    const variationData: WorkspaceVariationState = {
      prompt: "A landscape",
      negativePrompt: "blurry, low quality",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    expect(result.current.variationData!.negativePrompt).toBe(
      "blurry, low quality"
    );
  });

  // ---------------------------------------------------------------------------
  // AC-4: Negativ-Prompt null behandeln
  // ---------------------------------------------------------------------------
  it("should set negativePrompt to undefined or empty string when generation negative_prompt is null", () => {
    /**
     * AC-4: GIVEN eine Generation mit negative_prompt: null
     *       WHEN der User auf "Variation" klickt
     *       THEN wird negativePrompt als undefined oder leerer String in den WorkspaceVariationState geschrieben
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    // Simulate what the LightboxModal does: generation.negativePrompt ?? undefined
    const variationData: WorkspaceVariationState = {
      prompt: "A landscape",
      negativePrompt: undefined,
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    const negPrompt = result.current.variationData!.negativePrompt;
    expect(
      negPrompt === undefined || negPrompt === ""
    ).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC-6: State-Reset nach Konsumierung
  // ---------------------------------------------------------------------------
  it("should return cleared state after clearVariation is called", () => {
    /**
     * AC-6: GIVEN PromptArea hat die Variation-Daten uebernommen
     *       WHEN die Uebernahme abgeschlossen ist
     *       THEN ruft PromptArea clearVariation() auf, sodass kein Re-Render die Daten erneut uebertraegt
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    // First set some variation data
    act(() => {
      result.current.setVariation({
        prompt: "Test prompt",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: { aspect_ratio: "1:1" },
      });
    });

    expect(result.current.variationData).not.toBeNull();

    // Now clear it
    act(() => {
      result.current.clearVariation();
    });

    expect(result.current.variationData).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Edge case: Hook throws outside provider
  // ---------------------------------------------------------------------------
  it("should throw when useWorkspaceVariation is used outside WorkspaceStateProvider", () => {
    expect(() => {
      renderHook(() => useWorkspaceVariation());
    }).toThrow("useWorkspaceVariation must be used within a WorkspaceStateProvider");
  });
});
