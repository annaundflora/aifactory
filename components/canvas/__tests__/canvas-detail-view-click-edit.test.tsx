// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix AlertDialog, Popover, Tooltip internals)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number = 0;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec — SAM API Route via fetch-Mock,
// MaskCanvas-Rendering gemockt, CanvasDetailContext gemockt via real provider)
// ---------------------------------------------------------------------------

// Stable crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
});

// Mock lucide-react icons
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
    PanelLeftOpen: stub("PanelLeftOpen"), Paintbrush: stub("Paintbrush"),
    Eraser: stub("Eraser"), MousePointerClick: stub("MousePointerClick"),
    Expand: stub("Expand"),
  };
});

// Mock model selector
vi.mock("@/components/assistant/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector-mock" />,
  DEFAULT_MODEL_SLUG: "anthropic/claude-sonnet-4.6",
}));

// Mock canvas-chat-service
vi.mock("@/lib/canvas-chat-service", () => ({
  createSession: vi.fn().mockResolvedValue("test-session-id"),
  sendMessage: vi.fn(),
}));

// Mock generateImages server action
const mockGenerateImages = vi.fn().mockResolvedValue([]);
const mockFetchGenerations = vi.fn().mockResolvedValue([]);

vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
  upscaleImage: vi.fn().mockResolvedValue({}),
  fetchGenerations: (...args: unknown[]) => mockFetchGenerations(...args),
  deleteGeneration: vi.fn().mockResolvedValue({ success: true }),
  getSiblingGenerations: vi.fn().mockResolvedValue([]),
}));

// Mock uploadMask server action
vi.mock("@/app/actions/upload", () => ({
  uploadMask: vi.fn().mockResolvedValue({ url: "https://r2.example.com/masks/uploaded-mask.png" }),
}));

// Mock MaskService functions
vi.mock("@/lib/services/mask-service", () => ({
  validateMinSize: vi.fn().mockReturnValue({ valid: true, boundingBox: { width: 50, height: 50 } }),
  applyFeathering: vi.fn().mockImplementation((imageData: ImageData) => imageData),
  scaleToOriginal: vi.fn().mockImplementation((imageData: ImageData) => imageData),
  toGrayscalePng: vi.fn().mockResolvedValue(new Blob(["mock-png"], { type: "image/png" })),
}));

// Mock sonner toast
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

// Mock model-slots server action
vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: vi.fn().mockResolvedValue([]),
}));

// Mock model actions
vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
  getModelSchema: vi.fn().mockResolvedValue({ properties: {} }),
}));

// Mock references server action
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: vi.fn().mockResolvedValue([]),
  uploadReferenceImage: vi.fn().mockResolvedValue({ id: "ref-1", imageUrl: "https://example.com/ref.png" }),
  addGalleryAsReference: vi.fn().mockResolvedValue({ id: "gallery-ref-1" }),
}));

// Mock lib/utils
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("image.png"),
}));

// Mock db/queries to prevent DATABASE_URL error
vi.mock("@/lib/db/queries", () => ({
  updateProjectThumbnail: vi.fn(),
}));

// Mock model settings
vi.mock("@/app/actions/model-settings", () => ({
  getModelSettings: vi.fn().mockResolvedValue([]),
}));

// Mock resolve-model utility
vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: vi.fn().mockReturnValue([]),
}));

// Mock MaskCanvas to prevent jsdom canvas context errors (spec: MaskCanvas-Rendering gemockt)
vi.mock("@/components/canvas/mask-canvas", () => ({
  MaskCanvas: (props: Record<string, unknown>) => <div data-testid="mask-canvas-mock" />,
}));

