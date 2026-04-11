// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { useTouchGestures } from "@/lib/hooks/use-touch-gestures";
import type { UseTouchGesturesOptions } from "@/lib/hooks/use-touch-gestures";

/**
 * Tests for slice-08-double-tap-swipe: Double-Tap Detection
 *
 * Tests AC-1 through AC-7 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - TouchEvent is simulated via native DOM dispatchEvent (jsdom)
 * - vi.useFakeTimers for timing-based double-tap window (300ms)
 * - ResizeObserver is mocked (not available in jsdom)
 * - CanvasDetailProvider is real (provides actual reducer context)
 * - zoomToPoint / resetToFit are vi.fn() spies to verify calls
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock (required by jsdom environment)
// ---------------------------------------------------------------------------

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock container (main element) with addEventListener support.
 * In jsdom, regular elements support addEventListener natively.
 */
function createMockContainer(): HTMLElement {
  const el = document.createElement("main");
  el.setAttribute("data-testid", "canvas-area");
  Object.defineProperty(el, "clientWidth", {
    get: () => 800,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    get: () => 600,
    configurable: true,
  });
  el.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    toJSON: () => {},
  });
  // Append to document so events propagate correctly
  document.body.appendChild(el);
  return el;
}

/**
 * Creates a mock transform wrapper div.
 */
function createMockTransformWrapper(): HTMLDivElement {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "zoom-transform-wrapper");
  div.style.transform = "translate(0px, 0px) scale(1)";
  return div;
}

/**
 * Creates a TouchEvent-like object and dispatches it on the target element.
 * jsdom doesn't support the TouchEvent constructor, so we create a custom event
 * and patch the touches / changedTouches properties separately.
 *
 * For touchend events, `touches` should be the fingers still on screen (usually empty)
 * while `changedTouches` should contain the finger(s) that were just lifted.
 */
function createTouchEvent(
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  touches: Array<{ clientX: number; clientY: number }>,
  target: HTMLElement,
  changedTouches?: Array<{ clientX: number; clientY: number }>
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });

  const makeTouchList = (items: Array<{ clientX: number; clientY: number }>) =>
    items.map(
      (t, i) =>
        ({
          identifier: i,
          clientX: t.clientX,
          clientY: t.clientY,
          pageX: t.clientX,
          pageY: t.clientY,
          screenX: t.clientX,
          screenY: t.clientY,
          target,
          radiusX: 0,
          radiusY: 0,
          rotationAngle: 0,
          force: 1,
        }) as unknown as Touch
    );

  const touchList = makeTouchList(touches);
  const changedList = changedTouches ? makeTouchList(changedTouches) : touchList;

  Object.defineProperty(event, "touches", {
    get: () => touchList,
    configurable: true,
  });
  Object.defineProperty(event, "changedTouches", {
    get: () => changedList,
    configurable: true,
  });
  Object.defineProperty(event, "targetTouches", {
    get: () => touchList,
    configurable: true,
  });

  return event;
}

/**
 * Dispatches a touch event on the container.
 * For touchend, pass changedTouches separately (the lifted finger).
 */
function fireTouchEvent(
  container: HTMLElement,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  touches: Array<{ clientX: number; clientY: number }>,
  changedTouches?: Array<{ clientX: number; clientY: number }>
) {
  const event = createTouchEvent(type, touches, container, changedTouches);
  container.dispatchEvent(event);
  return event;
}

/**
 * Simulates a single tap (touchstart with 1 finger, then touchend with 0 fingers).
 * The changedTouches on touchend contains the lifted finger.
 */
function simulateSingleTap(
  container: HTMLElement,
  position: { clientX: number; clientY: number }
) {
  fireTouchEvent(container, "touchstart", [position]);
  fireTouchEvent(container, "touchend", [], [position]);
}

/**
 * Simulates a double-tap: two taps in quick succession.
 * Uses fake timers so no real delay is needed between taps.
 */
function simulateDoubleTap(
  container: HTMLElement,
  position: { clientX: number; clientY: number },
  delayBetweenTaps = 100
) {
  // First tap
  simulateSingleTap(container, position);

  // Advance time by delayBetweenTaps ms (within the 300ms window)
  vi.advanceTimersByTime(delayBetweenTaps);

  // Second tap
  simulateSingleTap(container, position);
}

// ---------------------------------------------------------------------------
// Wrapper + RefBridge (real CanvasDetailProvider context)
// ---------------------------------------------------------------------------

let sharedContainerRef: React.RefObject<HTMLElement | null> | null = null;
let sharedTransformRef: React.RefObject<HTMLDivElement | null> | null = null;

