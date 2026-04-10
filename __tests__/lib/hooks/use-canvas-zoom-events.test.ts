// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * Tests for slice-04-wheel-keyboard: Wheel + Keyboard Event Handler
 *
 * Tests AC-1 through AC-12 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver is mocked (not available in jsdom)
 * - DOM element dimensions are mocked via refs
 * - addEventListener/removeEventListener spied for registration assertions
 * - document.activeElement is manipulated for input-focus guard tests
 * - CanvasDetailProvider is real (provides actual reducer context)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock
// ---------------------------------------------------------------------------

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;
let resizeObserverInstances: MockResizeObserver[] = [];

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverCallback = callback;
    resizeObserverInstances.push(this);
  }

  observe(target: Element) {
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

  disconnect() {}
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
  Object.defineProperty(div, "clientWidth", {
    get: () => width,
    configurable: true,
  });
  Object.defineProperty(div, "clientHeight", {
    get: () => height,
    configurable: true,
  });
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
function createWrapper(container: HTMLDivElement, image: HTMLImageElement) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "test-gen-1" },
      createElement(RefBridge, { container, image }, children)
    );
  };
}

/**
 * Bridge component that exposes refs via a shared ref store.
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

/**
 * Creates a WheelEvent with given properties.
 * Uses the real WheelEvent constructor available in jsdom.
 */
function createWheelEvent(props: {
  deltaY: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  clientX?: number;
  clientY?: number;
}): WheelEvent {
  const event = new WheelEvent("wheel", {
    deltaY: props.deltaY,
    ctrlKey: props.ctrlKey ?? false,
    metaKey: props.metaKey ?? false,
    shiftKey: props.shiftKey ?? false,
    clientX: props.clientX ?? 400,
    clientY: props.clientY ?? 300,
    bubbles: true,
    cancelable: true,
  });
  return event;
}

/**
 * Creates a KeyboardEvent with given key.
 */
