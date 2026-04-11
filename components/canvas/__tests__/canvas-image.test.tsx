// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ImageOff: (props: Record<string, unknown>) => (
    <span data-testid="image-off-icon" {...props} />
  ),
  Loader2: (props: Record<string, unknown>) => (
    <span data-testid="loader-icon" {...props} />
  ),
}));

// Import AFTER mocks
import { CanvasImage } from "@/components/canvas/canvas-image";
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
    imageUrl: "imageUrl" in overrides ? overrides.imageUrl! : "https://example.com/image.png",
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

describe("CanvasImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-8: GIVEN die Detail-View ist aktiv
   *       WHEN das CanvasImage-Komponente geprueft wird
   *       THEN zeigt es das Bild der currentGenerationId zentriert mit object-contain (max-fit) an
   */
  it("AC-8: should display current generation image centered with object-contain", () => {
    const generation = makeGeneration({
      id: "gen-img-1",
      imageUrl: "https://example.com/main-image.png",
      prompt: "a beautiful landscape",
    });

    render(<CanvasImage generation={generation} />);

    // Container should exist (transform wrapper handles centering/scaling now)
    const container = screen.getByTestId("canvas-image-container");
    expect(container).toBeInTheDocument();

    // Image element should exist with correct src — uses natural dimensions
    // (no object-contain, no max-h/w — transform wrapper handles scaling)
    const img = screen.getByTestId("canvas-image");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/main-image.png");
    expect(img).toHaveAttribute("alt", "a beautiful landscape");
  });

  /**
   * AC-9: GIVEN das Bild-Loading ist noch nicht abgeschlossen
   *       WHEN der Loading-State aktiv ist
   *       THEN zeigt CanvasImage einen Loading-Indicator (z.B. Skeleton/Spinner)
   */
  it("AC-9: should show loading indicator while image is loading", () => {
    const generation = makeGeneration({
      id: "gen-loading",
      imageUrl: "https://example.com/loading-image.png",
    });

    render(<CanvasImage generation={generation} />);

    // Before image load event fires, the loading indicator should be visible
    // The component starts in "loading" state when imageUrl is present
    const loadingIndicator = screen.getByTestId("canvas-image-loading");
    expect(loadingIndicator).toBeInTheDocument();

    // The image element should exist but be invisible (opacity-0 while loading)
    const img = screen.getByTestId("canvas-image");
    expect(img.className).toMatch(/opacity-0/);
  });

  /**
   * AC-9 (isLoading prop): GIVEN the external isLoading prop is true
   *       WHEN the component renders
   *       THEN the loading indicator is shown
   */
  it("AC-9: should show loading indicator when isLoading prop is true", () => {
    const generation = makeGeneration({
      id: "gen-ext-loading",
      imageUrl: "https://example.com/ext-loading.png",
    });

    render(<CanvasImage generation={generation} isLoading={true} />);

    const loadingIndicator = screen.getByTestId("canvas-image-loading");
    expect(loadingIndicator).toBeInTheDocument();
  });

  /**
   * AC-9 (loaded): After image load completes, loading indicator should disappear.
   */
  it("AC-9: should hide loading indicator after image loads successfully", () => {
    const generation = makeGeneration({
      id: "gen-loaded",
      imageUrl: "https://example.com/loaded-image.png",
    });

    render(<CanvasImage generation={generation} />);

    // Initially loading
    expect(screen.getByTestId("canvas-image-loading")).toBeInTheDocument();

    // Simulate image load event
    const img = screen.getByTestId("canvas-image");
    fireEvent.load(img);

    // Loading indicator should be gone
    expect(screen.queryByTestId("canvas-image-loading")).not.toBeInTheDocument();

    // Image should now be visible (opacity-100)
    expect(img.className).toMatch(/opacity-100/);
  });

  /**
   * AC-10: GIVEN die Bild-URL ist ungueltig oder das Laden schlaegt fehl
   *        WHEN der Error-State eintritt
   *        THEN zeigt CanvasImage einen Fehler-State (z.B. Placeholder-Icon mit Fehlermeldung)
   */
  it("AC-10: should show error placeholder when image fails to load", () => {
    const generation = makeGeneration({
      id: "gen-error",
      imageUrl: "https://example.com/broken-image.png",
    });

    render(<CanvasImage generation={generation} />);

    // Simulate image error event
    const img = screen.getByTestId("canvas-image");
    fireEvent.error(img);

    // Error placeholder should be shown
    const errorPlaceholder = screen.getByTestId("canvas-image-error");
    expect(errorPlaceholder).toBeInTheDocument();

    // Should contain error message text
    expect(errorPlaceholder.textContent).toMatch(/konnte nicht geladen werden/i);

    // The broken image element should be gone (error state removes it)
    expect(screen.queryByTestId("canvas-image")).not.toBeInTheDocument();
  });

  /**
   * AC-10 (no imageUrl): GIVEN generation has no imageUrl
   *        WHEN CanvasImage renders
   *        THEN it shows error placeholder immediately
   */
  it("AC-10: should show error placeholder when generation has no imageUrl", () => {
    const generation = makeGeneration({
      id: "gen-no-url",
      imageUrl: null,
    });

    render(<CanvasImage generation={generation} />);

    // Error state should render immediately
    const errorPlaceholder = screen.getByTestId("canvas-image-error");
    expect(errorPlaceholder).toBeInTheDocument();
    expect(errorPlaceholder.textContent).toMatch(/kein bild/i);

    // No image element should exist
    expect(screen.queryByTestId("canvas-image")).not.toBeInTheDocument();

    // No loading indicator either
    expect(screen.queryByTestId("canvas-image-loading")).not.toBeInTheDocument();
  });
});
