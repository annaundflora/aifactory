// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { GenerationCard } from "@/components/workspace/generation-card";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Generation object with sensible defaults */
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
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GenerationCard", () => {
  /**
   * AC-4: GIVEN eine completed Generation mit image_url und prompt
   * WHEN <GenerationCard> gerendert wird
   * THEN zeigt die Card ein Thumbnail-Bild (<img> oder <Image>) mit der image_url als Source
   */
  it("AC-4: should render thumbnail image with image_url as source", () => {
    const generation = makeGeneration({
      imageUrl: "https://cdn.example.com/my-image.png",
      prompt: "a cat in space",
    });

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://cdn.example.com/my-image.png");
    expect(img).toHaveAttribute("alt", "a cat in space");
  });

  /**
   * AC-5: GIVEN eine <GenerationCard> im Default-Zustand
   * WHEN der User mit der Maus ueber die Card hovert
   * THEN wird ein visueller Hover-State angezeigt (z.B. Overlay, Border-Highlight oder Scale-Effekt)
   */
  it("AC-5: should apply visual hover state on mouse over", () => {
    const generation = makeGeneration();

    render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

    // The card button should have group + hover classes for visual feedback
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/hover:/);

    // The overlay div should use group-hover classes
    // Find the overlay element (contains group-hover classes)
    const overlay = button.querySelector("[class*='group-hover']");
    expect(overlay).not.toBeNull();

    // Fire mouseOver to ensure no errors during hover interaction
    fireEvent.mouseOver(button);

    // The card should still be in the document (no crash on hover)
    expect(button).toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN eine gerenderte <GenerationCard>
   * WHEN der User auf die Card klickt
   * THEN wird ein onSelect Callback mit der Generation-ID aufgerufen
   */
  it("AC-6: should call onSelect callback with generation ID on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const generation = makeGeneration({ id: "gen-xyz-789" });

    render(<GenerationCard generation={generation} onSelect={onSelect} />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("gen-xyz-789");
  });

  /**
   * AC-6 (additional): Verify click event propagation works correctly
   * by clicking on the image within the card
   */
  it("AC-6: should call onSelect when clicking on the image inside the card", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const generation = makeGeneration({ id: "gen-click-img" });

    render(<GenerationCard generation={generation} onSelect={onSelect} />);

    const img = screen.getByRole("img");
    await user.click(img);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("gen-click-img");
  });
});