// Mock OutpaintControls
vi.mock("@/components/canvas/outpaint-controls", () => ({
  OutpaintControls: () => <div data-testid="outpaint-controls-mock" />,
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import { type Generation } from "@/lib/db/queries";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-click-edit-1",
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

/**
 * Creates a fake ImageData-like object for use in tests.
 * jsdom does not provide ImageData natively, so we construct one manually.
 */
function createFakeImageData(width: number, height: number, fillAlpha = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;     // R
    data[i + 1] = 255; // G
    data[i + 2] = 255; // B
    data[i + 3] = fillAlpha; // A
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

/**
 * Helper component that sets activeToolId, maskData, and editMode in context on mount.
 * The component under test checks `state.activeToolId === "click-edit"` so we must
 * dispatch SET_ACTIVE_TOOL (not just SET_EDIT_MODE).
 */
function SetContextHelper({
  activeToolId,
  maskData,
  editMode,
}: {
  activeToolId?: string;
  maskData?: ImageData | null;
  editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
}) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    if (activeToolId !== undefined) {
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: activeToolId });
    }
    if (editMode !== undefined) {
      dispatch({ type: "SET_EDIT_MODE", editMode });
    }
    if (maskData !== undefined) {
      dispatch({ type: "SET_MASK_DATA", maskData });
    }
  }, [dispatch, activeToolId, maskData, editMode]);
  return null;
}

/**
 * Spy component that captures current state for assertion.
 */
function StateSpy({ onState }: { onState: (state: ReturnType<typeof useCanvasDetail>["state"]) => void }) {
  const { state } = useCanvasDetail();
  useEffect(() => {
    onState(state);
  });
  return null;
}

/**
 * Mocks getBoundingClientRect and clientWidth/clientHeight on the canvas-image
 * element that CanvasImage renders. Must be called after render.
 */
function mockImageElementGeometry() {
  const imgEl = document.querySelector('[data-testid="canvas-image"]');
  if (imgEl) {
    vi.spyOn(imgEl, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 512, bottom: 512, width: 512, height: 512,
      x: 0, y: 0, toJSON: () => ({}),
    });
    Object.defineProperty(imgEl, "clientWidth", { value: 512, configurable: true });
    Object.defineProperty(imgEl, "clientHeight", { value: 512, configurable: true });
  }
}

/**
 * Renders CanvasDetailView wrapped in CanvasDetailProvider with context helpers.
 */
