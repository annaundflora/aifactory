// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
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
// Mocks (mock_external strategy — only external deps and heavy siblings)
// ---------------------------------------------------------------------------

// Polyfill scrollIntoView for jsdom (used by ChatThread)
Element.prototype.scrollIntoView = vi.fn();

// Mock db/queries to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock canvas-chat-service (used by CanvasChatPanel)
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock server action (external)
vi.mock("@/app/actions/generations", () => ({
  fetchGenerations: vi.fn().mockResolvedValue([]),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
  generateImages: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn().mockResolvedValue({}),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock model settings server action (used by CanvasDetailView for tier-based model resolution)
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([]),
}));

// Mock references server action (transitive dep via details-overlay -> provenance-row)
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: vi.fn().mockResolvedValue([]),
}));

// Mock model actions (used by CanvasModelSelector)
vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock ModelSelector (used by CanvasChatPanel in its header)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => null,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock lib/utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock lucide-react icons used across the canvas component tree
vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    const id = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    const Comp = (props: Record<string, unknown>) => <span data-testid={`${id}-icon`} {...props} />;
    Comp.displayName = name;
    return Comp;
  };
  return {
    MessageSquare: stub("MessageSquare"), Minus: stub("Minus"), Plus: stub("Plus"),
    ArrowUp: stub("ArrowUp"), Square: stub("Square"), PanelRightClose: stub("PanelRightClose"),
    Image: stub("Image"), Loader2: stub("Loader2"), ImageOff: stub("ImageOff"),
    PanelRightOpen: stub("PanelRightOpen"), PanelLeftIcon: stub("PanelLeftIcon"),
    PanelLeftClose: stub("PanelLeftClose"), PenLine: stub("PenLine"),
    ChevronDown: stub("ChevronDown"), Check: stub("Check"), Type: stub("Type"),
    ImagePlus: stub("ImagePlus"), Scaling: stub("Scaling"), X: stub("X"),
    ArrowLeft: stub("ArrowLeft"), Undo2: stub("Undo2"), Redo2: stub("Redo2"),
    ChevronUp: stub("ChevronUp"), ChevronDownIcon: stub("ChevronDownIcon"),
    ChevronUpIcon: stub("ChevronUpIcon"), CheckIcon: stub("CheckIcon"),
    Info: stub("Info"), Copy: stub("Copy"), ArrowRightLeft: stub("ArrowRightLeft"),
    ZoomIn: stub("ZoomIn"), Download: stub("Download"), Trash2: stub("Trash2"),
    Sparkles: stub("Sparkles"), Library: stub("Library"), Star: stub("Star"),
    ChevronLeft: stub("ChevronLeft"), ChevronRight: stub("ChevronRight"),
    PanelLeftOpen: stub("PanelLeftOpen"), History: stub("History"),
  };
});

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock workspace-state (WorkspaceStateProvider / useWorkspaceVariation)
// Required by PromptAssistantProvider which is rendered inside WorkspaceContent
vi.mock("@/lib/workspace-state", () => ({
  WorkspaceStateProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
  useWorkspaceVariationOptional: () => null,
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
vi.mock("@/components/workspace/gallery-grid", () => ({
  GalleryGrid: (props: {
    generations: unknown[];
    onSelectGeneration: (id: string) => void;
  }) => {
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
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { startViewTransitionIfSupported } from "@/lib/utils/view-transition";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-abc-123",
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
    batchId: (overrides as any).batchId ?? null,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: CanvasImage viewTransitionName (AC-3)
// ---------------------------------------------------------------------------

describe("CanvasDetailView — View Transition", () => {
  const gen = makeGeneration({
    id: "gen-abc-123",
    imageUrl: "https://example.com/gen-abc-123.png",
    prompt: "a beautiful sunset",
  });

  const allGenerations = [gen];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-3: GIVEN die CanvasDetailView ist geoeffnet mit currentGenerationId === "gen-abc-123"
   *       WHEN das Canvas-Image-Element geprueft wird
   *       THEN hat es style.viewTransitionName === "canvas-image-gen-abc-123"
   *            (identisch zum Gallery-Thumbnail)
   */
  it('AC-3: should set viewTransitionName style on canvas image matching current generation id', () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-abc-123">
        <CanvasDetailView
          generation={gen}
          allGenerations={allGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    const canvasImage = screen.getByTestId("canvas-image");
    expect(canvasImage).toBeInTheDocument();
    expect(canvasImage.style.viewTransitionName).toBe("canvas-image-gen-abc-123");
  });

  /**
   * AC-3 (additional): Verify viewTransitionName updates when navigating to a different generation
   */
  it('AC-3: should use the correct viewTransitionName for different generation IDs', () => {
    const gen2 = makeGeneration({
      id: "gen-xyz-999",
      imageUrl: "https://example.com/gen-xyz-999.png",
      prompt: "another image",
    });

    render(
      <CanvasDetailProvider initialGenerationId="gen-xyz-999">
        <CanvasDetailView
          generation={gen2}
          allGenerations={[gen2]}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    const canvasImage = screen.getByTestId("canvas-image");
    expect(canvasImage.style.viewTransitionName).toBe("canvas-image-gen-xyz-999");
  });
});

// ---------------------------------------------------------------------------
// Tests: startViewTransition calls (AC-4, AC-5, AC-6, AC-7)
// ---------------------------------------------------------------------------

describe("View Transition — startViewTransitionIfSupported", () => {
  let originalStartViewTransition: any;

  beforeEach(() => {
    // Save original state
    originalStartViewTransition = (document as any).startViewTransition;
  });

  afterEach(() => {
    // Restore original state
    if (originalStartViewTransition !== undefined) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
  });

  /**
   * AC-4: GIVEN ein User auf der Gallery-View in einem Browser der CSS View Transitions API unterstuetzt
   *       WHEN der User auf ein Gallery-Bild klickt
   *       THEN wird document.startViewTransition() aufgerufen und die Detail-View wird
   *            innerhalb der Transition-Callback geoeffnet
   */
  it('AC-4: should call document.startViewTransition when opening detail view in supported browser', () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb(); // Execute the callback synchronously like the real API would
    });
    (document as any).startViewTransition = mockStartViewTransition;

    const callback = vi.fn();
    startViewTransitionIfSupported(callback);

    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
    expect(mockStartViewTransition).toHaveBeenCalledWith(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-5: GIVEN die Detail-View ist sichtbar in einem Browser der CSS View Transitions API unterstuetzt
   *       WHEN der User den Back-Button klickt oder ESC drueckt
   *       THEN wird document.startViewTransition() aufgerufen und die Gallery-View wird
   *            innerhalb der Transition-Callback angezeigt (Reverse-Animation)
   */
  it('AC-5: should call document.startViewTransition when closing detail view via back or ESC', () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
    });
    (document as any).startViewTransition = mockStartViewTransition;

    // Simulate the close callback pattern used by WorkspaceContent
    const closeCallback = vi.fn();
    startViewTransitionIfSupported(closeCallback);

    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);
    expect(mockStartViewTransition).toHaveBeenCalledWith(closeCallback);
    expect(closeCallback).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-6: GIVEN ein Browser der document.startViewTransition NICHT unterstuetzt
   *       WHEN der User auf ein Gallery-Bild klickt
   *       THEN oeffnet sich die Detail-View sofort ohne Animation
   *            (identisches Ergebnis, nur ohne visuelle Transition)
   */
  it('AC-6: should open detail view without animation when startViewTransition is not available', () => {
    // Ensure startViewTransition does NOT exist
    delete (document as any).startViewTransition;

    const callback = vi.fn();
    startViewTransitionIfSupported(callback);

    // Callback must still be called (graceful degradation)
    expect(callback).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-7: GIVEN ein Browser der document.startViewTransition NICHT unterstuetzt
   *       WHEN der User die Detail-View schliesst (Back/ESC)
   *       THEN kehrt die Gallery-View sofort ohne Animation zurueck
   */
  it('AC-7: should close detail view without animation when startViewTransition is not available', () => {
    // Ensure startViewTransition does NOT exist
    delete (document as any).startViewTransition;

    const closeCallback = vi.fn();
    startViewTransitionIfSupported(closeCallback);

    // Callback must still be called (graceful degradation)
    expect(closeCallback).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-6/7 (additional): Verify graceful degradation when startViewTransition throws
   */
  it('AC-6/7: should fall back to direct callback execution if startViewTransition throws', () => {
    (document as any).startViewTransition = () => {
      throw new Error("ViewTransition failed");
    };

    const callback = vi.fn();
    startViewTransitionIfSupported(callback);

    // Callback must still execute despite the error
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Integration Tests: Full open/close flow with view transitions
// ---------------------------------------------------------------------------

describe("WorkspaceContent — View Transition Integration", () => {
  const completedGen = makeGeneration({
    id: "gen-abc-123",
    status: "completed",
    imageUrl: "https://example.com/gen-abc-123.png",
    prompt: "a beautiful sunset",
  });

  let originalStartViewTransition: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStartViewTransition = (document as any).startViewTransition;
  });

  afterEach(() => {
    if (originalStartViewTransition !== undefined) {
      (document as any).startViewTransition = originalStartViewTransition;
    } else {
      delete (document as any).startViewTransition;
    }
  });

  /**
   * AC-4 (integration): Verify that clicking a gallery card in WorkspaceContent
   * triggers document.startViewTransition and opens the detail view inside the callback.
   */
  it("AC-4: should call startViewTransition when clicking a gallery card to open detail view", async () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
    });
    (document as any).startViewTransition = mockStartViewTransition;

    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Click a gallery card
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // startViewTransition should have been called
    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);

    // Detail view should be open
    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });
  });

  /**
   * AC-5 (integration): Verify that clicking back in the detail view triggers
   * document.startViewTransition for the reverse animation.
   */
  it("AC-5: should call startViewTransition when closing detail view via back button", async () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
    });
    (document as any).startViewTransition = mockStartViewTransition;

    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Open detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });

    // Reset mock to count only the close call
    mockStartViewTransition.mockClear();

    // Click back button
    const backButton = screen.getByTestId("canvas-back-button");
    await user.click(backButton);

    // startViewTransition should have been called for the close transition
    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);

    // Gallery should reappear
    await waitFor(() => {
      expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
    });
  });

  /**
   * AC-5 (ESC integration): Verify that pressing ESC in the detail view triggers
   * document.startViewTransition for the reverse animation.
   */
  it("AC-5: should call startViewTransition when closing detail view via ESC key", async () => {
    const mockStartViewTransition = vi.fn((cb: () => void) => {
      cb();
    });
    (document as any).startViewTransition = mockStartViewTransition;

    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Open detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });

    // Reset mock to count only the close call
    mockStartViewTransition.mockClear();

    // Ensure no input is focused
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      (document.activeElement as HTMLElement).blur();
    }

    // Press ESC
    fireEvent.keyDown(document, { key: "Escape" });

    // startViewTransition should have been called for the close transition
    expect(mockStartViewTransition).toHaveBeenCalledTimes(1);

    // Gallery should reappear
    await waitFor(() => {
      expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
    });
  });

  /**
   * AC-6 (integration): Verify that clicking a gallery card without startViewTransition
   * still opens the detail view (graceful degradation).
   */
  it("AC-6: should open detail view without animation when startViewTransition is not available", async () => {
    // Ensure startViewTransition does NOT exist
    delete (document as any).startViewTransition;

    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Click a gallery card
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    // Detail view should still open (graceful degradation)
    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });
    // Gallery view stays in DOM (hidden, not unmounted) to preserve PromptArea state
    const galleryView = screen.getByTestId("workspace-gallery-view");
    expect(galleryView).toBeInTheDocument();
    expect(galleryView.style.display).toBe("none");
  });

  /**
   * AC-7 (integration): Verify that closing the detail view without startViewTransition
   * still returns to the gallery (graceful degradation).
   */
  it("AC-7: should close detail view without animation when startViewTransition is not available", async () => {
    // Ensure startViewTransition does NOT exist
    delete (document as any).startViewTransition;

    const user = userEvent.setup();
    render(
      <WorkspaceContent
        projectId="project-1"
        initialGenerations={[completedGen]}
      />
    );

    // Open detail view
    const cardButton = screen.getByTestId("gallery-card-gen-abc-123");
    await user.click(cardButton);

    await waitFor(() => {
      expect(screen.getByTestId("workspace-detail-view")).toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByTestId("canvas-back-button");
    await user.click(backButton);

    // Gallery should reappear (graceful degradation)
    await waitFor(() => {
      expect(screen.getByTestId("workspace-gallery-view")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();
  });
});
