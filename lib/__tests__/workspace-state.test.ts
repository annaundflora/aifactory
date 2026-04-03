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
      promptMotiv: "A fox in oil painting style",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { aspect_ratio: "1:1", num_inference_steps: 28 },
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    expect(result.current.variationData!.promptMotiv).toBe(
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
  it("should store and retrieve variation state without removed fields", () => {
    /**
     * AC-3 (updated for slice-06): promptStyle and negativePrompt have been
     * removed from WorkspaceVariationState. Variation data should work
     * with only the remaining fields.
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    const variationData: WorkspaceVariationState = {
      promptMotiv: "A landscape",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    expect(result.current.variationData!.promptMotiv).toBe("A landscape");
    expect(result.current.variationData!.modelId).toBe("black-forest-labs/flux-2-pro");
  });

  // ---------------------------------------------------------------------------
  // AC-4: Negativ-Prompt null behandeln
  // ---------------------------------------------------------------------------
  it("should handle minimal variation state without removed fields", () => {
    /**
     * AC-4 (updated for slice-06): promptStyle and negativePrompt have been
     * removed. Minimal state with only required fields should work correctly.
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    const variationData: WorkspaceVariationState = {
      promptMotiv: "A landscape",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    };

    act(() => {
      result.current.setVariation(variationData);
    });

    expect(result.current.variationData).not.toBeNull();
    expect(result.current.variationData!.promptMotiv).toBe("A landscape");
    // Removed fields should not exist on the type
    expect(Object.keys(result.current.variationData!)).not.toContain("promptStyle");
    expect(Object.keys(result.current.variationData!)).not.toContain("negativePrompt");
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
        promptMotiv: "Test prompt",
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

// =============================================================================
// Slice-10: WorkspaceState Extension
// =============================================================================

describe("WorkspaceState Extension (slice-10)", () => {
  // ---------------------------------------------------------------------------
  // AC-1: Interface enthält alle neuen optionalen Felder
  // ---------------------------------------------------------------------------
  it("AC-1: should include targetMode, sourceImageUrl, strength, sourceGenerationId as optional fields in WorkspaceVariationState", () => {
    /**
     * AC-1: GIVEN WorkspaceVariationState ist in lib/workspace-state.tsx definiert
     *       WHEN der TypeScript-Compiler das Interface auswertet
     *       THEN enthält es die vier neuen optionalen Felder: targetMode?: string,
     *            sourceImageUrl?: string, strength?: number, sourceGenerationId?: string
     *            — zusätzlich zu den fünf bestehenden Feldern
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    // Create a state object with all fields (3 required + optional)
    // Note: promptStyle and negativePrompt were removed in slice-06
    const fullState: WorkspaceVariationState = {
      // 3 required fields
      promptMotiv: "test prompt",
      modelId: "model-1",
      modelParams: { steps: 20 },
      // optional fields
      targetMode: "img2img",
      sourceImageUrl: "https://example.com/image.png",
      strength: 0.75,
      sourceGenerationId: "gen-abc-123",
    };

    act(() => {
      result.current.setVariation(fullState);
    });

    // Verify all fields are present
    const data = result.current.variationData!;
    expect(data.promptMotiv).toBe("test prompt");
    expect(data.modelId).toBe("model-1");
    expect(data.modelParams).toEqual({ steps: 20 });
    expect(data.targetMode).toBe("img2img");
    expect(data.sourceImageUrl).toBe("https://example.com/image.png");
    expect(data.strength).toBe(0.75);
    expect(data.sourceGenerationId).toBe("gen-abc-123");
  });

  // ---------------------------------------------------------------------------
  // AC-2: setVariation mit targetMode, sourceImageUrl, strength
  // ---------------------------------------------------------------------------
  it("AC-2: should store and return targetMode, sourceImageUrl and strength when set via setVariation", () => {
    /**
     * AC-2: GIVEN ein State-Objekt wird über setVariation mit
     *            { targetMode: "img2img", sourceImageUrl: "https://r2.example.com/sources/p1/abc.png", strength: 0.6, ...requiredFields }
     *       WHEN useWorkspaceVariation().variationData ausgelesen wird
     *       THEN enthält es exakt targetMode: "img2img", sourceImageUrl: "https://r2.example.com/sources/p1/abc.png" und strength: 0.6
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    act(() => {
      result.current.setVariation({
        promptMotiv: "A landscape",
        modelId: "flux-2-pro",
        modelParams: {},
        targetMode: "img2img",
        sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
        strength: 0.6,
      });
    });

    const data = result.current.variationData!;
    expect(data.targetMode).toBe("img2img");
    expect(data.sourceImageUrl).toBe("https://r2.example.com/sources/p1/abc.png");
    expect(data.strength).toBe(0.6);
  });

  // ---------------------------------------------------------------------------
  // AC-3: sourceGenerationId wird korrekt gesetzt und ausgelesen
  // ---------------------------------------------------------------------------
  it("AC-3: should store and return sourceGenerationId when set via setVariation", () => {
    /**
     * AC-3: GIVEN ein State-Objekt wird über setVariation mit
     *            { sourceGenerationId: "uuid-abc-123", ...requiredFields }
     *       WHEN useWorkspaceVariation().variationData ausgelesen wird
     *       THEN enthält es exakt sourceGenerationId: "uuid-abc-123"
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    act(() => {
      result.current.setVariation({
        promptMotiv: "A portrait",
        modelId: "flux-2-pro",
        modelParams: {},
        sourceGenerationId: "uuid-abc-123",
      });
    });

    expect(result.current.variationData!.sourceGenerationId).toBe("uuid-abc-123");
  });

  // ---------------------------------------------------------------------------
  // AC-4: Bestehende Aufrufe ohne neue Felder — neue Felder sind undefined
  // ---------------------------------------------------------------------------
  it("AC-4: should set new fields to undefined when not provided in setVariation call", () => {
    /**
     * AC-4: GIVEN ein State-Objekt wird über setVariation ohne die neuen Felder gesetzt
     *            (nur die bisherigen Pflichtfelder promptMotiv, modelId, modelParams)
     *       WHEN useWorkspaceVariation().variationData ausgelesen wird
     *       THEN sind die neuen Felder undefined — kein Fehler, bestehende Contracts bleiben erfüllt
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    act(() => {
      result.current.setVariation({
        promptMotiv: "A sunset",
        modelId: "flux-2-pro",
        modelParams: { aspect_ratio: "16:9" },
      });
    });

    const data = result.current.variationData!;
    expect(data.promptMotiv).toBe("A sunset");
    expect(data.modelId).toBe("flux-2-pro");
    expect(data.targetMode).toBeUndefined();
    expect(data.sourceImageUrl).toBeUndefined();
    expect(data.strength).toBeUndefined();
    expect(data.sourceGenerationId).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // AC-5: clearVariation setzt variationData auf null
  // ---------------------------------------------------------------------------
  it("AC-5: should reset variationData to null after clearVariation is called", () => {
    /**
     * AC-5: GIVEN clearVariation wird aufgerufen nachdem setVariation mit neuen Feldern gesetzt hat
     *       WHEN useWorkspaceVariation().variationData ausgelesen wird
     *       THEN ist es null
     */
    const { result } = renderHook(() => useWorkspaceVariation(), { wrapper });

    // Set variation with new fields
    act(() => {
      result.current.setVariation({
        promptMotiv: "A mountain",
        modelId: "flux-2-pro",
        modelParams: {},
        targetMode: "img2img",
        sourceImageUrl: "https://example.com/img.png",
        strength: 0.8,
        sourceGenerationId: "gen-xyz",
      });
    });

    expect(result.current.variationData).not.toBeNull();

    // Clear
    act(() => {
      result.current.clearVariation();
    });

    expect(result.current.variationData).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // AC-6: Hook außerhalb Provider wirft Error
  // ---------------------------------------------------------------------------
  it("AC-6: should throw error when useWorkspaceVariation is used outside WorkspaceStateProvider", () => {
    /**
     * AC-6: GIVEN useWorkspaceVariation wird ausserhalb eines WorkspaceStateProvider aufgerufen
     *       WHEN der Hook ausgewertet wird
     *       THEN wirft er Error: "useWorkspaceVariation must be used within a WorkspaceStateProvider"
     */
    expect(() => {
      renderHook(() => useWorkspaceVariation());
    }).toThrow("useWorkspaceVariation must be used within a WorkspaceStateProvider");
  });
});
