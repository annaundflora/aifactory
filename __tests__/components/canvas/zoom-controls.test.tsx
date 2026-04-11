// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

/**
 * Tests for slice-03-zoom-controls: ZoomControls UI Component
 *
 * Mocking Strategy (per spec: mock_external):
 * - useCanvasDetail is mocked to provide controlled zoomLevel state
 * - canvasZoom prop functions are mock fns (simulating useCanvasZoom return)
 * - Lucide icons render as SVGs in jsdom (no mock needed)
 */

// ---------------------------------------------------------------------------
// Mock useCanvasDetail
// ---------------------------------------------------------------------------

const mockState = {
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
  brushTool: "brush" as const,
  outpaintDirections: [],
  outpaintSize: 50 as const,
  zoomLevel: 1.0,
  panX: 0,
  panY: 0,
};

const mockDispatch = vi.fn();

vi.mock("@/lib/canvas-detail-context", () => ({
  useCanvasDetail: () => ({
    state: mockState,
    dispatch: mockDispatch,
  }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { ZoomControls } from "@/components/canvas/zoom-controls";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createCanvasZoomMock(overrides?: { fitLevel?: number }) {
  return {
    fitLevel: overrides?.fitLevel ?? 0.5,
    zoomToStep: vi.fn(),
    resetToFit: vi.fn(),
  };
}

function renderZoomControls(options?: {
  zoomLevel?: number;
  fitLevel?: number;
}) {
  const zoomLevel = options?.zoomLevel ?? 1.0;
  const fitLevel = options?.fitLevel ?? 0.5;

  // Update the mock state for this render
  mockState.zoomLevel = zoomLevel;

  const canvasZoom = createCanvasZoomMock({ fitLevel });

  const result = render(<ZoomControls canvasZoom={canvasZoom} />);

  return { ...result, canvasZoom };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ZoomControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to defaults
    mockState.zoomLevel = 1.0;
    mockState.panX = 0;
    mockState.panY = 0;
  });

  // AC-1: GIVEN ZoomControls gemountet mit zoomLevel=1.0 und fitLevel=0.5
  //        WHEN die Komponente rendert
  //        THEN sind 3 Buttons sichtbar (Fit, Zoom-In, Zoom-Out) und ein Text-Element zeigt "100%"
  it("should render Fit, Zoom-In, Zoom-Out buttons and a percent display", () => {
    renderZoomControls({ zoomLevel: 1.0, fitLevel: 0.5 });

    const fitBtn = screen.getByTestId("zoom-fit-btn");
    const zoomInBtn = screen.getByTestId("zoom-in-btn");
    const zoomOutBtn = screen.getByTestId("zoom-out-btn");
    const percentDisplay = screen.getByTestId("zoom-percent");

    expect(fitBtn).toBeInTheDocument();
    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(percentDisplay).toHaveTextContent("100%");
  });

  // AC-2: GIVEN zoomLevel=3.0 (Maximum)
  //        WHEN die Komponente rendert
  //        THEN ist der Zoom-In-Button `disabled` und der Zoom-Out-Button NICHT disabled
  it("should disable Zoom-In button when zoomLevel is 3.0", () => {
    renderZoomControls({ zoomLevel: 3.0 });

    const zoomInBtn = screen.getByTestId("zoom-in-btn");
    const zoomOutBtn = screen.getByTestId("zoom-out-btn");

    expect(zoomInBtn).toBeDisabled();
    expect(zoomOutBtn).not.toBeDisabled();
  });

  // AC-3: GIVEN zoomLevel=0.5 (Minimum)
  //        WHEN die Komponente rendert
  //        THEN ist der Zoom-Out-Button `disabled` und der Zoom-In-Button NICHT disabled
  it("should disable Zoom-Out button when zoomLevel is 0.5", () => {
    renderZoomControls({ zoomLevel: 0.5 });

    const zoomInBtn = screen.getByTestId("zoom-in-btn");
    const zoomOutBtn = screen.getByTestId("zoom-out-btn");

    expect(zoomOutBtn).toBeDisabled();
    expect(zoomInBtn).not.toBeDisabled();
  });

  // AC-4: GIVEN zoomLevel === fitLevel (z.B. beide 0.5)
  //        WHEN die Komponente rendert
  //        THEN hat der Fit-Button einen visuellen Active/Highlight-State (z.B. `bg-accent` oder vergleichbar)
  it("should show active state on Fit button when zoomLevel equals fitLevel", () => {
    renderZoomControls({ zoomLevel: 0.5, fitLevel: 0.5 });

    const fitBtn = screen.getByTestId("zoom-fit-btn");

    // When active (variant="secondary"), the button gets bg-accent and shadow-xs
    // indicating a visual highlight/active state
    expect(fitBtn.className).toContain("bg-accent");
    expect(fitBtn.className).toContain("shadow-xs");
  });

  // AC-5: GIVEN zoomLevel !== fitLevel (z.B. zoomLevel=1.5, fitLevel=0.5)
  //        WHEN die Komponente rendert
  //        THEN hat der Fit-Button KEINEN Active-State (default Styling)
  it("should show default state on Fit button when zoomLevel differs from fitLevel", () => {
    renderZoomControls({ zoomLevel: 1.5, fitLevel: 0.5 });

    const fitBtn = screen.getByTestId("zoom-fit-btn");

    // When not active (variant="ghost"), the button does NOT have shadow-xs
    // (no highlight/active visual indicator)
    expect(fitBtn.className).not.toContain("shadow-xs");
    // Ghost variant uses text-foreground as base styling (no bg-accent base)
    expect(fitBtn.className).toContain("text-foreground");
  });

  // AC-6: GIVEN ZoomControls gemountet
  //        WHEN User auf den Zoom-In-Button klickt
  //        THEN wird `zoomToStep("in")` aus useCanvasZoom aufgerufen (genau einmal)
  it('should call zoomToStep("in") when Zoom-In button is clicked', async () => {
    const user = userEvent.setup();
    const { canvasZoom } = renderZoomControls({ zoomLevel: 1.0 });

    const zoomInBtn = screen.getByTestId("zoom-in-btn");
    await user.click(zoomInBtn);

    expect(canvasZoom.zoomToStep).toHaveBeenCalledTimes(1);
    expect(canvasZoom.zoomToStep).toHaveBeenCalledWith("in");
  });

  // AC-7: GIVEN ZoomControls gemountet
  //        WHEN User auf den Zoom-Out-Button klickt
  //        THEN wird `zoomToStep("out")` aus useCanvasZoom aufgerufen (genau einmal)
  it('should call zoomToStep("out") when Zoom-Out button is clicked', async () => {
    const user = userEvent.setup();
    const { canvasZoom } = renderZoomControls({ zoomLevel: 1.0 });

    const zoomOutBtn = screen.getByTestId("zoom-out-btn");
    await user.click(zoomOutBtn);

    expect(canvasZoom.zoomToStep).toHaveBeenCalledTimes(1);
    expect(canvasZoom.zoomToStep).toHaveBeenCalledWith("out");
  });

  // AC-8: GIVEN ZoomControls gemountet
  //        WHEN User auf den Fit-Button klickt
  //        THEN wird `resetToFit()` aus useCanvasZoom aufgerufen (genau einmal)
  it("should call resetToFit() when Fit button is clicked", async () => {
    const user = userEvent.setup();
    const { canvasZoom } = renderZoomControls({ zoomLevel: 1.5 });

    const fitBtn = screen.getByTestId("zoom-fit-btn");
    await user.click(fitBtn);

    expect(canvasZoom.resetToFit).toHaveBeenCalledTimes(1);
  });

  // AC-9: GIVEN zoomLevel=1.5
  //        WHEN die Komponente rendert
  //        THEN zeigt das Prozent-Element "150%" an (gerundeter Integer mit %-Suffix)
  it('should display "150%" when zoomLevel is 1.5', () => {
    renderZoomControls({ zoomLevel: 1.5 });

    const percentDisplay = screen.getByTestId("zoom-percent");
    expect(percentDisplay).toHaveTextContent("150%");
  });

  // AC-10: GIVEN zoomLevel=0.75
  //         WHEN die Komponente rendert
  //         THEN zeigt das Prozent-Element "75%" an
  it('should display "75%" when zoomLevel is 0.75', () => {
    renderZoomControls({ zoomLevel: 0.75 });

    const percentDisplay = screen.getByTestId("zoom-percent");
    expect(percentDisplay).toHaveTextContent("75%");
  });

  // AC-11: GIVEN ZoomControls gemountet
  //         WHEN die Komponente rendert
  //         THEN hat der aeussere Container die Positionierung `absolute bottom-4 right-4 z-20`
  //         und das Styling-Pattern aus FloatingBrushToolbar (`bg-card`, `border`, `shadow-md`, `rounded-lg`)
  it("should have absolute bottom-4 right-4 z-20 positioning with bg-card border shadow-md rounded-lg", () => {
    renderZoomControls();

    const container = screen.getByTestId("zoom-controls");
    const className = container.className;

    expect(className).toContain("absolute");
    expect(className).toContain("bottom-4");
    expect(className).toContain("right-4");
    expect(className).toContain("z-20");
    expect(className).toContain("bg-card");
    expect(className).toContain("border");
    expect(className).toContain("shadow-md");
    expect(className).toContain("rounded-lg");
  });
});
