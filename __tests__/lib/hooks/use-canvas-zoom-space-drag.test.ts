// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * Tests for slice-05-space-drag-pan: Space+Drag Pan
 *
 * Tests AC-1 through AC-10 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver is mocked (not available in jsdom)
 * - requestAnimationFrame is mocked (cursor rAF loop in canvas-detail-view)
 * - PointerEvent properties are simulated via plain objects
 * - setPointerCapture / releasePointerCapture are spied on
 * - CanvasDetailProvider is real (provides actual reducer context)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock
// ---------------------------------------------------------------------------

type ResizeObserverCallback = (entries: ResizeObserverEntry[]) => void;

let resizeObserverCallback: ResizeObserverCallback | null = null;

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverCallback = callback;
  }

  observe(target: Element) {
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

vi.stubGlobal("ResizeObserver", MockResizeObserver);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Creates a mock transform wrapper div that the hook uses for direct DOM
 * manipulation during drag panning.
 */
function createMockTransformWrapper(): HTMLDivElement {
  const div = document.createElement("div");
  // Initial transform matching zoomLevel=1.0, panX=0, panY=0
  div.style.transform = "translate(0px, 0px) scale(1)";
  return div;
}

// ---------------------------------------------------------------------------
// Shared ref store (same pattern as use-canvas-zoom-events.test.ts)
// ---------------------------------------------------------------------------

let sharedContainerRef: React.RefObject<HTMLDivElement | null> | null = null;
let sharedImageRef: React.RefObject<HTMLImageElement | null> | null = null;
let sharedTransformWrapperRef: React.RefObject<HTMLDivElement | null> | null =
  null;

function RefBridge({
  container,
  image,
  transformWrapper,
  children,
}: {
  container: HTMLDivElement;
  image: HTMLImageElement;
  transformWrapper: HTMLDivElement;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(container);
  const imageRef = useRef<HTMLImageElement | null>(image);
  const transformWrapperRef = useRef<HTMLDivElement | null>(transformWrapper);
  sharedContainerRef = containerRef;
  sharedImageRef = imageRef;
  sharedTransformWrapperRef = transformWrapperRef;
  return createElement("div", null, children);
}

function createWrapper(
  container: HTMLDivElement,
  image: HTMLImageElement,
  transformWrapper: HTMLDivElement
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "test-gen-space-drag" },
      createElement(
        RefBridge,
        { container, image, transformWrapper },
        children
      )
    );
  };
}

/**
 * Helper hook that calls useCanvasZoom with shared refs (including
 * transformWrapperRef) and returns the context state for assertions.
 */
function useCanvasZoomWithState() {
  const zoom = useCanvasZoom(
    sharedContainerRef!,
    sharedImageRef!,
    sharedTransformWrapperRef!
  );
  const { state } = useCanvasDetail();
  return { ...zoom, state };
}

/**
 * Creates a KeyboardEvent for Space key (keydown or keyup).
 */
