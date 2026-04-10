// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * Tests for slice-02-zoom-hook-transform: useCanvasZoom hook
 *
 * Tests AC-1 through AC-8 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver is mocked (not available in jsdom)
 * - DOM element dimensions are mocked via refs
 * - CanvasDetailProvider is real (provides actual reducer context)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock
// ---------------------------------------------------------------------------

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;
let observedElements: Element[] = [];

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverCallback = callback;
  }

  observe(target: Element) {
    observedElements.push(target);
    // Fire initial callback when observe is called (simulates ResizeObserver behavior)
    this.callback([
      {
        target,
        contentRect: target.getBoundingClientRect(),
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      } as ResizeObserverEntry,
    ]);
  }

  unobserve() {}

  disconnect() {
    observedElements = [];
  }
}

// Install global ResizeObserver mock
vi.stubGlobal("ResizeObserver", MockResizeObserver);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock container div with specified clientWidth/clientHeight.
 */
function createMockContainer(width: number, height: number): HTMLDivElement {
  const div = document.createElement("div");
  Object.defineProperty(div, "clientWidth", { get: () => width, configurable: true });
  Object.defineProperty(div, "clientHeight", { get: () => height, configurable: true });
  // getBoundingClientRect needed for ResizeObserver mock
  div.getBoundingClientRect = () => ({
    width,
    height,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    toJSON: () => {},
  });
  return div;
}

/**
 * Creates a mock image element with specified naturalWidth/naturalHeight.
 */
function createMockImage(
  naturalWidth: number,
  naturalHeight: number
): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", {
    get: () => naturalWidth,
    configurable: true,
  });
  Object.defineProperty(img, "naturalHeight", {
    get: () => naturalHeight,
    configurable: true,
  });
  Object.defineProperty(img, "complete", {
    get: () => true,
    configurable: true,
  });
  return img;
}

/**
 * Wrapper component that provides CanvasDetailProvider context
 * and sets up container/image refs for the hook.
 */
function createWrapper(
  container: HTMLDivElement,
  image: HTMLImageElement
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "test-gen-1" },
      createElement(RefBridge, { container, image }, children)
    );
  };
}

/**
 * Bridge component that exposes refs via a custom hook wrapper.
 * The renderHook callback accesses these via a shared ref store.
 */
let sharedContainerRef: React.RefObject<HTMLDivElement | null> | null = null;
let sharedImageRef: React.RefObject<HTMLImageElement | null> | null = null;

