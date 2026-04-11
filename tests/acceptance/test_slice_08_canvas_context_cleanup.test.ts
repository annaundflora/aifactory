// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { canvasDetailReducer, type CanvasDetailState } from "@/lib/canvas-detail-context";

/**
 * Acceptance Tests for slice-08-canvas-context-cleanup
 *
 * ACs 1-4 validate that selectedModelId and SET_SELECTED_MODEL have been
 * removed from the canvas-detail-context. These tests use source file
 * inspection (static analysis) and runtime type/reducer checks.
 *
 * Mocking Strategy: mock_external per spec. These tests inspect source
 * code and the exported reducer -- no external deps needed.
 */

// ---------------------------------------------------------------------------
// Source file path
// ---------------------------------------------------------------------------
const CONTEXT_FILE_PATH = path.resolve(
  __dirname,
  "../../lib/canvas-detail-context.tsx"
);

// ---------------------------------------------------------------------------
// Read source once for static analysis tests
// ---------------------------------------------------------------------------
const contextSource = fs.readFileSync(CONTEXT_FILE_PATH, "utf-8");

// ===========================================================================
// AC-1: selectedModelId removed from CanvasDetailState
// ===========================================================================
describe("CanvasDetailState (after cleanup)", () => {
  /**
   * AC-1: GIVEN CanvasDetailState aus lib/canvas-detail-context.tsx
   *       WHEN das Interface inspiziert wird
   *       THEN enthaelt es KEIN Feld selectedModelId
   */
  it("AC-1: should not have selectedModelId in CanvasDetailState interface", () => {
    // Extract the CanvasDetailState interface block from source
    const stateInterfaceMatch = contextSource.match(
      /export\s+interface\s+CanvasDetailState\s*\{[^}]*\}/s
    );
    expect(stateInterfaceMatch).not.toBeNull();

    const stateInterface = stateInterfaceMatch![0];

    // Verify selectedModelId is NOT present in the interface
    expect(stateInterface).not.toContain("selectedModelId");
  });
});

// ===========================================================================
// AC-2: SET_SELECTED_MODEL removed from CanvasDetailAction
// ===========================================================================
describe("CanvasDetailAction (after cleanup)", () => {
  /**
   * AC-2: GIVEN CanvasDetailAction aus lib/canvas-detail-context.tsx
   *       WHEN der Union-Type inspiziert wird
   *       THEN enthaelt er KEINEN Member { type: "SET_SELECTED_MODEL"; modelId: string | null }
   */
  it('AC-2: should not include SET_SELECTED_MODEL in action union type', () => {
    // The CanvasDetailAction type is a union declared with `export type CanvasDetailAction =`
    // Check that SET_SELECTED_MODEL does not appear anywhere in the source
    expect(contextSource).not.toContain("SET_SELECTED_MODEL");
  });
});

// ===========================================================================
// AC-3: No SET_SELECTED_MODEL case in reducer
// ===========================================================================
describe("canvasDetailReducer (after cleanup)", () => {
  /**
   * AC-3: GIVEN der canvasDetailReducer
   *       WHEN alle switch-cases geprueft werden
   *       THEN existiert KEIN case "SET_SELECTED_MODEL"
   */
  it('AC-3: should not handle SET_SELECTED_MODEL action', () => {
    // Extract the reducer function body
    const reducerMatch = contextSource.match(
      /export\s+function\s+canvasDetailReducer[\s\S]*?^}/m
    );
    expect(reducerMatch).not.toBeNull();

    const reducerBody = reducerMatch![0];

    // Verify no case for SET_SELECTED_MODEL exists
    expect(reducerBody).not.toContain("SET_SELECTED_MODEL");

    // Also verify at runtime: dispatching an unknown action returns the same state
    // (the default case returns state unchanged)
    const state: CanvasDetailState = {
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
      zoomLevel: 1,
      panX: 0,
      panY: 0,
    };

    // Dispatching a removed action type should hit the default case and return state unchanged
    const nextState = canvasDetailReducer(state, {
      type: "SET_SELECTED_MODEL" as any,
      modelId: "some-model",
    } as any);
    expect(nextState).toBe(state);
  });
});

// ===========================================================================
// AC-4: Initial state does not contain selectedModelId
// ===========================================================================
describe("CanvasDetailProvider initial state (after cleanup)", () => {
  /**
   * AC-4: GIVEN der CanvasDetailProvider
   *       WHEN der initiale State erzeugt wird
   *       THEN enthaelt er KEIN Feld selectedModelId
   */
  it("AC-4: should not include selectedModelId in initial state", () => {
    // Extract the useReducer initializer from the CanvasDetailProvider
    const providerMatch = contextSource.match(
      /useReducer\s*\(\s*canvasDetailReducer\s*,\s*(\{[^}]*\})\s*\)/s
    );
    expect(providerMatch).not.toBeNull();

    const initialStateBlock = providerMatch![1];

    // Verify selectedModelId is NOT present in the initial state object
    expect(initialStateBlock).not.toContain("selectedModelId");

    // Also verify that the known fields are present (sanity check)
    expect(initialStateBlock).toContain("currentGenerationId");
    expect(initialStateBlock).toContain("activeToolId");
    expect(initialStateBlock).toContain("undoStack");
    expect(initialStateBlock).toContain("redoStack");
    expect(initialStateBlock).toContain("isGenerating");
    expect(initialStateBlock).toContain("chatSessionId");
  });
});
