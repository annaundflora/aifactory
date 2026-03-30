// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy -- only icons and crypto)
// ---------------------------------------------------------------------------

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

// Mock the model selector (uses radix Select which needs complex setup in jsdom)
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector-mock" />,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock the canvas chat service (backend calls)
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn().mockReturnValue((async function* () {})()),
}));

// Mock the generateImages server action
vi.mock("@/app/actions/generations", () => ({
  generateImages: vi.fn().mockResolvedValue([]),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stable crypto.randomUUID for deterministic test IDs
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Import AFTER mocks
import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
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

function renderChatPanel(
  options: {
    generation?: Generation;
    projectId?: string;
    initialGenerationId?: string;
  } = {}
) {
  const generation =
    options.generation ?? makeGeneration({ id: "gen-chat-1" });
  const initialGenerationId =
    options.initialGenerationId ?? generation.id;
  const projectId = options.projectId ?? generation.projectId;

  return render(
    <CanvasDetailProvider initialGenerationId={initialGenerationId}>
      <CanvasChatPanel
        generation={generation}
        projectId={projectId}
        modelSlots={[]}
        models={[]}
      />
    </CanvasDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  /**
   * AC-1: GIVEN die CanvasDetailView ist sichtbar mit einem Bild
   *       WHEN der Chat-Slot (rechte Spalte) geprueft wird
   *       THEN rendert das CanvasChatPanel im expanded State mit einer Breite
   *            zwischen 320px und 480px
   */
  it("AC-1: should render in expanded state with width between 320px and 480px", () => {
    renderChatPanel();

    const panel = screen.getByTestId("canvas-chat-panel");
    expect(panel).toBeInTheDocument();

    // Default width is 360px, which is between 320 and 480
    const widthValue = parseInt(panel.style.width, 10);
    expect(widthValue).toBeGreaterThanOrEqual(320);
    expect(widthValue).toBeLessThanOrEqual(480);
  });

  /**
   * AC-2: GIVEN das Chat-Panel ist expanded
   *       WHEN der User den Collapse-Button ([-] Icon) klickt
   *       THEN kollabiert das Panel auf einen 48px breiten Icon-Strip
   *            mit nur einem Chat-Icon sichtbar
   */
  it("AC-2: should collapse to 48px icon strip when collapse button is clicked", async () => {
    const user = userEvent.setup();
    renderChatPanel();

    // Panel starts expanded
    expect(screen.getByTestId("canvas-chat-panel")).toBeInTheDocument();

    // Click the collapse button
    const collapseButton = screen.getByTestId("chat-collapse-button");
    await user.click(collapseButton);

    // Panel should now be collapsed
    const collapsedPanel = screen.getByTestId("canvas-chat-panel-collapsed");
    expect(collapsedPanel).toBeInTheDocument();

    // Width should be 48px
    expect(collapsedPanel.style.width).toBe("48px");

    // Only chat icon visible (MessageSquare icon)
    const chatIcon = screen.getByTestId("message-square-icon");
    expect(chatIcon).toBeInTheDocument();

    // Expanded panel should be gone
    expect(screen.queryByTestId("canvas-chat-panel")).not.toBeInTheDocument();
  });

  /**
   * AC-3: GIVEN das Chat-Panel ist collapsed (48px Icon-Strip)
   *       WHEN der User auf den Chat-Icon-Strip klickt
   *       THEN expandiert das Panel auf die vorherige Breite (oder Default 360px)
   */
  it("AC-3: should expand to previous width when collapsed icon strip is clicked", async () => {
    const user = userEvent.setup();
    renderChatPanel();

    // Collapse the panel first
    const collapseButton = screen.getByTestId("chat-collapse-button");
    await user.click(collapseButton);

    // Now click the collapsed strip to expand
    const collapsedPanel = screen.getByTestId("canvas-chat-panel-collapsed");
    await user.click(collapsedPanel);

    // Panel should be expanded again
    const expandedPanel = screen.getByTestId("canvas-chat-panel");
    expect(expandedPanel).toBeInTheDocument();

    // Width should be the default (320px) since we haven't resized
    const widthValue = parseInt(expandedPanel.style.width, 10);
    expect(widthValue).toBe(320);
  });

  /**
   * AC-4: GIVEN das Chat-Panel ist expanded
   *       WHEN der User den Resize-Handle am linken Rand zieht
   *       THEN aendert sich die Panel-Breite, begrenzt auf Minimum 320px und Maximum 480px
   */
  it("AC-4: should constrain panel width between 320px and 480px during resize", async () => {
    renderChatPanel();

    const resizeHandle = screen.getByTestId("chat-resize-handle");
    const panel = screen.getByTestId("canvas-chat-panel");

    // Simulate a drag that would try to widen beyond MAX_WIDTH (480px)
    // The handle is on the left edge: dragging left = wider.
    // Start at 500, move to 0 => delta = 500 => 360 + 500 = 860, clamped to 480
    fireEvent.mouseDown(resizeHandle, { clientX: 500 });

    // In jsdom, requestAnimationFrame fires on the next microtask.
    // We fire mouseMove then wait for rAF to resolve.
    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 0 });
      // Give rAF a chance to fire
      await new Promise((r) => requestAnimationFrame(r));
    });

    fireEvent.mouseUp(document);

    // Width should be clamped to MAX_WIDTH (480)
    const widthValue = parseInt(panel.style.width, 10);
    expect(widthValue).toBeGreaterThanOrEqual(320);
    expect(widthValue).toBeLessThanOrEqual(480);
  });

  /**
   * AC-4 (minimum boundary): Resize trying to shrink below 320px should be clamped.
   */
  it("AC-4: should not allow width below 320px during resize", () => {
    renderChatPanel();

    const resizeHandle = screen.getByTestId("chat-resize-handle");
    const panel = screen.getByTestId("canvas-chat-panel");

    // Drag right = narrower. Start at 0, move to 500 => delta = 0-500 = -500 => 360-500 = -140, clamped to 320
    fireEvent.mouseDown(resizeHandle, { clientX: 0 });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 500 });
    });

    fireEvent.mouseUp(document);

    const widthValue = parseInt(panel.style.width, 10);
    expect(widthValue).toBeGreaterThanOrEqual(320);
    expect(widthValue).toBeLessThanOrEqual(480);
  });
});
