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

  // -------------------------------------------------------------------------
  // Slice 13: Gallery Model Badge
  // -------------------------------------------------------------------------

  describe("Model Badge (Slice 13)", () => {
    /**
     * AC-1: GIVEN eine GenerationCard mit generation.modelId = "black-forest-labs/flux-1.1-pro"
     * WHEN die Komponente gerendert wird
     * THEN ist ein Badge-Element mit dem Text "Flux 1.1 Pro" sichtbar (nicht erst bei Hover)
     */
    it('AC-1: should render badge with display name "Flux 1.1 Pro" for modelId "black-forest-labs/flux-1.1-pro"', () => {
      const generation = makeGeneration({
        modelId: "black-forest-labs/flux-1.1-pro",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      const badge = screen.getByText("Flux 1.1 Pro");
      expect(badge).toBeInTheDocument();
      // Badge uses data-slot="badge" from the Badge component
      expect(badge).toHaveAttribute("data-slot", "badge");
    });

    /**
     * AC-2: GIVEN eine GenerationCard mit generation.modelId = "recraft-ai/recraft-v4"
     * WHEN die Komponente gerendert wird
     * THEN zeigt der Badge den Text "Recraft V4" (korrekte modelIdToDisplayName-Transformation)
     */
    it('AC-2: should render badge with display name "Recraft V4" for modelId "recraft-ai/recraft-v4"', () => {
      const generation = makeGeneration({
        modelId: "recraft-ai/recraft-v4",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      const badge = screen.getByText("Recraft V4");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-slot", "badge");
    });

    /**
     * AC-3: GIVEN eine GenerationCard mit einem Model-ID-String ohne "/" (z.B. "flux-dev")
     * WHEN die Komponente gerendert wird
     * THEN zeigt der Badge den Text "Flux Dev" (Fallback: gesamter String wird als Name behandelt)
     */
    it('AC-3: should render badge with display name "Flux Dev" for modelId "flux-dev"', () => {
      const generation = makeGeneration({
        modelId: "flux-dev",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      const badge = screen.getByText("Flux Dev");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-slot", "badge");
    });

    /**
     * AC-4: GIVEN eine GenerationCard mit einem sehr langen Model-Namen (> Badge-Breite)
     * WHEN die Komponente gerendert wird
     * THEN wird der Text mit text-overflow: ellipsis (CSS truncate) abgeschnitten
     * und laeuft nicht aus dem Badge heraus
     */
    it("AC-4: should truncate long model name with ellipsis", () => {
      const generation = makeGeneration({
        modelId: "some-vendor/extremely-long-model-name-that-should-definitely-be-truncated-via-css",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      // The badge should exist and contain the transformed text
      const badge = screen.getByText(
        "Extremely Long Model Name That Should Definitely Be Truncated Via Css"
      );
      expect(badge).toBeInTheDocument();

      // The badge element must have the `truncate` CSS class for text-overflow: ellipsis
      expect(badge.className).toContain("truncate");

      // It must also have a max-width constraint to enable truncation
      expect(badge.className).toMatch(/max-w-/);
    });

    /**
     * AC-5: GIVEN eine GenerationCard
     * WHEN die Komponente gerendert wird
     * THEN ist der Badge absolut positioniert (bottom-left), besitzt einen
     * semi-transparenten dunklen Hintergrund und weissen Text, und ist
     * unabhaengig vom Hover-Zustand sichtbar
     */
    it("AC-5: should always render badge with correct positioning and styling regardless of hover state", () => {
      const generation = makeGeneration({
        modelId: "black-forest-labs/flux-1.1-pro",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      const badge = screen.getByText("Flux 1.1 Pro");

      // Badge is absolutely positioned at bottom-left
      expect(badge.className).toContain("absolute");
      expect(badge.className).toContain("bottom-2");
      expect(badge.className).toContain("left-2");

      // Semi-transparent dark background
      expect(badge.className).toMatch(/bg-black\/\d+/);

      // White text
      expect(badge.className).toContain("text-white");

      // Badge must NOT have opacity-0 or group-hover:opacity classes (always visible)
      expect(badge.className).not.toContain("opacity-0");
      expect(badge.className).not.toContain("group-hover:opacity");
    });

    /**
     * AC-6: GIVEN eine GenerationCard mit generation.modelId = ""
     * WHEN die Komponente gerendert wird
     * THEN wird kein Badge-Element gerendert (leerer modelId = kein Badge)
     */
    it("AC-6: should not render badge when modelId is empty string", () => {
      const generation = makeGeneration({
        modelId: "",
      });

      render(<GenerationCard generation={generation} onSelect={vi.fn()} />);

      // No badge element should be present in the DOM at all
      const badges = screen.getByRole("button").querySelectorAll('[data-slot="badge"]');
      expect(badges).toHaveLength(0);
    });
  });
});
