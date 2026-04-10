// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, useRef, type ReactNode } from "react";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

/**
 * Unit Tests for slice-05-space-drag-pan: Space+Drag Pan handler logic
 *
 * Tests pure handler behavior (guards, ref mutations, DOM manipulation).
 * Focus: edge cases, guard logic, ref-based DOM manipulation correctness.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver mocked (jsdom limitation)
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
  sharedContainerRef = useRef<HTMLDivElement | null>(container);
  sharedImageRef = useRef<HTMLImageElement | null>(image);
  sharedTransformWrapperRef = useRef<HTMLDivElement | null>(tw);
  return createElement("div", null, children);
}

function createWrapper(c: HTMLDivElement, i: HTMLImageElement, tw: HTMLDivElement) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      CanvasDetailProvider,
      { initialGenerationId: "unit-test" },
      createElement(RefBridge, { container: c, image: i, tw }, children)
    );
  };
}

function useZoomWithState() {
  const zoom = useCanvasZoom(sharedContainerRef!, sharedImageRef!, sharedTransformWrapperRef!);
  const { state } = useCanvasDetail();
  return { ...zoom, state };
}

function makeCanvasArea(): HTMLDivElement {
  const el = document.createElement("div");
  el.setPointerCapture = vi.fn();
  el.releasePointerCapture = vi.fn();
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isInputFocused guard", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let tw: HTMLDivElement;

  beforeEach(() => {
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    tw = createMockTransformWrapper();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should block Space activation when an INPUT element is focused", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });
    act(() => { result.current.isCanvasHoveredRef.current = true; });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });

    expect(result.current.isSpaceHeldRef.current).toBe(false);
    document.body.removeChild(input);
  });

  it("should block Space activation when a TEXTAREA element is focused", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });
    act(() => { result.current.isCanvasHoveredRef.current = true; });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });

    expect(result.current.isSpaceHeldRef.current).toBe(false);
    document.body.removeChild(textarea);
  });

  it("should allow Space activation when body is focused", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });
    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();

    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });

    expect(result.current.isSpaceHeldRef.current).toBe(true);
  });
});

describe("Space key event.code guard", () => {
  let container: HTMLDivElement;
  let image: HTMLImageElement;
  let tw: HTMLDivElement;

  beforeEach(() => {
    sharedContainerRef = null;
    sharedImageRef = null;
    sharedTransformWrapperRef = null;
    container = createMockContainer(800, 600);
    image = createMockImage(800, 600);
    tw = createMockTransformWrapper();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should ignore non-Space key codes on keydown", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });
    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();

    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "KeyA", key: "a", bubbles: true })
      );
    });

    expect(result.current.isSpaceHeldRef.current).toBe(false);
  });

  it("should ignore non-Space key codes on keyup", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });
    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();

    // Activate space first
    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });
    expect(result.current.isSpaceHeldRef.current).toBe(true);

    // keyup for a different key should NOT deactivate space
    act(() => {
      result.current.handleSpaceKeyUp(
        new KeyboardEvent("keyup", { code: "KeyA", key: "a", bubbles: true })
      );
    });

    expect(result.current.isSpaceHeldRef.current).toBe(true);
  });
});

describe("Transform wrapper direct DOM manipulation", () => {
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
    canvasArea = makeCanvasArea();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should include current zoomLevel in transform string during drag", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    // First zoom to 2.0
    act(() => { result.current.zoomToPoint(2.0, 400, 300); });
    expect(result.current.state.zoomLevel).toBe(2.0);

    // Update the transform wrapper initial state to reflect the zoomed-in state
    const panX = result.current.state.panX;
    const panY = result.current.state.panY;
    tw.style.transform = `translate(${panX}px, ${panY}px) scale(2)`;

    // Activate space and start drag
    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });
    act(() => {
      result.current.handlePanPointerDown(
        new PointerEvent("pointerdown", {
          clientX: 100, clientY: 100, pointerId: 1, button: 0, bubbles: true, cancelable: true,
        })
      );
    });

    // Move by (20, 10)
    act(() => {
      result.current.handlePanPointerMove(
        new PointerEvent("pointermove", { clientX: 120, clientY: 110, bubbles: true })
      );
    });

    // Transform should use zoomLevel=2
    const expectedPanX = panX + 20;
    const expectedPanY = panY + 10;
    expect(tw.style.transform).toBe(`translate(${expectedPanX}px, ${expectedPanY}px) scale(2)`);
  });

  it("should not trigger React re-render during pointermove (state remains unchanged)", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });

    const initialPanX = result.current.state.panX;
    const initialPanY = result.current.state.panY;

    act(() => {
      result.current.handlePanPointerDown(
        new PointerEvent("pointerdown", {
          clientX: 200, clientY: 200, pointerId: 1, button: 0, bubbles: true, cancelable: true,
        })
      );
    });

    // Multiple moves — state should NOT change (only transform wrapper DOM)
    for (let i = 1; i <= 10; i++) {
      act(() => {
        result.current.handlePanPointerMove(
          new PointerEvent("pointermove", { clientX: 200 + i * 5, clientY: 200 - i * 3, bubbles: true })
        );
      });
    }

    // State unchanged — this is the 60fps optimization
    expect(result.current.state.panX).toBe(initialPanX);
    expect(result.current.state.panY).toBe(initialPanY);

    // But transform wrapper reflects the final position
    expect(tw.style.transform).toBe("translate(50px, -30px) scale(1)");
  });
});

describe("endDrag dispatch correctness", () => {
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
    canvasArea = makeCanvasArea();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse final panX/panY from transform wrapper style on drag end", () => {
    const wrapper = createWrapper(container, image, tw);
    const { result } = renderHook(() => useZoomWithState(), { wrapper });

    act(() => { result.current.isCanvasHoveredRef.current = true; });
    document.body.focus();
    act(() => {
      result.current.handleSpaceKeyDown(
        new KeyboardEvent("keydown", { code: "Space", key: " ", bubbles: true, cancelable: true })
      );
    });

    // Start at (500, 400)
    const pe = new PointerEvent("pointerdown", {
      clientX: 500, clientY: 400, pointerId: 1, button: 0, bubbles: true, cancelable: true,
    });
    Object.defineProperty(pe, "currentTarget", { value: canvasArea });
    act(() => { result.current.handlePanPointerDown(pe); });

    // Move to (600, 350) => delta (100, -50)
    act(() => {
      result.current.handlePanPointerMove(
        new PointerEvent("pointermove", { clientX: 600, clientY: 350, bubbles: true })
      );
    });

    expect(tw.style.transform).toBe("translate(100px, -50px) scale(1)");

    // End drag via pointerup
    const upEv = new PointerEvent("pointerup", { bubbles: true });
    Object.defineProperty(upEv, "currentTarget", { value: canvasArea });
    act(() => { result.current.handlePanPointerUp(upEv); });

    // State should now match the transform wrapper values
    expect(result.current.state.panX).toBe(100);
    expect(result.current.state.panY).toBe(-50);
    expect(result.current.state.zoomLevel).toBe(1);
  });
});
