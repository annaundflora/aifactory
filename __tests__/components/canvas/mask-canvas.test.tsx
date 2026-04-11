// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Tests for slice-06-mask-zoom-fix: MaskCanvas Zoom Coordinate Compensation
 *
 * Tests AC-1, AC-2, AC-3, AC-4, AC-7 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - CanvasDetailContext is mocked to inject zoomLevel
 * - Canvas 2D context is mocked (jsdom does not support canvas)
 * - ResizeObserver is mocked (not available in jsdom)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock (must be before component imports)
// ---------------------------------------------------------------------------
vi.stubGlobal(
  "ResizeObserver",
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

// ---------------------------------------------------------------------------
// Canvas 2D Context Mock
// ---------------------------------------------------------------------------
function createMockContext2D() {
  return {
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      width: 800,
      height: 600,
      data: new Uint8ClampedArray(800 * 600 * 4),
    })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    set lineWidth(_v: number) {},
    set lineCap(_v: string) {},
    set lineJoin(_v: string) {},
    set strokeStyle(_v: string) {},
    set fillStyle(_v: string) {},
    set globalCompositeOperation(_v: string) {},
  };
}

// ---------------------------------------------------------------------------
// Mock CanvasDetailContext
// ---------------------------------------------------------------------------
let mockState: Record<string, unknown> = {};
const mockDispatch = vi.fn();

