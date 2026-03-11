// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock lucide-react icons (GalleryGrid uses ImageIcon for empty state)
vi.mock("lucide-react", () => ({
  ImageIcon: (props: Record<string, unknown>) => (
    <span data-testid="image-icon" {...props} />
  ),
}));

// Import AFTER mocks
import { GalleryGrid } from "@/components/workspace/gallery-grid";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock Generation object with sensible defaults */
function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    negativePrompt: overrides.negativePrompt ?? null,
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
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GalleryGrid", () => {
  const noop = vi.fn();

  /**
   * AC-1: GIVEN ein Projekt mit 5 completed Generierungen
   * WHEN <GalleryGrid> mit diesen Generierungen gerendert wird
   * THEN werden alle 5 Bilder im Masonry-Layout (CSS columns) angezeigt
   */
  it("AC-1: should render all completed generations in a CSS columns layout", () => {
    const generations = Array.from({ length: 5 }, (_, i) =>
      makeGeneration({
        id: `gen-${i}`,
        imageUrl: `https://example.com/img-${i}.png`,
        prompt: `prompt ${i}`,
      })
    );

    render(
      <GalleryGrid generations={generations} onSelectGeneration={noop} />
    );

    // The masonry container should exist and use CSS columns class
    const grid = screen.getByTestId("gallery-grid");
    expect(grid).toBeInTheDocument();
    expect(grid.className).toMatch(/columns-/);

    // All 5 images should be rendered
    const images = grid.querySelectorAll("img");
    expect(images).toHaveLength(5);
  });

  /**
   * AC-2: GIVEN ein Projekt mit 5 completed Generierungen mit unterschiedlichen created_at Timestamps
   * WHEN <GalleryGrid> gerendert wird
   * THEN erscheint die neueste Generierung als erstes Element (Sortierung created_at DESC)
   */
  it("AC-2: should display generations sorted by created_at descending", () => {
    const generations = [
      makeGeneration({
        id: "oldest",
        prompt: "oldest",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
      makeGeneration({
        id: "newest",
        prompt: "newest",
        createdAt: new Date("2026-03-01T00:00:00Z"),
      }),
      makeGeneration({
        id: "middle",
        prompt: "middle",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      }),
    ];

    render(
      <GalleryGrid generations={generations} onSelectGeneration={noop} />
    );

    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");

    // First image should be the newest generation
    expect(images[0]).toHaveAttribute("alt", "newest");
    expect(images[1]).toHaveAttribute("alt", "middle");
    expect(images[2]).toHaveAttribute("alt", "oldest");
  });

  /**
   * AC-3: GIVEN ein Projekt ohne Generierungen (leeres Array)
   * WHEN <GalleryGrid> gerendert wird
   * THEN wird ein Empty State angezeigt mit dem Text "No generations yet. Enter a prompt and hit Generate!"
   */
  it("AC-3: should show empty state message when no generations exist", () => {
    render(<GalleryGrid generations={[]} onSelectGeneration={noop} />);

    expect(
      screen.getByText(
        "No generations yet. Enter a prompt and hit Generate!"
      )
    ).toBeInTheDocument();

    // Grid should NOT be rendered
    expect(screen.queryByTestId("gallery-grid")).not.toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN Generierungen mit Status "pending" oder "failed"
   * WHEN <GalleryGrid> die Liste filtert
   * THEN werden NUR Generierungen mit status: "completed" als Cards angezeigt
   */
  it("AC-7: should only render cards for generations with status completed", () => {
    const generations = [
      makeGeneration({ id: "completed-1", status: "completed", prompt: "done1" }),
      makeGeneration({ id: "pending-1", status: "pending", prompt: "pending1" }),
      makeGeneration({ id: "failed-1", status: "failed", prompt: "failed1" }),
      makeGeneration({ id: "completed-2", status: "completed", prompt: "done2" }),
    ];

    render(
      <GalleryGrid generations={generations} onSelectGeneration={noop} />
    );

    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");

    // Only the 2 completed generations should be rendered
    expect(images).toHaveLength(2);

    const alts = Array.from(images).map((img) => img.getAttribute("alt"));
    expect(alts).toContain("done1");
    expect(alts).toContain("done2");
    expect(alts).not.toContain("pending1");
    expect(alts).not.toContain("failed1");
  });

  /**
   * AC-7 (edge case): GIVEN only pending/failed generations
   * WHEN <GalleryGrid> filters
   * THEN empty state is shown (no completed items)
   */
  it("AC-7: should show empty state when all generations are pending or failed", () => {
    const generations = [
      makeGeneration({ id: "p1", status: "pending" }),
      makeGeneration({ id: "f1", status: "failed" }),
    ];

    render(
      <GalleryGrid generations={generations} onSelectGeneration={noop} />
    );

    expect(
      screen.getByText(
        "No generations yet. Enter a prompt and hit Generate!"
      )
    ).toBeInTheDocument();
  });

  /**
   * AC-8: GIVEN ein Projekt mit 20+ completed Generierungen
   * WHEN <GalleryGrid> gerendert wird
   * THEN werden alle Generierungen ohne Virtualisierung gerendert (einfaches CSS-Columns-Layout)
   */
  it("AC-8: should render all generations without virtualization for 20+ items", () => {
    const generations = Array.from({ length: 25 }, (_, i) =>
      makeGeneration({
        id: `gen-${i}`,
        prompt: `prompt ${i}`,
        createdAt: new Date(2026, 0, 1, 0, 0, i),
      })
    );

    render(
      <GalleryGrid generations={generations} onSelectGeneration={noop} />
    );

    const grid = screen.getByTestId("gallery-grid");
    const images = grid.querySelectorAll("img");

    // All 25 images must be in the DOM (no virtualization / lazy cut-off)
    expect(images).toHaveLength(25);

    // Container uses CSS columns (no JS virtualization library wrapper)
    expect(grid.className).toMatch(/columns-/);
  });
});
