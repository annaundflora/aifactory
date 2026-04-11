// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * Acceptance Tests for slice-05-space-drag-pan: Space+Drag Pan
 *
 * 1:1 mapping from GIVEN/WHEN/THEN acceptance criteria.
 * Each test documents its AC-ID and the original spec text.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver mocked (jsdom limitation)
 * - requestAnimationFrame mocked where needed
 * - CanvasDetailProvider is real (actual reducer)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock
// ---------------------------------------------------------------------------

class MockResizeObserver {
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: target.getBoundingClientRect(),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        } as ResizeObserverEntry,
      ],
      this
    );
  }
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContainer(w: number, h: number): HTMLDivElement {
  const div = document.createElement("div");
  Object.defineProperty(div, "clientWidth", { get: () => w, configurable: true });
  Object.defineProperty(div, "clientHeight", { get: () => h, configurable: true });
  div.getBoundingClientRect = () => ({
    width: w, height: h, x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, toJSON: () => {},
  });
  return div;
}

function createMockImage(nw: number, nh: number): HTMLImageElement {
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { get: () => nw, configurable: true });
  Object.defineProperty(img, "naturalHeight", { get: () => nh, configurable: true });
  Object.defineProperty(img, "complete", { get: () => true, configurable: true });
  return img;
}

function createMockTransformWrapper(): HTMLDivElement {
  const div = document.createElement("div");
  div.style.transform = "translate(0px, 0px) scale(1)";
  return div;
}

let sharedContainerRef: React.RefObject<HTMLDivElement | null> | null = null;
let sharedImageRef: React.RefObject<HTMLImageElement | null> | null = null;
let sharedTransformWrapperRef: React.RefObject<HTMLDivElement | null> | null = null;

function RefBridge({ container, image, tw, children }: {
  container: HTMLDivElement; image: HTMLImageElement; tw: HTMLDivElement; children: ReactNode;
}) {
  const cr = useRef<HTMLDivElement | null>(container);
  const ir = useRef<HTMLImageElement | null>(image);
  const twr = useRef<HTMLDivElement | null>(tw);
  sharedContainerRef = cr;
  sharedImageRef = ir;
  sharedTransformWrapperRef = twr;
  return createElement("div", null, children);
}

function createWrapper(c: HTMLDivElement, i: HTMLImageElement, tw: HTMLDivElement) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "acc-test-gen" },
      createElement(RefBridge, { container: c, image: i, tw }, children)
    );
  };
}

function useZoomWithState() {
  const zoom = useCanvasZoom(sharedContainerRef!, sharedImageRef!, sharedTransformWrapperRef!);
  const { state } = useCanvasDetail();
  return { ...zoom, state };
}

function spaceKeyEvent(type: "keydown" | "keyup", overrides?: Partial<KeyboardEventInit>): KeyboardEvent {
  return new KeyboardEvent(type, { code: "Space", key: " ", bubbles: true, cancelable: true, ...overrides });
}

function pointerEvent(type: string, props: {
  clientX?: number; clientY?: number; pointerId?: number; button?: number; currentTarget?: HTMLElement;
} = {}): PointerEvent {
  const ev = new PointerEvent(type, {
    clientX: props.clientX ?? 0, clientY: props.clientY ?? 0,
    pointerId: props.pointerId ?? 1, button: props.button ?? 0,
    bubbles: true, cancelable: true,
  });
  if (props.currentTarget) {
    Object.defineProperty(ev, "currentTarget", { value: props.currentTarget, writable: false });
  }
  return ev;
}

// ---------------------------------------------------------------------------
// Acceptance Tests — Space+Drag Pan
// ---------------------------------------------------------------------------

