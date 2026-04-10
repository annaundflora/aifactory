// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  canvasDetailReducer,
  type CanvasDetailState,
} from "@/lib/canvas-detail-context";

/**
 * Unit Tests for slice-01-zoom-state: Zoom State Extension
 *
 * These tests cover internal reducer logic, clamping behavior, and
 * edge cases for the zoom/pan state fields.
 *
 * Mocking Strategy: no_mocks (per spec). Pure reducer function tests.
 */

// ---------------------------------------------------------------------------
// Helper
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
// SET_ZOOM_PAN clamping edge cases
// ===========================================================================
describe("SET_ZOOM_PAN clamping edge cases", () => {
  it("should accept zoomLevel exactly at minimum boundary (0.5)", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 0.5,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(0.5);
  });

  it("should accept zoomLevel exactly at maximum boundary (3.0)", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 3.0,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(3.0);
  });

  it("should clamp zoomLevel of 0 to minimum (0.5)", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 0,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(0.5);
  });

  it("should clamp negative zoomLevel to minimum (0.5)", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: -1,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(0.5);
  });

  it("should handle Infinity zoomLevel safely", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: Infinity,
      panX: 0,
      panY: 0,
    });

    expect(Number.isFinite(next.zoomLevel)).toBe(true);
    expect(next.zoomLevel).toBeGreaterThanOrEqual(0.5);
    expect(next.zoomLevel).toBeLessThanOrEqual(3.0);
  });

  it("should handle -Infinity zoomLevel safely", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: -Infinity,
      panX: 0,
      panY: 0,
    });

    expect(Number.isFinite(next.zoomLevel)).toBe(true);
    expect(next.zoomLevel).toBeGreaterThanOrEqual(0.5);
    expect(next.zoomLevel).toBeLessThanOrEqual(3.0);
  });

  it("should accept valid fractional zoomLevel (1.75)", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1.75,
      panX: 0,
      panY: 0,
    });

    expect(next.zoomLevel).toBe(1.75);
  });
});

// ===========================================================================
// Pan value handling
// ===========================================================================
describe("SET_ZOOM_PAN pan value handling", () => {
  it("should accept negative pan values", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1,
      panX: -500,
      panY: -300,
    });

    expect(next.panX).toBe(-500);
    expect(next.panY).toBe(-300);
  });

  it("should accept large positive pan values", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1,
      panX: 10000,
      panY: 10000,
    });

    expect(next.panX).toBe(10000);
    expect(next.panY).toBe(10000);
  });

  it("should handle NaN panX safely", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1,
      panX: NaN,
      panY: 0,
    });

    expect(Number.isFinite(next.panX)).toBe(true);
  });

  it("should handle NaN panY safely", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1,
      panX: 0,
      panY: NaN,
    });

    expect(Number.isFinite(next.panY)).toBe(true);
  });

  it("should handle Infinity pan values safely", () => {
    const state = makeBaseState();
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 1,
      panX: Infinity,
      panY: -Infinity,
    });

    expect(Number.isFinite(next.panX)).toBe(true);
    expect(Number.isFinite(next.panY)).toBe(true);
  });
});

// ===========================================================================
// RESET_ZOOM_PAN does not affect other state fields
// ===========================================================================
describe("RESET_ZOOM_PAN state isolation", () => {
  it("should not affect non-zoom state fields on reset", () => {
    const state = makeBaseState({
      zoomLevel: 2.5,
      panX: 120,
      panY: -80,
      currentGenerationId: "gen-123",
      editMode: "inpaint",
      brushSize: 25,
      isGenerating: true,
    });
    const next = canvasDetailReducer(state, { type: "RESET_ZOOM_PAN" });

    expect(next.currentGenerationId).toBe("gen-123");
    expect(next.editMode).toBe("inpaint");
    expect(next.brushSize).toBe(25);
    expect(next.isGenerating).toBe(true);

    // But zoom/pan should be reset
    expect(next.zoomLevel).toBe(1);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });
});

// ===========================================================================
// SET_ZOOM_PAN does not affect other state fields
// ===========================================================================
describe("SET_ZOOM_PAN state isolation", () => {
  it("should not modify non-zoom state fields", () => {
    const state = makeBaseState({
      currentGenerationId: "gen-xyz",
      editMode: "erase",
      isGenerating: true,
      chatSessionId: "chat-1",
    });
    const next = canvasDetailReducer(state, {
      type: "SET_ZOOM_PAN",
      zoomLevel: 2.0,
      panX: 50,
      panY: -25,
    });

    expect(next.currentGenerationId).toBe("gen-xyz");
    expect(next.editMode).toBe("erase");
    expect(next.isGenerating).toBe(true);
    expect(next.chatSessionId).toBe("chat-1");
  });
});