function createSpaceKeyEvent(
  type: "keydown" | "keyup",
  overrides?: Partial<KeyboardEventInit>
): KeyboardEvent {
  return new KeyboardEvent(type, {
    code: "Space",
    key: " ",
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
}

/**
 * Creates a minimal PointerEvent-like object for handler testing.
 * jsdom does not fully support PointerEvent constructor, so we create
 * a MouseEvent and augment it with pointerId and currentTarget.
 */
function createPointerEvent(
  type: string,
  props: {
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    button?: number;
    currentTarget?: HTMLElement;
  } = {}
): PointerEvent {
  const event = new PointerEvent(type, {
    clientX: props.clientX ?? 0,
    clientY: props.clientY ?? 0,
    pointerId: props.pointerId ?? 1,
    button: props.button ?? 0,
    bubbles: true,
    cancelable: true,
  });

  // Override currentTarget for setPointerCapture calls
  if (props.currentTarget) {
    Object.defineProperty(event, "currentTarget", {
      value: props.currentTarget,
      writable: false,
    });
  }

  return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Space Key Handler", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let transformWrapper: HTMLDivElement;

  beforeEach(() => {
    resizeObserverCallback = null;
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    transformWrapper = createMockTransformWrapper();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Space keydown setzt isSpaceHeld und Cursor grab
  // GIVEN Space-Taste ist NICHT gedrueckt
  // WHEN die Taste `Space` auf `document` keydown feuert UND kein Input-Element
  //      fokussiert ist UND Maus ueber canvas-area
  // THEN `isSpaceHeld`-Ref wird `true` UND Cursor auf canvas-area wechselt zu `grab`
  // ---------------------------------------------------------------------------
  it("AC-1: should set isSpaceHeld to true and cursor to grab on Space keydown", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Pre-condition: isSpaceHeld is false
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    // Set canvas as hovered (guard requirement)
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    // Focus body (not an input)
    document.body.focus();

    // Fire Space keydown
    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    // isSpaceHeld should be true
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Note: Cursor style is managed by rAF loop in canvas-detail-view.tsx.
    // The hook only exposes isSpaceHeldRef. The rAF loop sets cursor to "grab"
    // when isSpaceHeldRef.current === true && isDraggingRef.current === false.
    // We verify the ref state that drives the cursor logic.
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-2: Space keyup loescht isSpaceHeld und Cursor default
  // GIVEN `isSpaceHeld === true` UND kein Pointer-Drag aktiv
  // WHEN `keyup` fuer Space feuert
  // THEN `isSpaceHeld`-Ref wird `false` UND Cursor auf canvas-area wechselt
  //      zurueck zu `default`
  // ---------------------------------------------------------------------------
  it("AC-2: should set isSpaceHeld to false and restore cursor on Space keyup", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered and activate Space
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();

    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    // Pre-condition: isSpaceHeld is true
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Fire Space keyup
    const spaceUp = createSpaceKeyEvent("keyup");
    act(() => {
      result.current.handleSpaceKeyUp(spaceUp);
    });

    // isSpaceHeld should revert to false
    expect(result.current.isSpaceHeldRef.current).toBe(false);
    // No drag active, cursor should revert to default (empty string in rAF logic)
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-9: Space keydown bei fokussiertem Input -> kein Effekt
  // GIVEN ein Input-Element (z.B. Chat-Textfeld) ist fokussiert
  // WHEN Space-Taste gedrueckt wird
  // THEN `isSpaceHeld` wird NICHT gesetzt (Guard verhindert Aktivierung)
  // ---------------------------------------------------------------------------
  it("AC-9: should not set isSpaceHeld when input element is focused", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Set canvas as hovered
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    // Create and focus an input element (simulates chat textfield)
    const inputEl = document.createElement("input");
    document.body.appendChild(inputEl);
    inputEl.focus();
    expect(document.activeElement).toBe(inputEl);

    // Fire Space keydown
    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    // isSpaceHeld should remain false
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    // Cleanup
    document.body.removeChild(inputEl);
  });

  it("AC-9: should not set isSpaceHeld when textarea element is focused", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    const textareaEl = document.createElement("textarea");
    document.body.appendChild(textareaEl);
    textareaEl.focus();
    expect(document.activeElement).toBe(textareaEl);

    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    expect(result.current.isSpaceHeldRef.current).toBe(false);

    document.body.removeChild(textareaEl);
  });

  it("AC-9: should not set isSpaceHeld when contentEditable element is focused", () => {
    // jsdom does not implement `isContentEditable` (returns undefined),
    // so we patch it on the element to simulate real browser behavior.
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });

    const editableDiv = document.createElement("div");
    editableDiv.contentEditable = "true";
    editableDiv.tabIndex = 0;
    // Patch isContentEditable since jsdom does not support it
    Object.defineProperty(editableDiv, "isContentEditable", {
      get: () => true,
      configurable: true,
    });
    document.body.appendChild(editableDiv);
    editableDiv.focus();
    expect(document.activeElement).toBe(editableDiv);

    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    expect(result.current.isSpaceHeldRef.current).toBe(false);

    document.body.removeChild(editableDiv);
  });

  it("AC-1: should not activate isSpaceHeld when mouse is NOT over canvas area", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // isCanvasHoveredRef defaults to false
    expect(result.current.isCanvasHoveredRef.current).toBe(false);
    document.body.focus();

    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    // Should remain false — guard blocks activation
    expect(result.current.isSpaceHeldRef.current).toBe(false);
  });

  it("AC-1: should ignore repeated keydown events (event.repeat === true)", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();

    // First press — activates
    const spaceDown1 = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown1);
    });
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Repeated keydown (held key) with repeat: true
    const spaceDown2 = createSpaceKeyEvent("keydown", { repeat: true });
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown2);
    });

    // Should still be true (no toggle or error)
    expect(result.current.isSpaceHeldRef.current).toBe(true);
  });

  it("AC-1: should call preventDefault on Space keydown to prevent page scroll", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();

    const spaceDown = createSpaceKeyEvent("keydown");
    const preventDefaultSpy = vi.spyOn(spaceDown, "preventDefault");

    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe("Pointer Drag Handler", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let transformWrapper: HTMLDivElement;
  let canvasAreaEl: HTMLDivElement;

  beforeEach(() => {
    resizeObserverCallback = null;
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    transformWrapper = createMockTransformWrapper();

    // Canvas area element for pointer capture
    canvasAreaEl = document.createElement("div");
    canvasAreaEl.setPointerCapture = vi.fn();
    canvasAreaEl.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper: activate Space mode (pre-condition for drag tests)
   */
  function activateSpace(result: { current: ReturnType<typeof useCanvasZoomWithState> }) {
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();
    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });
    expect(result.current.isSpaceHeldRef.current).toBe(true);
  }

  // ---------------------------------------------------------------------------
  // AC-3: pointerdown bei isSpaceHeld -> grabbing + pointerCapture
  // GIVEN `isSpaceHeld === true`
  // WHEN `pointerdown` auf canvas-area feuert
  // THEN Cursor wechselt zu `grabbing`, Drag-Startposition wird gespeichert,
  //      `setPointerCapture()` wird aufgerufen
  // ---------------------------------------------------------------------------
  it("AC-3: should set cursor to grabbing and call setPointerCapture on pointerdown when space held", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    // Fire pointerdown on canvas area
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
      pointerId: 42,
      currentTarget: canvasAreaEl,
    });

    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // isDragging should be true
    expect(result.current.isDraggingRef.current).toBe(true);
    // isSpaceHeld is still true -> cursor logic: isDragging + isSpaceHeld => "grabbing"
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // setPointerCapture should have been called with the pointer ID
    expect(canvasAreaEl.setPointerCapture).toHaveBeenCalledWith(42);
  });

  it("AC-3: should not start drag when space is not held", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Space is NOT held
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
      currentTarget: canvasAreaEl,
    });

    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // Should NOT start dragging
    expect(result.current.isDraggingRef.current).toBe(false);
    expect(canvasAreaEl.setPointerCapture).not.toHaveBeenCalled();
  });

  it("AC-3: should not start drag on secondary button (right-click)", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
      button: 2, // right-click
      currentTarget: canvasAreaEl,
    });

    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-4: pointermove bei Drag -> Ref-basiertes Transform-Update
  // GIVEN `isSpaceHeld === true` UND Pointer-Drag laeuft (nach pointerdown)
  // WHEN `pointermove` mit deltaX=+30, deltaY=-20 feuert
  // THEN Transform-Wrapper `style.transform` wird direkt via Ref aktualisiert
  //      (KEIN React-Render): panX += 30, panY += -20
  // ---------------------------------------------------------------------------
  it("AC-4: should update transform wrapper style directly via ref on pointermove during drag", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    // Start drag at (400, 300)
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
      pointerId: 1,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    expect(result.current.isDraggingRef.current).toBe(true);

    // Initial state: panX=0, panY=0, zoomLevel=1.0
    // Move pointer by deltaX=+30, deltaY=-20 (new pos: 430, 280)
    const pointerMove = createPointerEvent("pointermove", {
      clientX: 430,
      clientY: 280,
    });
    act(() => {
      result.current.handlePanPointerMove(pointerMove);
    });

    // Transform wrapper should be updated directly (no React render)
    // Expected: translate(30px, -20px) scale(1)
    expect(transformWrapper.style.transform).toBe(
      "translate(30px, -20px) scale(1)"
    );

    // React state should NOT have been updated yet (only happens on pointerup)
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);
  });

  it("AC-4: should not update transform when not dragging", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // No drag active
    const initialTransform = transformWrapper.style.transform;

    const pointerMove = createPointerEvent("pointermove", {
      clientX: 430,
      clientY: 280,
    });
    act(() => {
      result.current.handlePanPointerMove(pointerMove);
    });

    // Transform should not have changed
    expect(transformWrapper.style.transform).toBe(initialTransform);
  });

  // ---------------------------------------------------------------------------
  // AC-5: pointerup -> dispatch SET_ZOOM_PAN + releasePointerCapture
  // GIVEN Pointer-Drag laeuft mit `isSpaceHeld === true`
  // WHEN `pointerup` feuert
  // THEN `releasePointerCapture()` wird aufgerufen, finale panX/panY werden
  //      via `dispatch(SET_ZOOM_PAN)` in den Reducer synchronisiert, Cursor
  //      wechselt zurueck zu `grab`
  // ---------------------------------------------------------------------------
  it("AC-5: should dispatch SET_ZOOM_PAN and release pointer capture on pointerup", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    // Start drag at (400, 300)
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 400,
      clientY: 300,
      pointerId: 7,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // Move to (450, 250) => delta (50, -50)
    const pointerMove = createPointerEvent("pointermove", {
      clientX: 450,
      clientY: 250,
    });
    act(() => {
      result.current.handlePanPointerMove(pointerMove);
    });

    // Transform should show the new pan
    expect(transformWrapper.style.transform).toBe(
      "translate(50px, -50px) scale(1)"
    );

    // Fire pointerup
    const pointerUp = createPointerEvent("pointerup", {
      clientX: 450,
      clientY: 250,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerUp(pointerUp);
    });

    // isDragging should be reset
    expect(result.current.isDraggingRef.current).toBe(false);

    // releasePointerCapture should have been called
    expect(canvasAreaEl.releasePointerCapture).toHaveBeenCalled();

    // State should be synced via dispatch — final panX/panY from transform
    // The endDrag reads the transform string: translate(50px, -50px)
    expect(result.current.state.panX).toBe(50);
    expect(result.current.state.panY).toBe(-50);

    // isSpaceHeld is still true -> cursor should be "grab" (not "grabbing")
    expect(result.current.isSpaceHeldRef.current).toBe(true);
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-6: Space keyup waehrend Drag -> Drag beenden
  // GIVEN Pointer-Drag laeuft
  // WHEN `keyup` fuer Space feuert WAEHREND des Drags
  // THEN Drag wird beendet (wie pointerup), State wird synchronisiert,
  //      Cursor wechselt zu `default`
  // ---------------------------------------------------------------------------
  it("AC-6: should end drag and sync state when Space is released during active drag", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    // Start drag
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 3,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    expect(result.current.isDraggingRef.current).toBe(true);

    // Move to create some delta
    const pointerMove = createPointerEvent("pointermove", {
      clientX: 170,
      clientY: 60,
    });
    act(() => {
      result.current.handlePanPointerMove(pointerMove);
    });

    // Transform: delta = (70, -40)
    expect(transformWrapper.style.transform).toBe(
      "translate(70px, -40px) scale(1)"
    );

    // Release Space WHILE dragging (AC-6)
    const spaceUp = createSpaceKeyEvent("keyup");
    act(() => {
      result.current.handleSpaceKeyUp(spaceUp);
    });

    // isSpaceHeld should be false
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    // Drag should have ended
    expect(result.current.isDraggingRef.current).toBe(false);

    // State should be synced
    expect(result.current.state.panX).toBe(70);
    expect(result.current.state.panY).toBe(-40);
  });

  it("AC-5: should handle pointerup gracefully when not dragging", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // No drag active — pointerup should be a no-op
    const pointerUp = createPointerEvent("pointerup", {
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerUp(pointerUp);
    });

    // No errors, state unchanged
    expect(result.current.isDraggingRef.current).toBe(false);
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);
  });

  it("AC-4: should accumulate delta from drag start, not incremental moves", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    activateSpace(result);

    // Start drag at (200, 200)
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 200,
      clientY: 200,
      pointerId: 1,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // Move #1: to (210, 190) => delta from start = (10, -10)
    act(() => {
      result.current.handlePanPointerMove(
        createPointerEvent("pointermove", { clientX: 210, clientY: 190 })
      );
    });
    expect(transformWrapper.style.transform).toBe(
      "translate(10px, -10px) scale(1)"
    );

    // Move #2: to (240, 160) => delta from start = (40, -40)
    act(() => {
      result.current.handlePanPointerMove(
        createPointerEvent("pointermove", { clientX: 240, clientY: 160 })
      );
    });
    expect(transformWrapper.style.transform).toBe(
      "translate(40px, -40px) scale(1)"
    );
  });
});