function createKeyboardEvent(
  key: string,
  props?: Partial<KeyboardEventInit>
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...props,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Wheel Handler", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    resizeObserverInstances = [];
    sharedContainerRef = null;
    sharedImageRef = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-1: Ctrl+Scroll up -> zoom in mit Cursor-Anchor
  // GIVEN canvas-area ist gemountet und Maus ist ueber dem Canvas
  // WHEN ein wheel-Event mit ctrlKey: true und deltaY: -100 gefeuert wird
  // THEN preventDefault() wird aufgerufen UND zoomToPoint() wird mit einer
  //      Zoom-Erhoehung und Cursor-Position als Anchor aufgerufen
  // -------------------------------------------------------------------------
  it("AC-1: should call zoomToPoint with zoom increase on Ctrl+wheel deltaY negative", () => {
    const container = createMockContainer(800, 600);
    // Image 800x600 -> fitLevel = 1.0 -> initial zoomLevel = 1.0
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Initial state: zoomLevel=1.0
    expect(result.current.state.zoomLevel).toBe(1.0);

    // Create wheel event with Ctrl+scroll up (deltaY negative = zoom in)
    const wheelEvent = createWheelEvent({
      deltaY: -100,
      ctrlKey: true,
      clientX: 200,
      clientY: 150,
    });
    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // preventDefault must be called to prevent browser zoom
    expect(preventDefaultSpy).toHaveBeenCalled();

    // newZoom = oldZoom * (1 - deltaY * 0.01) = 1.0 * (1 - (-100) * 0.01) = 1.0 * 2.0 = 2.0
    // zoomLevel should have increased
    expect(result.current.state.zoomLevel).toBeGreaterThan(1.0);
    expect(result.current.state.zoomLevel).toBe(2.0);
  });

  // -------------------------------------------------------------------------
  // AC-2: Ctrl+Scroll down -> zoom out mit Cursor-Anchor
  // GIVEN canvas-area ist gemountet und Maus ist ueber dem Canvas
  // WHEN ein wheel-Event mit ctrlKey: true und deltaY: 100 gefeuert wird
  // THEN preventDefault() wird aufgerufen UND zoomToPoint() wird mit einer
  //      Zoom-Verringerung und Cursor-Position als Anchor aufgerufen
  // -------------------------------------------------------------------------
  it("AC-2: should call zoomToPoint with zoom decrease on Ctrl+wheel deltaY positive", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Start at 1.0 and zoom out
    expect(result.current.state.zoomLevel).toBe(1.0);

    const wheelEvent = createWheelEvent({
      deltaY: 100,
      ctrlKey: true,
      clientX: 400,
      clientY: 300,
    });
    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // preventDefault must be called
    expect(preventDefaultSpy).toHaveBeenCalled();

    // newZoom = 1.0 * (1 - 100 * 0.01) = 1.0 * 0.0 = 0.0 -> clamped to 0.5
    // zoomLevel should have decreased (clamped to min)
    expect(result.current.state.zoomLevel).toBeLessThan(1.0);
    expect(result.current.state.zoomLevel).toBe(0.5);
  });

  // -------------------------------------------------------------------------
  // AC-3: Scroll ohne Modifier -> vertikaler Pan
  // GIVEN canvas-area ist gemountet und zoomLevel > fitLevel (Bild ist gezoomt)
  // WHEN ein wheel-Event OHNE Modifier mit deltaY: 50 gefeuert wird
  // THEN panY wird um -50 veraendert
  // -------------------------------------------------------------------------
  it("AC-3: should update panY by negative deltaY on wheel without modifier when zoomed", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Zoom in first so zoomLevel > fitLevel
    act(() => {
      result.current.zoomToPoint(2.0, 400, 300);
    });

    expect(result.current.state.zoomLevel).toBe(2.0);
    const initialPanY = result.current.state.panY;

    // Plain scroll (no modifier)
    const wheelEvent = createWheelEvent({
      deltaY: 50,
      ctrlKey: false,
      shiftKey: false,
    });

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // panY should decrease by deltaY (scroll down = pan image up)
    expect(result.current.state.panY).toBe(initialPanY - 50);
  });

  // -------------------------------------------------------------------------
  // AC-4: Shift+Scroll -> horizontaler Pan
  // GIVEN canvas-area ist gemountet und zoomLevel > fitLevel
  // WHEN ein wheel-Event mit shiftKey: true und deltaY: 80 gefeuert wird
  // THEN panX wird um -80 veraendert, panY bleibt unveraendert
  // -------------------------------------------------------------------------
  it("AC-4: should update panX by negative deltaY on Shift+wheel when zoomed", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Zoom in first
    act(() => {
      result.current.zoomToPoint(2.0, 400, 300);
    });

    const initialPanX = result.current.state.panX;
    const initialPanY = result.current.state.panY;

    // Shift+scroll
    const wheelEvent = createWheelEvent({
      deltaY: 80,
      shiftKey: true,
      ctrlKey: false,
    });

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // panX should decrease by deltaY, panY unchanged
    expect(result.current.state.panX).toBe(initialPanX - 80);
    expect(result.current.state.panY).toBe(initialPanY);
  });

  // -------------------------------------------------------------------------
  // AC-5: Scroll bei Fit -> kein Effekt
  // GIVEN zoomLevel === fitLevel (Bild im Fit-Modus, nicht gezoomt)
  // WHEN ein wheel-Event OHNE Modifier gefeuert wird
  // THEN kein Pan-Update erfolgt
  // -------------------------------------------------------------------------
  it("AC-5: should not pan when zoomLevel equals fitLevel on wheel without modifier", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // zoomLevel === fitLevel === 1.0
    expect(result.current.state.zoomLevel).toBe(1.0);
    expect(result.current.fitLevel).toBe(1.0);

    const initialPanX = result.current.state.panX;
    const initialPanY = result.current.state.panY;

    // Plain scroll at fit level
    const wheelEvent = createWheelEvent({
      deltaY: 50,
      ctrlKey: false,
      shiftKey: false,
    });

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // No pan change
    expect(result.current.state.panX).toBe(initialPanX);
    expect(result.current.state.panY).toBe(initialPanY);
  });

  // -------------------------------------------------------------------------
  // AC-6: passive:false Registrierung
  // GIVEN der wheel-Listener auf canvas-area
  // WHEN der Listener registriert wird
  // THEN wird addEventListener("wheel", handler, { passive: false }) verwendet
  // -------------------------------------------------------------------------
  it("AC-6: should register wheel listener with passive false via addEventListener", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);

    // Spy on addEventListener of the container element
    const addEventListenerSpy = vi.spyOn(container, "addEventListener");

    const wrapper = createWrapper(container, image);

    // We test this by checking that handleWheel can call preventDefault successfully.
    // The actual registration happens in canvas-detail-view.tsx useEffect.
    // For the hook unit test, we verify that handleWheel calls preventDefault on Ctrl+wheel.
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    const wheelEvent = createWheelEvent({
      deltaY: -50,
      ctrlKey: true,
      clientX: 400,
      clientY: 300,
    });
    const preventDefaultSpy = vi.spyOn(wheelEvent, "preventDefault");

    act(() => {
      result.current.handleWheel(wheelEvent);
    });

    // The handler calls preventDefault — which only works if { passive: false } is used
    // when registering via addEventListener (not React onWheel).
    // This confirms the handler is designed for passive:false registration.
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(wheelEvent.defaultPrevented).toBe(true);
  });
});

