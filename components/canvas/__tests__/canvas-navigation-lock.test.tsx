// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — CanvasDetailContext gemockt)
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

/** Create 5 gallery generations sorted newest-first. */
function makeFiveGenerations(): Generation[] {
  return Array.from({ length: 5 }, (_, i) =>
    makeGeneration({
      id: `gen-${i + 1}`,
      createdAt: new Date(Date.now() - i * 60000),
    })
  );
}

// ---------------------------------------------------------------------------
// Tests — Slice 15: Navigation Lock
// ---------------------------------------------------------------------------

describe("CanvasNavigation — Navigation Lock (Slice 15)", () => {
  let onNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onNavigate = vi.fn();
  });

  /**
   * AC-1: GIVEN `maskData` ist eine gueltige `ImageData`-Instanz im State (Maske wurde gemalt)
   *       WHEN die `CanvasNavigation`-Komponente rendert
   *       THEN sind Prev- und Next-Buttons visuell disabled (`opacity-50`, `pointer-events-none`)
   *       AND Klick auf Prev/Next fuehrt NICHT zu `SET_CURRENT_IMAGE` Dispatch
   *       AND Arrow-Key-Navigation (Left/Right) ist unterdrueckt
   */
  it("AC-1: should disable prev/next buttons and suppress arrow keys when maskData exists (disabled=true)", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    // Render with disabled=true (simulates maskData !== null passed from parent)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-3"
        onNavigate={onNavigate}
        disabled={true}
      />
    );

    // -- Buttons should be visually disabled --
    const prevBtn = screen.getByTestId("canvas-nav-prev");
    const nextBtn = screen.getByTestId("canvas-nav-next");

    // Check opacity-50 and pointer-events-none CSS classes
    expect(prevBtn.className).toMatch(/opacity-50/);
    expect(prevBtn.className).toMatch(/pointer-events-none/);
    expect(nextBtn.className).toMatch(/opacity-50/);
    expect(nextBtn.className).toMatch(/pointer-events-none/);

    // Check disabled attribute
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Check aria-disabled
    expect(prevBtn).toHaveAttribute("aria-disabled", "true");
    expect(nextBtn).toHaveAttribute("aria-disabled", "true");

    // -- Click on prev/next should NOT trigger onNavigate --
    await user.click(prevBtn);
    await user.click(nextBtn);
    expect(onNavigate).not.toHaveBeenCalled();

    // -- Arrow key navigation should be suppressed --
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  /**
   * AC-2: GIVEN `maskData` ist `null` im State (keine Maske vorhanden)
   *       WHEN die `CanvasNavigation`-Komponente rendert
   *       THEN sind Prev- und Next-Buttons normal klickbar (wie bisher)
   *       AND Arrow-Key-Navigation funktioniert wie bisher
   */
  it("AC-2: should enable prev/next buttons and arrow keys when maskData is null (disabled=false)", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    // Render with disabled=false (simulates maskData === null)
    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-3"
        onNavigate={onNavigate}
        disabled={false}
      />
    );

    // -- Buttons should NOT have disabled styling --
    const prevBtn = screen.getByTestId("canvas-nav-prev");
    const nextBtn = screen.getByTestId("canvas-nav-next");

    expect(prevBtn.className).not.toMatch(/opacity-50/);
    expect(prevBtn.className).not.toMatch(/pointer-events-none/);
    expect(nextBtn.className).not.toMatch(/opacity-50/);
    expect(nextBtn.className).not.toMatch(/pointer-events-none/);

    // Buttons should not be disabled
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // -- Click on prev should trigger onNavigate --
    await user.click(prevBtn);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-2");

    onNavigate.mockClear();

    // -- Click on next should trigger onNavigate --
    await user.click(nextBtn);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-4");

    onNavigate.mockClear();

    // -- Arrow key navigation should work --
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-2");

    onNavigate.mockClear();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("gen-4");
  });

  /**
   * AC-2 (default prop): GIVEN disabled prop is omitted (default false)
   *       WHEN the component renders
   *       THEN navigation works normally (backwards compat)
   */
  it("AC-2 (default): should default disabled to false when prop is omitted", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    render(
      <CanvasNavigation
        allGenerations={generations}
        currentGenerationId="gen-3"
        onNavigate={onNavigate}
      />
    );

    const nextBtn = screen.getByTestId("canvas-nav-next");
    expect(nextBtn).not.toBeDisabled();

    await user.click(nextBtn);
    expect(onNavigate).toHaveBeenCalledWith("gen-4");
  });
});