function RefBridge({
  container,
  image,
  children,
}: {
  container: HTMLDivElement;
  image: HTMLImageElement;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(container);
  const imageRef = useRef<HTMLImageElement | null>(image);
  sharedContainerRef = containerRef;
  sharedImageRef = imageRef;
  return createElement("div", null, children);
}

/**
 * Helper hook that calls useCanvasZoom with shared refs
 * and also returns the context state for assertions.
 */
function useCanvasZoomWithState() {
  const zoom = useCanvasZoom(sharedContainerRef!, sharedImageRef!);
  const { state } = useCanvasDetail();
  return { ...zoom, state };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCanvasZoom", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    observedElements = [];
    sharedContainerRef = null;
    sharedImageRef = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: fitLevel Berechnung (Bild groesser als Container)
  // GIVEN ein Container von 800x600px und ein Bild mit naturalWidth=1600, naturalHeight=1200
  // WHEN `useCanvasZoom` initialisiert wird
  // THEN `fitLevel === 0.5` (min(800/1600, 600/1200))
  // -------------------------------------------------------------------------
  it("AC-1: should calculate fitLevel as min(containerW/imageW, containerH/imageH)", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(1600, 1200);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // min(800/1600, 600/1200) = min(0.5, 0.5) = 0.5
    expect(result.current.fitLevel).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // AC-2: fitLevel clamped bei kleinem Bild
  // GIVEN ein Container von 800x600px und ein Bild mit naturalWidth=400, naturalHeight=300
  // WHEN `useCanvasZoom` initialisiert wird
  // THEN `fitLevel === 1.0` (min(800/400, 600/300) = 2.0, aber geclampt auf max 1.0)
  // -------------------------------------------------------------------------
  it("AC-2: should clamp fitLevel to 1.0 when image is smaller than container", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(400, 300);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // min(800/400, 600/300) = min(2.0, 2.0) = 2.0, clamped to 1.0
    expect(result.current.fitLevel).toBe(1.0);
  });

  // -------------------------------------------------------------------------
  // AC-3: fitLevel Neuberechnung bei Container-Resize
  // GIVEN der Container wird von 800x600 auf 400x300 resized
  // WHEN ResizeObserver feuert
  // THEN fitLevel wird neu berechnet; wenn aktueller zoomLevel === alter fitLevel,
  //      wird zoomLevel auf neuen fitLevel angepasst
  // -------------------------------------------------------------------------
  it("AC-3: should recalculate fitLevel when ResizeObserver fires", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(1600, 1200);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Initially fitLevel = 0.5 and zoomLevel follows fitLevel
    expect(result.current.fitLevel).toBe(0.5);
    expect(result.current.state.zoomLevel).toBe(0.5);

    // Simulate container resize to 400x300
    Object.defineProperty(container, "clientWidth", { get: () => 400, configurable: true });
    Object.defineProperty(container, "clientHeight", { get: () => 300, configurable: true });

    // Fire ResizeObserver callback
    act(() => {
      if (resizeObserverCallback && observedElements.length > 0) {
        resizeObserverCallback([
          {
            target: observedElements[0],
            contentRect: container.getBoundingClientRect(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as ResizeObserverEntry,
        ]);
      }
    });

    // New fitLevel = min(400/1600, 300/1200) = min(0.25, 0.25) = 0.25
    // But 0.25 < ZOOM_MIN(0.5), so the clamping in the reducer will handle this.
    // The fitLevel itself is calculated raw, clamped to FIT_LEVEL_MAX(1.0) only.
    // Hmm, fitLevel = Math.min(rawFit, 1.0) = Math.min(0.25, 1.0) = 0.25
    // The reducer clamps zoomLevel to [0.5, 3.0], but fitLevel is independent.
    // Since zoomLevel was === old fitLevel (0.5), it follows the new fitLevel.
    // But the SET_ZOOM_PAN will clamp 0.25 to 0.5.
    expect(result.current.fitLevel).toBe(0.25);
    // zoomLevel gets clamped to min 0.5 by reducer
    expect(result.current.state.zoomLevel).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // AC-4: Anchor-Point Zoom Mathematik
  // GIVEN zoomLevel=1.0, panX=0, panY=0 und Cursor bei containerX=200, containerY=150
  // WHEN `zoomToPoint(2.0, 200, 150)` aufgerufen wird
  // THEN neuer panX === -200, panY === -150
  //      (Anchor-Point-Formel: newPan = cursor - imageCoord * newZoom)
  // -------------------------------------------------------------------------
  it("AC-4: should compute correct panX/panY for zoomToPoint with anchor at cursor position", () => {
    const container = createMockContainer(800, 600);
    // Use image that produces fitLevel=1.0 so initial zoomLevel=1.0
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Initial state: zoomLevel=1.0, panX=0, panY=0 (fitLevel=1.0)
    expect(result.current.state.zoomLevel).toBe(1.0);
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);

    act(() => {
      result.current.zoomToPoint(2.0, 200, 150);
    });

    // imageX = (cursorX - panX) / oldZoom = (200 - 0) / 1.0 = 200
    // imageY = (cursorY - panY) / oldZoom = (150 - 0) / 1.0 = 150
    // newPanX = cursorX - imageX * newZoom = 200 - 200 * 2.0 = 200 - 400 = -200
    // newPanY = cursorY - imageY * newZoom = 150 - 150 * 2.0 = 150 - 300 = -150
    expect(result.current.state.zoomLevel).toBe(2.0);
    expect(result.current.state.panX).toBe(-200);
    expect(result.current.state.panY).toBe(-150);
  });

  // -------------------------------------------------------------------------
  // AC-5: zoomToStep("in") naechste Stufe
  // GIVEN zoomLevel=1.0
  // WHEN `zoomToStep("in")` aufgerufen wird
  // THEN zoomLevel wird auf 1.5 gesetzt (naechste Stufe aus [0.5, 0.75, 1.0, 1.5, 2.0, 3.0])
  // -------------------------------------------------------------------------
  it('AC-5: should step to next zoom level from predefined steps on zoomToStep("in")', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Initial zoomLevel = 1.0 (fitLevel = 1.0)
    expect(result.current.state.zoomLevel).toBe(1.0);

    act(() => {
      result.current.zoomToStep("in");
    });

    // Next step above 1.0 is 1.5
    expect(result.current.state.zoomLevel).toBe(1.5);
  });

  // -------------------------------------------------------------------------
  // AC-6: zoomToStep("in") bei Maximum
  // GIVEN zoomLevel=3.0
  // WHEN `zoomToStep("in")` aufgerufen wird
  // THEN zoomLevel bleibt 3.0 (bereits am Maximum)
  // -------------------------------------------------------------------------
  it('AC-6: should not exceed max zoom level on zoomToStep("in") when already at 3.0', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // First zoom to 3.0 via zoomToPoint
    act(() => {
      result.current.zoomToPoint(3.0, 400, 300);
    });

    expect(result.current.state.zoomLevel).toBe(3.0);

    act(() => {
      result.current.zoomToStep("in");
    });

    // Should remain at 3.0
    expect(result.current.state.zoomLevel).toBe(3.0);
  });

  // -------------------------------------------------------------------------
  // AC-7: zoomToStep("out") bei Minimum
  // GIVEN zoomLevel=0.5
  // WHEN `zoomToStep("out")` aufgerufen wird
  // THEN zoomLevel bleibt 0.5 (bereits am Minimum)
  // -------------------------------------------------------------------------
  it('AC-7: should not go below min zoom level on zoomToStep("out") when already at 0.5', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(1600, 1200);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // fitLevel = 0.5, initial zoomLevel follows = 0.5
    expect(result.current.state.zoomLevel).toBe(0.5);

    act(() => {
      result.current.zoomToStep("out");
    });

    // Should remain at 0.5 — no lower step exists
    expect(result.current.state.zoomLevel).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // AC-8: resetToFit
  // GIVEN beliebiger Zoom-State
  // WHEN `resetToFit()` aufgerufen wird
  // THEN zoomLevel === fitLevel, panX === 0, panY === 0
  // -------------------------------------------------------------------------
  it("AC-8: should set zoomLevel to fitLevel and panX/panY to 0 on resetToFit", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(1600, 1200);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // fitLevel = 0.5
    expect(result.current.fitLevel).toBe(0.5);

    // Zoom to a different level with pan offset
    act(() => {
      result.current.zoomToPoint(2.0, 200, 150);
    });

    expect(result.current.state.zoomLevel).toBe(2.0);
    expect(result.current.state.panX).not.toBe(0);

    // Reset to fit
    act(() => {
      result.current.resetToFit();
    });

    expect(result.current.state.zoomLevel).toBe(0.5);
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);
  });
});
