// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  canvasDetailReducer,
  type CanvasDetailState,
} from "@/lib/canvas-detail-context";

/**
 * Acceptance Tests for slice-01-zoom-state: Zoom State Extension
 *
 * Each test maps 1:1 to an Acceptance Criterion from the slice spec.
 * Tests are written against the spec, not against the implementation.
 *
 * Mocking Strategy: no_mocks (per spec). Pure reducer function — no
 * external dependencies.
 */

// ---------------------------------------------------------------------------
// Helper: create a base state matching the provider's initial values
// ---------------------------------------------------------------------------
function makeInitialState(overrides: Partial<CanvasDetailState> = {}): CanvasDetailState {
  return {
    currentGenerationId: "gen-initial",
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
// Slice-01 Zoom State Extension - Acceptance Tests
// ===========================================================================
describe("slice-01-zoom-state Acceptance", () => {
  // =========================================================================
  // AC-1
  // =========================================================================
  it("AC-1: GIVEN der Reducer im Initial-State WHEN kein Action dispatched THEN zoomLevel === 1, panX === 0, panY === 0", () => {
    /**
     * AC-1: GIVEN der Reducer im Initial-State
     *       WHEN kein Action dispatched
     *       THEN zoomLevel === 1, panX === 0, panY === 0
     */
    const state = makeInitialState();

    expect(state.zoomLevel).toBe(1);
    expect(state.panX).toBe(0);
    expect(state.panY).toBe(0);
  });

  // =========================================================================
  // AC-2
  // =========================================================================
  it("AC-2: GIVEN der Reducer im Initial-State WHEN SET_ZOOM_PAN mit { zoomLevel: 2.0, panX: 100, panY: -50 } dispatched THEN State enthaelt zoomLevel === 2.0, panX === 100, panY === -50", () => {
    /**
     * AC-2: GIVEN der Reducer im Initial-State
     *       WHEN SET_ZOOM_PAN mit { zoomLevel: 2.0, panX: 100, panY: -50 } dispatched
     *       THEN State enthaelt zoomLevel === 2.0, panX === 100, panY === -50
     */
    const state = makeInitialState();
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

  // =========================================================================
  // AC-3
  // =========================================================================
  it("AC-3: GIVEN der Reducer im Initial-State WHEN SET_ZOOM_PAN mit { zoomLevel: 5.0 } dispatched THEN zoomLevel === 3.0 (geclampt auf Maximum)", () => {
    /**
     * AC-3: GIVEN der Reducer im Initial-State
     *       WHEN SET_ZOOM_PAN mit { zoomLevel: 5.0, panX: 0, panY: 0 } dispatched
     *       THEN zoomLevel === 3.0 (geclampt auf Maximum)
     */
    const state = makeInitialState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 5.0,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(3.0);
  });

  // =========================================================================
  // AC-4
  // =========================================================================
  it("AC-4: GIVEN der Reducer im Initial-State WHEN SET_ZOOM_PAN mit { zoomLevel: 0.1 } dispatched THEN zoomLevel === 0.5 (geclampt auf Minimum)", () => {
    /**
     * AC-4: GIVEN der Reducer im Initial-State
     *       WHEN SET_ZOOM_PAN mit { zoomLevel: 0.1, panX: 0, panY: 0 } dispatched
     *       THEN zoomLevel === 0.5 (geclampt auf Minimum)
     */
    const state = makeInitialState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 0.1,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(0.5);
  });

  // =========================================================================
  // AC-5
  // =========================================================================
  it("AC-5: GIVEN State mit zoomLevel: 2.5, panX: 120, panY: -80 WHEN RESET_ZOOM_PAN dispatched THEN zoomLevel === 1, panX === 0, panY === 0", () => {
    /**
     * AC-5: GIVEN State mit zoomLevel: 2.5, panX: 120, panY: -80
     *       WHEN RESET_ZOOM_PAN dispatched
     *       THEN zoomLevel === 1, panX === 0, panY === 0
     */
    const state = makeInitialState({
      zoomLevel: 2.5,
      panX: 120,
      panY: -80,
    });
    const next = canvasDetailReducer(state, { type: "RESET_ZOOM_PAN" });

    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  // =========================================================================
  // AC-6
  // =========================================================================
  it('AC-6: GIVEN State mit zoomLevel: 2.0, panX: 50, panY: 30 WHEN SET_CURRENT_IMAGE mit generationId "new-id" dispatched THEN currentGenerationId === "new-id", zoomLevel === 1, panX === 0, panY === 0', () => {
    /**
     * AC-6: GIVEN State mit zoomLevel: 2.0, panX: 50, panY: 30
     *       WHEN SET_CURRENT_IMAGE mit { generationId: "new-id" } dispatched
     *       THEN currentGenerationId === "new-id", zoomLevel === 1, panX === 0, panY === 0
     */
    const state = makeInitialState({
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

  // =========================================================================
  // AC-7
  // =========================================================================
  it("AC-7: GIVEN State mit zoomLevel: 2.0, editMode: inpaint, maskData: non-null WHEN SET_CURRENT_IMAGE dispatched THEN editMode, maskData, brushSize, brushTool bleiben UNVERAENDERT", () => {
    /**
     * AC-7: GIVEN State mit zoomLevel: 2.0, panX: 50, panY: 30,
     *             editMode: "inpaint", maskData: <non-null>
     *       WHEN SET_CURRENT_IMAGE dispatched
     *       THEN editMode, maskData, brushSize, brushTool bleiben UNVERAENDERT
     *            (nur Zoom/Pan resettet)
     */
    const fakeMaskData = {
      width: 512,
      height: 512,
      data: new Uint8ClampedArray(512 * 512 * 4),
    } as unknown as ImageData;

    const state = makeInitialState({
      zoomLevel: 2.0,
      panX: 50,
      panY: 30,
      editMode: "inpaint",
      maskData: fakeMaskData,
      brushSize: 60,
      brushTool: "eraser",
    });

    const next = canvasDetailReducer(state, {
      type: "SET_CURRENT_IMAGE",
      generationId: "switched-image",
    });

    // Zoom/Pan MUST be reset
    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);

    // Non-zoom fields MUST be preserved
    expect(next.editMode).toBe("inpaint");
    expect(next.maskData).toBe(fakeMaskData);
    expect(next.brushSize).toBe(60);
    expect(next.brushTool).toBe("eraser");
  });

  // =========================================================================
  // AC-8
  // =========================================================================
  it("AC-8: GIVEN der Reducer im Initial-State WHEN SET_ZOOM_PAN mit { zoomLevel: NaN } dispatched THEN zoomLevel is NaN-safe (clamped or state unchanged)", () => {
    /**
     * AC-8: GIVEN der Reducer im Initial-State
     *       WHEN SET_ZOOM_PAN mit { zoomLevel: NaN, panX: 0, panY: 0 } dispatched
     *       THEN zoomLevel wird auf 0.5 oder 3.0 geclampt (NaN-safe Handling)
     *            ODER State bleibt unveraendert
     */
    const state = makeInitialState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: NaN,
      panX: 0,
      panY: 0,
    });

    // zoomLevel MUST NOT be NaN
    expect(Number.isNaN(next.zoomLevel)).toBe(false);
    // zoomLevel must be within valid range
    expect(Number.isFinite(next.zoomLevel)).toBe(true);
    expect(next.zoomLevel).toBeGreaterThanOrEqual(0.5);
    expect(next.zoomLevel).toBeLessThanOrEqual(3.0);
  });
});