function renderDetailViewWithContext(
  options: {
    generation?: Generation;
    allGenerations?: Generation[];
    onBack?: () => void;
    onGenerationsCreated?: (gens: Generation[]) => void;
    activeToolId?: string;
    maskData?: ImageData | null;
    editMode?: "inpaint" | "erase" | "instruction" | "outpaint" | null;
    onState?: (state: ReturnType<typeof useCanvasDetail>["state"]) => void;
  } = {}
) {
  const generation = options.generation ?? makeGeneration();
  const allGenerations = options.allGenerations ?? [generation];
  const onBack = options.onBack ?? vi.fn();

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetContextHelper
        activeToolId={options.activeToolId}
        maskData={options.maskData}
        editMode={options.editMode}
      />
      {options.onState && <StateSpy onState={options.onState} />}
      <CanvasDetailView
        generation={generation}
        allGenerations={allGenerations}
        onBack={onBack}
        onGenerationsCreated={options.onGenerationsCreated}
        chatSlot={<div data-testid="chat-slot-stub" />}
      />
    </CanvasDetailProvider>
  );

  // After render, mock image geometry so click handlers can compute coordinates
  mockImageElementGeometry();

  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasDetailView — Click-to-Edit (Slice 11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    // Reset global fetch mock
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // AC-1: Crosshair-Cursor und kein Overlay bei click-edit Mode
  // =========================================================================

  /**
   * AC-1: GIVEN `editMode` ist `"click-edit"` im CanvasDetailState
   *       WHEN die Canvas-Image-Area gerendert wird
   *       THEN hat das Bild-Element `cursor: crosshair` als CSS-Style
   *       AND die Floating Brush Toolbar ist NICHT sichtbar
   *       AND kein Mask-Overlay ist aktiv (solange kein Klick erfolgt ist)
   */
  it("AC-1: should show crosshair cursor and hide floating toolbar when editMode is click-edit", async () => {
    renderDetailViewWithContext({
      activeToolId: "click-edit",
    });

    await waitFor(() => {
      const imageArea = screen.getByTestId("canvas-image-area");
      expect(imageArea).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // THEN: cursor: crosshair on the image area
    expect(imageArea.style.cursor).toBe("crosshair");

    // AND: Floating Brush Toolbar is NOT visible
    const floatingToolbar = screen.queryByTestId("floating-brush-toolbar");
    expect(floatingToolbar).not.toBeInTheDocument();

    // AND: no SAM loading overlay visible (no click happened yet)
    const samOverlay = screen.queryByTestId("sam-loading-overlay");
    expect(samOverlay).not.toBeInTheDocument();
  });

  /**
   * AC-1 (negative): GIVEN `editMode` is NOT `"click-edit"`
   *       WHEN the Canvas-Image-Area is rendered
   *       THEN cursor is NOT crosshair
   */
  it("AC-1 (negative): should NOT show crosshair cursor when editMode is not click-edit", async () => {
    renderDetailViewWithContext({
      activeToolId: undefined,
    });

    await waitFor(() => {
      const imageArea = screen.getByTestId("canvas-image-area");
      expect(imageArea).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");
    expect(imageArea.style.cursor).not.toBe("crosshair");
  });

  // =========================================================================
  // AC-2: Klick auf Bild berechnet normalisierte Koordinaten und ruft SAM API
  // =========================================================================

  /**
   * AC-2: GIVEN `editMode` ist `"click-edit"` und `maskData` ist `null`
   *       WHEN der User auf das Bild klickt bei Position (clientX, clientY)
   *       THEN werden normalisierte Koordinaten berechnet als
   *            `click_x = offsetX / imageDisplayWidth`, `click_y = offsetY / imageDisplayHeight`
   *       AND `POST /api/sam/segment` wird aufgerufen mit `{ image_url, click_x, click_y }`
   */
  it("AC-2: should calculate normalized coordinates and call POST /api/sam/segment on image click", async () => {
    // Setup: mock fetch to resolve with a mask URL
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ mask_url: "https://example.com/mask.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Simulate click at (256, 256) — on an image at (0,0) with 512x512 dimensions
    // this gives normalized coords (0.5, 0.5)
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: POST /api/sam/segment called with normalized coordinates
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sam/segment",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: "https://example.com/image.png",
            click_x: 0.5,
            click_y: 0.5,
          }),
        })
      );
    });
  });

  // =========================================================================
  // AC-3: Loading-Spinner waehrend SAM-Call, weitere Klicks ignoriert
  // =========================================================================

  /**
   * AC-3: GIVEN der SAM-API-Call laeuft (fetch pending)
   *       WHEN der Loading-State aktiv ist
   *       THEN wird ein Loading-Spinner ueber dem Bild angezeigt
   *       AND weitere Klicks auf das Bild werden ignoriert (Click-Handler deaktiviert)
   */
  it("AC-3: should show loading spinner and ignore clicks while SAM request is pending", async () => {
    // Setup: fetch that never resolves (simulates pending request)
    let resolveFetch: ((value: Response) => void) | undefined;
    const pendingFetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(
      pendingFetchPromise as Promise<Response>
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click to trigger SAM call
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: loading spinner visible
    await waitFor(() => {
      expect(screen.getByTestId("sam-loading-overlay")).toBeInTheDocument();
    });

    // AND: second click should be ignored (fetch called only once)
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 100, clientY: 100 });
    });

    // fetch should have been called exactly once (second click ignored)
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Cleanup: resolve the pending fetch to avoid hanging promise
    resolveFetch?.(
      new Response(JSON.stringify({ mask_url: "https://example.com/mask.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  // =========================================================================
  // AC-4: SAM-Erfolg rendert Mask-Overlay und wechselt zu inpaint Mode
  // =========================================================================

  /**
   * AC-4: GIVEN `POST /api/sam/segment` antwortet mit HTTP 200 und `{ mask_url: "<URL>" }`
   *       WHEN die Response verarbeitet wird
   *       THEN wird die Mask-PNG von `mask_url` geladen und als rotes Semi-Transparent-Overlay
   *            (50% Opacity) im MaskCanvas gerendert
   *       AND `SET_MASK_DATA` wird mit der geladenen ImageData dispatched
   *       AND `SET_EDIT_MODE` wird mit `"inpaint"` dispatched
   *       AND die Floating Brush Toolbar erscheint
   */
  it("AC-4: should render mask overlay and dispatch SET_EDIT_MODE inpaint on SAM 200 response", async () => {
    // Track state changes
    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    // Mock fetch to return mask_url
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ mask_url: "https://example.com/mask.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    // Mock Image constructor for mask loading (loadMaskImageData uses new Image())
    const originalImage = globalThis.Image;
    vi.stubGlobal("Image", class MockImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 64;
      height = 64;
      private _src = "";
      get src() { return this._src; }
      set src(val: string) {
        this._src = val;
        // Trigger onload asynchronously after src is set
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    });

    // Mock createElement("canvas") for the offscreen canvas used to read mask pixels
    const mockCanvasCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(createFakeImageData(64, 64)),
    };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string, options?: ElementCreationOptions) => {
      if (tag === "canvas") {
        const fakeCanvas = originalCreateElement("canvas");
        vi.spyOn(fakeCanvas, "getContext").mockReturnValue(mockCanvasCtx as unknown as CanvasRenderingContext2D);
        return fakeCanvas;
      }
      return originalCreateElement(tag, options);
    });

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
      onState: (state) => {
        latestState = state;
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click image to trigger SAM
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // Wait for async flow to complete: fetch -> Image load -> dispatch
    await waitFor(() => {
      expect(latestState?.editMode).toBe("inpaint");
    }, { timeout: 3000 });

    // THEN: SET_MASK_DATA was dispatched (maskData is not null)
    expect(latestState?.maskData).not.toBeNull();

    // AND: SET_EDIT_MODE dispatched with "inpaint"
    expect(latestState?.editMode).toBe("inpaint");

    // AND: loading spinner is gone
    expect(screen.queryByTestId("sam-loading-overlay")).not.toBeInTheDocument();

    // Restore mocks before cleanup triggers React unmount (which uses createElement)
    vi.stubGlobal("Image", originalImage);
    vi.mocked(document.createElement).mockRestore();
  });

  // =========================================================================
  // AC-5: Confirmation-Dialog wenn maskData bereits vorhanden
  // =========================================================================

  /**
   * AC-5: GIVEN `editMode` ist `"click-edit"` und `maskData` ist NICHT `null`
   *       WHEN der User auf das Bild klickt
   *       THEN erscheint ein Confirmation-Dialog mit Text
   *            "Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?"
   *            und Buttons [Abbrechen] [Ersetzen]
   */
  it("AC-5: should show confirmation dialog when clicking image with existing maskData", async () => {
    const fakeMask = createFakeImageData(64, 64);

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: fakeMask,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click image with existing mask
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: Confirmation dialog appears with correct text
    await waitFor(() => {
      expect(
        screen.getByText("Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?")
      ).toBeInTheDocument();
    });

    // AND: Buttons "Abbrechen" and "Ersetzen" are present
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ersetzen" })).toBeInTheDocument();
  });

  // =========================================================================
  // AC-6: Ersetzen-Button im Dialog verwirft Maske und startet SAM-Call
  // =========================================================================

  /**
   * AC-6: GIVEN der Confirmation-Dialog ist sichtbar
   *       WHEN der User "Ersetzen" klickt
   *       THEN wird die bestehende Maske verworfen, `SET_MASK_DATA` mit `null` dispatched
   *       AND der SAM-API-Call wird mit den Klick-Koordinaten ausgefuehrt (wie AC-2)
   */
  it("AC-6: should clear mask and trigger SAM call when user confirms replacement", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(64, 64);

    // Mock fetch for SAM call
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ mask_url: "https://example.com/mask.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: fakeMask,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click to show confirmation dialog
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ersetzen" })).toBeInTheDocument();
    });

    // Click "Ersetzen" button
    await user.click(screen.getByRole("button", { name: "Ersetzen" }));

    // THEN: SAM API was called (mask cleared + SAM call triggered)
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/sam/segment",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    // AND: Dialog is closed
    expect(
      screen.queryByText("Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?")
    ).not.toBeInTheDocument();
  });

  // =========================================================================
  // AC-7: Abbrechen-Button im Dialog behaelt Maske ohne SAM-Call
  // =========================================================================

  /**
   * AC-7: GIVEN der Confirmation-Dialog ist sichtbar
   *       WHEN der User "Abbrechen" klickt
   *       THEN bleibt die bestehende Maske erhalten
   *       AND kein SAM-API-Call wird ausgefuehrt
   */
  it("AC-7: should keep existing mask and skip SAM call when user cancels", async () => {
    const user = userEvent.setup();
    const fakeMask = createFakeImageData(64, 64);

    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ mask_url: "https://example.com/mask.png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: fakeMask,
      onState: (state) => {
        latestState = state;
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click to show confirmation dialog
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    });

    // Click "Abbrechen"
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    // THEN: no SAM API call was made
    expect(fetchSpy).not.toHaveBeenCalled();

    // AND: mask data is still in state (not cleared)
    expect(latestState?.maskData).not.toBeNull();

    // AND: dialog is closed
    await waitFor(() => {
      expect(
        screen.queryByText("Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?")
      ).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // AC-8: HTTP 422 zeigt Kein-Objekt-Toast und bleibt in click-edit Mode
  // =========================================================================

  /**
   * AC-8: GIVEN `POST /api/sam/segment` antwortet mit HTTP 422 (kein Objekt erkannt)
   *       WHEN die Error-Response verarbeitet wird
   *       THEN wird ein Error-Toast angezeigt mit Text
   *            "Kein Objekt erkannt. Versuche einen anderen Punkt."
   *       AND der `editMode` bleibt auf `"click-edit"` (User kann erneut klicken)
   *       AND kein Loading-Spinner ist sichtbar
   */
  it("AC-8: should show no-object-found toast on 422 and stay in click-edit mode", async () => {
    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    // Mock fetch to return 422
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "No object detected" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
      onState: (state) => {
        latestState = state;
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click image to trigger SAM call
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: Error toast with correct message
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Kein Objekt erkannt. Versuche einen anderen Punkt."
      );
    });

    // AND: activeToolId is still "click-edit"
    expect(latestState?.activeToolId).toBe("click-edit");

    // AND: no loading spinner
    expect(screen.queryByTestId("sam-loading-overlay")).not.toBeInTheDocument();
  });

  // =========================================================================
  // AC-9: HTTP 502 / Netzwerkfehler zeigt SAM-Fehler-Toast
  // =========================================================================

  /**
   * AC-9: GIVEN `POST /api/sam/segment` antwortet mit HTTP 502 oder Netzwerk-Fehler
   *       WHEN die Error-Response verarbeitet wird
   *       THEN wird ein Error-Toast angezeigt mit Text
   *            "SAM-Fehler. Versuche manuelles Maskieren."
   *       AND der `editMode` bleibt auf `"click-edit"`
   */
  it("AC-9: should show SAM error toast on 502 and stay in click-edit mode", async () => {
    let latestState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

    // Mock fetch to return 502
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Gateway", {
        status: 502,
      })
    );

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
      onState: (state) => {
        latestState = state;
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click image
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: Error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "SAM-Fehler. Versuche manuelles Maskieren."
      );
    });

    // AND: activeToolId still "click-edit"
    expect(latestState?.activeToolId).toBe("click-edit");
  });

  /**
   * AC-9 (network error variant): GIVEN fetch throws a network error
   *       WHEN the error is processed
   *       THEN shows the SAM error toast
   */
  it("AC-9 (network error): should show SAM error toast on network failure", async () => {
    // Mock fetch to throw network error
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    renderDetailViewWithContext({
      activeToolId: "click-edit",
      maskData: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("canvas-image-area")).toBeInTheDocument();
    });

    const imageArea = screen.getByTestId("canvas-image-area");

    // Click image
    await act(async () => {
      fireEvent.click(imageArea, { clientX: 256, clientY: 256 });
    });

    // THEN: SAM error toast
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "SAM-Fehler. Versuche manuelles Maskieren."
      );
    });

    // AND: no loading spinner
    expect(screen.queryByTestId("sam-loading-overlay")).not.toBeInTheDocument();
  });
});