function RefBridge({
  container,
  transformWrapper,
  children,
}: {
  container: HTMLElement;
  transformWrapper: HTMLDivElement;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLElement | null>(container);
  const transformRef = useRef<HTMLDivElement | null>(transformWrapper);
  sharedContainerRef = containerRef;
  sharedTransformRef = transformRef;
  return createElement("div", null, children);
}

function createWrapper(container: HTMLElement, transformWrapper: HTMLDivElement) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "test-gen-1" },
      createElement(RefBridge, { container, transformWrapper }, children)
    );
  };
}

/**
 * Helper hook that calls useTouchGestures with shared refs
 * and also returns the context state + dispatch for assertions.
 */
function useTouchGesturesWithState(options: UseTouchGesturesOptions) {
  useTouchGestures(sharedContainerRef!, sharedTransformRef!, options);
  const { state, dispatch } = useCanvasDetail();
  return { state, dispatch };
}

// ---------------------------------------------------------------------------
// Tests: Double-Tap Detection (Slice 8, AC-1 through AC-7)
// ---------------------------------------------------------------------------

describe("useTouchGestures - Double-Tap Detection", () => {
  let container: HTMLElement;
  let transformWrapper: HTMLDivElement;
  let mockZoomToPoint: ReturnType<typeof vi.fn>;
  let mockResetToFit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = createMockContainer();
    transformWrapper = createMockTransformWrapper();
    sharedContainerRef = null;
    sharedTransformRef = null;
    mockZoomToPoint = vi.fn();
    mockResetToFit = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Double-Tap bei Fit -> Zoom 100%
  // GIVEN zoomLevel === fitLevel (Fit-Ansicht) und editMode ist null
  // WHEN der User zwei Mal innerhalb von 300ms auf den Canvas tippt (Double-Tap)
  // THEN wird zoomLevel auf 1.0 (100%) gesetzt mit Ankerpunkt an der Tap-Position
  // ---------------------------------------------------------------------------
  it("AC-1: should zoom to 1.0 with anchor at tap position on double-tap when at fitLevel", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set state to fitLevel (simulate being at fit view)
    act(() => {
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    expect(result.current.state.zoomLevel).toBe(fitLevel);
    expect(result.current.state.editMode).toBeNull();

    // Perform double-tap at position (400, 300)
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // zoomToPoint should have been called with 1.0 and container-relative coordinates
    // Container getBoundingClientRect returns top=0, left=0
    // So cursorX = 400 - 0 = 400, cursorY = 300 - 0 = 300
    expect(mockZoomToPoint).toHaveBeenCalledTimes(1);
    expect(mockZoomToPoint).toHaveBeenCalledWith(1.0, 400, 300);
    expect(mockResetToFit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-2: Double-Tap bei 100% -> Fit
  // GIVEN zoomLevel === 1.0 (100%) und editMode ist null
  // WHEN der User einen Double-Tap ausfuehrt
  // THEN wird zoomLevel auf fitLevel gesetzt und panX === 0, panY === 0
  // ---------------------------------------------------------------------------
  it("AC-2: should zoom to fitLevel with panX=0 panY=0 on double-tap when at 1.0", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Initial zoomLevel is 1.0 (default), which is NOT fitLevel (0.75)
    expect(result.current.state.zoomLevel).toBe(1.0);
    expect(result.current.state.editMode).toBeNull();

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // resetToFit should be called (zoom is at 1.0, which is != fitLevel)
    expect(mockResetToFit).toHaveBeenCalledTimes(1);
    expect(mockZoomToPoint).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-3: Double-Tap bei beliebigem Zoom -> Fit
  // GIVEN zoomLevel === 2.5 (beliebiger Zoom ungleich Fit und ungleich 1.0)
  // WHEN der User einen Double-Tap ausfuehrt und editMode ist null
  // THEN wird zoomLevel auf fitLevel gesetzt und panX === 0, panY === 0
  // ---------------------------------------------------------------------------
  it("AC-3: should zoom to fitLevel with panX=0 panY=0 on double-tap when at arbitrary zoom", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set zoomLevel to 2.5 (arbitrary, not fit, not 1.0)
    act(() => {
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: 2.5,
        panX: 100,
        panY: 50,
      });
    });

    expect(result.current.state.zoomLevel).toBe(2.5);
    expect(result.current.state.editMode).toBeNull();

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // resetToFit should be called (zoom is at 2.5, which is != fitLevel)
    expect(mockResetToFit).toHaveBeenCalledTimes(1);
    expect(mockZoomToPoint).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-4: Double-Tap blockiert bei inpaint
  // GIVEN editMode === "inpaint"
  // WHEN der User einen Double-Tap ausfuehrt
  // THEN passiert nichts (kein Zoom-Toggle, kein Mask-Punkt)
  // ---------------------------------------------------------------------------
  it("AC-4: should not toggle zoom on double-tap when editMode is inpaint", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set editMode to inpaint and zoom to fitLevel
    act(() => {
      result.current.dispatch({ type: "SET_EDIT_MODE", editMode: "inpaint" });
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    expect(result.current.state.editMode).toBe("inpaint");

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // Nothing should happen — neither zoomToPoint nor resetToFit called
    expect(mockZoomToPoint).not.toHaveBeenCalled();
    expect(mockResetToFit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-5: Double-Tap blockiert bei erase
  // GIVEN editMode === "erase"
  // WHEN der User einen Double-Tap ausfuehrt
  // THEN passiert nichts (kein Zoom-Toggle, kein Mask-Punkt)
  // ---------------------------------------------------------------------------
  it("AC-5: should not toggle zoom on double-tap when editMode is erase", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set editMode to erase and zoom to fitLevel
    act(() => {
      result.current.dispatch({ type: "SET_EDIT_MODE", editMode: "erase" });
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    expect(result.current.state.editMode).toBe("erase");

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // Nothing should happen
    expect(mockZoomToPoint).not.toHaveBeenCalled();
    expect(mockResetToFit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // AC-6: Double-Tap erlaubt bei instruction/outpaint
  // GIVEN editMode === "instruction" oder editMode === "outpaint"
  // WHEN der User einen Double-Tap ausfuehrt
  // THEN wird der Zoom-Toggle normal ausgefuehrt (nicht blockiert)
  // ---------------------------------------------------------------------------
  it('AC-6: should toggle zoom on double-tap when editMode is "instruction"', () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set editMode to instruction and zoom to fitLevel
    act(() => {
      result.current.dispatch({ type: "SET_EDIT_MODE", editMode: "instruction" });
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    expect(result.current.state.editMode).toBe("instruction");

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // Should zoom to 1.0 (since we're at fitLevel)
    expect(mockZoomToPoint).toHaveBeenCalledTimes(1);
    expect(mockZoomToPoint).toHaveBeenCalledWith(1.0, 400, 300);
  });

  it('AC-6: should toggle zoom on double-tap when editMode is "outpaint"', () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set editMode to outpaint and zoom to fitLevel
    act(() => {
      result.current.dispatch({ type: "SET_EDIT_MODE", editMode: "outpaint" });
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    expect(result.current.state.editMode).toBe("outpaint");

    // Perform double-tap
    act(() => {
      simulateDoubleTap(container, { clientX: 400, clientY: 300 });
    });

    // Should zoom to 1.0 (since we're at fitLevel)
    expect(mockZoomToPoint).toHaveBeenCalledTimes(1);
    expect(mockZoomToPoint).toHaveBeenCalledWith(1.0, 400, 300);
  });

  // ---------------------------------------------------------------------------
  // AC-7: Einzelner Tap loest keinen Toggle aus
  // GIVEN ein einzelner Tap (kein zweiter Tap innerhalb 300ms)
  // WHEN 300ms vergehen
  // THEN wird KEIN Zoom-Toggle ausgefuehrt
  // ---------------------------------------------------------------------------
  it("AC-7: should not toggle zoom on single tap after 300ms timeout", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set to fitLevel
    act(() => {
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    // Single tap
    act(() => {
      simulateSingleTap(container, { clientX: 400, clientY: 300 });
    });

    // Advance time past the 300ms window
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // No zoom toggle should have happened
    expect(mockZoomToPoint).not.toHaveBeenCalled();
    expect(mockResetToFit).not.toHaveBeenCalled();
  });

  it("AC-7: should not toggle zoom when second tap arrives after 300ms window", () => {
    const fitLevel = 0.75;
    const wrapper = createWrapper(container, transformWrapper);
    const { result } = renderHook(
      () =>
        useTouchGesturesWithState({
          fitLevel,
          zoomToPoint: mockZoomToPoint,
          resetToFit: mockResetToFit,
        }),
      { wrapper }
    );

    // Set to fitLevel
    act(() => {
      result.current.dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: fitLevel,
        panX: 0,
        panY: 0,
      });
    });

    // First tap
    act(() => {
      simulateSingleTap(container, { clientX: 400, clientY: 300 });
    });

    // Advance time past the 300ms window
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Second tap (too late — should not trigger double-tap)
    act(() => {
      simulateSingleTap(container, { clientX: 400, clientY: 300 });
    });

    // No zoom toggle should have happened
    expect(mockZoomToPoint).not.toHaveBeenCalled();
    expect(mockResetToFit).not.toHaveBeenCalled();
  });
});
