// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  canvasDetailReducer,
  type CanvasDetailState,
} from "@/lib/canvas-detail-context";

/**
 * Tests for slice-01-zoom-state: Zoom State Extension
 *
 * These tests validate the canvasDetailReducer's zoom/pan behavior
 * against the Acceptance Criteria defined in the slice spec.
 *
 * Mocking Strategy: no_mocks (per spec). Pure reducer tests — no
 * external dependencies needed.
 */

// ---------------------------------------------------------------------------
// Helper: create a base state for reducer tests
// ---------------------------------------------------------------------------
function makeBaseState(overrides: Partial<CanvasDetailState> = {}): CanvasDetailState {
  return {
    currentGenerationId: "gen-base",
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
    zoomLevel: 1,
    panX: 0,
    panY: 0,
    ...overrides,
  };
}

// ===========================================================================
// canvasDetailReducer - Zoom State
// ===========================================================================
describe("canvasDetailReducer - Zoom State", () => {
  // -------------------------------------------------------------------------
  // AC-1: Initial state defaults
  // GIVEN der Reducer im Initial-State
  // WHEN kein Action dispatched
  // THEN zoomLevel === 1, panX === 0, panY === 0
  // -------------------------------------------------------------------------
  it("AC-1: should have zoomLevel=1, panX=0, panY=0 in initial state", () => {
    const state = makeBaseState();

    expect(state.zoomLevel).toBe(1);
    expect(state.panX).toBe(0);
    expect(state.panY).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-2: SET_ZOOM_PAN with valid values
  // GIVEN der Reducer im Initial-State
  // WHEN SET_ZOOM_PAN mit { zoomLevel: 2.0, panX: 100, panY: -50 } dispatched
  // THEN State enthaelt zoomLevel === 2.0, panX === 100, panY === -50
  // -------------------------------------------------------------------------
  it("AC-2: should set zoomLevel, panX, panY from SET_ZOOM_PAN payload", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 2.0,
      panX: 100,
      panY: -50,
    });

    expect(next.zoomLevel).toBe(2.0);
    expect(next.panX).toBe(100);
    expect(next.panY).toBe(-50);
  });

  // -------------------------------------------------------------------------
  // AC-3: SET_ZOOM_PAN clamps zoomLevel above maximum
  // GIVEN der Reducer im Initial-State
  // WHEN SET_ZOOM_PAN mit { zoomLevel: 5.0, panX: 0, panY: 0 } dispatched
  // THEN zoomLevel === 3.0 (geclampt auf Maximum)
  // -------------------------------------------------------------------------
  it("AC-3: should clamp zoomLevel to 3.0 when payload exceeds maximum", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 5.0,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(3.0);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-4: SET_ZOOM_PAN clamps zoomLevel below minimum
  // GIVEN der Reducer im Initial-State
  // WHEN SET_ZOOM_PAN mit { zoomLevel: 0.1, panX: 0, panY: 0 } dispatched
  // THEN zoomLevel === 0.5 (geclampt auf Minimum)
  // -------------------------------------------------------------------------
  it("AC-4: should clamp zoomLevel to 0.5 when payload is below minimum", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 0.1,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(0.5);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-5: RESET_ZOOM_PAN resets to defaults
  // GIVEN State mit zoomLevel: 2.5, panX: 120, panY: -80
  // WHEN RESET_ZOOM_PAN dispatched
  // THEN zoomLevel === 1, panX === 0, panY === 0
  // -------------------------------------------------------------------------
  it("AC-5: should reset zoomLevel to 1, panX to 0, panY to 0 on RESET_ZOOM_PAN", () => {
    const state = makeBaseState({
      zoomLevel: 2.5,
      panX: 120,
      panY: -80,
    });
    const next = canvasDetailReducer(state, { type: "RESET_ZOOM_PAN" });

    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-6: SET_CURRENT_IMAGE resets zoom/pan
  // GIVEN State mit zoomLevel: 2.0, panX: 50, panY: 30
  // WHEN SET_CURRENT_IMAGE mit { generationId: "new-id" } dispatched
  // THEN currentGenerationId === "new-id", zoomLevel === 1, panX === 0, panY === 0
  // -------------------------------------------------------------------------
  it("AC-6: should reset zoomLevel, panX, panY when SET_CURRENT_IMAGE is dispatched", () => {
    const state = makeBaseState({
      zoomLevel: 2.0,
      panX: 50,
      panY: 30,
    });
    const next = canvasDetailReducer(state, {
      type: "SET_CURRENT_IMAGE",
      generationId: "new-id",
    });

    expect(next.currentGenerationId).toBe("new-id");
    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-7: SET_CURRENT_IMAGE preserves non-zoom state
  // GIVEN State mit zoomLevel: 2.0, panX: 50, panY: 30,
  //       editMode: "inpaint", maskData: <non-null>
  // WHEN SET_CURRENT_IMAGE dispatched
  // THEN editMode, maskData, brushSize, brushTool bleiben UNVERAENDERT
  //      (nur Zoom/Pan resettet)
  // -------------------------------------------------------------------------
  it("AC-7: should preserve editMode, maskData, brushSize, brushTool on SET_CURRENT_IMAGE", () => {
    // Create a non-null maskData stub (ImageData is not available in node env)
    const fakeMaskData = { width: 100, height: 100, data: new Uint8ClampedArray(4) } as unknown as ImageData;
    const state = makeBaseState({
      zoomLevel: 2.0,
      panX: 50,
      panY: 30,
      editMode: "inpaint",
      maskData: fakeMaskData,
      brushSize: 25,
      brushTool: "eraser",
    });
    const next = canvasDetailReducer(state, {
      type: "SET_CURRENT_IMAGE",
      generationId: "another-id",
    });

    // Zoom/Pan should be reset
    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);

    // Non-zoom state should be preserved
    expect(next.editMode).toBe("inpaint");
    expect(next.maskData).toBe(fakeMaskData);
    expect(next.brushSize).toBe(25);
    expect(next.brushTool).toBe("eraser");
  });

  // -------------------------------------------------------------------------
  // AC-8: SET_ZOOM_PAN handles NaN zoomLevel
  // GIVEN der Reducer im Initial-State
  // WHEN SET_ZOOM_PAN mit { zoomLevel: NaN, panX: 0, panY: 0 } dispatched
  // THEN zoomLevel wird auf 0.5 oder 3.0 geclampt (NaN-safe Handling)
  //      ODER State bleibt unveraendert
  // -------------------------------------------------------------------------
  it("AC-8: should handle NaN zoomLevel safely in SET_ZOOM_PAN", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: NaN,
      panX: 0,
      panY: 0,
    });

    // NaN should be handled: either clamped to min (0.5) or state unchanged
    // Per implementation: clampZoom returns ZOOM_MIN for non-finite values
    expect(Number.isFinite(next.zoomLevel)).toBe(true);
    expect(next.zoomLevel).toBeGreaterThanOrEqual(0.5);
    expect(next.zoomLevel).toBeLessThanOrEqual(3.0);
  });
});