vi.mock("@/lib/canvas-detail-context", () => ({
  useCanvasDetail: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { MaskCanvas } from "@/components/canvas/mask-canvas";
import { createRef } from "react";

// ---------------------------------------------------------------------------
// Helper: Create a mock image element with natural dimensions
// ---------------------------------------------------------------------------
function createMockImageElement(
  naturalWidth: number,
  naturalHeight: number,
  rectOverrides: Partial<DOMRect> = {}
) {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: naturalHeight, configurable: true });
  img.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: naturalWidth,
      bottom: naturalHeight,
      width: naturalWidth,
      height: naturalHeight,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rectOverrides,
    } as DOMRect);
  return img;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MaskCanvas - Zoom Coordinate Compensation", () => {
  let mockCtx: ReturnType<typeof createMockContext2D>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext2D();

    // Default state for inpaint mode
    mockState = {
      editMode: "inpaint",
      brushSize: 20,
      brushTool: "brush",
      maskData: null,
      zoomLevel: 1.0,
    };

    // Mock HTMLCanvasElement.getContext
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
  });

  // ---------------------------------------------------------------------------
  // AC-1: getCanvasCoords dividiert durch zoomLevel
  // GIVEN MaskCanvas bei zoomLevel=2.0 und ein Pointer-Event bei clientX=300, clientY=200
  //       (Canvas rect.left=100, rect.top=50)
  // WHEN getCanvasCoords aufgerufen wird
  // THEN x === 100, y === 75 (Formel: (clientX - rect.left) / zoomLevel)
  // ---------------------------------------------------------------------------
  it("should divide pointer offset by zoomLevel in getCanvasCoords at zoom 2.0", () => {
    mockState = {
      ...mockState,
      zoomLevel: 2.0,
    };

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(<MaskCanvas imageRef={imageRef as React.RefObject<HTMLImageElement | null>} />);

    const canvas = screen.getByTestId("mask-canvas");

    // Mock the canvas getBoundingClientRect to return left=100, top=50
    canvas.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        right: 1700,
        bottom: 1250,
        width: 1600,
        height: 1200,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      } as DOMRect);

    // Fire pointerdown at clientX=300, clientY=200
    // Expected: x = (300 - 100) / 2.0 = 100, y = (200 - 50) / 2.0 = 75
    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 200,
      pointerId: 1,
      button: 0,
    });

    // The drawDot (arc) should be called with the zoom-compensated coordinates
    // arc(x, y, radius, startAngle, endAngle)
    expect(mockCtx.arc).toHaveBeenCalled();
    const arcCall = mockCtx.arc.mock.calls[0];
    expect(arcCall[0]).toBe(100); // x = (300 - 100) / 2.0
    expect(arcCall[1]).toBe(75); // y = (200 - 50) / 2.0
  });

  // ---------------------------------------------------------------------------
  // AC-2: getCanvasCoords bei zoomLevel 1.0 (Rueckwaertskompatibilitaet)
  // GIVEN MaskCanvas bei zoomLevel=1.0 (Fit)
  // WHEN getCanvasCoords aufgerufen wird mit clientX=300, clientY=200
  //      (Canvas rect.left=100, rect.top=50)
  // THEN x === 200, y === 150 (Division durch 1.0 aendert nichts)
  // ---------------------------------------------------------------------------
  it("should return unchanged coordinates when zoomLevel is 1.0", () => {
    mockState = {
      ...mockState,
      zoomLevel: 1.0,
    };

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(<MaskCanvas imageRef={imageRef as React.RefObject<HTMLImageElement | null>} />);

    const canvas = screen.getByTestId("mask-canvas");

    canvas.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      } as DOMRect);

    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 200,
      pointerId: 1,
      button: 0,
    });

    // x = (300 - 100) / 1.0 = 200, y = (200 - 50) / 1.0 = 150
    expect(mockCtx.arc).toHaveBeenCalled();
    const arcCall = mockCtx.arc.mock.calls[0];
    expect(arcCall[0]).toBe(200); // x = (300 - 100) / 1.0
    expect(arcCall[1]).toBe(150); // y = (200 - 50) / 1.0
  });

  // ---------------------------------------------------------------------------
  // AC-3: syncCanvasSize verwendet natuerliche Dimensionen
  // GIVEN MaskCanvas bei zoomLevel=2.0, Bild naturalWidth=800, naturalHeight=600
  // WHEN syncCanvasSize aufgerufen wird
  // THEN canvas.width === 800, canvas.height === 600
  //      (natuerliche Dimensionen, NICHT die von getBoundingClientRect
  //       zurueckgegebenen 1600x1200)
  // ---------------------------------------------------------------------------
  it("should set canvas dimensions to natural image size, not transformed size", () => {
    mockState = {
      ...mockState,
      zoomLevel: 2.0,
    };

    const imageRef = createRef<HTMLImageElement>();
    // Image has naturalWidth=800, naturalHeight=600, but getBoundingClientRect
    // would return 1600x1200 at zoom 2.0
    const img = createMockImageElement(800, 600, {
      width: 1600,
      height: 1200,
      left: 0,
      top: 0,
      right: 1600,
      bottom: 1200,
    });
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(<MaskCanvas imageRef={imageRef as React.RefObject<HTMLImageElement | null>} />);

    const canvas = screen.getByTestId("mask-canvas");

    // syncCanvasSize is triggered by ResizeObserver/initial effect.
    // In our mock, it fires during render. Check that canvas dimensions
    // match naturalWidth/naturalHeight, NOT the BoundingClientRect values.
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  // ---------------------------------------------------------------------------
  // AC-4: syncCanvasSize bewahrt existierende Mask-Daten
  // GIVEN MaskCanvas mit existierenden Mask-Daten und Container-Resize
  //       bei zoomLevel=1.5
  // WHEN syncCanvasSize aufgerufen wird
  // THEN existierende Mask-Daten werden skaliert auf die neuen
  //      Canvas-Dimensionen beibehalten
  // ---------------------------------------------------------------------------
  it("should preserve and rescale existing mask data during syncCanvasSize", () => {
    mockState = {
      ...mockState,
      zoomLevel: 1.5,
    };

    // Start with an image of 400x300, then "resize" to 800x600
    const imageRef = { current: null as HTMLImageElement | null };
    const img = createMockImageElement(400, 300);
    imageRef.current = img;

    render(
      <MaskCanvas imageRef={imageRef as React.RefObject<HTMLImageElement | null>} />
    );

    const canvas = screen.getByTestId("mask-canvas");

    // Canvas should match initial natural dimensions
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);

    // Now "resize" the image: change naturalWidth/Height on the same element
    // This simulates a new image being loaded with different dimensions
    Object.defineProperty(img, "naturalWidth", { value: 800, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 600, configurable: true });

    // Trigger syncCanvasSize via window resize event
    // (syncCanvasSize is registered as a window resize listener)
    fireEvent(window, new Event("resize"));

    // syncCanvasSize should have:
    // 1. Read existing image data (getImageData called)
    // 2. Set new canvas dimensions
    // 3. Drawn old data scaled to new size (drawImage called)
    expect(mockCtx.getImageData).toHaveBeenCalled();
    expect(mockCtx.drawImage).toHaveBeenCalled();

    // Canvas should now be 800x600
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  // ---------------------------------------------------------------------------
  // AC-7: Kein Offset-Drift bei zoomLevel 3.0
  // GIVEN MaskCanvas bei zoomLevel=3.0 (Maximum) und ein Mask-Strich
  //       von Punkt A nach Punkt B
  // WHEN der Strich gezeichnet wird
  // THEN landen die gezeichneten Pixel exakt auf den Bildkoordinaten
  //      unter dem Cursor (kein Offset-Drift bei hohem Zoom)
  // ---------------------------------------------------------------------------
  it("should produce correct coordinates at maximum zoom level 3.0", () => {
    mockState = {
      ...mockState,
      zoomLevel: 3.0,
    };

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(<MaskCanvas imageRef={imageRef as React.RefObject<HTMLImageElement | null>} />);

    const canvas = screen.getByTestId("mask-canvas");

    // At zoom 3.0, the canvas rect from getBoundingClientRect would be 3x larger
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 2400,
        bottom: 1800,
        width: 2400,
        height: 1800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

    // PointerDown at (300, 150) — start of stroke
    fireEvent.pointerDown(canvas, {
      clientX: 300,
      clientY: 150,
      pointerId: 1,
      button: 0,
    });

    // Expected dot at: x = 300/3.0 = 100, y = 150/3.0 = 50
    expect(mockCtx.arc).toHaveBeenCalled();
    const dotCall = mockCtx.arc.mock.calls[0];
    expect(dotCall[0]).toBe(100);
    expect(dotCall[1]).toBe(50);

    // PointerMove to (600, 300) — continue stroke
    fireEvent.pointerMove(canvas, {
      clientX: 600,
      clientY: 300,
      pointerId: 1,
      button: 0,
    });

    // Expected stroke to: x = 600/3.0 = 200, y = 300/3.0 = 100
    // drawStroke calls moveTo(from) and lineTo(to)
    expect(mockCtx.lineTo).toHaveBeenCalled();
    const lineToCall = mockCtx.lineTo.mock.calls[0];
    expect(lineToCall[0]).toBe(200);
    expect(lineToCall[1]).toBe(100);

    // Verify no drift: the moveTo should use the previous position (100, 50)
    expect(mockCtx.moveTo).toHaveBeenCalled();
    const moveToCall = mockCtx.moveTo.mock.calls[0];
    expect(moveToCall[0]).toBe(100);
    expect(moveToCall[1]).toBe(50);
  });
});

// ===========================================================================
// Slice 9: Procreate-Style Stroke-Undo — MaskCanvas Integration
// ===========================================================================

describe("MaskCanvas - Stroke-Undo Integration", () => {
  let mockCtx: ReturnType<typeof createMockContext2D>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockContext2D();

    mockState = {
      editMode: "inpaint",
      brushSize: 20,
      brushTool: "brush",
      maskData: null,
      zoomLevel: 1.0,
    };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );
  });

  // ---------------------------------------------------------------------------
  // AC-8: maskData-Konsistenz nach Undo
  // GIVEN ein Stroke-Undo wurde ausgefuehrt (AC-1)
  // WHEN der maskData-State nach dem Undo ausgelesen wird
  // THEN ist maskData konsistent mit dem Canvas-Inhalt (kein "Ghost-Stroke"
  //      der visuell weg ist aber im State noch existiert)
  // ---------------------------------------------------------------------------
  it("AC-8: should have consistent maskData state after stroke undo (no ghost stroke)", () => {
    // Track the onStrokeUndoRefsReady callback to get a reference to performStrokeUndo
    let capturedRefs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs | null = null;
    const handleRefsReady = vi.fn((refs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs) => {
      capturedRefs = refs;
    });

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(
      <MaskCanvas
        imageRef={imageRef as React.RefObject<HTMLImageElement | null>}
        onStrokeUndoRefsReady={handleRefsReady}
      />
    );

    // onStrokeUndoRefsReady should have been called with refs
    expect(handleRefsReady).toHaveBeenCalledTimes(1);
    expect(capturedRefs).not.toBeNull();

    const canvas = screen.getByTestId("mask-canvas");

    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

    // Step 1: Start a stroke (pointerDown pushes snapshot to undo stack + sets isDrawing=true)
    fireEvent.pointerDown(canvas, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      button: 0,
    });

    // Verify isDrawing is true after pointerDown
    expect(capturedRefs!.isDrawingRef.current).toBe(true);

    // Step 2: Draw some pixels (pointerMove)
    fireEvent.pointerMove(canvas, {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
      button: 0,
    });

    // Step 3: Before lifting the finger, simulate stroke-undo via performStrokeUndo
    // (This is what useTouchGestures would call on 1->2 finger transition)

    // Set up the mock to return ImageData with alpha content for the restored state
    // The undo stack should have one entry (pushed during pointerDown)
    expect(capturedRefs!.maskUndoStackRef.current.length).toBe(1);

    // Mock getImageData to return data that indicates "has content" for the restore
    // (after putImageData, getImageData is called to dispatch SET_MASK_DATA)
    const restoredImageData = {
      width: 800,
      height: 600,
      data: new Uint8ClampedArray(800 * 600 * 4),
    };
    // Set some alpha pixels to simulate content
    restoredImageData.data[3] = 128; // First pixel has alpha

    // Override getImageData to return our test data after restore
    const getImageDataSpy = mockCtx.getImageData as ReturnType<typeof vi.fn>;
    getImageDataSpy.mockReturnValue(restoredImageData);

    // Call performStrokeUndo
    capturedRefs!.performStrokeUndo();

    // Verify AC-8: isDrawing should be false
    expect(capturedRefs!.isDrawingRef.current).toBe(false);

    // Verify AC-8: The undo stack entry was popped
    expect(capturedRefs!.maskUndoStackRef.current.length).toBe(0);

    // Verify AC-8: Canvas was restored (clearRect + putImageData called)
    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.putImageData).toHaveBeenCalled();

    // Verify AC-8: SET_MASK_DATA was dispatched with restored data
    // (ensures state is consistent with canvas content, no ghost stroke)
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_MASK_DATA",
      })
    );

    // The last SET_MASK_DATA call should have maskData (not null) because
    // our mock getImageData returns data with alpha content
    const setMaskDataCalls = mockDispatch.mock.calls.filter(
      (call) => call[0]?.type === "SET_MASK_DATA"
    );
    const lastSetMaskData = setMaskDataCalls[setMaskDataCalls.length - 1];
    expect(lastSetMaskData[0].maskData).not.toBeNull();
  });

  it("AC-8: should dispatch SET_MASK_DATA with null when restored canvas is empty", () => {
    let capturedRefs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs | null = null;
    const handleRefsReady = vi.fn((refs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs) => {
      capturedRefs = refs;
    });

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(
      <MaskCanvas
        imageRef={imageRef as React.RefObject<HTMLImageElement | null>}
        onStrokeUndoRefsReady={handleRefsReady}
      />
    );

    expect(capturedRefs).not.toBeNull();

    const canvas = screen.getByTestId("mask-canvas");
    canvas.getBoundingClientRect = () =>
      ({
        left: 0, top: 0, right: 800, bottom: 600,
        width: 800, height: 600, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect);

    // Start a stroke to push to undo stack
    fireEvent.pointerDown(canvas, {
      clientX: 100, clientY: 100, pointerId: 1, button: 0,
    });

    // Mock getImageData to return completely transparent data (empty canvas after restore)
    const emptyImageData = {
      width: 800,
      height: 600,
      data: new Uint8ClampedArray(800 * 600 * 4), // All zeros = fully transparent
    };
    (mockCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValue(emptyImageData);

    // Perform stroke undo
    capturedRefs!.performStrokeUndo();

    // SET_MASK_DATA should be dispatched with null (empty canvas = no mask)
    const setMaskDataCalls = mockDispatch.mock.calls.filter(
      (call) => call[0]?.type === "SET_MASK_DATA"
    );
    const lastSetMaskData = setMaskDataCalls[setMaskDataCalls.length - 1];
    expect(lastSetMaskData[0].maskData).toBeNull();
  });

  it("AC-7/AC-8: performStrokeUndo with empty stack sets isDrawing false without canvas restore", () => {
    let capturedRefs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs | null = null;
    const handleRefsReady = vi.fn((refs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs) => {
      capturedRefs = refs;
    });

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(
      <MaskCanvas
        imageRef={imageRef as React.RefObject<HTMLImageElement | null>}
        onStrokeUndoRefsReady={handleRefsReady}
      />
    );

    expect(capturedRefs).not.toBeNull();

    // Manually set isDrawing=true without pushing to undo stack
    capturedRefs!.isDrawingRef.current = true;
    expect(capturedRefs!.maskUndoStackRef.current.length).toBe(0);

    // Clear any previous mock calls
    mockCtx.clearRect.mockClear();
    mockCtx.putImageData.mockClear();
    mockDispatch.mockClear();

    // Perform stroke undo with empty stack
    capturedRefs!.performStrokeUndo();

    // isDrawing should be false
    expect(capturedRefs!.isDrawingRef.current).toBe(false);

    // Canvas restore should NOT have been called (empty stack)
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
    expect(mockCtx.putImageData).not.toHaveBeenCalled();

    // SET_MASK_DATA should NOT have been dispatched (no restore happened)
    const setMaskDataCalls = mockDispatch.mock.calls.filter(
      (call) => call[0]?.type === "SET_MASK_DATA"
    );
    expect(setMaskDataCalls.length).toBe(0);
  });

  it("should expose refs via onStrokeUndoRefsReady callback", () => {
    let capturedRefs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs | null = null;
    const handleRefsReady = vi.fn((refs: import("@/components/canvas/mask-canvas").MaskCanvasStrokeUndoRefs) => {
      capturedRefs = refs;
    });

    const imageRef = createRef<HTMLImageElement>();
    const img = createMockImageElement(800, 600);
    Object.defineProperty(imageRef, "current", { value: img, writable: true });

    render(
      <MaskCanvas
        imageRef={imageRef as React.RefObject<HTMLImageElement | null>}
        onStrokeUndoRefsReady={handleRefsReady}
      />
    );

    // Callback should have been called
    expect(handleRefsReady).toHaveBeenCalledTimes(1);

    // All required refs/callbacks should be present
    expect(capturedRefs).toBeDefined();
    expect(capturedRefs!.isDrawingRef).toBeDefined();
    expect(capturedRefs!.maskUndoStackRef).toBeDefined();
    expect(capturedRefs!.canvasRef).toBeDefined();
    expect(typeof capturedRefs!.performStrokeUndo).toBe("function");

    // Initial values
    expect(capturedRefs!.isDrawingRef.current).toBe(false);
    expect(capturedRefs!.maskUndoStackRef.current).toEqual([]);
  });
});
