// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfill ImageData for jsdom (not natively available)
// ---------------------------------------------------------------------------

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace = "srgb";

    constructor(sw: number | Uint8ClampedArray, sh?: number, settings?: ImageDataSettings) {
      if (typeof sw === "number") {
        this.width = sw;
        this.height = sh!;
        this.data = new Uint8ClampedArray(sw * sh! * 4);
      } else {
        // sw is Uint8ClampedArray
        this.data = sw;
        this.width = sh!;
        this.height = sw.length / (sh! * 4);
      }
      if (settings?.colorSpace) {
        this.colorSpace = settings.colorSpace;
      }
    }
  } as unknown as typeof ImageData;
}

// ---------------------------------------------------------------------------
// Hoisted mock values (available before vi.mock factories execute)
// ---------------------------------------------------------------------------

const { mockDispatch, mockState } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockState: {
    currentGenerationId: "gen-1",
    lastImageChangeSource: null as string | null,
    activeToolId: null as string | null,
    undoStack: [] as string[],
    redoStack: [] as string[],
    isGenerating: false,
    chatSessionId: null as string | null,
    editMode: "inpaint" as string | null,
    maskData: null as InstanceType<typeof ImageData> | null,
    brushSize: 40,
    brushTool: "brush" as "brush" | "eraser",
    outpaintDirections: [] as string[],
    outpaintSize: 50 as number,
  },
}));

// ---------------------------------------------------------------------------
// Canvas 2D Context mock (mock_external strategy per spec)
// ---------------------------------------------------------------------------

function createMockContext2D(): Record<string, unknown> {
  return {
    // State
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",

    // Path methods
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),

    // State stack
    save: vi.fn(),
    restore: vi.fn(),

    // Rect
    clearRect: vi.fn(),

    // Image data
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      return new ImageData(w, h);
    }),
    putImageData: vi.fn(),

    // Drawing
    drawImage: vi.fn(),
  };
}

// Store references to created contexts for assertions
let maskCtx: ReturnType<typeof createMockContext2D>;
let cursorCtx: ReturnType<typeof createMockContext2D>;

// ---------------------------------------------------------------------------
// Mock HTMLCanvasElement.getContext -- assign context by data-testid attribute
// ---------------------------------------------------------------------------

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const contextMap = new WeakMap<HTMLCanvasElement, ReturnType<typeof createMockContext2D>>();

function installCanvasMock() {
  maskCtx = createMockContext2D();
  cursorCtx = createMockContext2D();

  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === "2d") {
      if (!contextMap.has(this)) {
        // Assign context based on data-testid to avoid order-of-call issues.
        // The component sets data-testid="mask-canvas" and
        // data-testid="mask-canvas-cursor" on its two canvas elements.
        const testId = this.getAttribute("data-testid");
        if (testId === "mask-canvas") {
          contextMap.set(this, maskCtx);
        } else if (testId === "mask-canvas-cursor") {
          contextMap.set(this, cursorCtx);
        } else {
          // Temp canvases created via document.createElement('canvas')
          // (e.g. for resize data preservation) get a fresh context.
          contextMap.set(this, createMockContext2D());
        }
      }
      return contextMap.get(this) as unknown as CanvasRenderingContext2D;
    }
    return null as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

function uninstallCanvasMock() {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
}

// ---------------------------------------------------------------------------
// Mock ResizeObserver
// ---------------------------------------------------------------------------

let resizeObserverCallback: ResizeObserverCallback | null = null;

class MockResizeObserver implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/canvas-detail-context", () => ({
  useCanvasDetail: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// Import AFTER mocks
import { MaskCanvas } from "@/components/canvas/mask-canvas";
import React from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMockState(overrides: Partial<typeof mockState> = {}) {
  Object.assign(mockState, {
    currentGenerationId: "gen-1",
    lastImageChangeSource: null,
    activeToolId: null,
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    chatSessionId: null,
    editMode: "inpaint",
    maskData: null,
    brushSize: 40,
    brushTool: "brush",
    outpaintDirections: [],
    outpaintSize: 50,
    ...overrides,
  });
}

/**
 * Creates a fake image element ref with configurable bounding rect.
 * The image element is appended to document.body so DOM queries work.
 */
