// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }

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

// Mock db/queries to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock db/index to prevent DATABASE_URL error from reference-service transitive imports
vi.mock("@/lib/db/index", () => ({
  db: {},
}));

// Mock reference-service to prevent DATABASE_URL crash
vi.mock("@/lib/services/reference-service", () => ({
  ReferenceService: {
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

// Mock references actions (depends on reference-service)
vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  deleteReferenceImage: vi.fn().mockResolvedValue(undefined),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
}));

// Mock server action (external)
vi.mock("@/app/actions/generations", () => ({
  fetchGenerations: vi.fn().mockResolvedValue([]),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
  generateImages: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn().mockResolvedValue({}),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock model actions (used by CanvasModelSelector)
vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock ModelBrowserDrawer
vi.mock("@/components/models/model-browser-drawer", () => ({
  ModelBrowserDrawer: () => null,
}));

// Mock lib/utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock workspace-state (needed by PromptAssistantProvider -> useWorkspaceVariation)
vi.mock("@/lib/workspace-state", () => ({
  useWorkspaceVariation: () => ({
    variationData: null,
    setVariation: vi.fn(),
    clearVariation: vi.fn(),
  }),
  useWorkspaceVariationOptional: () => null,
  WorkspaceStateProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock assistant context (needed by AssistantPanelContent)
vi.mock("@/lib/assistant/assistant-context", () => ({
  PromptAssistantProvider: ({ children }: { children: React.ReactNode }) => children,
  usePromptAssistant: () => ({
    messages: [],
    isStreaming: false,
    hasCanvas: false,
    selectedModel: "gpt-4",
    setSelectedModel: vi.fn(),
    cancelStream: vi.fn(),
    activeView: "startscreen" as const,
    setActiveView: vi.fn(),
    loadSession: vi.fn(),
    sessionId: null,
    dispatch: vi.fn(),
    sessionIdRef: { current: null },
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
  }),
  getWorkspaceFieldsForChip: () => null,
}));

vi.mock("@/lib/assistant/use-assistant-runtime", () => ({
  useAssistantRuntime: () => ({
    sendMessage: vi.fn(),
  }),
}));

vi.mock("@/lib/assistant/use-sessions", () => ({
  useSessions: () => ({
    sessions: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock assistant panel component (prevent deep import chains)
vi.mock("@/components/assistant/assistant-panel", () => ({
  AssistantPanelContent: () => null,
}));

// Mock upload action (used by assistant chat-input)
vi.mock("@/app/actions/upload", () => ({
  uploadSourceImage: vi.fn().mockResolvedValue({ url: "https://r2.example.com/uploaded.png" }),
}));

// Mock model-settings (used by PromptArea)
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([]),
}));

// Mock snippet-service to prevent DATABASE_URL crash
vi.mock("@/lib/services/snippet-service", () => ({
  SnippetService: {
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    getAll: vi.fn().mockResolvedValue({}),
  },
}));

// Mock storage client
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn().mockResolvedValue("https://r2.example.com/uploaded.png"),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock lucide-react icons used across the component tree
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
    PanelLeftOpen: stub("PanelLeftOpen"),
  };
});

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
    batchId: overrides.batchId ?? null,
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

    // Gallery should be hidden (display: none, not unmounted, to preserve PromptArea state)
    await waitFor(() => {
      const galleryView = screen.getByTestId("workspace-gallery-view");
      expect(galleryView).toHaveStyle({ display: "none" });
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
    // Gallery is hidden (not unmounted) when detail view is open
    expect(screen.getByTestId("workspace-gallery-view")).toHaveStyle({ display: "none" });

    // Click the back button in the header
    const backButton = screen.getByTestId("canvas-back-button");
    await user.click(backButton);

    // Gallery should reappear (visible, no display:none)
    await waitFor(() => {
      const galleryView = screen.getByTestId("workspace-gallery-view");
      expect(galleryView).not.toHaveStyle({ display: "none" });
    });
    expect(screen.getByTestId("prompt-area")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-grid")).toBeInTheDocument();

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

    // Gallery should reappear (visible, no display:none)
    await waitFor(() => {
      const galleryView = screen.getByTestId("workspace-gallery-view");
      expect(galleryView).not.toHaveStyle({ display: "none" });
    });

    // Detail view should be gone
    expect(screen.queryByTestId("workspace-detail-view")).not.toBeInTheDocument();
  });
});
