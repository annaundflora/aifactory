// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
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
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",

    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),

    save: vi.fn(),
    restore: vi.fn(),

    clearRect: vi.fn(),

    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      return new ImageData(w, h);
    }),
    putImageData: vi.fn(),

    drawImage: vi.fn(),
  };
}

let maskCtx: ReturnType<typeof createMockContext2D>;
let cursorCtx: ReturnType<typeof createMockContext2D>;

// ---------------------------------------------------------------------------
// Mock HTMLCanvasElement.getContext
// ---------------------------------------------------------------------------

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const contextMap = new WeakMap<HTMLCanvasElement, ReturnType<typeof createMockContext2D>>();

function installCanvasMock() {
  maskCtx = createMockContext2D();
  cursorCtx = createMockContext2D();

  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === "2d") {
      if (!contextMap.has(this)) {
        const testId = this.getAttribute("data-testid");
        if (testId === "mask-canvas") {
          contextMap.set(this, maskCtx);
        } else if (testId === "mask-canvas-cursor") {
          contextMap.set(this, cursorCtx);
        } else {
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

class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// ---------------------------------------------------------------------------
// Mock useCanvasDetail context (mock_external strategy per spec)
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

function createImageRef(
  width = 512,
  height = 512
): React.RefObject<HTMLImageElement | null> {
  const img = document.createElement("img");
  img.setAttribute("data-testid", "canvas-image");
  img.style.width = `${width}px`;
  img.style.height = `${height}px`;
  document.body.appendChild(img);

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

/**
 * Helper: fire a keydown event on `document` to simulate keyboard shortcut.
 * Uses the capture phase to match the component's listener registration.
 */
function pressKey(
  key: string,
  options: Partial<KeyboardEventInit> = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
}

/**
 * Helper: simulate a full stroke (mousedown -> mousemove -> mouseup) on the
 * canvas to push an entry onto the internal mask undo stack.
 */
function simulateStroke(canvas: HTMLElement) {
  fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
  fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
  fireEvent.mouseUp(canvas);
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe("MaskCanvas Keyboard Shortcuts — Slice 14 Acceptance Tests", () => {
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
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // AC-1: ] increases brush size by 5 (max 100)
  // =========================================================================

  /**
   * AC-1: GIVEN editMode is "inpaint" or "erase"
   *       WHEN the user presses ]
   *       THEN SET_BRUSH_SIZE is dispatched with currentBrushSize + 5
   *       AND the value is clamped to a maximum of 100
   */
  it("AC-1: should dispatch SET_BRUSH_SIZE with currentSize + 5 on ] key", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 45,
    });
  });

  it("AC-1: should clamp brush size to 100 when ] would exceed maximum", () => {
    resetMockState({ editMode: "inpaint", brushSize: 98 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 100,
    });
  });

  it("AC-1: should work when editMode is erase", () => {
    resetMockState({ editMode: "erase", brushSize: 50 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 55,
    });
  });

  // =========================================================================
  // AC-2: [ decreases brush size by 5 (min 1)
  // =========================================================================

  /**
   * AC-2: GIVEN editMode is "inpaint" or "erase"
   *       WHEN the user presses [
   *       THEN SET_BRUSH_SIZE is dispatched with currentBrushSize - 5
   *       AND the value is clamped to a minimum of 1
   */
  it("AC-2: should dispatch SET_BRUSH_SIZE with currentSize - 5 on [ key", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("[");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 35,
    });
  });

  it("AC-2: should clamp brush size to 1 when [ would go below minimum", () => {
    resetMockState({ editMode: "inpaint", brushSize: 3 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("[");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 1,
    });
  });

  it("AC-2: should work when editMode is erase", () => {
    resetMockState({ editMode: "erase", brushSize: 20 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("[");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 15,
    });
  });

  // =========================================================================
  // AC-3: E toggles brush/eraser tool
  // =========================================================================

  /**
   * AC-3: GIVEN editMode is "inpaint" or "erase"
   *       WHEN the user presses E (upper or lowercase)
   *       THEN SET_BRUSH_TOOL is dispatched toggling brush <-> eraser
   */
  it("AC-3: should dispatch SET_BRUSH_TOOL toggling brush to eraser on E key", () => {
    resetMockState({ editMode: "inpaint", brushTool: "brush" });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("e");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_TOOL",
      brushTool: "eraser",
    });
  });

  it("AC-3: should dispatch SET_BRUSH_TOOL toggling eraser to brush on E key", () => {
    resetMockState({ editMode: "inpaint", brushTool: "eraser" });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("e");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_TOOL",
      brushTool: "brush",
    });
  });

  it("AC-3: should handle both uppercase and lowercase E", () => {
    resetMockState({ editMode: "inpaint", brushTool: "brush" });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("E");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_TOOL",
      brushTool: "eraser",
    });
  });

  // =========================================================================
  // AC-4: Shortcuts inactive outside painting modes
  // =========================================================================

  /**
   * AC-4: GIVEN editMode is null, "instruction", "outpaint", or "click-edit"
   *       WHEN the user presses [, ], E, or Ctrl+Z
   *       THEN nothing happens (no dispatches, no undo)
   */
  it("AC-4: should not dispatch on ] key when editMode is null", () => {
    resetMockState({ editMode: null });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("AC-4: should not dispatch on [ key when editMode is instruction", () => {
    resetMockState({ editMode: "instruction" });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("[");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("AC-4: should not dispatch on E key when editMode is outpaint", () => {
    resetMockState({ editMode: "outpaint" });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("e");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("AC-4: should not dispatch on Ctrl+Z when editMode is null", () => {
    resetMockState({ editMode: null });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("z", { ctrlKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-5: Ctrl+Z undoes last mask stroke
  // =========================================================================

  /**
   * AC-5: GIVEN the user has painted 3 mask strokes (mouseup triggered 3 times)
   *       WHEN the user presses Ctrl+Z (Win/Linux) or Cmd+Z (macOS)
   *       THEN the last stroke is undone (canvas state before 3rd stroke restored)
   *       AND the undo stack still has 2 entries
   */
  it("AC-5: should restore canvas state before last stroke on Ctrl+Z", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint 3 strokes to push 3 entries onto the undo stack
    simulateStroke(canvas);
    simulateStroke(canvas);
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // Undo the last stroke
    pressKey("z", { ctrlKey: true });

    // putImageData should be called to restore the canvas
    expect(maskCtx.putImageData).toHaveBeenCalled();

    // SET_MASK_DATA should be dispatched with the restored data
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_MASK_DATA" })
    );
  });

  it("AC-5: should support Cmd+Z on macOS for mask undo", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint one stroke
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // Undo via Cmd+Z (metaKey = macOS Command)
    pressKey("z", { metaKey: true });

    // putImageData should be called to restore the canvas
    expect(maskCtx.putImageData).toHaveBeenCalled();

    // SET_MASK_DATA should be dispatched
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SET_MASK_DATA" })
    );
  });

  // =========================================================================
  // AC-6: Ctrl+Z with empty undo stack does nothing
  // =========================================================================

  /**
   * AC-6: GIVEN the mask undo stack is empty (no stroke painted or all undone)
   *       WHEN the user presses Ctrl+Z / Cmd+Z
   *       THEN nothing happens (no error, no dispatch)
   */
  it("AC-6: should do nothing when Ctrl+Z pressed with empty undo stack", () => {
    resetMockState({ editMode: "inpaint" });
    render(<MaskCanvas imageRef={imageRef} />);

    // No strokes painted, so undo stack is empty
    pressKey("z", { ctrlKey: true });

    // No dispatch should happen
    expect(mockDispatch).not.toHaveBeenCalled();

    // putImageData should not be called
    expect(maskCtx.putImageData).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-7: SET_MASK_DATA dispatch after undo
  // =========================================================================

  /**
   * AC-7: GIVEN the user undoes a stroke via Ctrl+Z
   *       WHEN the undo restores the canvas state
   *       THEN SET_MASK_DATA is dispatched with the restored ImageData (or null if empty)
   *       AND the image undo (PUSH_UNDO) remains untouched
   */
  it("AC-7: should dispatch SET_MASK_DATA with restored ImageData after undo", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint 2 strokes
    simulateStroke(canvas);
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // Make getImageData return data with non-zero alpha (simulating content)
    const fakeRestoredData = new ImageData(512, 512);
    fakeRestoredData.data[3] = 255; // first pixel has alpha > 0 = has content
    (maskCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeRestoredData);

    // Undo
    pressKey("z", { ctrlKey: true });

    // SET_MASK_DATA should be dispatched with the ImageData
    const setMaskCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "SET_MASK_DATA"
    );
    expect(setMaskCalls.length).toBe(1);
    expect(setMaskCalls[0][0].maskData).toBeInstanceOf(ImageData);
  });

  it("AC-7: should dispatch SET_MASK_DATA with null when undo stack fully exhausted", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint 1 stroke
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // getImageData returns empty (all zeros = no alpha content) to simulate blank canvas
    const emptyData = new ImageData(512, 512);
    (maskCtx.getImageData as ReturnType<typeof vi.fn>).mockReturnValueOnce(emptyData);

    // Undo the only stroke -> stack is now empty, canvas is blank
    pressKey("z", { ctrlKey: true });

    // SET_MASK_DATA should be dispatched with null (canvas empty)
    const setMaskCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "SET_MASK_DATA"
    );
    expect(setMaskCalls.length).toBe(1);
    expect(setMaskCalls[0][0].maskData).toBeNull();
  });

  it("AC-7: should not trigger PUSH_UNDO on mask undo", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint and undo
    simulateStroke(canvas);
    mockDispatch.mockClear();

    pressKey("z", { ctrlKey: true });

    // Verify no PUSH_UNDO or POP_UNDO dispatches (image undo stack untouched)
    const pushUndoCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => {
        const action = call[0] as { type: string };
        return action.type === "PUSH_UNDO" || action.type === "POP_UNDO";
      }
    );
    expect(pushUndoCalls.length).toBe(0);
  });

  // =========================================================================
  // AC-8: Shortcuts inactive when input elements have focus
  // =========================================================================

  /**
   * AC-8: GIVEN an <input>, <textarea>, or [contenteditable] element has focus
   *       WHEN the user presses E, [, ], or Ctrl+Z
   *       THEN the shortcuts are NOT triggered (no conflict with text input)
   */
  it("AC-8: should not trigger shortcuts when input element has focus", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    // Create and focus an input element
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    pressKey("]");
    pressKey("[");
    pressKey("e");
    pressKey("z", { ctrlKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("AC-8: should not trigger shortcuts when textarea has focus", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    pressKey("]");
    pressKey("[");
    pressKey("e");
    pressKey("z", { ctrlKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("AC-8: should not trigger shortcuts when contenteditable has focus", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    // jsdom does not implement isContentEditable natively — patch it so the
    // component's input-focus guard recognises the focused element correctly.
    Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });

    pressKey("]");
    pressKey("[");
    pressKey("e");
    pressKey("z", { ctrlKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-9: CLEAR_MASK resets the undo stack
  // =========================================================================

  /**
   * AC-9: GIVEN CLEAR_MASK is dispatched (e.g. via Clear button)
   *       WHEN the mask is cleared
   *       THEN the mask undo stack is also cleared (reset)
   */
  it("AC-9: should reset undo stack when CLEAR_MASK is dispatched", () => {
    // Start with non-null maskData to simulate an existing mask
    const existingMaskData = new ImageData(512, 512);
    resetMockState({ editMode: "inpaint", brushSize: 10, maskData: existingMaskData });
    const { rerender } = render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint 3 strokes to build up the undo stack
    simulateStroke(canvas);
    simulateStroke(canvas);
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // Simulate CLEAR_MASK by setting maskData to null (as the reducer does for CLEAR_MASK).
    // The useEffect watching state.maskData transitions from non-null to null,
    // which triggers the undo stack reset.
    resetMockState({ editMode: "inpaint", maskData: null });
    rerender(<MaskCanvas imageRef={imageRef} />);

    // Now pressing Ctrl+Z should do nothing (undo stack was cleared)
    pressKey("z", { ctrlKey: true });

    // No SET_MASK_DATA dispatch should happen (stack is empty)
    const setMaskCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "SET_MASK_DATA"
    );
    expect(setMaskCalls.length).toBe(0);
  });
});

// ===========================================================================
// Unit Tests: Edge cases and boundary conditions
// ===========================================================================

describe("MaskCanvas Keyboard Shortcuts — Unit Tests", () => {
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
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("should not dispatch on ] when editMode is click-edit", () => {
    resetMockState({ editMode: "click-edit" as string });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("should not react to Ctrl+Z with shiftKey (Ctrl+Shift+Z is redo, not handled here)", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    simulateStroke(canvas);
    mockDispatch.mockClear();

    // Ctrl+Shift+Z should not trigger mask undo
    pressKey("z", { ctrlKey: true, shiftKey: true });

    const setMaskCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "SET_MASK_DATA"
    );
    expect(setMaskCalls.length).toBe(0);
  });

  it("should clamp brush size to exactly 100 when starting from 100 and pressing ]", () => {
    resetMockState({ editMode: "inpaint", brushSize: 100 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("]");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 100,
    });
  });

  it("should clamp brush size to exactly 1 when starting from 1 and pressing [", () => {
    resetMockState({ editMode: "inpaint", brushSize: 1 });
    render(<MaskCanvas imageRef={imageRef} />);

    pressKey("[");

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_SIZE",
      brushSize: 1,
    });
  });

  it("should not trigger shortcuts when modifier keys are combined with [ or ]", () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<MaskCanvas imageRef={imageRef} />);

    // Ctrl+] should not trigger brush size change
    pressKey("]", { ctrlKey: true });
    // Alt+[ should not trigger brush size change
    pressKey("[", { altKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("should handle multiple sequential undo operations correctly", () => {
    resetMockState({ editMode: "inpaint", brushSize: 10 });
    render(<MaskCanvas imageRef={imageRef} />);

    const canvas = screen.getByTestId("mask-canvas");
    (canvas as HTMLCanvasElement).getBoundingClientRect = () => ({
      width: 512, height: 512, top: 0, left: 0,
      bottom: 512, right: 512, x: 0, y: 0, toJSON: () => {},
    });

    // Paint 3 strokes
    simulateStroke(canvas);
    simulateStroke(canvas);
    simulateStroke(canvas);

    mockDispatch.mockClear();

    // Undo 3 times — all should succeed
    pressKey("z", { ctrlKey: true });
    pressKey("z", { ctrlKey: true });
    pressKey("z", { ctrlKey: true });

    // putImageData called 3 times (once per undo)
    expect(maskCtx.putImageData).toHaveBeenCalledTimes(3);

    // 4th undo should do nothing (stack empty)
    mockDispatch.mockClear();
    (maskCtx.putImageData as ReturnType<typeof vi.fn>).mockClear();

    pressKey("z", { ctrlKey: true });

    expect(maskCtx.putImageData).not.toHaveBeenCalled();
  });
});