function createImageRef(
  width = 512,
  height = 512
): React.RefObject<HTMLImageElement | null> {
  const img = document.createElement("img");
  img.setAttribute("data-testid", "canvas-image");
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  document.body.appendChild(img);

  // Override getBoundingClientRect to return predictable values
  img.getBoundingClientRect = () => ({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  return { current: img };
}

// ---------------------------------------------------------------------------
// Test Suite: Acceptance Tests
// ---------------------------------------------------------------------------

describe("MaskCanvas Acceptance Tests", () => {
  let imageRef: React.RefObject<HTMLImageElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
    installCanvasMock();
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    imageRef = createImageRef(512, 512);
  });

  afterEach(() => {
    cleanup();
    uninstallCanvasMock();
    resizeObserverCallback = null;
    // Remove any stale DOM elements from the body
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // AC-1: Canvas-Dimensionen matchen Bild
  // =========================================================================

  /**
   * AC-1: GIVEN das MaskCanvas-Component wird mit einer Bild-Referenz gerendert
   *       WHEN das Component im DOM erscheint
   *       THEN hat das <canvas>-Element exakt die gleiche Breite und Hoehe (in px)
   *            wie das darunterliegende Bild-Element
   *       AND das Canvas ist absolut positioniert ueber dem Bild
   *            (position: absolute, top: 0, left: 0)
   */
  it("AC-1: should render canvas with same dimensions as the image element", () => {
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    expect(canvas).toBeInTheDocument();

    // Canvas dimensions should match the image ref dimensions (512x512)
    expect(canvas).toHaveAttribute("width", "512");
    expect(canvas).toHaveAttribute("height", "512");

    // Canvas must be absolutely positioned over the image
    expect(canvas.className).toContain("absolute");

    // Cursor canvas should also exist and be absolutely positioned
    const cursorCanvas = screen.getByTestId("mask-canvas-cursor");
    expect(cursorCanvas).toBeInTheDocument();
    expect(cursorCanvas.className).toContain("absolute");
  });

  // =========================================================================
  // AC-2: Brush-Painting erzeugt rote Pixel
  // =========================================================================

  /**
   * AC-2: GIVEN editMode im CanvasDetailState ist "inpaint" oder "erase"
   *       WHEN der User mousedown auf dem Canvas ausfuehrt und die Maus bewegt
   *       THEN werden rote Pixel (rgba 255,0,0,128) entlang des Maus-Pfades
   *            auf das Canvas gezeichnet
   *       AND der Strich-Durchmesser entspricht dem aktuellen brushSize-Wert
   */
  it("AC-2: should paint red pixels along mouse path on mousedown and mousemove", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");

    // Override getBoundingClientRect on the canvas for coordinate calculation
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Simulate drawing: mousedown then mousemove
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 150 });

    // On mousedown, drawDot is called (arc + fill)
    expect(maskCtx.beginPath).toHaveBeenCalled();
    expect(maskCtx.arc).toHaveBeenCalled();
    expect(maskCtx.fill).toHaveBeenCalled();

    // On mousemove while drawing, drawStroke is called (moveTo + lineTo + stroke)
    expect(maskCtx.moveTo).toHaveBeenCalled();
    expect(maskCtx.lineTo).toHaveBeenCalled();
    expect(maskCtx.stroke).toHaveBeenCalled();

    // Verify save/restore pattern is used
    expect(maskCtx.save).toHaveBeenCalled();
    expect(maskCtx.restore).toHaveBeenCalled();
  });

  /**
   * AC-2 (variant): Same painting behavior when editMode is "erase"
   */
  it("AC-2: should paint on canvas when editMode is erase", () => {
    resetMockState({ editMode: "erase", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 120, clientY: 120 });

    expect(maskCtx.beginPath).toHaveBeenCalled();
    expect(maskCtx.stroke).toHaveBeenCalled();
  });

  // =========================================================================
  // AC-3: SET_MASK_DATA dispatch bei mouseup
  // =========================================================================

  /**
   * AC-3: GIVEN der User hat Pixel auf das Canvas gemalt
   *       WHEN mouseup ausgeloest wird
   *       THEN wird SET_MASK_DATA mit den aktuellen Canvas-ImageData dispatched
   *       AND der Strich ist persistent auf dem Canvas sichtbar
   */
  it("AC-3: should dispatch SET_MASK_DATA with canvas ImageData on mouseup", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Draw something first
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 150 });

    // Reset dispatch tracking to isolate mouseup dispatch
    mockDispatch.mockClear();

    // pointerup should trigger SET_MASK_DATA dispatch
    fireEvent.pointerUp(canvas);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_MASK_DATA",
      })
    );

    // The dispatched maskData should be an ImageData instance
    const call = mockDispatch.mock.calls[0][0];
    expect(call.maskData).toBeInstanceOf(ImageData);

    // getImageData should have been called to capture the canvas state
    expect(maskCtx.getImageData).toHaveBeenCalled();
  });

  // =========================================================================
  // AC-4: Eraser entfernt Masken-Pixel
  // =========================================================================

  /**
   * AC-4: GIVEN brushTool im State ist "eraser"
   *       WHEN der User auf dem Canvas malt (mousedown + mousemove)
   *       THEN werden die uebermalten Pixel transparent
   *            (globalCompositeOperation destination-out)
   *       AND zuvor gemalte Masken-Bereiche werden entfernt
   */
  it("AC-4: should erase painted pixels when brushTool is eraser", () => {
    resetMockState({ editMode: "inpaint", brushTool: "eraser", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint with eraser tool
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { clientX: 250, clientY: 250 });

    // globalCompositeOperation should have been set to "destination-out"
    expect(maskCtx.globalCompositeOperation).toBe("destination-out");
  });

  // =========================================================================
  // AC-5: Clear-Mask leert Canvas
  // =========================================================================

  /**
   * AC-5: GIVEN der User hat eine Maske gemalt
   *       WHEN CLEAR_MASK dispatched wird
   *       THEN wird das gesamte Canvas geleert (keine roten Pixel mehr sichtbar)
   *       AND SET_MASK_DATA wird mit null dispatched
   */
  it("AC-5: should clear all canvas pixels when CLEAR_MASK is dispatched", () => {
    // First render with mask data present (simulating painted mask)
    const fakeMaskData = new ImageData(512, 512);
    resetMockState({ editMode: "inpaint", maskData: fakeMaskData });
    const { rerender } = render(<MaskCanvas imageRef={imageRef} />);

    // Now simulate CLEAR_MASK by setting maskData to null (as the reducer does)
    resetMockState({ editMode: "inpaint", maskData: null });
    rerender(<MaskCanvas imageRef={imageRef} />);

    // clearRect should be called to wipe the canvas
    expect(maskCtx.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
  });

  // =========================================================================
  // AC-6: Brush-Size-Aenderung wirkt auf naechsten Strich
  // =========================================================================

  /**
   * AC-6: GIVEN brushSize im State wird von 40 auf 80 geaendert
   *       WHEN der User anschliessend auf dem Canvas malt
   *       THEN hat der neue Strich einen Durchmesser von 80 Pixeln
   */
  it("AC-6: should use updated brushSize for new strokes after state change", () => {
    // Start with brushSize 40
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    const { rerender } = render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Change brushSize to 80
    resetMockState({ editMode: "inpaint", brushSize: 80 });
    rerender(<MaskCanvas imageRef={imageRef} />);

    // Clear previous call tracking
    (maskCtx.arc as ReturnType<typeof vi.fn>).mockClear();

    // Paint with new brush size
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });

    // drawDot draws an arc with radius = brushSize / 2 = 40
    expect(maskCtx.arc).toHaveBeenCalledWith(
      expect.any(Number), // x
      expect.any(Number), // y
      40,                 // radius = brushSize(80) / 2
      0,
      Math.PI * 2
    );
  });

  // =========================================================================
  // AC-7: Cursor-Indicator folgt der Maus
  // =========================================================================

  /**
   * AC-7: GIVEN die Maus befindet sich ueber dem Canvas
   *       WHEN der User die Maus bewegt (ohne zu klicken)
   *       THEN wird ein kreisfoermiger Cursor-Indicator angezeigt, dessen
   *            Durchmesser dem aktuellen brushSize entspricht
   *       AND der native Cursor ist versteckt (CSS cursor: none)
   */
  it("AC-7: should show circle cursor matching brushSize and hide native cursor", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    const cursorCanvas = screen.getByTestId("mask-canvas-cursor");

    // Native cursor should be hidden
    expect(canvas).toHaveStyle({ cursor: "none" });

    // Set up getBoundingClientRect for coordinate calculation
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Move pointer without pressing -- should draw cursor indicator on cursor canvas
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 200 });

    // The cursor canvas context should have arc drawn (circle indicator)
    expect(cursorCtx.arc).toHaveBeenCalled();

    // Verify the arc radius matches brushSize / 2 = 20
    const arcCall = (cursorCtx.arc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(arcCall[2]).toBe(20); // radius = brushSize(40) / 2

    // clearRect should be called before drawing cursor (to clear previous position)
    expect(cursorCtx.clearRect).toHaveBeenCalled();

    // Cursor canvas should not receive pointer events (clicks pass through)
    expect(cursorCanvas.className).toContain("pointer-events-none");
  });

  // =========================================================================
  // AC-8: Canvas versteckt wenn kein editMode
  // =========================================================================

  /**
   * AC-8: GIVEN editMode ist null (kein Edit-Modus aktiv)
   *       WHEN das MaskCanvas-Component gerendert wird
   *       THEN ist das Canvas nicht sichtbar (hidden/unmounted) und akzeptiert
   *            keine Mouse-Events
   */
  it("AC-8: should not render canvas when editMode is null", () => {
    resetMockState({ editMode: null });
    render(<MaskCanvas imageRef={imageRef} />);

    // Canvas elements should not exist in the DOM at all (component returns null)
    expect(screen.queryByTestId("mask-canvas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mask-canvas-cursor")).not.toBeInTheDocument();
  });

  // =========================================================================
  // AC-9: ResizeObserver passt Canvas an
  // =========================================================================

  /**
   * AC-9: GIVEN das Bild-Element aendert seine Groesse (z.B. durch Window-Resize)
   *       WHEN ein ResizeObserver die Aenderung erkennt
   *       THEN wird das Canvas auf die neue Bild-Groesse angepasst
   *       AND bestehende Masken-Daten bleiben erhalten
   */
  it("AC-9: should resize canvas when image element dimensions change", () => {
    resetMockState({ editMode: "inpaint" });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");

    // Initial size should be 512x512
    expect(canvas).toHaveAttribute("width", "512");
    expect(canvas).toHaveAttribute("height", "512");

    // Simulate image resize by changing the getBoundingClientRect return value
    imageRef.current!.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Trigger the ResizeObserver callback
    act(() => {
      if (resizeObserverCallback) {
        resizeObserverCallback([], {} as ResizeObserver);
      }
    });

    // Canvas should now have new dimensions
    expect(canvas).toHaveAttribute("width", "800");
    expect(canvas).toHaveAttribute("height", "600");

    // Existing mask data should be preserved -- getImageData should have been
    // called to capture the old data before resize
    expect(maskCtx.getImageData).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Conditional rendering and edge cases
// ---------------------------------------------------------------------------

describe("MaskCanvas Unit Tests", () => {
  let imageRef: React.RefObject<HTMLImageElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
    installCanvasMock();
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    imageRef = createImageRef(256, 256);
  });

  afterEach(() => {
    cleanup();
    uninstallCanvasMock();
    resizeObserverCallback = null;
    // Remove any stale DOM elements from the body
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("should not render when editMode is 'instruction' (only inpaint/erase supported)", () => {
    resetMockState({ editMode: "instruction" });
    render(<MaskCanvas imageRef={imageRef} />);

    expect(screen.queryByTestId("mask-canvas")).not.toBeInTheDocument();
  });

  it("should not render when editMode is 'outpaint' (only inpaint/erase supported)", () => {
    resetMockState({ editMode: "outpaint" });
    render(<MaskCanvas imageRef={imageRef} />);

    expect(screen.queryByTestId("mask-canvas")).not.toBeInTheDocument();
  });

  it("should dispatch SET_MASK_DATA on pointerCancel while drawing", () => {
    // With pointer capture, pointerleave no longer fires mid-stroke (capture
    // keeps events targeted to the canvas). The analogous "interrupted"
    // scenario is pointercancel, which Safari fires when the OS takes over
    // the gesture (e.g. a system swipe). We must still commit whatever was
    // drawn up to that point.
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 256, height: 256, top: 0, left: 0,
      bottom: 256, right: 256, x: 0, y: 0, toJSON: () => {},
    });

    // Start drawing
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50 });
    mockDispatch.mockClear();

    // Pointer cancel (e.g. iOS system gesture interrupts the stroke)
    fireEvent.pointerCancel(canvas);

    // Should dispatch SET_MASK_DATA (same behavior as pointerup)
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_MASK_DATA" })
    );
  });

  it("should not dispatch SET_MASK_DATA on pointerup when not drawing", () => {
    resetMockState({ editMode: "inpaint" });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");

    // pointerup without prior pointerdown -- should not dispatch
    fireEvent.pointerUp(canvas);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("should restore maskData from state when component renders with existing maskData", () => {
    const existingMaskData = new ImageData(512, 512);
    resetMockState({ editMode: "inpaint", maskData: existingMaskData });

    // Need image ref matching maskData dimensions
    document.body.querySelectorAll("img").forEach((el) => el.remove());
    imageRef = createImageRef(512, 512);

    render(<MaskCanvas imageRef={imageRef} />);

    // putImageData should be called to restore the saved mask
    expect(maskCtx.putImageData).toHaveBeenCalledWith(existingMaskData, 0, 0);
  });

  it("should use source-over compositeOperation for brush tool", () => {
    resetMockState({ editMode: "inpaint", brushTool: "brush", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 256, height: 256, top: 0, left: 0,
      bottom: 256, right: 256, x: 0, y: 0, toJSON: () => {},
    });

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });

    // For brush tool, globalCompositeOperation should be "source-over"
    expect(maskCtx.globalCompositeOperation).toBe("source-over");
  });
});