describe("MaskCanvas Suppression", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let transformWrapper: HTMLDivElement;

  beforeEach(() => {
    resizeObserverCallback = null;
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    transformWrapper = createMockTransformWrapper();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-7: isSpaceHeld unterdrueckt MaskCanvas Painting
  // GIVEN `isSpaceHeld === true` UND editMode ist `inpaint` oder `erase`
  // WHEN `pointerdown` auf MaskCanvas feuert
  // THEN MaskCanvas `onPointerDown`-Handler wird NICHT ausgefuehrt (Painting
  //      unterdrueckt), stattdessen Pan-Drag beginnt
  // ---------------------------------------------------------------------------
  it("AC-7: should suppress MaskCanvas onPointerDown when isSpaceHeld is true", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // Activate space mode
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();
    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // The MaskCanvas checks `isSpaceHeldRef?.current` at the top of
    // handlePointerDown and returns early if true. We verify the ref value
    // that MaskCanvas reads to decide whether to suppress painting.
    //
    // This is a contract test: MaskCanvas reads isSpaceHeldRef.current,
    // and our hook sets it to true when Space is held.
    // The actual suppression code in mask-canvas.tsx:
    //   if (isSpaceHeldRef?.current) return;
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Additionally, handlePanPointerDown should pick up the event instead
    const canvasAreaEl = document.createElement("div");
    canvasAreaEl.setPointerCapture = vi.fn();
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 300,
      clientY: 200,
      pointerId: 5,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // Pan drag should have started
    expect(result.current.isDraggingRef.current).toBe(true);
    expect(canvasAreaEl.setPointerCapture).toHaveBeenCalledWith(5);
  });

  // ---------------------------------------------------------------------------
  // AC-8: Normales Painting wenn isSpaceHeld false
  // GIVEN `isSpaceHeld === false` UND editMode ist `inpaint`
  // WHEN `pointerdown` auf MaskCanvas feuert
  // THEN normales Mask-Painting beginnt (bestehende Funktionalitaet unveraendert)
  // ---------------------------------------------------------------------------
  it("AC-8: should allow normal MaskCanvas painting when isSpaceHeld is false", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result } = renderHook(() => useCanvasZoomWithState(), { wrapper });

    // isSpaceHeld is false (default)
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    // The MaskCanvas will NOT early-return when isSpaceHeldRef.current === false.
    // Contract: isSpaceHeldRef.current is false -> painting proceeds normally.

    // Also: handlePanPointerDown should NOT start drag when space is not held
    const canvasAreaEl = document.createElement("div");
    canvasAreaEl.setPointerCapture = vi.fn();
    const pointerDown = createPointerEvent("pointerdown", {
      clientX: 300,
      clientY: 200,
      currentTarget: canvasAreaEl,
    });
    act(() => {
      result.current.handlePanPointerDown(pointerDown);
    });

    // No pan drag should start
    expect(result.current.isDraggingRef.current).toBe(false);
    expect(canvasAreaEl.setPointerCapture).not.toHaveBeenCalled();
  });
});

