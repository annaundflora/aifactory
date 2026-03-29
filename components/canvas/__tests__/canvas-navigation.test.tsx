// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronLeft: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-left-icon" {...props} />
  ),
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right-icon" {...props} />
  ),
}));

// Import AFTER mocks
import { CanvasNavigation } from "@/components/canvas/canvas-navigation";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-default-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/** Create 20 gallery generations sorted newest-first (gen-1 = newest, gen-20 = oldest). */
function makeTwentyGenerations(): Generation[] {
  return Array.from({ length: 20 }, (_, i) =>
    makeGeneration({
      id: `gen-${i + 1}`,
      createdAt: new Date(Date.now() - i * 60000), // each 1 min older
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasNavigation", () => {
  let onNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onNavigate = vi.fn();
  });

  /**
   * AC-4: GIVEN die Detail-View zeigt Bild 5 von 20 Gallery-Bildern (neueste zuerst)
   *       WHEN der User den Next-Button (rechts) klickt
   *       THEN wechselt das Hauptbild zu Bild 6 (naechst-aelteres)
   */
  it("AC-4: should navigate to next (older) gallery image when next button is clicked", async () => {
    const user = userEvent.setup();
    const generations = makeTwentyGenerations();

    // Viewing gen-5 (index 4, which is the 5th image)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-5"
        onNavigate={onNavigate}
      />
    );

    // Click the next button
    const nextButton = screen.getByTestId("canvas-nav-next");
    await user.click(nextButton);

    // Should navigate to gen-6 (index 5, the next older image)
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-6");
  });

  /**
   * AC-5: GIVEN die Detail-View zeigt das erste Gallery-Bild (neuestes)
   *       WHEN die Navigation-Buttons geprueft werden
   *       THEN ist der Prev-Button (links) versteckt/nicht gerendert und der Next-Button sichtbar
   */
  it("AC-5: should hide prev button when viewing the first (newest) image", () => {
    const generations = makeTwentyGenerations();

    // Viewing gen-1 (index 0, the newest image)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-1"
        onNavigate={onNavigate}
      />
    );

    // Prev button should NOT be rendered
    expect(screen.queryByTestId("canvas-nav-prev")).not.toBeInTheDocument();

    // Next button SHOULD be rendered
    expect(screen.getByTestId("canvas-nav-next")).toBeInTheDocument();
  });

  /**
   * AC-6: GIVEN die Detail-View zeigt das letzte Gallery-Bild (aeltestes)
   *       WHEN die Navigation-Buttons geprueft werden
   *       THEN ist der Next-Button (rechts) versteckt/nicht gerendert und der Prev-Button sichtbar
   */
  it("AC-6: should hide next button when viewing the last (oldest) image", () => {
    const generations = makeTwentyGenerations();

    // Viewing gen-20 (index 19, the oldest image)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-20"
        onNavigate={onNavigate}
      />
    );

    // Next button should NOT be rendered
    expect(screen.queryByTestId("canvas-nav-next")).not.toBeInTheDocument();

    // Prev button SHOULD be rendered
    expect(screen.getByTestId("canvas-nav-prev")).toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN nur ein einziges Bild in der Gallery
   *       WHEN die Detail-View geoeffnet wird
   *       THEN sind beide Prev/Next-Buttons versteckt
   */
  it("AC-7: should hide both buttons when gallery has only one image", () => {
    const singleGeneration = [makeGeneration({ id: "gen-solo" })];

    render(
      <CanvasNavigation
        allGenerations={singleGeneration}
        currentGenerationId="gen-solo"
        onNavigate={onNavigate}
      />
    );

    // Both buttons should NOT be rendered
    expect(screen.queryByTestId("canvas-nav-prev")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-nav-next")).not.toBeInTheDocument();
  });

  /**
   * AC-11: GIVEN die Detail-View zeigt ein Bild in der Mitte der Gallery
   *        WHEN der User ArrowLeft/ArrowRight drueckt
   *        THEN navigiert ArrowLeft zum vorherigen (neueren) und ArrowRight zum naechsten (aelteren) Bild
   */
  it("AC-11: should navigate via arrow key presses", () => {
    const generations = makeTwentyGenerations();

    // Viewing gen-10 (middle of gallery, both prev/next visible)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-10"
        onNavigate={onNavigate}
      />
    );

    // ArrowLeft → prev (newer image: gen-9)
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-9");

    onNavigate.mockClear();

    // ArrowRight → next (older image: gen-11)
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-11");
  });

  /**
   * AC-11b: GIVEN ein Input-Feld hat Focus
   *         WHEN der User ArrowLeft/ArrowRight drueckt
   *         THEN wird NICHT navigiert (Pfeiltasten bewegen den Cursor im Input)
   */
  it("AC-11b: should not navigate via arrow keys when an input has focus", () => {
    const generations = makeTwentyGenerations();

    const { container } = render(
      <div>
        <input data-testid="text-input" />
        <CanvasNavigation
          allGenerations={generations}
          currentGenerationId="gen-10"
          onNavigate={onNavigate}
        />
      </div>
    );

    // Focus the input
    const input = screen.getByTestId("text-input");
    input.focus();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowRight" });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  /**
   * AC-4 (supplementary): Verify clicking prev navigates to the newer image.
   */
  it("AC-4 (prev): should navigate to previous (newer) gallery image when prev button is clicked", async () => {
    const user = userEvent.setup();
    const generations = makeTwentyGenerations();

    // Viewing gen-5 (index 4)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-5"
        onNavigate={onNavigate}
      />
    );

    // Click the prev button
    const prevButton = screen.getByTestId("canvas-nav-prev");
    await user.click(prevButton);

    // Should navigate to gen-4 (index 3, the newer image)
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-4");
  });
});
