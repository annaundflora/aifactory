// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy)
// ---------------------------------------------------------------------------

// Polyfill scrollIntoView for jsdom (used by ChatThread)
Element.prototype.scrollIntoView = vi.fn();

// Mock db/queries to prevent DATABASE_URL error at module scope
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock canvas-chat-service (used by CanvasChatPanel which is rendered as default chatSlot)
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock server actions that reach the database
vi.mock("@/app/actions/generations", () => ({
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
  generateImages: vi.fn().mockResolvedValue([]),
  upscaleImage: vi.fn().mockResolvedValue({}),
  fetchGenerations: vi.fn().mockResolvedValue([]),
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

// Mock lib/utils to avoid real download/image utilities
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock model actions (used by CanvasModelSelector)
vi.mock("@/app/actions/models", () => ({
  getCollectionModels: vi.fn().mockResolvedValue([]),
  checkImg2ImgSupport: vi.fn().mockResolvedValue(true),
}));

// Mock ModelBrowserDrawer (complex external component)
vi.mock("@/components/models/model-browser-drawer", () => ({
  ModelBrowserDrawer: () => null,
}));

// Mock ModelSelector (used by CanvasChatPanel in its header)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => null,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock sonner (used by canvas-toolbar and other canvas components)
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock lucide-react icons used across the canvas component tree.
vi.mock("lucide-react", () => {
  const stub = (name: string) => {
    const Comp = (props: Record<string, unknown>) => (
      <span data-testid={`${name}-icon`} {...props} />
    );
    Comp.displayName = name;
    return Comp;
  };
  return {
    ArrowLeft: stub("ArrowLeft"),
    ArrowUp: stub("ArrowUp"),
    ChevronLeft: stub("ChevronLeft"),
    ChevronRight: stub("ChevronRight"),
    ChevronDown: stub("ChevronDown"),
    Copy: stub("Copy"),
    ArrowRightLeft: stub("ArrowRightLeft"),
    ZoomIn: stub("ZoomIn"),
    Download: stub("Download"),
    Trash2: stub("Trash2"),
    Info: stub("Info"),
    ImageOff: stub("ImageOff"),
    Loader2: stub("Loader2"),
    PanelRightClose: stub("PanelRightClose"),
    PanelRightOpen: stub("PanelRightOpen"),
    MessageSquare: stub("MessageSquare"),
    Minus: stub("Minus"),
    Plus: stub("Plus"),
    Sparkles: stub("Sparkles"),
    Library: stub("Library"),
    Undo2: stub("Undo2"),
    Redo2: stub("Redo2"),
    ChevronUp: stub("ChevronUp"),
    ChevronDownIcon: stub("ChevronDownIcon"),
    ChevronUpIcon: stub("ChevronUpIcon"),
    CheckIcon: stub("CheckIcon"),
  };
});

// Import AFTER mocks
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
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

/**
 * Renders CanvasDetailView wrapped in CanvasDetailProvider (required by the component).
 */
function renderDetailView(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    initialGenerationId?: string;
    toolbarSlot?: React.ReactNode;
    chatSlot?: React.ReactNode;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-abc-123" });
  const allGenerations = options.allGenerations ?? [generation];
  const onBack = options.onBack ?? vi.fn();
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasDetailView
        generation={generation}
        allGenerations={allGenerations}
        onBack={onBack}
        toolbarSlot={options.toolbarSlot}
        chatSlot={options.chatSlot}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-2: GIVEN die CanvasDetailView ist sichtbar
   *       WHEN das Layout geprueft wird
   *       THEN besteht es aus 3 Spalten: Toolbar-Slot links (48px breit),
   *            Canvas-Bereich mitte (flex: 1), Chat-Slot rechts (collapsible, initial sichtbar)
   */
  it("AC-2: should render 3-column layout with toolbar slot, canvas area, and chat slot", () => {
    renderDetailView();

    // The root container should exist
    const detailView = screen.getByTestId("canvas-detail-view");
    expect(detailView).toBeInTheDocument();

    // Toolbar slot (left, 48px = w-12 in tailwind)
    const toolbarSlot = screen.getByTestId("toolbar-slot");
    expect(toolbarSlot).toBeInTheDocument();
    expect(toolbarSlot.tagName).toBe("ASIDE");
    // w-12 = 48px in Tailwind
    expect(toolbarSlot.className).toMatch(/w-12/);
    expect(toolbarSlot.className).toMatch(/shrink-0/);

    // Canvas area (center, flex: 1)
    const canvasArea = screen.getByTestId("canvas-area");
    expect(canvasArea).toBeInTheDocument();
    expect(canvasArea.tagName).toBe("MAIN");
    expect(canvasArea.className).toMatch(/flex-1/);

    // Chat slot (right, collapsible, initially visible)
    const chatSlot = screen.getByTestId("chat-slot");
    expect(chatSlot).toBeInTheDocument();
    expect(chatSlot.tagName).toBe("ASIDE");
  });

  /**
   * AC-8: GIVEN die CanvasDetailView ist sichtbar
   *       WHEN der Canvas-Bereich (mittlere Spalte) geprueft wird
   *       THEN zeigt er das Bild der aktuellen currentGenerationId aus dem Context zentriert an (max-fit)
   */
  it("AC-8: should display the current generation image centered in the canvas area", () => {
    const generation = makeGeneration({
      id: "gen-img-test",
      imageUrl: "https://example.com/current-image.png",
      prompt: "beautiful landscape",
    });

    renderDetailView({
      generation,
      allGenerations: [generation],
      initialGenerationId: "gen-img-test",
    });

    // The image should be rendered in the canvas area
    const canvasImage = screen.getByTestId("canvas-image");
    expect(canvasImage).toBeInTheDocument();
    expect(canvasImage).toHaveAttribute(
      "src",
      "https://example.com/current-image.png"
    );
    expect(canvasImage).toHaveAttribute("alt", "beautiful landscape");

    // Image uses object-contain for max-fit display
    expect(canvasImage.className).toMatch(/object-contain/);

    // The image's parent wrapper uses centering classes
    const innerWrapper = canvasImage.closest("div");
    expect(innerWrapper).not.toBeNull();
    expect(innerWrapper!.className).toMatch(/items-center/);
    expect(innerWrapper!.className).toMatch(/justify-center/);
  });

  /**
   * AC-8 (context matching): GIVEN multiple generations and a specific currentGenerationId
   *       WHEN the canvas area is rendered
   *       THEN the image matching currentGenerationId from context is displayed
   */
  it("AC-8: should display the image matching the currentGenerationId from context", () => {
    const gen1 = makeGeneration({
      id: "gen-1",
      imageUrl: "https://example.com/img1.png",
      prompt: "first image",
    });
    const gen2 = makeGeneration({
      id: "gen-2",
      imageUrl: "https://example.com/img2.png",
      prompt: "second image",
    });

    renderDetailView({
      generation: gen1,
      allGenerations: [gen1, gen2],
      initialGenerationId: "gen-2",
    });

    // The image displayed should be gen-2 (matching the context's currentGenerationId)
    const canvasImage = screen.getByTestId("canvas-image");
    expect(canvasImage).toHaveAttribute(
      "src",
      "https://example.com/img2.png"
    );
    expect(canvasImage).toHaveAttribute("alt", "second image");
  });
});
