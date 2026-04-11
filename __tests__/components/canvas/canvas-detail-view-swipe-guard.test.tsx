// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Tests for slice-08-double-tap-swipe: Swipe Guard
 *
 * Tests AC-8, AC-9, AC-10 from the slice spec.
 *
 * Mocking Strategy (per spec: mock_external):
 * - ResizeObserver is mocked (not available in jsdom)
 * - External server actions and child components with complex deps are mocked
 * - CanvasDetailProvider is real (provides actual reducer context)
 * - useCanvasZoom is mocked to control fitLevel
 * - useTouchGestures is mocked (tested separately in its own test file)
 */

// ---------------------------------------------------------------------------
// ResizeObserver Mock (must be before component imports)
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
// Mock child components that have deep dependency chains.
// We only care about the swipe guard, not the full component tree.
// ---------------------------------------------------------------------------
vi.mock("@/components/canvas/canvas-header", () => ({
  CanvasHeader: () => <div data-testid="mock-canvas-header" />,
}));

vi.mock("@/components/canvas/canvas-image", () => ({
  CanvasImage: () => <div data-testid="mock-canvas-image" />,
}));

vi.mock("@/components/canvas/canvas-navigation", () => ({
  CanvasNavigation: () => <div data-testid="mock-canvas-navigation" />,
}));

vi.mock("@/components/canvas/sibling-thumbnails", () => ({
  SiblingThumbnails: () => <div data-testid="mock-sibling-thumbnails" />,
}));

vi.mock("@/components/canvas/canvas-toolbar", () => ({
  CanvasToolbar: () => <div data-testid="mock-canvas-toolbar" />,
}));

vi.mock("@/components/canvas/details-overlay", () => ({
  DetailsOverlay: () => <div data-testid="mock-details-overlay" />,
}));

vi.mock("@/components/canvas/popovers/variation-popover", () => ({
  VariationPopover: () => <div />,
}));

vi.mock("@/components/canvas/popovers/img2img-popover", () => ({
  Img2imgPopover: () => <div />,
}));

vi.mock("@/components/canvas/popovers/upscale-popover", () => ({
  UpscalePopover: () => <div />,
}));

vi.mock("@/components/canvas/canvas-chat-panel", () => ({
  CanvasChatPanel: () => <div />,
}));

vi.mock("@/components/canvas/mask-canvas", () => ({
  MaskCanvas: () => <div data-testid="mock-mask-canvas" />,
}));

vi.mock("@/components/canvas/floating-brush-toolbar", () => ({
  FloatingBrushToolbar: () => <div />,
}));

vi.mock("@/components/canvas/zoom-controls", () => ({
  ZoomControls: () => <div data-testid="mock-zoom-controls" />,
}));

vi.mock("@/components/canvas/outpaint-controls", () => ({
  OutpaintControls: () => <div />,
}));

vi.mock("@/app/actions/generations", () => ({
  generateImages: vi.fn(),
  upscaleImage: vi.fn(),
  fetchGenerations: vi.fn(),
  deleteGeneration: vi.fn(),
}));

vi.mock("@/app/actions/model-slots", () => ({
  getModelSlots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/models", () => ({
  getModels: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/actions/references", () => ({
  uploadReferenceImage: vi.fn(),
  addGalleryAsReference: vi.fn(),
}));

vi.mock("@/app/actions/upload", () => ({
  uploadMask: vi.fn(),
}));

vi.mock("@/lib/services/mask-service", () => ({
  validateMinSize: vi.fn(),
  applyFeathering: vi.fn(),
  scaleToOriginal: vi.fn(),
  toGrayscalePng: vi.fn(),
}));

