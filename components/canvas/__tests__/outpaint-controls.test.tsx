// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

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
// Mocks (mock_external strategy per spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/canvas-detail-context", () => ({
  useCanvasDetail: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// Import AFTER mocks
import { OutpaintControls } from "@/components/canvas/outpaint-controls";

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

// ---------------------------------------------------------------------------
// Acceptance Tests
// ---------------------------------------------------------------------------

describe("OutpaintControls Acceptance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // AC-1: Default-Rendering mit 4 Direction-Buttons und Size 50% vorausgewaehlt
  // =========================================================================

  /**
   * AC-1: GIVEN das OutpaintControls Component wird gerendert
   *       WHEN kein initialer State gesetzt ist
   *       THEN sind 4 Direction-Buttons sichtbar (Top, Bottom, Left, Right)
   *            und keiner ist selektiert.
   *            Die Size-Selection zeigt 3 Optionen (25%, 50%, 100%)
   *            wobei 50% als Default vorausgewaehlt ist
   */
  it("AC-1: should render 4 direction buttons and pre-select 50% size", () => {
    resetMockState({ outpaintDirections: [], outpaintSize: 50 });
    render(<OutpaintControls />);

    // 4 direction buttons must be visible
    const topBtn = screen.getByTestId("outpaint-direction-top");
    const bottomBtn = screen.getByTestId("outpaint-direction-bottom");
    const leftBtn = screen.getByTestId("outpaint-direction-left");
    const rightBtn = screen.getByTestId("outpaint-direction-right");

    expect(topBtn).toBeInTheDocument();
    expect(bottomBtn).toBeInTheDocument();
    expect(leftBtn).toBeInTheDocument();
    expect(rightBtn).toBeInTheDocument();

    // None should be selected (aria-pressed="false")
    expect(topBtn).toHaveAttribute("aria-pressed", "false");
    expect(bottomBtn).toHaveAttribute("aria-pressed", "false");
    expect(leftBtn).toHaveAttribute("aria-pressed", "false");
    expect(rightBtn).toHaveAttribute("aria-pressed", "false");

    // 3 size options must exist (25%, 50%, 100%)
    const size25Buttons = screen.getAllByTestId("outpaint-size-25");
    const size50Buttons = screen.getAllByTestId("outpaint-size-50");
    const size100Buttons = screen.getAllByTestId("outpaint-size-100");

    expect(size25Buttons.length).toBeGreaterThan(0);
    expect(size50Buttons.length).toBeGreaterThan(0);
    expect(size100Buttons.length).toBeGreaterThan(0);

    // 50% should be pre-selected (aria-pressed="true"), others not
    for (const btn of size50Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "true");
    }
    for (const btn of size25Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }
    for (const btn of size100Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }
  });

  // =========================================================================
  // AC-2: Klick auf Top dispatched SET_OUTPAINT_DIRECTIONS mit ["top"]
  // =========================================================================

  /**
   * AC-2: GIVEN das OutpaintControls Component wird gerendert
   *       WHEN der User auf den "Top"-Direction-Button klickt
   *       THEN wird SET_OUTPAINT_DIRECTIONS mit ["top"] dispatched
   */
  it('AC-2: should dispatch SET_OUTPAINT_DIRECTIONS with ["top"] when Top clicked', async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: [], outpaintSize: 50 });
    render(<OutpaintControls />);

    const topBtn = screen.getByTestId("outpaint-direction-top");
    await user.click(topBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: ["top"],
    });
  });

  // =========================================================================
  // AC-3: Klick auf Right bei bestehender Selection ["top"] ergibt ["top", "right"]
  // =========================================================================

  /**
   * AC-3: GIVEN outpaintDirections ist ["top"] im Context
   *       WHEN der User auf den "Right"-Direction-Button klickt
   *       THEN wird SET_OUTPAINT_DIRECTIONS mit ["top", "right"] dispatched (Mehrfachauswahl)
   */
  it('AC-3: should dispatch SET_OUTPAINT_DIRECTIONS with ["top", "right"] for multi-select', async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: ["top"], outpaintSize: 50 });
    render(<OutpaintControls />);

    const rightBtn = screen.getByTestId("outpaint-direction-right");
    await user.click(rightBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: ["top", "right"],
    });
  });

  // =========================================================================
  // AC-4: Erneuter Klick auf Top bei ["top", "right"] toggled zu ["right"]
  // =========================================================================

  /**
   * AC-4: GIVEN outpaintDirections ist ["top", "right"] im Context
   *       WHEN der User auf den "Top"-Direction-Button klickt (erneut)
   *       THEN wird SET_OUTPAINT_DIRECTIONS mit ["right"] dispatched (Toggle-Off)
   */
  it('AC-4: should dispatch SET_OUTPAINT_DIRECTIONS with ["right"] when Top toggled off', async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: ["top", "right"], outpaintSize: 50 });
    render(<OutpaintControls />);

    const topBtn = screen.getByTestId("outpaint-direction-top");
    await user.click(topBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: ["right"],
    });
  });

  // =========================================================================
  // AC-5: Klick auf 100% Size dispatched SET_OUTPAINT_SIZE mit 100
  // =========================================================================

  /**
   * AC-5: GIVEN outpaintSize ist 50 im Context
   *       WHEN der User auf den "100%"-Size-Button klickt
   *       THEN wird SET_OUTPAINT_SIZE mit 100 dispatched
   */
  it("AC-5: should dispatch SET_OUTPAINT_SIZE with 100 when 100% clicked", async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: [], outpaintSize: 50 });
    render(<OutpaintControls />);

    // Multiple size selectors exist (one per edge), click the first 100% button
    const size100Buttons = screen.getAllByTestId("outpaint-size-100");
    await user.click(size100Buttons[0]);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_SIZE",
      outpaintSize: 100,
    });
  });

  // =========================================================================
  // AC-6: Selected Direction-Button ist visuell hervorgehoben
  // =========================================================================

  /**
   * AC-6: GIVEN outpaintDirections ist ["top"] im Context
   *       WHEN das Component gerendert wird
   *       THEN ist der "Top"-Direction-Button visuell hervorgehoben (selected State)
   *            und die anderen 3 sind nicht hervorgehoben
   */
  it("AC-6: should visually highlight the selected direction button", () => {
    resetMockState({ outpaintDirections: ["top"], outpaintSize: 50 });
    render(<OutpaintControls />);

    const topBtn = screen.getByTestId("outpaint-direction-top");
    const bottomBtn = screen.getByTestId("outpaint-direction-bottom");
    const leftBtn = screen.getByTestId("outpaint-direction-left");
    const rightBtn = screen.getByTestId("outpaint-direction-right");

    // Top should be selected (aria-pressed="true") and visually distinct
    expect(topBtn).toHaveAttribute("aria-pressed", "true");
    expect(topBtn.className).toContain("bg-primary");
    expect(topBtn.className).toContain("text-primary-foreground");

    // Others should NOT be selected
    expect(bottomBtn).toHaveAttribute("aria-pressed", "false");
    expect(bottomBtn.className).not.toContain("bg-primary");

    expect(leftBtn).toHaveAttribute("aria-pressed", "false");
    expect(leftBtn.className).not.toContain("bg-primary");

    expect(rightBtn).toHaveAttribute("aria-pressed", "false");
    expect(rightBtn.className).not.toContain("bg-primary");
  });

  // =========================================================================
  // AC-7: Selected Size-Button ist visuell hervorgehoben
  // =========================================================================

  /**
   * AC-7: GIVEN outpaintSize ist 25 im Context
   *       WHEN das Component gerendert wird
   *       THEN ist der "25%"-Size-Button visuell hervorgehoben
   *            und "50%" sowie "100%" sind nicht hervorgehoben
   */
  it("AC-7: should visually highlight the active size button", () => {
    resetMockState({ outpaintDirections: [], outpaintSize: 25 });
    render(<OutpaintControls />);

    const size25Buttons = screen.getAllByTestId("outpaint-size-25");
    const size50Buttons = screen.getAllByTestId("outpaint-size-50");
    const size100Buttons = screen.getAllByTestId("outpaint-size-100");

    // 25% should be highlighted (aria-pressed="true" and bg-primary class)
    for (const btn of size25Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "true");
      expect(btn.className).toContain("bg-primary");
      expect(btn.className).toContain("text-primary-foreground");
    }

    // 50% and 100% should NOT be highlighted
    for (const btn of size50Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
      expect(btn.className).not.toContain("bg-primary");
    }
    for (const btn of size100Buttons) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
      expect(btn.className).not.toContain("bg-primary");
    }
  });

  // =========================================================================
  // AC-8: Direction-Buttons an korrekten Positionen (Top oben, Bottom unten, etc.)
  // =========================================================================

  /**
   * AC-8: GIVEN das OutpaintControls Component wird gerendert
   *       WHEN die 4 Direction-Buttons geprueft werden
   *       THEN ist "Top" oberhalb des Bild-Bereichs positioniert,
   *            "Bottom" unterhalb, "Left" links und "Right" rechts
   *            (Edge-Positionen gemaess wireframes.md -> Outpaint Mode)
   */
  it("AC-8: should position direction buttons at the correct image edges", () => {
    resetMockState({ outpaintDirections: [], outpaintSize: 50 });
    render(<OutpaintControls />);

    const topBtn = screen.getByTestId("outpaint-direction-top");
    const bottomBtn = screen.getByTestId("outpaint-direction-bottom");
    const leftBtn = screen.getByTestId("outpaint-direction-left");
    const rightBtn = screen.getByTestId("outpaint-direction-right");

    // Each button is inside a positioned wrapper div.
    // Top's wrapper should have "top-0" positioning class
    const topWrapper = topBtn.closest("[class*='absolute']")!;
    expect(topWrapper).toBeTruthy();
    expect(topWrapper.className).toContain("top-0");
    expect(topWrapper.className).toContain("left-1/2");

    // Bottom's wrapper should have "bottom-0" positioning class
    const bottomWrapper = bottomBtn.closest("[class*='absolute']")!;
    expect(bottomWrapper).toBeTruthy();
    expect(bottomWrapper.className).toContain("bottom-0");
    expect(bottomWrapper.className).toContain("left-1/2");

    // Left's wrapper should have "left-0" positioning class
    const leftWrapper = leftBtn.closest("[class*='absolute']")!;
    expect(leftWrapper).toBeTruthy();
    expect(leftWrapper.className).toContain("left-0");
    expect(leftWrapper.className).toContain("top-1/2");

    // Right's wrapper should have "right-0" positioning class
    const rightWrapper = rightBtn.closest("[class*='absolute']")!;
    expect(rightWrapper).toBeTruthy();
    expect(rightWrapper.className).toContain("right-0");
    expect(rightWrapper.className).toContain("top-1/2");

    // The root container must be absolutely positioned to overlay the image
    const rootContainer = screen.getByTestId("outpaint-controls");
    expect(rootContainer.className).toContain("absolute");
    expect(rootContainer.className).toContain("inset-0");
  });
});

