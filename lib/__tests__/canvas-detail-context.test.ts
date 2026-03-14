// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  canvasDetailReducer,
  useCanvasDetail,
  type CanvasDetailState,
} from "../canvas-detail-context";

/**
 * Tests for slice-03-canvas-detail-context
 *
 * Tests the canvasDetailReducer (pure function) and useCanvasDetail hook.
 * All tests are derived from the Acceptance Criteria in the slice spec.
 * NO mocks -- the reducer is tested directly as a pure function,
 * and the hook test uses a real renderHook call without a provider.
 */

// ---------------------------------------------------------------------------
// Helper: create a default initial state for reducer tests
// ---------------------------------------------------------------------------
function makeInitialState(
  overrides: Partial<CanvasDetailState> = {}
): CanvasDetailState {
  return {
    currentGenerationId: "gen-abc-123",
    lastImageChangeSource: null,
    activeToolId: null,
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    chatSessionId: null,
    selectedModelId: null,
    ...overrides,
  };
}

// ===========================================================================
// canvasDetailReducer
// ===========================================================================
describe("canvasDetailReducer", () => {
  // -------------------------------------------------------------------------
  // AC-1: Initialzustand korrekt
  // -------------------------------------------------------------------------
  it("should initialize with correct default values for all state fields", () => {
    /**
     * AC-1: GIVEN ein frisch initialisierter CanvasDetailContext mit
     *       currentGenerationId: "gen-abc-123"
     *       WHEN der State abgefragt wird
     *       THEN enthaelt er currentGenerationId: "gen-abc-123",
     *       activeToolId: null, undoStack: [], redoStack: [],
     *       isGenerating: false, chatSessionId: null, selectedModelId: null
     */
    const state = makeInitialState();

    expect(state.currentGenerationId).toBe("gen-abc-123");
    expect(state.activeToolId).toBeNull();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.isGenerating).toBe(false);
    expect(state.chatSessionId).toBeNull();
    expect(state.selectedModelId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // AC-2: SET_CURRENT_IMAGE aendert currentGenerationId
  // -------------------------------------------------------------------------
  it("should set currentGenerationId when SET_CURRENT_IMAGE is dispatched", () => {
    /**
     * AC-2: GIVEN der Reducer im Initialzustand
     *       WHEN Action SET_CURRENT_IMAGE mit { generationId: "gen-xyz-789" }
     *       dispatcht wird
     *       THEN ist currentGenerationId gleich "gen-xyz-789"
     */
    const state = makeInitialState();
    const nextState = canvasDetailReducer(state, {
      type: "SET_CURRENT_IMAGE",
      generationId: "gen-xyz-789",
    });

    expect(nextState.currentGenerationId).toBe("gen-xyz-789");
  });

  // -------------------------------------------------------------------------
  // AC-3: SET_ACTIVE_TOOL setzt activeToolId
  // -------------------------------------------------------------------------
  it("should set activeToolId when SET_ACTIVE_TOOL is dispatched", () => {
    /**
     * AC-3: GIVEN der Reducer mit activeToolId: null
     *       WHEN Action SET_ACTIVE_TOOL mit { toolId: "variation" } dispatcht wird
     *       THEN ist activeToolId gleich "variation"
     */
    const state = makeInitialState({ activeToolId: null });
    const nextState = canvasDetailReducer(state, {
      type: "SET_ACTIVE_TOOL",
      toolId: "variation",
    });

    expect(nextState.activeToolId).toBe("variation");
  });

  // -------------------------------------------------------------------------
  // AC-4: SET_ACTIVE_TOOL toggled bei gleichem Tool
  // -------------------------------------------------------------------------
  it("should toggle activeToolId to null when same tool is dispatched again", () => {
    /**
     * AC-4: GIVEN der Reducer mit activeToolId: "variation"
     *       WHEN Action SET_ACTIVE_TOOL mit { toolId: "variation" } dispatcht
     *       wird (gleiches Tool erneut)
     *       THEN ist activeToolId gleich null (Toggle-Verhalten)
     */
    const state = makeInitialState({ activeToolId: "variation" });
    const nextState = canvasDetailReducer(state, {
      type: "SET_ACTIVE_TOOL",
      toolId: "variation",
    });

    expect(nextState.activeToolId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // AC-5: PUSH_UNDO verschiebt aktuelles Bild in undoStack, setzt neues Bild,
  //        leert redoStack
  // -------------------------------------------------------------------------
  it("should push current image to undo stack, set new image, and clear redo stack on PUSH_UNDO", () => {
    /**
     * AC-5: GIVEN der Reducer mit currentGenerationId: "gen-B" und
     *       undoStack: ["gen-A"]
     *       WHEN Action PUSH_UNDO mit { generationId: "gen-C" } dispatcht wird
     *       THEN ist undoStack gleich ["gen-A", "gen-B"] und
     *       currentGenerationId gleich "gen-C" und redoStack gleich []
     */
    const state = makeInitialState({
      currentGenerationId: "gen-B",
      undoStack: ["gen-A"],
      redoStack: ["something-that-should-be-cleared"],
    });
    const nextState = canvasDetailReducer(state, {
      type: "PUSH_UNDO",
      generationId: "gen-C",
    });

    expect(nextState.undoStack).toEqual(["gen-A", "gen-B"]);
    expect(nextState.currentGenerationId).toBe("gen-C");
    expect(nextState.redoStack).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // AC-6: POP_UNDO stellt vorheriges Bild wieder her
  // -------------------------------------------------------------------------
  it("should restore previous image from undo stack and push current to redo stack on POP_UNDO", () => {
    /**
     * AC-6: GIVEN der Reducer mit currentGenerationId: "gen-B",
     *       undoStack: ["gen-A"], redoStack: []
     *       WHEN Action POP_UNDO dispatcht wird
     *       THEN ist currentGenerationId gleich "gen-A",
     *       undoStack gleich [], redoStack gleich ["gen-B"]
     */
    const state = makeInitialState({
      currentGenerationId: "gen-B",
      undoStack: ["gen-A"],
      redoStack: [],
    });
    const nextState = canvasDetailReducer(state, { type: "POP_UNDO" });

    expect(nextState.currentGenerationId).toBe("gen-A");
    expect(nextState.undoStack).toEqual([]);
    expect(nextState.redoStack).toEqual(["gen-B"]);
  });

  // -------------------------------------------------------------------------
  // AC-7: POP_UNDO bei leerem Stack ist No-Op
  // -------------------------------------------------------------------------
  it("should not change state when POP_UNDO is dispatched with empty undo stack", () => {
    /**
     * AC-7: GIVEN der Reducer mit undoStack: []
     *       WHEN Action POP_UNDO dispatcht wird
     *       THEN bleibt der State unveraendert (No-Op)
     */
    const state = makeInitialState({ undoStack: [] });
    const nextState = canvasDetailReducer(state, { type: "POP_UNDO" });

    // No-Op: must return the exact same reference
    expect(nextState).toBe(state);
  });

  // -------------------------------------------------------------------------
  // AC-8: POP_REDO stellt naechstes Bild wieder her
  // -------------------------------------------------------------------------
  it("should restore next image from redo stack and push current to undo stack on POP_REDO", () => {
    /**
     * AC-8: GIVEN der Reducer mit currentGenerationId: "gen-A",
     *       redoStack: ["gen-B"], undoStack: []
     *       WHEN Action POP_REDO dispatcht wird
     *       THEN ist currentGenerationId gleich "gen-B",
     *       redoStack gleich [], undoStack gleich ["gen-A"]
     */
    const state = makeInitialState({
      currentGenerationId: "gen-A",
      redoStack: ["gen-B"],
      undoStack: [],
    });
    const nextState = canvasDetailReducer(state, { type: "POP_REDO" });

    expect(nextState.currentGenerationId).toBe("gen-B");
    expect(nextState.redoStack).toEqual([]);
    expect(nextState.undoStack).toEqual(["gen-A"]);
  });

  // -------------------------------------------------------------------------
  // AC-9: POP_REDO bei leerem Stack ist No-Op
  // -------------------------------------------------------------------------
  it("should not change state when POP_REDO is dispatched with empty redo stack", () => {
    /**
     * AC-9: GIVEN der Reducer mit redoStack: []
     *       WHEN Action POP_REDO dispatcht wird
     *       THEN bleibt der State unveraendert (No-Op)
     */
    const state = makeInitialState({ redoStack: [] });
    const nextState = canvasDetailReducer(state, { type: "POP_REDO" });

    // No-Op: must return the exact same reference
    expect(nextState).toBe(state);
  });

  // -------------------------------------------------------------------------
  // AC-10: CLEAR_REDO leert den Redo-Stack
  // -------------------------------------------------------------------------
  it("should clear redo stack when CLEAR_REDO is dispatched", () => {
    /**
     * AC-10: GIVEN der Reducer mit redoStack: ["gen-X", "gen-Y"]
     *        WHEN Action CLEAR_REDO dispatcht wird
     *        THEN ist redoStack gleich []
     */
    const state = makeInitialState({
      redoStack: ["gen-X", "gen-Y"],
    });
    const nextState = canvasDetailReducer(state, { type: "CLEAR_REDO" });

    expect(nextState.redoStack).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // AC-11: Undo-Stack Maximum 20 Eintraege
  // -------------------------------------------------------------------------
  it("should cap undo stack at 20 entries by removing oldest entry", () => {
    /**
     * AC-11: GIVEN der Reducer mit undoStack das bereits 20 Eintraege enthaelt
     *        WHEN Action PUSH_UNDO dispatcht wird
     *        THEN hat undoStack weiterhin maximal 20 Eintraege
     *        (aeltester Eintrag an Index 0 wird entfernt)
     */
    // Build an undo stack with exactly 20 entries: ["gen-0", "gen-1", ..., "gen-19"]
    const twentyEntries = Array.from({ length: 20 }, (_, i) => `gen-${i}`);
    const state = makeInitialState({
      currentGenerationId: "gen-current",
      undoStack: twentyEntries,
    });

    const nextState = canvasDetailReducer(state, {
      type: "PUSH_UNDO",
      generationId: "gen-new",
    });

    // The undo stack should still have exactly 20 entries
    expect(nextState.undoStack).toHaveLength(20);
    // The oldest entry ("gen-0") should have been removed
    expect(nextState.undoStack[0]).not.toBe("gen-0");
    // The second entry from the old stack should now be first
    expect(nextState.undoStack[0]).toBe("gen-1");
    // The previous currentGenerationId should be the last entry
    expect(nextState.undoStack[19]).toBe("gen-current");
    // The new generation should be current
    expect(nextState.currentGenerationId).toBe("gen-new");
  });

  // -------------------------------------------------------------------------
  // AC-12: SET_GENERATING aendert isGenerating
  // -------------------------------------------------------------------------
  it("should set isGenerating when SET_GENERATING is dispatched", () => {
    /**
     * AC-12: GIVEN der Reducer mit isGenerating: false
     *        WHEN Action SET_GENERATING mit { isGenerating: true } dispatcht wird
     *        THEN ist isGenerating gleich true
     */
    const state = makeInitialState({ isGenerating: false });
    const nextState = canvasDetailReducer(state, {
      type: "SET_GENERATING",
      isGenerating: true,
    });

    expect(nextState.isGenerating).toBe(true);
  });
});

// ===========================================================================
// useCanvasDetail
// ===========================================================================
describe("useCanvasDetail", () => {
  // -------------------------------------------------------------------------
  // AC-13: Hook ohne Provider wirft Error
  // -------------------------------------------------------------------------
  it("should throw error when used outside of CanvasDetailProvider", () => {
    /**
     * AC-13: GIVEN eine React-Komponente die useCanvasDetail() ohne
     *        umgebenden CanvasDetailProvider aufruft
     *        WHEN der Hook ausgefuehrt wird
     *        THEN wird ein Error geworfen
     *        (z.B. "useCanvasDetail must be used within CanvasDetailProvider")
     */
    // Suppress console.error from React during the expected error
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useCanvasDetail());
    }).toThrow("useCanvasDetail must be used within CanvasDetailProvider");

    console.error = originalError;
  });
});