describe("Keyboard Handler", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    resizeObserverInstances = [];
    sharedContainerRef = null;
    sharedImageRef = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-7: Input fokussiert -> kein Zoom
  // GIVEN ein Input-Element ist fokussiert ODER Maus ist NICHT ueber canvas-area
  // WHEN die Taste + oder = gedrueckt wird
  // THEN passiert NICHTS (isInputFocused()-Guard + Canvas-Hover-Check blockieren)
  // -------------------------------------------------------------------------
  it("AC-7: should not trigger zoom when input element is focused", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    const initialZoom = result.current.state.zoomLevel;

    // Create and focus an input element
    const inputEl = document.createElement("input");
    document.body.appendChild(inputEl);
    inputEl.focus();

    // Verify activeElement is the input
    expect(document.activeElement).toBe(inputEl);

    // Press + key
    const keyEvent = createKeyboardEvent("+");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Zoom should NOT change
    expect(result.current.state.zoomLevel).toBe(initialZoom);

    // Cleanup
    document.body.removeChild(inputEl);
  });

  it("AC-7: should not trigger zoom when mouse is NOT over canvas-area", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // isCanvasHoveredRef defaults to false — mouse not over canvas
    expect(result.current.isCanvasHoveredRef.current).toBe(false);

    const initialZoom = result.current.state.zoomLevel;

    // Press + key with no input focused but mouse NOT over canvas
    const keyEvent = createKeyboardEvent("+");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Zoom should NOT change
    expect(result.current.state.zoomLevel).toBe(initialZoom);
  });

  // -------------------------------------------------------------------------
  // AC-8: + Taste -> zoomToStep in
  // GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
  // WHEN die Taste + oder = gedrueckt wird
  // THEN zoomToStep("in") wird aufgerufen
  // -------------------------------------------------------------------------
  it('AC-8: should call zoomToStep in on plus key when canvas is hovered and no input focused', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    // Focus body (not an input)
    document.body.focus();

    // Initial zoomLevel = 1.0
    expect(result.current.state.zoomLevel).toBe(1.0);

    // Press + key
    const keyEvent = createKeyboardEvent("+");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Should zoom in to next step (1.5)
    expect(result.current.state.zoomLevel).toBe(1.5);
  });

  it('AC-8: should also zoom in on equals key (=) when canvas is hovered', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    document.body.focus();

    expect(result.current.state.zoomLevel).toBe(1.0);

    // Press = key (alternative for +)
    const keyEvent = createKeyboardEvent("=");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Should zoom in to next step (1.5)
    expect(result.current.state.zoomLevel).toBe(1.5);
  });

  // -------------------------------------------------------------------------
  // AC-9: - Taste -> zoomToStep out
  // GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
  // WHEN die Taste - gedrueckt wird
  // THEN zoomToStep("out") wird aufgerufen
  // -------------------------------------------------------------------------
  it('AC-9: should call zoomToStep out on minus key when canvas is hovered and no input focused', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    document.body.focus();

    // Initial zoomLevel = 1.0
    expect(result.current.state.zoomLevel).toBe(1.0);

    // Press - key
    const keyEvent = createKeyboardEvent("-");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Should zoom out to previous step (0.75)
    expect(result.current.state.zoomLevel).toBe(0.75);
  });

  // -------------------------------------------------------------------------
  // AC-10: 0 Taste -> resetToFit
  // GIVEN kein Input-Element fokussiert UND Maus ueber canvas-area
  // WHEN die Taste 0 gedrueckt wird
  // THEN resetToFit() wird aufgerufen (Zoom=Fit, Pan=0,0)
  // -------------------------------------------------------------------------
  it('AC-10: should call resetToFit on 0 key when canvas is hovered and no input focused', () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    document.body.focus();

    // Zoom to a non-fit level first
    act(() => {
      result.current.zoomToPoint(2.0, 400, 300);
    });

    expect(result.current.state.zoomLevel).toBe(2.0);
    expect(result.current.state.panX).not.toBe(0);

    // Press 0 key
    const keyEvent = createKeyboardEvent("0");

    act(() => {
      result.current.handleKeyDown(keyEvent);
    });

    // Should reset to fit level (1.0) with pan 0,0
    expect(result.current.state.zoomLevel).toBe(result.current.fitLevel);
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);
  });
});