describe("Space+Drag Pan Acceptance", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let tw: HTMLDivElement;
  let canvasArea: HTMLDivElement;

  beforeEach(() => {
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    tw = createMockTransformWrapper();
    canvasArea = document.createElement("div");
    canvasArea.setPointerCapture = vi.fn();
    canvasArea.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-1
  // ---------------------------------------------------------------------------
  it(`AC-1: GIVEN Space-Taste ist NICHT gedrueckt
      WHEN die Taste Space auf document keydown feuert UND kein Input-Element fokussiert ist UND Maus ueber canvas-area
      THEN isSpaceHeld-Ref wird true UND Cursor auf canvas-area wechselt zu grab`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    expect(result.current.isSpaceHeldRef.current).toBe(false);

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();

    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });

    expect(result.current.isSpaceHeldRef.current).toBe(true);
    // Cursor is "grab" when isSpaceHeld && !isDragging (rAF logic in canvas-detail-view)
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-2
  // ---------------------------------------------------------------------------
  it(`AC-2: GIVEN isSpaceHeld === true UND kein Pointer-Drag aktiv
      WHEN keyup fuer Space feuert
      THEN isSpaceHeld-Ref wird false UND Cursor auf canvas-area wechselt zurueck zu default`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    act(() => { result.current.handleSpaceKeyUp(spaceKeyEvent("keyup")); });

    expect(result.current.isSpaceHeldRef.current).toBe(false);
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // AC-3
  // ---------------------------------------------------------------------------
  it(`AC-3: GIVEN isSpaceHeld === true
      WHEN pointerdown auf canvas-area feuert
      THEN Cursor wechselt zu grabbing, Drag-Startposition wird gespeichert, setPointerCapture() wird aufgerufen`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });

    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 400, clientY: 300, pointerId: 10, currentTarget: canvasArea })
      );
    });

    expect(result.current.isDraggingRef.current).toBe(true);
    expect(result.current.isSpaceHeldRef.current).toBe(true);
    expect(canvasArea.setPointerCapture).toHaveBeenCalledWith(10);
  });

  // ---------------------------------------------------------------------------
  // AC-4
  // ---------------------------------------------------------------------------
  it(`AC-4: GIVEN isSpaceHeld === true UND Pointer-Drag laeuft (nach pointerdown)
      WHEN pointermove mit deltaX=+30, deltaY=-20 feuert
      THEN Transform-Wrapper style.transform wird direkt via Ref aktualisiert: panX += 30, panY += -20`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 200, clientY: 200, currentTarget: canvasArea })
      );
    });

    // Move: delta = (230-200, 180-200) = (30, -20)
    act(() => {
      result.current.handlePanPointerMove(
        pointerEvent("pointermove", { clientX: 230, clientY: 180 })
      );
    });

    expect(tw.style.transform).toBe("translate(30px, -20px) scale(1)");
    // No React state update during drag
    expect(result.current.state.panX).toBe(0);
    expect(result.current.state.panY).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // AC-5
  // ---------------------------------------------------------------------------
  it(`AC-5: GIVEN Pointer-Drag laeuft mit isSpaceHeld === true
      WHEN pointerup feuert
      THEN releasePointerCapture() wird aufgerufen, finale panX/panY werden via dispatch(SET_ZOOM_PAN) synchronisiert, Cursor wechselt zurueck zu grab`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100, pointerId: 5, currentTarget: canvasArea })
      );
    });
    act(() => {
      result.current.handlePanPointerMove(
        pointerEvent("pointermove", { clientX: 160, clientY: 80 })
      );
    });

    act(() => {
      result.current.handlePanPointerUp(
        pointerEvent("pointerup", { currentTarget: canvasArea })
      );
    });

    expect(canvasArea.releasePointerCapture).toHaveBeenCalled();
    expect(result.current.state.panX).toBe(60);
    expect(result.current.state.panY).toBe(-20);
    expect(result.current.isDraggingRef.current).toBe(false);
    expect(result.current.isSpaceHeldRef.current).toBe(true); // still held => cursor "grab"
  });

  // ---------------------------------------------------------------------------
  // AC-6
  // ---------------------------------------------------------------------------
  it(`AC-6: GIVEN Pointer-Drag laeuft
      WHEN keyup fuer Space feuert WAEHREND des Drags
      THEN Drag wird beendet (wie pointerup), State wird synchronisiert, Cursor wechselt zu default`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 300, clientY: 300, pointerId: 2, currentTarget: canvasArea })
      );
    });
    act(() => {
      result.current.handlePanPointerMove(
        pointerEvent("pointermove", { clientX: 350, clientY: 270 })
      );
    });

    // Release Space while dragging
    act(() => { result.current.handleSpaceKeyUp(spaceKeyEvent("keyup")); });

    expect(result.current.isSpaceHeldRef.current).toBe(false);
    expect(result.current.isDraggingRef.current).toBe(false);
    expect(result.current.state.panX).toBe(50);
    expect(result.current.state.panY).toBe(-30);
  });

  // ---------------------------------------------------------------------------
  // AC-7
  // ---------------------------------------------------------------------------
  it(`AC-7: GIVEN isSpaceHeld === true UND editMode ist inpaint oder erase
      WHEN pointerdown auf MaskCanvas feuert
      THEN MaskCanvas onPointerDown-Handler wird NICHT ausgefuehrt (Painting unterdrueckt), stattdessen Pan-Drag beginnt`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });

    // isSpaceHeldRef.current is true — MaskCanvas reads this and returns early
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // Pan drag should start instead
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 250, clientY: 250, currentTarget: canvasArea })
      );
    });
    expect(result.current.isDraggingRef.current).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC-8
  // ---------------------------------------------------------------------------
  it(`AC-8: GIVEN isSpaceHeld === false UND editMode ist inpaint
      WHEN pointerdown auf MaskCanvas feuert
      THEN normales Mask-Painting beginnt (bestehende Funktionalitaet unveraendert)`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    // isSpaceHeld is false
    expect(result.current.isSpaceHeldRef.current).toBe(false);

    // handlePanPointerDown should NOT start drag
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 250, clientY: 250, currentTarget: canvasArea })
      );
    });
    expect(result.current.isDraggingRef.current).toBe(false);
    // MaskCanvas would proceed with normal painting (not tested here — that's MaskCanvas's concern)
  });

  // ---------------------------------------------------------------------------
  // AC-9
  // ---------------------------------------------------------------------------
  it(`AC-9: GIVEN ein Input-Element (z.B. Chat-Textfeld) ist fokussiert
      WHEN Space-Taste gedrueckt wird
      THEN isSpaceHeld wird NICHT gesetzt (Guard verhindert Aktivierung)`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });

    expect(result.current.isSpaceHeldRef.current).toBe(false);

    document.body.removeChild(input);
  });

  // ---------------------------------------------------------------------------
  // AC-10
  // ---------------------------------------------------------------------------
  it(`AC-10: GIVEN die Komponente wird unmounted
      WHEN Cleanup laeuft
      THEN keydown/keyup-Listener fuer Space werden entfernt, isSpaceHeld ist false`, () => {
    const wrapper = createWrapper(container, image, tw);
    const { result, unmount } = renderHook(() => useZoomWithState(), { wrapper });

    // Activate space + start drag
    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => { result.current.handleSpaceKeyDown(spaceKeyEvent("keydown")); });
    act(() => {
      result.current.handlePanPointerDown(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100, currentTarget: canvasArea })
      );
    });
    expect(result.current.isSpaceHeldRef.current).toBe(true);
    expect(result.current.isDraggingRef.current).toBe(true);

    // Verify handler functions exist for cleanup
    expect(typeof result.current.handleSpaceKeyDown).toBe("function");
    expect(typeof result.current.handleSpaceKeyUp).toBe("function");

    unmount();

    // After unmount, refs should be reset
    expect(result.current.isSpaceHeldRef.current).toBe(false);
    expect(result.current.isDraggingRef.current).toBe(false);
  });
});
