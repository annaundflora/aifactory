// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — only external server action)
// ---------------------------------------------------------------------------

// Mock the getVariantFamilyAction server action (runs on server, cannot call in jsdom)
const mockGetVariantFamilyAction = vi.fn();
vi.mock("@/app/actions/generations", () => ({
  getVariantFamilyAction: (...args: unknown[]) => mockGetVariantFamilyAction(...args),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
}));

// Mock cn utility to pass through classNames
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((x) => typeof x === "string")
      .join(" "),
}));

// Import AFTER mocks
import { SiblingThumbnails } from "@/components/canvas/sibling-thumbnails";
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SiblingThumbnails", () => {
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onSelect = vi.fn();
  });

  /**
   * AC-1: GIVEN eine Generation mit batchId: "batch-xyz" die 3 completed Siblings hat
   *       WHEN die Detail-View fuer diese Generation geoeffnet wird
   *       THEN rendert SiblingThumbnails eine horizontale Reihe mit 3 Thumbnails,
   *            wobei das aktuelle Bild visuell hervorgehoben ist (z.B. Ring/Border)
   */
  it("AC-1: should render horizontal thumbnail row with active image highlighted", async () => {
    const siblings: Generation[] = [
      makeGeneration({ id: "sib-1", imageUrl: "https://example.com/sib1.png", batchId: "batch-xyz" }),
      makeGeneration({ id: "sib-2", imageUrl: "https://example.com/sib2.png", batchId: "batch-xyz" }),
      makeGeneration({ id: "sib-3", imageUrl: "https://example.com/sib3.png", batchId: "batch-xyz" }),
    ];

    mockGetVariantFamilyAction.mockResolvedValue(siblings);

    render(
      <SiblingThumbnails
        batchId="batch-xyz"
        sourceGenerationId={null}
        currentGenerationId="sib-2"
        onSelect={onSelect}
      />
    );

    // Wait for siblings to load
    await waitFor(() => {
      expect(screen.getByTestId("sibling-thumbnails")).toBeInTheDocument();
    });

    // Should render 3 thumbnail buttons
    const thumbnails = [
      screen.getByTestId("sibling-thumbnail-sib-1"),
      screen.getByTestId("sibling-thumbnail-sib-2"),
      screen.getByTestId("sibling-thumbnail-sib-3"),
    ];
    expect(thumbnails).toHaveLength(3);

    // The active thumbnail (sib-2) should have aria-current="true"
    expect(thumbnails[1]).toHaveAttribute("aria-current", "true");

    // The active thumbnail should have the highlight class (border-primary)
    expect(thumbnails[1].className).toMatch(/border-primary/);

    // Non-active thumbnails should NOT have aria-current
    expect(thumbnails[0]).not.toHaveAttribute("aria-current");
    expect(thumbnails[2]).not.toHaveAttribute("aria-current");

    // Each thumbnail should contain an <img> element
    for (const thumb of thumbnails) {
      const img = thumb.querySelector("img");
      expect(img).toBeInTheDocument();
    }
  });

  /**
   * AC-2: GIVEN die Sibling-Thumbnails zeigen 3 Bilder und das mittlere ist aktiv
   *       WHEN der User auf den ersten Thumbnail klickt
   *       THEN wird currentGenerationId im CanvasDetailContext auf die ID des angeklickten
   *            Siblings gesetzt und das Hauptbild wechselt
   */
  it("AC-2: should call onSelect with clicked sibling id when a thumbnail is clicked", async () => {
    const user = userEvent.setup();

    const siblings: Generation[] = [
      makeGeneration({ id: "sib-1", imageUrl: "https://example.com/sib1.png", batchId: "batch-xyz" }),
      makeGeneration({ id: "sib-2", imageUrl: "https://example.com/sib2.png", batchId: "batch-xyz" }),
      makeGeneration({ id: "sib-3", imageUrl: "https://example.com/sib3.png", batchId: "batch-xyz" }),
    ];

    mockGetVariantFamilyAction.mockResolvedValue(siblings);

    render(
      <SiblingThumbnails
        batchId="batch-xyz"
        sourceGenerationId={null}
        currentGenerationId="sib-2"
        onSelect={onSelect}
      />
    );

    // Wait for thumbnails to render
    await waitFor(() => {
      expect(screen.getByTestId("sibling-thumbnails")).toBeInTheDocument();
    });

    // Click the first thumbnail
    const firstThumbnail = screen.getByTestId("sibling-thumbnail-sib-1");
    await user.click(firstThumbnail);

    // onSelect should have been called with the first sibling's ID
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("sib-1");
  });

  /**
   * AC-3: GIVEN eine Generation mit batchId: null (Einzelbild-Generierung)
   *       WHEN die Detail-View geoeffnet wird
   *       THEN wird keine Sibling-Thumbnail-Row gerendert
   */
  it("AC-3: should not render thumbnail row when batchId is null", () => {
    render(
      <SiblingThumbnails
        batchId={null}
        sourceGenerationId={null}
        currentGenerationId="gen-solo"
        onSelect={onSelect}
      />
    );

    // Thumbnail container should not exist
    expect(screen.queryByTestId("sibling-thumbnails")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sibling-thumbnails-loading")).not.toBeInTheDocument();

    // Server action should NOT have been called
    expect(mockGetVariantFamilyAction).not.toHaveBeenCalled();
  });
});
