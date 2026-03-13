// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Mock server action (external)
vi.mock("@/app/actions/generations", () => ({
  fetchGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock lucide-react icons used across the component tree
vi.mock("lucide-react", () => ({
  ArrowLeft: (props: Record<string, unknown>) => (
    <span data-testid="arrow-left-icon" {...props} />
  ),
  PanelRightClose: (props: Record<string, unknown>) => (
    <span data-testid="panel-right-close-icon" {...props} />
  ),
  PanelRightOpen: (props: Record<string, unknown>) => (
    <span data-testid="panel-right-open-icon" {...props} />
  ),
  ImageIcon: (props: Record<string, unknown>) => (
    <span data-testid="image-icon" {...props} />
  ),
}));

// Mock PromptArea (heavy component with many server-action deps)
vi.mock("@/components/workspace/prompt-area", () => ({
  PromptArea: (props: Record<string, unknown>) => (
    <div data-testid="prompt-area">PromptArea Mock</div>
  ),
}));

// Mock FilterChips
vi.mock("@/components/workspace/filter-chips", () => ({
  FilterChips: (props: Record<string, unknown>) => (
    <div data-testid="filter-chips">FilterChips Mock</div>
  ),
}));

// Mock GalleryGrid — exposes onSelectGeneration so we can simulate clicks
let capturedOnSelectGeneration: ((id: string) => void) | null = null;
vi.mock("@/components/workspace/gallery-grid", () => ({
  GalleryGrid: (props: { generations: unknown[]; onSelectGeneration: (id: string) => void }) => {
    capturedOnSelectGeneration = props.onSelectGeneration;
    return (
      <div data-testid="gallery-grid">
        <button
          data-testid="gallery-card-gen-abc-123"
          onClick={() => props.onSelectGeneration("gen-abc-123")}
        >
          Generation Card
        </button>
      </div>
    );
  },
}));

// Mock GenerationPlaceholder
vi.mock("@/components/workspace/generation-placeholder", () => ({
  GenerationPlaceholder: (props: Record<string, unknown>) => (
    <div data-testid="generation-placeholder">Placeholder Mock</div>
  ),
}));

// Mock Lightbox components
vi.mock("@/components/lightbox/lightbox-modal", () => ({
  LightboxModal: () => <div data-testid="lightbox-modal">Lightbox Mock</div>,
}));
vi.mock("@/components/lightbox/lightbox-navigation", () => ({
  LightboxNavigation: () => <div data-testid="lightbox-nav">Nav Mock</div>,
}));

// Mock useColumnCount hook (used by GalleryGrid)
vi.mock("@/hooks/use-column-count", () => ({
  useColumnCount: () => 2,
}));

// Import AFTER mocks
import { WorkspaceContent } from "@/components/workspace/workspace-content";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-default-1",
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

describe("WorkspaceContent — Detail-View integration", () => {
  const completedGen = makeGeneration({
    id: "gen-abc-123",
    status: "completed",
    imageUrl: "https://example.com/gen-abc-123.png",
    prompt: "a beautiful sunset",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSelectGeneration = null;
  });

  /**
   * AC-1: GIVEN ein User auf der Gallery-View mit mindestens einem completed Bild
   *       WHEN der User auf ein Gallery-Bild (GenerationCard) klickt
   *       THEN verschwindet die Gallery (PromptArea + GalleryGrid) und die CanvasDetailView
   *            wird fullscreen innerhalb des Workspace-Bereichs gerendert
   */
  it("AC-1: should show CanvasDetailView and hide gallery when a generation card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Gallery view should be visible initially
    expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();

    // No detail view yet
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();

    // Simulate clicking a gallery card
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // Gallery should disappear
    await waitFor(() => {
      expect(screen.queryByTestId("workspace-gallery-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("prompt-area")).not.toBeInTheDocument();
      expect(screen.queryByTestId("gallery-grid")).not.toBeInTheDocument();
    });

    // Detail view should appear
    expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-detail-view")).toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN der User klickt auf ein Gallery-Bild mit id: "gen-abc-123"
   *       WHEN die CanvasDetailView geoeffnet wird
   *       THEN wird der CanvasDetailProvider mit initialGenerationId: "gen-abc-123" initialisiert
   */
  it("AC-7: should initialize CanvasDetailProvider with the clicked generation id", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Click a generation card to open detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // Wait for detail view to appear
    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });

    // The image displayed in the canvas area should match gen-abc-123
    // This validates that CanvasDetailProvider was initialized with the correct generation id,
    // because the image is resolved via the context's currentGenerationId
    const canvasImage = screen.getByTestId("canvas-image");
    expect(canvasImage).toHaveAttribute("src", "https://example.com/gen-abc-123.png");
    expect(canvasImage).toHaveAttribute("alt", "a beautiful sunset");
  });

  /**
   * AC-9: GIVEN WorkspaceContent mit detailViewOpen: false
   *       WHEN der State geprueft wird
   *       THEN sind PromptArea, FilterChips, GalleryGrid und PendingPlaceholders sichtbar
   *            und keine CanvasDetailView gerendert
   */
  it("AC-9: should show PromptArea and GalleryGrid when detail view is not open", () => {
    const pendingGen = makeGeneration({
      id: "gen-pending-1",
      status: "pending",
    });

    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen, pendingGen]}
      />
    );

    // Gallery view is visible
    expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();

    // PromptArea is rendered
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();

    // FilterChips is rendered
    expect(screen.getByTestId("filter-chips")).toBeInTheDocument();

    // GalleryGrid is rendered
    expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();

    // PendingPlaceholders are rendered (at least one for the pending generation)
    expect(screen.getByTestId("generation-placeholder")).toBeInTheDocument();

    // No CanvasDetailView
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-detail-view")).not.toBeInTheDocument();
  });

  /**
   * AC-4+5: GIVEN die CanvasDetailView ist sichtbar
   *         WHEN der User den Back-Button klickt oder ESC drueckt
   *         THEN schliesst die Detail-View und die Gallery-View wird wieder angezeigt
   */
  it("AC-4+5: should close detail view and show gallery when back is triggered", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Open the detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // Verify detail view is open
    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("workspace-gallery-view")).not.toBeInTheDocument();

    // Click the back button in the header
    const backButton = screen.getByTestId("canvas-back-button");
    await user.click(backButton);

    // Gallery should reappear
    await waitFor(() => {
      expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
      expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
      expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();
    });

    // Detail view should be gone
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();
  });

  /**
   * AC-5 (ESC variant): Close detail view via ESC key press when no input is focused.
   */
  it("AC-5: should close detail view when ESC is pressed and no input is focused", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Open the detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // Verify detail view is open
    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });

    // Ensure no input is focused
    if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
      (document.activeElement as HTMLElement).blur();
    }

    // Press ESC
    fireEvent.keyDown(document, { key: "Escape" });

    // Gallery should reappear
    await waitFor(() => {
      expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
    });

    // Detail view should be gone
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();
  });
});
