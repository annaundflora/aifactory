// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { GenerationCard } from "@/components/workspace/generation-card";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a Generation object with sensible defaults */
function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-abc-123",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a beautiful sunset over the ocean",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/sunset.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: (overrides as any).batchId ?? null,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GenerationCard — View Transition", () => {
  /**
   * AC-2: GIVEN eine GenerationCard mit generation.id === "gen-abc-123" wird gerendert
   *       WHEN das Thumbnail-<img>-Element geprueft wird
   *       THEN hat es style.viewTransitionName === "canvas-image-gen-abc-123"
   *            (dynamisch pro Generation-ID)
   */
  it('AC-2: should set viewTransitionName style on thumbnail image matching generation id', () => {
    const generation = makeGeneration({
      id: "gen-abc-123",
      imageUrl: "https://example.com/image.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const img = screen.getByTestId("generation-card-image");
    expect(img).toBeInTheDocument();
    expect(img.style.viewTransitionName).toBe("canvas-image-gen-abc-123");
  });

  /**
   * AC-2 (additional): Verify viewTransitionName is dynamic per generation ID
   */
  it('AC-2: should set different viewTransitionName for different generation IDs', () => {
    const generation = makeGeneration({
      id: "gen-xyz-999",
      imageUrl: "https://example.com/other.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const img = screen.getByTestId("generation-card-image");
    expect(img.style.viewTransitionName).toBe("canvas-image-gen-xyz-999");
  });

});