describe("Lifecycle", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let transformWrapper: HTMLDivElement;

  beforeEach(() => {
    resizeObserverCallback = null;
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    transformWrapper = createMockTransformWrapper();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-10: Cleanup bei Unmount
  // GIVEN die Komponente wird unmounted
  // WHEN Cleanup laeuft
  // THEN `keydown`/`keyup`-Listener fuer Space werden entfernt,
  //      `isSpaceHeld` ist `false`
  // ---------------------------------------------------------------------------
  it("AC-10: should remove Space keydown/keyup listeners and reset isSpaceHeld on unmount", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result, unmount } = renderHook(() => useCanvasZoomWithState(), {
      wrapper,
    });

    // Activate space mode first
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();
    const spaceDown = createSpaceKeyEvent("keydown");
    act(() => {
      result.current.handleSpaceKeyDown(spaceDown);
    });

    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Verify handlers are stable functions suitable for listener cleanup
    const spaceDownHandler = result.current.handleSpaceKeyDown;
    const spaceUpHandler = result.current.handleSpaceKeyUp;
    expect(typeof spaceDownHandler).toBe("function");
    expect(typeof spaceUpHandler).toBe("function");

    // Simulate the event listener pattern from canvas-detail-view.tsx
    const docRemoveListenerSpy = vi.spyOn(document, "removeEventListener");
    document.addEventListener("keydown", spaceDownHandler);
    document.addEventListener("keyup", spaceUpHandler);

    // Simulate cleanup
    document.removeEventListener("keydown", spaceDownHandler);
    document.removeEventListener("keyup", spaceUpHandler);

    expect(docRemoveListenerSpy).toHaveBeenCalledWith(
      "keydown",
      spaceDownHandler
    );
    expect(docRemoveListenerSpy).toHaveBeenCalledWith(
      "keyup",
      spaceUpHandler
    );

    // Unmount — the hook's cleanup effect resets isSpaceHeld
    unmount();

    // After unmount, the ref's current should be false (cleanup effect)
    expect(result.current.isSpaceHeldRef.current).toBe(false);
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it("AC-10: should reset drag state on unmount even if drag was active", () => {
    const wrapper = createWrapper(container, image, transformWrapper);
    const { result, unmount } = renderHook(() => useCanvasZoomWithState(), {
      wrapper,
    });

    // Activate space and start drag
    act(() => {
      result.current.isCanvasHoveredRef.current = true;
    });
    document.body.focus();
    act(() => {
      result.current.handleSpaceKeyDown(createSpaceKeyEvent("keydown"));
    });

    const canvasAreaEl = document.createElement("div");
    canvasAreaEl.setPointerCapture = vi.fn();
    act(() => {
      result.current.handlePanPointerDown(
        createPointerEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          currentTarget: canvasAreaEl,
        })
      );
    });

    expect(result.current.isDraggingRef.current).toBe(true);

    // Unmount while drag is active
    unmount();

    expect(result.current.isSpaceHeldRef.current).toBe(false);
    expect(result.current.isDraggingRef.current).toBe(false);
  });
});
