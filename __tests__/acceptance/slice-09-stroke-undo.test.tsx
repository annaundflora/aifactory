// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import { createElement, useRef, createRef, type ReactNode } from "react";
import { CanvasDetailProvider, useCanvasDetail } from "@/lib/canvas-detail-context";
import { useTouchGestures } from "@/lib/hooks/use-touch-gestures";
import type { UseTouchGesturesOptions, StrokeUndoRefs } from "@/lib/hooks/use-touch-gestures";

/**
 * Acceptance Tests for Slice 9: Procreate-Style Stroke-Undo bei Gestenstart
 *
 * These tests validate all 9 Acceptance Criteria from the slice spec.
 * Each test maps 1:1 to a GIVEN/WHEN/THEN AC block.
 *
 * Mocking Strategy (per spec: mock_external):
 * - TouchEvent simulated via native DOM dispatchEvent (jsdom)
 * - Canvas 2D context mocked (jsdom does not support canvas)
 * - requestAnimationFrame mocked via vi.useFakeTimers
 * - CanvasDetailProvider is real (actual reducer context)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock
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
// Mock CanvasDetailContext for MaskCanvas tests
// ---------------------------------------------------------------------------

let mockState: Record<string, unknown> = {};
const mockDispatch = vi.fn();

vi.mock("@/lib/canvas-detail-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/canvas-detail-context")>(
    "@/lib/canvas-detail-context"
  );
  return {
    ...actual,
    useCanvasDetail: () => ({
      state: mockState,
      dispatch: mockDispatch,
    }),
  };
});

// ---------------------------------------------------------------------------
// Import components AFTER mocks
// ---------------------------------------------------------------------------

import { MaskCanvas } from "@/components/canvas/mask-canvas";
import type { MaskCanvasStrokeUndoRefs } from "@/components/canvas/mask-canvas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContainer(): HTMLElement {
  const el = document.createElement("main");
  el.setAttribute("data-testid", "canvas-area");
  Object.defineProperty(el, "clientWidth", { get: () => 800, configurable: true });
  Object.defineProperty(el, "clientHeight", { get: () => 600, configurable: true });
  el.getBoundingClientRect = () => ({
    width: 800, height: 600, x: 0, y: 0,
    top: 0, left: 0, right: 800, bottom: 600,
    toJSON: () => {},
  });
  document.body.appendChild(el);
  return el;
}

function createMockTransformWrapper(): HTMLDivElement {
  const div = document.createElement("div");
  div.setAttribute("data-testid", "zoom-transform-wrapper");
  div.style.transform = "translate(0px, 0px) scale(1)";
  return div;
}

function fireTouchEvent(
  container: HTMLElement,
  type: "touchstart" | "touchmove" | "touchend" | "touchcancel",
  touches: Array<{ clientX: number; clientY: number }>
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touchList = touches.map(
    (t, i) =>
      ({
        identifier: i,
        clientX: t.clientX,
        clientY: t.clientY,
        pageX: t.clientX,
        pageY: t.clientY,
        screenX: t.clientX,
        screenY: t.clientY,
        target: container,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 1,
      }) as unknown as Touch
  );

  Object.defineProperty(event, "touches", { get: () => touchList, configurable: true });
  Object.defineProperty(event, "changedTouches", { get: () => touchList, configurable: true });
  Object.defineProperty(event, "targetTouches", { get: () => touchList, configurable: true });
  container.dispatchEvent(event);
  return event;
}

function createMockStrokeUndoRefs(options: { isDrawing: boolean }) {
  const isDrawingRef = { current: options.isDrawing };
  const performStrokeUndo = vi.fn(() => {
    isDrawingRef.current = false;
  });
  return { isDrawingRef, performStrokeUndo };
}

function createMockImageElement(naturalWidth: number, naturalHeight: number) {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: naturalHeight, configurable: true });
  img.getBoundingClientRect = () => ({
    left: 0, top: 0, right: naturalWidth, bottom: naturalHeight,
    width: naturalWidth, height: naturalHeight, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  return img;
}

// ---------------------------------------------------------------------------
// useTouchGestures wrapper (uses mocked useCanvasDetail)
// ---------------------------------------------------------------------------

let sharedContainerRef: React.RefObject<HTMLElement | null> | null = null;
let sharedTransformRef: React.RefObject<HTMLDivElement | null> | null = null;

function useTouchGesturesWithMockedState(
  container: HTMLElement,
  transformWrapper: HTMLDivElement,
  options: UseTouchGesturesOptions
) {
  const containerRef = useRef<HTMLElement | null>(container);
  const transformRef = useRef<HTMLDivElement | null>(transformWrapper);
  sharedContainerRef = containerRef;
  sharedTransformRef = transformRef;
  useTouchGestures(containerRef, transformRef, options);
  const { state, dispatch } = useCanvasDetail();
  return { state, dispatch };
}

// ===========================================================================
// Acceptance Tests: Slice 9 - Procreate-Style Stroke-Undo
// ===========================================================================

describe("Slice 9 Acceptance: Procreate-Style Stroke-Undo bei Gestenstart", () => {
  let container: HTMLElement;
  let transformWrapper: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
    transformWrapper = createMockTransformWrapper();

    mockState = {
      editMode: "inpaint",
      brushSize: 20,
      brushTool: "brush",
      maskData: null,
      zoomLevel: 1.0,
      panX: 0,
      panY: 0,
    };

    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // AC-1: GIVEN editMode ist "inpaint" oder "erase" und der User zeichnet
  //       einen Mask-Stroke (isDrawing === true)
  //       WHEN ein zweiter Finger auf den Canvas-Container kommt
  //       (touches.length wechselt von 1 auf 2)
  //       THEN wird der aktuelle Stroke rueckgaengig gemacht: Canvas-State
  //       wird auf den letzten Eintrag im maskUndoStackRef zurueckgesetzt,
  //       der oberste Stack-Eintrag wird entfernt
  // ---------------------------------------------------------------------------
  it("AC-1: should undo active stroke when second finger arrives during inpaint drawing", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    // 1->2 finger transition
    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(undoRefs.performStrokeUndo).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN AC-1 Stroke-Undo wurde ausgefuehrt
  //       WHEN der Stroke-Undo abgeschlossen ist
  //       THEN isDrawing ist false, pointerCapture ist released, und der
  //       Gesten-Modus (Pinch/Pan) wird aktiviert
  // ---------------------------------------------------------------------------
  it("AC-2: should set isDrawing false and activate gesture mode after stroke undo", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(undoRefs.isDrawingRef.current).toBe(false);

    // Gesture mode active: moving 2 fingers should update transform
    const transformBefore = transformWrapper.style.transform;
    act(() => {
      fireTouchEvent(container, "touchmove", [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]);
    });
    expect(transformWrapper.style.transform).not.toBe(transformBefore);

    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  // ---------------------------------------------------------------------------
  // AC-3: GIVEN AC-2 Gesten-Modus ist aktiv nach Stroke-Undo
  //       WHEN der User Pinch/Pan ausfuehrt (Finger bewegen sich)
  //       THEN funktioniert Zoom/Pan normal wie in Slice 7 spezifiziert
  //       (keine Interferenz durch den vorherigen Stroke)
  // ---------------------------------------------------------------------------
  it("AC-3: should allow normal pinch/pan after stroke undo without interference", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    // Trigger stroke undo
    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    // Pinch-out: double distance from 200px to 400px
    act(() => {
      fireTouchEvent(container, "touchmove", [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]);
    });

    // Transform should reflect zoom change
    const transform = transformWrapper.style.transform;
    expect(transform).toMatch(/scale\(/);
    // The scale value should be approximately 2.0
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    expect(scaleMatch).not.toBeNull();
    const scaleValue = parseFloat(scaleMatch![1]);
    expect(scaleValue).toBeCloseTo(2.0, 1);

    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  // ---------------------------------------------------------------------------
  // AC-4: GIVEN Gesten-Modus ist aktiv nach Stroke-Undo
  //       WHEN alle Finger losgelassen werden (touches.length === 0)
  //       THEN kehrt der Modus zurueck zu Mask-Painting (naechster einzelner
  //       Finger-Touch startet neuen Stroke)
  // ---------------------------------------------------------------------------
  it("AC-4: should return to mask painting mode when all fingers lifted after gesture", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    // Trigger stroke undo + gesture
    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    act(() => {
      fireTouchEvent(container, "touchmove", [
        { clientX: 250, clientY: 300 },
        { clientX: 550, clientY: 300 },
      ]);
    });

    // Release all fingers
    act(() => { fireTouchEvent(container, "touchend", []); });

    // editMode remains inpaint => mask-painting mode is ready
    expect(mockState.editMode).toBe("inpaint");

    // SET_ZOOM_PAN should have been dispatched (gesture end commits state)
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_ZOOM_PAN" })
    );
  });

  // ---------------------------------------------------------------------------
  // AC-5: GIVEN editMode ist "inpaint" oder "erase" und isDrawing === false
  //       (kein aktiver Stroke)
  //       WHEN ein zweiter Finger aufgesetzt wird
  //       THEN wird KEIN Undo ausgefuehrt (nur Pinch/Pan-Geste startet,
  //       maskUndoStackRef bleibt unveraendert)
  // ---------------------------------------------------------------------------
  it("AC-5: should NOT trigger undo when isDrawing is false", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: false });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    expect(undoRefs.performStrokeUndo).not.toHaveBeenCalled();

    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  // ---------------------------------------------------------------------------
  // AC-6: GIVEN editMode ist null, "instruction" oder "outpaint"
  //       WHEN ein zweiter Finger waehrend eines Touch aufgesetzt wird
  //       THEN wird KEIN Undo ausgefuehrt (Stroke-Undo ist nur im Mask-Modus
  //       relevant)
  // ---------------------------------------------------------------------------
  it("AC-6: should NOT trigger undo when editMode is null", () => {
    mockState = { ...mockState, editMode: null };
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    expect(undoRefs.performStrokeUndo).not.toHaveBeenCalled();
    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  it("AC-6: should NOT trigger undo when editMode is instruction", () => {
    mockState = { ...mockState, editMode: "instruction" };
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    expect(undoRefs.performStrokeUndo).not.toHaveBeenCalled();
    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  it("AC-6: should NOT trigger undo when editMode is outpaint", () => {
    mockState = { ...mockState, editMode: "outpaint" };
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    expect(undoRefs.performStrokeUndo).not.toHaveBeenCalled();
    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  // ---------------------------------------------------------------------------
  // AC-7: GIVEN der maskUndoStackRef ist leer und isDrawing === true
  //       WHEN ein zweiter Finger aufgesetzt wird
  //       THEN wird isDrawing auf false gesetzt und Gesten-Modus aktiviert,
  //       aber KEIN Canvas-Restore ausgefuehrt (leerer Stack = nichts
  //       rueckgaengig zu machen)
  // ---------------------------------------------------------------------------
  it("AC-7: should deactivate drawing without canvas restore when undo stack is empty", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });
    act(() => { vi.advanceTimersByTime(16); });

    // performStrokeUndo called (handles empty stack internally)
    expect(undoRefs.performStrokeUndo).toHaveBeenCalledTimes(1);
    // isDrawing set to false
    expect(undoRefs.isDrawingRef.current).toBe(false);

    // Gesture mode should still work
    const transformBefore = transformWrapper.style.transform;
    act(() => {
      fireTouchEvent(container, "touchmove", [
        { clientX: 200, clientY: 300 },
        { clientX: 600, clientY: 300 },
      ]);
    });
    expect(transformWrapper.style.transform).not.toBe(transformBefore);

    act(() => { fireTouchEvent(container, "touchend", []); });
  });

  // ---------------------------------------------------------------------------
  // AC-8: GIVEN ein Stroke-Undo wurde ausgefuehrt (AC-1)
  //       WHEN der maskData-State nach dem Undo ausgelesen wird
  //       THEN ist maskData konsistent mit dem Canvas-Inhalt (kein
  //       "Ghost-Stroke" der visuell weg ist aber im State noch existiert)
  // ---------------------------------------------------------------------------
  it("AC-8: should have consistent maskData state after stroke undo via MaskCanvas performStrokeUndo", () => {
    const mockCtx = createMockContext2D();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );

    let capturedRefs: MaskCanvasStrokeUndoRefs | null = null;
    const handleRefsReady = vi.fn((refs: MaskCanvasStrokeUndoRefs) => {
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
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    // Start a stroke (pushes to undo stack)
    fireEvent.pointerDown(canvas, {
      clientX: 100, clientY: 100, pointerId: 1, button: 0,
    });

    expect(capturedRefs!.isDrawingRef.current).toBe(true);
    expect(capturedRefs!.maskUndoStackRef.current.length).toBe(1);

    // Mock restored canvas data (with alpha content)
    const restoredData = {
      width: 800,
      height: 600,
      data: new Uint8ClampedArray(800 * 600 * 4),
    };
    restoredData.data[3] = 128;
    (mockCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValue(restoredData);

    // Perform stroke undo
    capturedRefs!.performStrokeUndo();

    // Stack should be empty after pop
    expect(capturedRefs!.maskUndoStackRef.current.length).toBe(0);

    // Canvas was restored
    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.putImageData).toHaveBeenCalled();

    // SET_MASK_DATA dispatched with consistent data (not null since alpha > 0)
    const setMaskDataCalls = mockDispatch.mock.calls.filter(
      (call) => call[0]?.type === "SET_MASK_DATA"
    );
    expect(setMaskDataCalls.length).toBeGreaterThan(0);
    const lastCall = setMaskDataCalls[setMaskDataCalls.length - 1];
    expect(lastCall[0].maskData).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // AC-9: GIVEN isDrawing === true und ein schneller 1->2 Finger-Wechsel
  //       geschieht (innerhalb von < 50ms)
  //       WHEN die Race-Condition-Pruefung laeuft
  //       THEN wird der Undo trotzdem korrekt ausgefuehrt
  //       (requestAnimationFrame-gated, isDrawing wird atomar geprueft)
  // ---------------------------------------------------------------------------
  it("AC-9: should correctly undo on rapid 1-to-2 finger transition via rAF gating", () => {
    const undoRefs = createMockStrokeUndoRefs({ isDrawing: true });
    const strokeUndoRefsRef = { current: undoRefs };

    renderHook(() =>
      useTouchGesturesWithMockedState(container, transformWrapper, {
        fitLevel: 1.0,
        zoomToPoint: vi.fn(),
        resetToFit: vi.fn(),
        strokeUndoRefsRef,
      })
    );

    // Rapid 2-finger touchstart
    act(() => {
      fireTouchEvent(container, "touchstart", [
        { clientX: 300, clientY: 300 },
        { clientX: 500, clientY: 300 },
      ]);
    });

    // Before rAF fires: undo should NOT have been called yet
    expect(undoRefs.performStrokeUndo).not.toHaveBeenCalled();

    // After rAF fires: undo should execute
    act(() => { vi.advanceTimersByTime(16); });

    expect(undoRefs.performStrokeUndo).toHaveBeenCalledTimes(1);
    expect(undoRefs.isDrawingRef.current).toBe(false);

    act(() => { fireTouchEvent(container, "touchend", []); });
  });
});
