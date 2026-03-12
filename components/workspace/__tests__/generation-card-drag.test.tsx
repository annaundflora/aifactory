// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { GenerationCard } from "@/components/workspace/generation-card";
import { GALLERY_DRAG_MIME_TYPE } from "@/lib/constants/drag-types";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Generation object with sensible defaults */
function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-abc",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a beautiful sunset over the ocean",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://r2.example.com/img.png",
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
  };
}

/**
 * Creates a minimal mock DataTransfer for dragstart events.
 * jsdom does not implement DataTransfer, so we provide a stub.
 */
function createMockDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: vi.fn((type: string, data: string) => {
      store[type] = data;
    }),
    getData: vi.fn((type: string) => store[type] ?? ""),
    setDragImage: vi.fn(),
    effectAllowed: "" as string,
    types: [] as string[],
    /** Internal helper to read stored data in assertions */
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GenerationCard Drag", () => {
  /**
   * AC-1: GIVEN eine GenerationCard mit generation.id: "gen-abc" und
   *       generation.imageUrl: "https://r2.example.com/img.png"
   * WHEN sie gerendert wird
   * THEN hat das aeussere Element das Attribut draggable="true"
   */
  it('AC-1: should have draggable="true" attribute on the root element', () => {
    const generation = makeGeneration({
      id: "gen-abc",
      imageUrl: "https://r2.example.com/img.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("draggable", "true");
  });

  /**
   * AC-2: GIVEN eine GenerationCard mit generation.id: "gen-abc" und
   *       generation.imageUrl: "https://r2.example.com/img.png"
   * WHEN der User einen Drag startet (dragstart-Event)
   * THEN wird dataTransfer.setData("application/x-aifactory-generation",
   *      JSON.stringify({ generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" }))
   *      aufgerufen und dataTransfer.effectAllowed ist "copy"
   */
  it("AC-2: should set application/x-aifactory-generation data with generationId and imageUrl on dragstart", () => {
    const generation = makeGeneration({
      id: "gen-abc",
      imageUrl: "https://r2.example.com/img.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const button = screen.getByRole("button");
    const dataTransfer = createMockDataTransfer();

    fireEvent.dragStart(button, { dataTransfer });

    // setData should have been called with the custom MIME type
    expect(dataTransfer.setData).toHaveBeenCalledTimes(1);
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      GALLERY_DRAG_MIME_TYPE,
      JSON.stringify({
        generationId: "gen-abc",
        imageUrl: "https://r2.example.com/img.png",
      })
    );
  });

  /**
   * AC-2 (effectAllowed): GIVEN a GenerationCard
   * WHEN dragstart fires
   * THEN dataTransfer.effectAllowed is set to "copy"
   */
  it('AC-2: should set dataTransfer.effectAllowed to "copy" on dragstart', () => {
    const generation = makeGeneration({
      id: "gen-abc",
      imageUrl: "https://r2.example.com/img.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const button = screen.getByRole("button");
    const dataTransfer = createMockDataTransfer();

    fireEvent.dragStart(button, { dataTransfer });

    expect(dataTransfer.effectAllowed).toBe("copy");
  });

  /**
   * AC-3: GIVEN eine GenerationCard im Drag-Zustand
   * WHEN der Drag laeuft
   * THEN wird ein Drag-Image (Ghost) angezeigt (natives Browser-Verhalten,
   *      kein Custom-Ghost erforderlich)
   *
   * Verification: setDragImage must NOT be called, so the browser uses
   * its native ghost rendering.
   */
  it("AC-3: should not call setDragImage (uses native browser ghost)", () => {
    const generation = makeGeneration({
      id: "gen-abc",
      imageUrl: "https://r2.example.com/img.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const button = screen.getByRole("button");
    const dataTransfer = createMockDataTransfer();

    fireEvent.dragStart(button, { dataTransfer });

    // setDragImage should NOT be called -- native browser ghost is used
    expect(dataTransfer.setDragImage).not.toHaveBeenCalled();
  });

  /**
   * Additional unit test: Verify the MIME type constant matches the expected value.
   */
  it("should use the correct MIME type constant value", () => {
    expect(GALLERY_DRAG_MIME_TYPE).toBe("application/x-aifactory-generation");
  });

  /**
   * Additional unit test: Verify the payload JSON structure contains
   * exactly the expected keys.
   */
  it("should include both generationId and imageUrl in the drag payload", () => {
    const generation = makeGeneration({
      id: "gen-payload-test",
      imageUrl: "https://r2.example.com/payload-test.png",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const button = screen.getByRole("button");
    const dataTransfer = createMockDataTransfer();

    fireEvent.dragStart(button, { dataTransfer });

    // Parse the payload that was set
    const rawPayload = dataTransfer._store[GALLERY_DRAG_MIME_TYPE];
    expect(rawPayload).toBeDefined();

    const parsed = JSON.parse(rawPayload);
    expect(parsed).toEqual({
      generationId: "gen-payload-test",
      imageUrl: "https://r2.example.com/payload-test.png",
    });
    // No extra keys
    expect(Object.keys(parsed)).toHaveLength(2);
  });
});