vi.mock("@/lib/utils/resolve-model", () => ({
  resolveActiveSlots: vi.fn().mockReturnValue([]),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock useCanvasZoom to control fitLevel value
// ---------------------------------------------------------------------------
const mockFitLevel = { value: 0.75 };
const mockZoomToPoint = vi.fn();
const mockResetToFit = vi.fn();

vi.mock("@/lib/hooks/use-canvas-zoom", () => ({
  useCanvasZoom: () => ({
    fitLevel: mockFitLevel.value,
    zoomToPoint: mockZoomToPoint,
    zoomToStep: vi.fn(),
    resetToFit: mockResetToFit,
    handleWheel: vi.fn(),
    handleKeyDown: vi.fn(),
    isCanvasHoveredRef: { current: false },
    isSpaceHeldRef: { current: false },
    isDraggingRef: { current: false },
    handleSpaceKeyDown: vi.fn(),
    handleSpaceKeyUp: vi.fn(),
    handlePanPointerDown: vi.fn(),
    handlePanPointerMove: vi.fn(),
    handlePanPointerUp: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock useTouchGestures (tested separately in its own test file)
// ---------------------------------------------------------------------------
vi.mock("@/lib/hooks/use-touch-gestures", () => ({
  useTouchGestures: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks
// ---------------------------------------------------------------------------
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider, useCanvasDetail } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Test data: 3 generations for swipe navigation
// ---------------------------------------------------------------------------

function makeGeneration(id: string): Generation {
  return {
    id,
    prompt: "test prompt",
    imageUrl: `https://example.com/${id}.png`,
    width: 1024,
    height: 768,
    userId: "user-1",
    projectId: "project-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    model: "flux-pro",
    status: "completed",
    parentId: null,
    mode: "generate",
    referenceImageUrl: null,
    maskUrl: null,
    promptStrength: null,
    numInferenceSteps: null,
    guidanceScale: null,
    seed: null,
    aspectRatio: null,
    outputFormat: null,
    safetyTolerance: null,
    rawParams: null,
    batchGroup: null,
  } as Generation;
}

const gen1 = makeGeneration("gen-1");
const gen2 = makeGeneration("gen-2");
const gen3 = makeGeneration("gen-3");
const threeGenerations = [gen1, gen2, gen3];

// ---------------------------------------------------------------------------
// Helper: DispatchSpy component to control state from within provider
// ---------------------------------------------------------------------------

let testDispatch: ReturnType<typeof useCanvasDetail>["dispatch"] | null = null;
let testState: ReturnType<typeof useCanvasDetail>["state"] | null = null;

function StateSpy() {
  const { dispatch, state } = useCanvasDetail();
  testDispatch = dispatch;
  testState = state;
  return null;
}

// ---------------------------------------------------------------------------
// Helper: Simulate a swipe gesture via React synthetic touch events
// ---------------------------------------------------------------------------

function simulateSwipe(
  element: HTMLElement,
  startX: number,
  endX: number
) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: startX, clientY: 300 }],
  });
  fireEvent.touchEnd(element, {
    changedTouches: [{ clientX: endX, clientY: 300 }],
  });
}

// ---------------------------------------------------------------------------
// Tests: Swipe Guard (Slice 8, AC-8 through AC-10)
// ---------------------------------------------------------------------------

describe("canvas-detail-view - Swipe Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFitLevel.value = 0.75;
    testDispatch = null;
    testState = null;
  });

  // ---------------------------------------------------------------------------
  // AC-8: Swipe bei Fit -> Navigation
  // GIVEN zoomLevel === fitLevel (Fit-Ansicht) und state.maskData === null
  // WHEN der User horizontal swiped (deltaX > 50px)
  // THEN wird die Swipe-Navigation (prev/next Image) ausgefuehrt
  // ---------------------------------------------------------------------------
  it("AC-8: should allow swipe navigation when zoomLevel equals fitLevel and no maskData", () => {
    // Start with gen-2 as current (middle item), so both prev and next exist
    render(
      <CanvasDetailProvider initialGenerationId="gen-2">
        <StateSpy />
        <CanvasDetailView
          generation={gen2}
          allGenerations={threeGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    // Set zoomLevel to fitLevel so swipe is allowed
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: mockFitLevel.value,
        panX: 0,
        panY: 0,
      });
    });

    const canvasArea = screen.getByTestId("canvas-area");

    // Verify starting state
    expect(testState!.currentGenerationId).toBe("gen-2");

    // Swipe left (deltaX = -80, which is > 50 threshold) -> next image
    act(() => {
      simulateSwipe(canvasArea, 400, 320);
    });

    // After swipe left with delta -80px (abs > 50), currentGenerationId should change to gen-3
    // gen-2 is at index 1, delta < 0 -> navigate to gen-3 (index 2)
    expect(testState!.currentGenerationId).toBe("gen-3");
  });

  it("AC-8: should navigate to previous image on swipe right when at fitLevel", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-2">
        <StateSpy />
        <CanvasDetailView
          generation={gen2}
          allGenerations={threeGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    // Set zoomLevel to fitLevel
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: mockFitLevel.value,
        panX: 0,
        panY: 0,
      });
    });

    const canvasArea = screen.getByTestId("canvas-area");

    // Verify starting state
    expect(testState!.currentGenerationId).toBe("gen-2");

    // Swipe right (deltaX = +80, > 50 threshold) -> previous image
    act(() => {
      simulateSwipe(canvasArea, 320, 400);
    });

    // After swipe right with delta +80px, should navigate to gen-1 (index 0)
    expect(testState!.currentGenerationId).toBe("gen-1");
  });

  // ---------------------------------------------------------------------------
  // AC-9: Swipe bei Zoom > Fit -> blockiert
  // GIVEN zoomLevel > fitLevel (gezoomtes Bild) und state.maskData === null
  // WHEN der User horizontal swiped (deltaX > 50px)
  // THEN wird die Swipe-Navigation NICHT ausgefuehrt
  // ---------------------------------------------------------------------------
  it("AC-9: should block swipe navigation when zoomLevel is greater than fitLevel", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-2">
        <StateSpy />
        <CanvasDetailView
          generation={gen2}
          allGenerations={threeGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    // Set zoomLevel above fitLevel (zoomed in)
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: 1.5,
        panX: 0,
        panY: 0,
      });
    });

    const canvasArea = screen.getByTestId("canvas-area");

    // Verify starting state
    expect(testState!.currentGenerationId).toBe("gen-2");

    // Attempt swipe left (deltaX = -80)
    act(() => {
      simulateSwipe(canvasArea, 400, 320);
    });

    // Navigation should NOT happen -- currentGenerationId should still be gen-2
    // The handleTouchStart guard blocks capturing when zoomed beyond fit level
    expect(testState!.currentGenerationId).toBe("gen-2");
  });

  it("AC-9: should also block when zoom changes between touchstart and touchend", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-2">
        <StateSpy />
        <CanvasDetailView
          generation={gen2}
          allGenerations={threeGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    // Start at fitLevel
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: mockFitLevel.value,
        panX: 0,
        panY: 0,
      });
    });

    const canvasArea = screen.getByTestId("canvas-area");

    // Start touch at fitLevel (touchStartXRef gets captured)
    fireEvent.touchStart(canvasArea, {
      touches: [{ clientX: 400, clientY: 300 }],
    });

    // Zoom changes between touchstart and touchend (e.g. pinch happened)
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: 2.0,
        panX: 0,
        panY: 0,
      });
    });

    // Verify starting state (still gen-2)
    expect(testState!.currentGenerationId).toBe("gen-2");

    // End touch — the guard in handleTouchEnd should block because zoomLevel > fitLevel
    act(() => {
      fireEvent.touchEnd(canvasArea, {
        changedTouches: [{ clientX: 320, clientY: 300 }],
      });
    });

    // Navigation should NOT happen — the double-check guard in handleTouchEnd caught it
    expect(testState!.currentGenerationId).toBe("gen-2");
  });

  // ---------------------------------------------------------------------------
  // AC-10: Swipe bei Fit + maskData -> blockiert (bestehender Guard bleibt erhalten)
  // GIVEN zoomLevel === fitLevel und state.maskData !== null
  // WHEN der User horizontal swiped
  // THEN wird die Swipe-Navigation NICHT ausgefuehrt (bestehender maskData-Guard bleibt erhalten)
  // ---------------------------------------------------------------------------
  it("AC-10: should block swipe navigation when maskData exists even at fitLevel", () => {
    render(
      <CanvasDetailProvider initialGenerationId="gen-2">
        <StateSpy />
        <CanvasDetailView
          generation={gen2}
          allGenerations={threeGenerations}
          onBack={vi.fn()}
        />
      </CanvasDetailProvider>
    );

    // Set zoomLevel to fitLevel AND set maskData (non-null)
    act(() => {
      testDispatch!({
        type: "SET_ZOOM_PAN",
        zoomLevel: mockFitLevel.value,
        panX: 0,
        panY: 0,
      });
    });

    // Create a minimal ImageData-like object for maskData
    // (ImageData is not available in jsdom, so we create a plain object
    // that satisfies the !== null check in the swipe guard)
    const mockMaskData = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(16),
      colorSpace: "srgb" as const,
    } as unknown as ImageData;

    act(() => {
      testDispatch!({
        type: "SET_MASK_DATA",
        maskData: mockMaskData,
      });
    });

    const canvasArea = screen.getByTestId("canvas-area");

    // Verify starting state (still gen-2)
    expect(testState!.currentGenerationId).toBe("gen-2");

    // Attempt swipe left at fitLevel but with maskData present
    act(() => {
      simulateSwipe(canvasArea, 400, 320);
    });

    // Navigation should NOT happen — the maskData guard blocks it
    // even though zoomLevel === fitLevel. The existing maskData guard is preserved.
    expect(testState!.currentGenerationId).toBe("gen-2");
  });
});