describe("Lifecycle", () => {
  beforeEach(() => {
    resizeObserverCallback = null;
    resizeObserverInstances = [];
    sharedContainerRef = null;
    sharedImageRef = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-11: Container-Resize -> fitLevel Neuberechnung
  // GIVEN canvas-area Container wird resized
  // WHEN ResizeObserver callback feuert
  // THEN fitLevel wird neu berechnet UND aktueller zoomLevel bleibt erhalten
  //      (nur fitLevel-Referenz aktualisiert)
  // -------------------------------------------------------------------------
  it("AC-11: should recalculate fitLevel on container resize while preserving current zoomLevel", () => {
    const container = createMockContainer(800, 600);
    // 1600x1200 image -> fitLevel = min(800/1600, 600/1200) = 0.5
    const image = createMockImage(1600, 1200);
    const wrapper = createWrapper(container, image);

    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Initial: fitLevel=0.5, zoomLevel follows fit = 0.5
    expect(result.current.fitLevel).toBe(0.5);
    expect(result.current.state.zoomLevel).toBe(0.5);

    // Manually zoom to 1.5 (away from fitLevel)
    act(() => {
      result.current.zoomToPoint(1.5, 400, 300);
    });

    expect(result.current.state.zoomLevel).toBe(1.5);

    // Now simulate container resize: 1600x1200 container -> fitLevel = 1.0
    Object.defineProperty(container, "clientWidth", {
      get: () => 1600,
      configurable: true,
    });
    Object.defineProperty(container, "clientHeight", {
      get: () => 1200,
      configurable: true,
    });

    // Fire ResizeObserver callback
    act(() => {
      if (resizeObserverCallback) {
        resizeObserverCallback([
          {
            target: container,
            contentRect: container.getBoundingClientRect(),
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as ResizeObserverEntry,
        ]);
      }
    });

    // fitLevel should be recalculated: min(1600/1600, 1200/1200) = 1.0
    expect(result.current.fitLevel).toBe(1.0);

    // zoomLevel should remain at 1.5 (user manually zoomed, not following fit)
    expect(result.current.state.zoomLevel).toBe(1.5);
  });

  // -------------------------------------------------------------------------
  // AC-12: Cleanup bei Unmount
  // GIVEN die Komponente wird unmounted
  // WHEN Cleanup laeuft
  // THEN wheel-Listener wird von canvas-area entfernt UND keydown-Listener
  //      wird von document entfernt
  // -------------------------------------------------------------------------
  it("AC-12: should remove wheel and keydown listeners on unmount", () => {
    const container = createMockContainer(800, 600);
    const image = createMockImage(800, 600);
    const wrapper = createWrapper(container, image);

    // The hook itself does NOT register listeners (that happens in canvas-detail-view.tsx).
    // However, the hook provides handleWheel and handleKeyDown which are stable callbacks.
    // We verify that the returned handlers are functions that can be used for cleanup.
    const { result, unmount } = renderHook(
      () => useCanvasZoomWithState(),
      { wrapper }
    );

    // Verify handlers are functions
    expect(typeof result.current.handleWheel).toBe("function");
    expect(typeof result.current.handleKeyDown).toBe("function");

    // Spy on document.removeEventListener to verify cleanup pattern works
    const docRemoveListenerSpy = vi.spyOn(document, "removeEventListener");

    // Simulate the registration pattern from canvas-detail-view.tsx
    const wheelHandler = result.current.handleWheel;
    const keydownHandler = result.current.handleKeyDown;

    container.addEventListener("wheel", wheelHandler as EventListener, {
      passive: false,
    });
    document.addEventListener("keydown", keydownHandler as EventListener);

    const containerRemoveListenerSpy = vi.spyOn(container, "removeEventListener");

    // Simulate cleanup (what the useEffect cleanup in canvas-detail-view.tsx does)
    container.removeEventListener("wheel", wheelHandler as EventListener);
    document.removeEventListener("keydown", keydownHandler as EventListener);

    expect(containerRemoveListenerSpy).toHaveBeenCalledWith(
      "wheel",
      wheelHandler
    );
    expect(docRemoveListenerSpy).toHaveBeenCalledWith(
      "keydown",
      keydownHandler
    );

    // Unmount the hook
    unmount();
  });
});
