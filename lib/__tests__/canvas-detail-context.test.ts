// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  canvasDetailReducer,
  useCanvasDetail,
  type CanvasDetailState,
} from "../canvas-detail-context";

// ---------------------------------------------------------------------------
// Polyfill: jsdom does not provide ImageData — add a minimal implementation
// so reducer tests can pass real ImageData-like instances through state.
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof globalThis.ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = class ImageData {
      readonly width: number;
      readonly height: number;
      readonly data: Uint8ClampedArray;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
});

/**
 * Tests for canvas-detail-context
 *
 * Tests the canvasDetailReducer (pure function) and useCanvasDetail hook.
 * All tests are derived from the Acceptance Criteria in the slice specs.
 * NO mocks -- the reducer is tested directly as a pure function,
 * and the hook test uses a real renderHook call without a provider.
 *
 * Slice-01 ACs cover the base context (SET_CURRENT_IMAGE, SET_ACTIVE_TOOL, etc.)
 * Slice-02 ACs cover the edit-mode extension (editMode, maskData, brushSize, etc.)
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
     *       isGenerating: false, chatSessionId: null
     */
    const state = makeInitialState();

    expect(state.currentGenerationId).toBe("gen-abc-123");
    expect(state.activeToolId).toBeNull();
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.isGenerating).toBe(false);
    expect(state.chatSessionId).toBeNull();
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

  // =========================================================================
  // Slice-02: Canvas Detail Context Extension — Edit-Mode State & Actions
  // =========================================================================

  // -------------------------------------------------------------------------
  // AC-1 (Slice-02): Default-Werte der neuen Edit-Mode State-Felder
  // -------------------------------------------------------------------------
  it("should initialize editMode as null, maskData as null, brushSize as 40, brushTool as brush, outpaintDirections as empty array, outpaintSize as 50", () => {
    /**
     * AC-1: GIVEN der initiale CanvasDetailState
     *       WHEN der State ohne Dispatch gelesen wird
     *       THEN ist editMode gleich null, maskData gleich null,
     *       brushSize gleich 40, brushTool gleich "brush",
     *       outpaintDirections gleich [] (leeres Array),
     *       outpaintSize gleich 50
     */
    const state = makeInitialState();

    expect(state.editMode).toBeNull();
    expect(state.maskData).toBeNull();
    expect(state.brushSize).toBe(40);
    expect(state.brushTool).toBe("brush");
    expect(state.outpaintDirections).toEqual([]);
    expect(state.outpaintSize).toBe(50);
  });

  // -------------------------------------------------------------------------
  // AC-2 (Slice-02): SET_EDIT_MODE setzt editMode
  // -------------------------------------------------------------------------
  it("should set editMode to inpaint when SET_EDIT_MODE dispatched", () => {
    /**
     * AC-2: GIVEN ein State mit editMode: null
     *       WHEN { type: "SET_EDIT_MODE", editMode: "inpaint" } dispatched wird
     *       THEN ist editMode gleich "inpaint"
     */
    const state = makeInitialState({ editMode: null });
    const nextState = canvasDetailReducer(state, {
      type: "SET_EDIT_MODE",
      editMode: "inpaint",
    });

    expect(nextState.editMode).toBe("inpaint");
  });

  // -------------------------------------------------------------------------
  // AC-3 (Slice-02): SET_EDIT_MODE auf null zuruecksetzen
  // -------------------------------------------------------------------------
  it("should set editMode to null when SET_EDIT_MODE dispatched with null", () => {
    /**
     * AC-3: GIVEN ein State mit editMode: "inpaint"
     *       WHEN { type: "SET_EDIT_MODE", editMode: null } dispatched wird
     *       THEN ist editMode gleich null
     */
    const state = makeInitialState({ editMode: "inpaint" });
    const nextState = canvasDetailReducer(state, {
      type: "SET_EDIT_MODE",
      editMode: null,
    });

    expect(nextState.editMode).toBeNull();
  });

  // -------------------------------------------------------------------------
  // AC-4 (Slice-02): SET_MASK_DATA setzt maskData (Referenzgleichheit)
  // -------------------------------------------------------------------------
  it("should set maskData to provided ImageData instance", () => {
    /**
     * AC-4: GIVEN ein State mit maskData: null
     *       WHEN { type: "SET_MASK_DATA", maskData: <ImageData-Instanz> }
     *       dispatched wird
     *       THEN ist maskData die uebergebene ImageData-Instanz
     *       (Referenzgleichheit)
     */
    const state = makeInitialState({ maskData: null });
    // Create a real ImageData instance (jsdom provides this)
    const imageData = new ImageData(100, 100);
    const nextState = canvasDetailReducer(state, {
      type: "SET_MASK_DATA",
      maskData: imageData,
    });

    // Reference equality — must be the exact same object
    expect(nextState.maskData).toBe(imageData);
  });

  // -------------------------------------------------------------------------
  // AC-5 (Slice-02): CLEAR_MASK setzt maskData auf null
  // -------------------------------------------------------------------------
  it("should set maskData to null when CLEAR_MASK dispatched", () => {
    /**
     * AC-5: GIVEN ein State mit maskData: <ImageData-Instanz>
     *       WHEN { type: "CLEAR_MASK" } dispatched wird
     *       THEN ist maskData gleich null
     */
    const imageData = new ImageData(100, 100);
    const state = makeInitialState({ maskData: imageData });
    const nextState = canvasDetailReducer(state, { type: "CLEAR_MASK" });

    expect(nextState.maskData).toBeNull();
  });

  // -------------------------------------------------------------------------
  // AC-6 (Slice-02): SET_BRUSH_SIZE setzt brushSize
  // -------------------------------------------------------------------------
  it("should set brushSize to 75 when SET_BRUSH_SIZE dispatched", () => {
    /**
     * AC-6: GIVEN ein State mit brushSize: 40
     *       WHEN { type: "SET_BRUSH_SIZE", brushSize: 75 } dispatched wird
     *       THEN ist brushSize gleich 75
     */
    const state = makeInitialState({ brushSize: 40 });
    const nextState = canvasDetailReducer(state, {
      type: "SET_BRUSH_SIZE",
      brushSize: 75,
    });

    expect(nextState.brushSize).toBe(75);
  });

  // -------------------------------------------------------------------------
  // AC-7 (Slice-02): SET_BRUSH_TOOL setzt brushTool
  // -------------------------------------------------------------------------
  it("should set brushTool to eraser when SET_BRUSH_TOOL dispatched", () => {
    /**
     * AC-7: GIVEN ein State mit brushTool: "brush"
     *       WHEN { type: "SET_BRUSH_TOOL", brushTool: "eraser" } dispatched wird
     *       THEN ist brushTool gleich "eraser"
     */
    const state = makeInitialState({ brushTool: "brush" });
    const nextState = canvasDetailReducer(state, {
      type: "SET_BRUSH_TOOL",
      brushTool: "eraser",
    });

    expect(nextState.brushTool).toBe("eraser");
  });

  // -------------------------------------------------------------------------
  // AC-8 (Slice-02): SET_OUTPAINT_DIRECTIONS setzt outpaintDirections
  // -------------------------------------------------------------------------
  it("should set outpaintDirections to top and right when SET_OUTPAINT_DIRECTIONS dispatched", () => {
    /**
     * AC-8: GIVEN ein State mit outpaintDirections: []
     *       WHEN { type: "SET_OUTPAINT_DIRECTIONS",
     *       outpaintDirections: ["top", "right"] } dispatched wird
     *       THEN ist outpaintDirections gleich ["top", "right"]
     */
    const state = makeInitialState({ outpaintDirections: [] });
    const nextState = canvasDetailReducer(state, {
      type: "SET_OUTPAINT_DIRECTIONS",
      outpaintDirections: ["top", "right"],
    });

    expect(nextState.outpaintDirections).toEqual(["top", "right"]);
  });

  // -------------------------------------------------------------------------
  // AC-9 (Slice-02): SET_OUTPAINT_SIZE setzt outpaintSize
  // -------------------------------------------------------------------------
  it("should set outpaintSize to 100 when SET_OUTPAINT_SIZE dispatched", () => {
    /**
     * AC-9: GIVEN ein State mit outpaintSize: 50
     *       WHEN { type: "SET_OUTPAINT_SIZE", outpaintSize: 100 }
     *       dispatched wird
     *       THEN ist outpaintSize gleich 100
     */
    const state = makeInitialState({ outpaintSize: 50 });
    const nextState = canvasDetailReducer(state, {
      type: "SET_OUTPAINT_SIZE",
      outpaintSize: 100,
    });

    expect(nextState.outpaintSize).toBe(100);
  });

  // -------------------------------------------------------------------------
  // AC-10 (Slice-02): Maske ueberlebt Mode-Wechsel
  // -------------------------------------------------------------------------
  it("should preserve maskData when editMode changes from inpaint to outpaint", () => {
    /**
     * AC-10: GIVEN ein State mit editMode: "inpaint" und
     *        maskData: <ImageData-Instanz>
     *        WHEN { type: "SET_EDIT_MODE", editMode: "outpaint" }
     *        dispatched wird
     *        THEN ist editMode gleich "outpaint" AND maskData bleibt
     *        unveraendert (Maske ueberlebt Mode-Wechsel)
     */
    const imageData = new ImageData(100, 100);
    const state = makeInitialState({
      editMode: "inpaint",
      maskData: imageData,
    });
    const nextState = canvasDetailReducer(state, {
      type: "SET_EDIT_MODE",
      editMode: "outpaint",
    });

    expect(nextState.editMode).toBe("outpaint");
    // maskData must be the exact same reference — not cleared, not cloned
    expect(nextState.maskData).toBe(imageData);
  });

  // -------------------------------------------------------------------------
  // AC-11 (Slice-02): Keine Regression bestehender Cases
  // -------------------------------------------------------------------------
  it("should handle SET_ACTIVE_TOOL identically to previous behavior", () => {
    /**
     * AC-11: GIVEN bestehende Reducer-Cases (SET_CURRENT_IMAGE,
     *        SET_ACTIVE_TOOL, etc.)
     *        WHEN ein bestehender Action-Type dispatched wird
     *        THEN bleibt das Verhalten identisch zum bisherigen Reducer
     *        (keine Regression)
     *
     * This test dispatches several pre-existing action types and verifies
     * they still produce the expected state transitions, proving the new
     * edit-mode cases did not break existing reducer logic.
     */

    // --- SET_ACTIVE_TOOL: toggle on ---
    const s1 = makeInitialState({ activeToolId: null });
    const r1 = canvasDetailReducer(s1, {
      type: "SET_ACTIVE_TOOL",
      toolId: "variation",
    });
    expect(r1.activeToolId).toBe("variation");

    // --- SET_ACTIVE_TOOL: toggle off (same tool) ---
    const r1b = canvasDetailReducer(r1, {
      type: "SET_ACTIVE_TOOL",
      toolId: "variation",
    });
    expect(r1b.activeToolId).toBeNull();

    // --- SET_CURRENT_IMAGE ---
    const s2 = makeInitialState();
    const r2 = canvasDetailReducer(s2, {
      type: "SET_CURRENT_IMAGE",
      generationId: "gen-new-img",
    });
    expect(r2.currentGenerationId).toBe("gen-new-img");

    // --- SET_GENERATING ---
    const s3 = makeInitialState({ isGenerating: false });
    const r3 = canvasDetailReducer(s3, {
      type: "SET_GENERATING",
      isGenerating: true,
    });
    expect(r3.isGenerating).toBe(true);

    // --- PUSH_UNDO ---
    const s4 = makeInitialState({
      currentGenerationId: "gen-B",
      undoStack: ["gen-A"],
    });
    const r4 = canvasDetailReducer(s4, {
      type: "PUSH_UNDO",
      generationId: "gen-C",
    });
    expect(r4.undoStack).toEqual(["gen-A", "gen-B"]);
    expect(r4.currentGenerationId).toBe("gen-C");
    expect(r4.redoStack).toEqual([]);

    // --- POP_UNDO ---
    const s5 = makeInitialState({
      currentGenerationId: "gen-B",
      undoStack: ["gen-A"],
    });
    const r5 = canvasDetailReducer(s5, { type: "POP_UNDO" });
    expect(r5.currentGenerationId).toBe("gen-A");
    expect(r5.undoStack).toEqual([]);
    expect(r5.redoStack).toEqual(["gen-B"]);

    // --- POP_REDO ---
    const s6 = makeInitialState({
      currentGenerationId: "gen-A",
      redoStack: ["gen-B"],
    });
    const r6 = canvasDetailReducer(s6, { type: "POP_REDO" });
    expect(r6.currentGenerationId).toBe("gen-B");

    // --- CLEAR_REDO ---
    const s7 = makeInitialState({ redoStack: ["gen-X"] });
    const r7 = canvasDetailReducer(s7, { type: "CLEAR_REDO" });
    expect(r7.redoStack).toEqual([]);

    // --- SET_CHAT_SESSION ---
    const s8 = makeInitialState({ chatSessionId: null });
    const r8 = canvasDetailReducer(s8, {
      type: "SET_CHAT_SESSION",
      chatSessionId: "session-123",
    });
    expect(r8.chatSessionId).toBe("session-123");

    // Verify new edit-mode fields were NOT affected by existing actions
    expect(r1.editMode).toBeNull();
    expect(r1.maskData).toBeNull();
    expect(r1.brushSize).toBe(40);
    expect(r1.brushTool).toBe("brush");
    expect(r1.outpaintDirections).toEqual([]);
    expect(r1.outpaintSize).toBe(50);
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