// ---------------------------------------------------------------------------
// Unit Tests: Interaction edge cases and toggle logic
// ---------------------------------------------------------------------------

describe("OutpaintControls Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render all 4 direction buttons with correct aria-labels", () => {
    render(<OutpaintControls />);

    expect(screen.getByLabelText("Top")).toBeInTheDocument();
    expect(screen.getByLabelText("Bottom")).toBeInTheDocument();
    expect(screen.getByLabelText("Left")).toBeInTheDocument();
    expect(screen.getByLabelText("Right")).toBeInTheDocument();
  });

  it("should render size buttons with correct aria-labels", () => {
    render(<OutpaintControls />);

    const size25Buttons = screen.getAllByLabelText("25%");
    const size50Buttons = screen.getAllByLabelText("50%");
    const size100Buttons = screen.getAllByLabelText("100%");

    expect(size25Buttons.length).toBeGreaterThan(0);
    expect(size50Buttons.length).toBeGreaterThan(0);
    expect(size100Buttons.length).toBeGreaterThan(0);
  });

  it("should dispatch SET_OUTPAINT_SIZE with 25 when 25% clicked", async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: [], outpaintSize: 50 });
    render(<OutpaintControls />);

    const size25Buttons = screen.getAllByTestId("outpaint-size-25");
    await user.click(size25Buttons[0]);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_SIZE",
      outpaintSize: 25,
    });
  });

  it("should highlight multiple directions when multiple are selected", () => {
    resetMockState({ outpaintDirections: ["top", "bottom", "left"], outpaintSize: 50 });
    render(<OutpaintControls />);

    expect(screen.getByTestId("outpaint-direction-top")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("outpaint-direction-bottom")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("outpaint-direction-left")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("outpaint-direction-right")).toHaveAttribute("aria-pressed", "false");
  });

  it("should dispatch SET_OUTPAINT_DIRECTIONS with all 4 directions when all toggled on", async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: ["top", "bottom", "left"], outpaintSize: 50 });
    render(<OutpaintControls />);

    const rightBtn = screen.getByTestId("outpaint-direction-right");
    await user.click(rightBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: ["top", "bottom", "left", "right"],
    });
  });

  it("should dispatch SET_OUTPAINT_DIRECTIONS with empty array when last direction toggled off", async () => {
    const user = userEvent.setup();
    resetMockState({ outpaintDirections: ["left"], outpaintSize: 50 });
    render(<OutpaintControls />);

    const leftBtn = screen.getByTestId("outpaint-direction-left");
    await user.click(leftBtn);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: [],
    });
  });

  it("should use pointer-events-none on root container so clicks pass through", () => {
    render(<OutpaintControls />);

    const rootContainer = screen.getByTestId("outpaint-controls");
    expect(rootContainer.className).toContain("pointer-events-none");
  });

  it("should re-enable pointer events on interactive areas", () => {
    render(<OutpaintControls />);

    // Direction buttons should be clickable (pointer-events-auto on wrapper)
    const topBtn = screen.getByTestId("outpaint-direction-top");
    const wrapper = topBtn.closest("[class*='pointer-events-auto']");
    expect(wrapper).toBeTruthy();
  });
});
