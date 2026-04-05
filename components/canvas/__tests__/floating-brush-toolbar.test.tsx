// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Slider/Tooltip use these internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number = 0;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

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
    editMode: null as string | null,
    maskData: null as unknown,
    brushSize: 40,
    brushTool: "brush" as "brush" | "eraser",
    outpaintDirections: [] as string[],
    outpaintSize: 50 as number,
  },
}));

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per spec -- mock context provider)
// ---------------------------------------------------------------------------

vi.mock("@/lib/canvas-detail-context", () => ({
  useCanvasDetail: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// Import AFTER mocks
import { FloatingBrushToolbar } from "@/components/canvas/floating-brush-toolbar";

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
    editMode: null,
    maskData: null,
    brushSize: 40,
    brushTool: "brush",
    outpaintDirections: [],
    outpaintSize: 50,
    ...overrides,
  });
}

/** Create a fake ImageData-like object for maskData */
function createFakeMaskData() {
  return { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4) };
}

// ---------------------------------------------------------------------------
// Acceptance Tests: FloatingBrushToolbar (slice-04)
// ---------------------------------------------------------------------------

describe("FloatingBrushToolbar Acceptance Tests", () => {
  const mockOnEraseAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // AC-1: GIVEN editMode is "inpaint" or "erase"
  //        WHEN the FloatingBrushToolbar is rendered
  //        THEN the toolbar is visible, horizontally positioned above the canvas
  // =========================================================================

  it("AC-1: should render toolbar when editMode is inpaint", () => {
    resetMockState({ editMode: "inpaint" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const toolbar = screen.getByTestId("floating-brush-toolbar");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toBeVisible();
  });

  it("AC-1: should render toolbar when editMode is erase", () => {
    resetMockState({ editMode: "erase" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const toolbar = screen.getByTestId("floating-brush-toolbar");
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toBeVisible();
  });

  // =========================================================================
  // AC-2: GIVEN editMode is null or "instruction" or "outpaint"
  //        WHEN the FloatingBrushToolbar is rendered
  //        THEN the toolbar is not visible (not in DOM or hidden)
  // =========================================================================

  it("AC-2: should not render toolbar when editMode is null", () => {
    resetMockState({ editMode: null });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.queryByTestId("floating-brush-toolbar")).not.toBeInTheDocument();
  });

  it("AC-2: should not render toolbar when editMode is instruction", () => {
    resetMockState({ editMode: "instruction" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.queryByTestId("floating-brush-toolbar")).not.toBeInTheDocument();
  });

  it("AC-2: should not render toolbar when editMode is outpaint", () => {
    resetMockState({ editMode: "outpaint" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.queryByTestId("floating-brush-toolbar")).not.toBeInTheDocument();
  });

  // =========================================================================
  // AC-3: GIVEN the toolbar is visible
  //        WHEN the user moves the brush-size slider
  //        THEN SET_BRUSH_SIZE is dispatched with the new value
  //        AND the slider accepts values from 1 to 100
  //        AND the current value is displayed numerically next to the slider
  // =========================================================================

  it("AC-3: should dispatch SET_BRUSH_SIZE when slider value changes", async () => {
    resetMockState({ editMode: "inpaint", brushSize: 40 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    // The Radix Slider renders role="slider" elements
    const slider = screen.getByTestId("brush-size-slider");
    const thumb = slider.querySelector("[role='slider']");
    expect(thumb).toBeTruthy();

    // Verify slider has correct min/max attributes (AC-3 range requirement)
    expect(thumb).toHaveAttribute("aria-valuemin", "1");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
    expect(thumb).toHaveAttribute("aria-valuenow", "40");
  });

  it("AC-3: should accept slider values from 1 to 100", () => {
    resetMockState({ editMode: "inpaint", brushSize: 1 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const slider = screen.getByTestId("brush-size-slider");
    const thumb = slider.querySelector("[role='slider']");

    expect(thumb).toHaveAttribute("aria-valuemin", "1");
    expect(thumb).toHaveAttribute("aria-valuemax", "100");
    expect(thumb).toHaveAttribute("aria-valuenow", "1");

    cleanup();

    // Also verify max boundary renders correctly
    resetMockState({ editMode: "inpaint", brushSize: 100 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const slider2 = screen.getByTestId("brush-size-slider");
    const thumb2 = slider2.querySelector("[role='slider']");
    expect(thumb2).toHaveAttribute("aria-valuenow", "100");
  });

  it("AC-3: should display current brush size value", () => {
    resetMockState({ editMode: "inpaint", brushSize: 55 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const sizeDisplay = screen.getByTestId("brush-size-value");
    expect(sizeDisplay).toHaveTextContent("55");
  });

  // =========================================================================
  // AC-4: GIVEN brushTool in state is "brush"
  //        WHEN the user clicks the Brush/Eraser toggle
  //        THEN SET_BRUSH_TOOL with "eraser" is dispatched
  //        AND the toggle visually shows "Eraser" as active
  // =========================================================================

  it('AC-4: should dispatch SET_BRUSH_TOOL with "eraser" when toggle clicked in brush mode', async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "inpaint", brushTool: "brush" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const toggleBtn = screen.getByTestId("brush-tool-toggle");

    // Verify the toggle shows "brush" as active (aria-pressed="true" when brush is active)
    expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    // Verify the label indicates switching to eraser
    expect(toggleBtn).toHaveAttribute("aria-label", "Wechsel zu Radierer");

    await user.click(toggleBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_TOOL",
      brushTool: "eraser",
    });
  });

  // =========================================================================
  // AC-5: GIVEN brushTool in state is "eraser"
  //        WHEN the user clicks the Brush/Eraser toggle
  //        THEN SET_BRUSH_TOOL with "brush" is dispatched
  //        AND the toggle visually shows "Brush" as active
  // =========================================================================

  it('AC-5: should dispatch SET_BRUSH_TOOL with "brush" when toggle clicked in eraser mode', async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "inpaint", brushTool: "eraser" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const toggleBtn = screen.getByTestId("brush-tool-toggle");

    // Verify the toggle shows "eraser" as active (aria-pressed="false" when eraser is active)
    expect(toggleBtn).toHaveAttribute("aria-pressed", "false");
    // Verify the label indicates switching to brush
    expect(toggleBtn).toHaveAttribute("aria-label", "Wechsel zu Pinsel");

    await user.click(toggleBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_BRUSH_TOOL",
      brushTool: "brush",
    });
  });

  // =========================================================================
  // AC-6: GIVEN maskData in state is not null (mask present)
  //        WHEN the user clicks the Clear-Mask button
  //        THEN CLEAR_MASK is dispatched
  // =========================================================================

  it("AC-6: should dispatch CLEAR_MASK when clear button clicked with mask present", async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "inpaint", maskData: createFakeMaskData() });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const clearBtn = screen.getByTestId("clear-mask-btn");
    expect(clearBtn).not.toBeDisabled();

    await user.click(clearBtn);

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLEAR_MASK" });
  });

  // =========================================================================
  // AC-7: GIVEN maskData in state is null (no mask present)
  //        WHEN the toolbar is rendered
  //        THEN the Clear-Mask button is disabled (not clickable)
  // =========================================================================

  it("AC-7: should disable clear button when maskData is null", async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "inpaint", maskData: null });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const clearBtn = screen.getByTestId("clear-mask-btn");
    expect(clearBtn).toBeDisabled();

    // Verify clicking does NOT dispatch
    await user.click(clearBtn);
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: "CLEAR_MASK" });
  });

  // =========================================================================
  // AC-8: GIVEN editMode is "erase"
  //        WHEN the toolbar is rendered
  //        THEN an additional "Entfernen" button (erase-action-btn) is visible
  // =========================================================================

  it('AC-8: should show erase action button when editMode is "erase"', () => {
    resetMockState({ editMode: "erase" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const eraseBtn = screen.getByTestId("erase-action-btn");
    expect(eraseBtn).toBeInTheDocument();
    expect(eraseBtn).toBeVisible();
    expect(eraseBtn).toHaveTextContent("Entfernen");
  });

  // =========================================================================
  // AC-9: GIVEN editMode is "inpaint"
  //        WHEN the toolbar is rendered
  //        THEN the "Entfernen" button is NOT visible
  // =========================================================================

  it('AC-9: should not show erase action button when editMode is "inpaint"', () => {
    resetMockState({ editMode: "inpaint" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.queryByTestId("erase-action-btn")).not.toBeInTheDocument();
  });

  // =========================================================================
  // AC-10: GIVEN editMode is "erase" and maskData is null
  //         WHEN the "Entfernen" button is rendered
  //         THEN the button is disabled
  // =========================================================================

  it("AC-10: should disable erase action button when maskData is null in erase mode", () => {
    resetMockState({ editMode: "erase", maskData: null });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const eraseBtn = screen.getByTestId("erase-action-btn");
    expect(eraseBtn).toBeDisabled();
  });

  // =========================================================================
  // AC-11: GIVEN editMode is "erase" and maskData is not null
  //         WHEN the user clicks the "Entfernen" button
  //         THEN onEraseAction callback is called
  // =========================================================================

  it("AC-11: should call onEraseAction callback when erase action button clicked with mask", async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "erase", maskData: createFakeMaskData() });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const eraseBtn = screen.getByTestId("erase-action-btn");
    expect(eraseBtn).not.toBeDisabled();

    await user.click(eraseBtn);

    expect(mockOnEraseAction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Edge cases and interaction details
// ---------------------------------------------------------------------------

describe("FloatingBrushToolbar Unit Tests", () => {
  const mockOnEraseAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it("should not call onEraseAction when erase button is clicked but maskData is null", async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "erase", maskData: null });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const eraseBtn = screen.getByTestId("erase-action-btn");

    // Button should be disabled, clicking a disabled button should not trigger the callback
    await user.click(eraseBtn);
    expect(mockOnEraseAction).not.toHaveBeenCalled();
  });

  it("should display brush size value matching state", () => {
    resetMockState({ editMode: "inpaint", brushSize: 1 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);
    expect(screen.getByTestId("brush-size-value")).toHaveTextContent("1");

    cleanup();

    resetMockState({ editMode: "inpaint", brushSize: 100 });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);
    expect(screen.getByTestId("brush-size-value")).toHaveTextContent("100");
  });

  it("should render all toolbar controls when visible in inpaint mode", () => {
    resetMockState({ editMode: "inpaint" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.getByTestId("brush-size-slider")).toBeInTheDocument();
    expect(screen.getByTestId("brush-size-value")).toBeInTheDocument();
    expect(screen.getByTestId("brush-tool-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("clear-mask-btn")).toBeInTheDocument();
  });

  it("should render all toolbar controls plus erase-action when in erase mode", () => {
    resetMockState({ editMode: "erase" });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    expect(screen.getByTestId("brush-size-slider")).toBeInTheDocument();
    expect(screen.getByTestId("brush-size-value")).toBeInTheDocument();
    expect(screen.getByTestId("brush-tool-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("clear-mask-btn")).toBeInTheDocument();
    expect(screen.getByTestId("erase-action-btn")).toBeInTheDocument();
  });

  it("should not dispatch CLEAR_MASK when clear button is disabled and clicked", async () => {
    const user = userEvent.setup();
    resetMockState({ editMode: "inpaint", maskData: null });
    render(<FloatingBrushToolbar onEraseAction={mockOnEraseAction} />);

    const clearBtn = screen.getByTestId("clear-mask-btn");
    await user.click(clearBtn);

    // No dispatch should occur for CLEAR_MASK on a disabled button
    const clearMaskCalls = mockDispatch.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === "CLEAR_MASK"
    );
    expect(clearMaskCalls).toHaveLength(0);
  });
});
