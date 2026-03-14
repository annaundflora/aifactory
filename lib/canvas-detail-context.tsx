"use client";

import { createContext, useContext, useReducer, useEffect } from "react";
import type { Dispatch, ReactNode } from "react";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const UNDO_STACK_MAX = 20;

export interface CanvasDetailState {
  currentGenerationId: string;
  /** Source of the last image change — "navigation" for Prev/Next, "sibling" for sibling click */
  lastImageChangeSource: "sibling" | "navigation" | null;
  activeToolId: string | null;
  undoStack: string[];
  redoStack: string[];
  isGenerating: boolean;
  chatSessionId: string | null;
  selectedModelId: string | null;
}

// ---------------------------------------------------------------------------
// Actions (discriminated union)
// ---------------------------------------------------------------------------

export type CanvasDetailAction =
  | { type: "SET_CURRENT_IMAGE"; generationId: string; source?: "sibling" | "navigation" }
  | { type: "SET_ACTIVE_TOOL"; toolId: string }
  | { type: "PUSH_UNDO"; generationId: string }
  | { type: "POP_UNDO" }
  | { type: "POP_REDO" }
  | { type: "CLEAR_REDO" }
  | { type: "SET_GENERATING"; isGenerating: boolean }
  | { type: "SET_CHAT_SESSION"; chatSessionId: string | null }
  | { type: "SET_SELECTED_MODEL"; modelId: string | null };

// ---------------------------------------------------------------------------
// Reducer (pure function, no side effects)
// ---------------------------------------------------------------------------

export function canvasDetailReducer(
  state: CanvasDetailState,
  action: CanvasDetailAction
): CanvasDetailState {
  switch (action.type) {
    case "SET_CURRENT_IMAGE":
      return {
        ...state,
        currentGenerationId: action.generationId,
        lastImageChangeSource: action.source ?? null,
      };

    case "SET_ACTIVE_TOOL":
      return {
        ...state,
        activeToolId:
          state.activeToolId === action.toolId ? null : action.toolId,
      };

    case "PUSH_UNDO": {
      const newUndoStack = [...state.undoStack, state.currentGenerationId];
      // Cap at UNDO_STACK_MAX by removing oldest entries (from the front)
      if (newUndoStack.length > UNDO_STACK_MAX) {
        newUndoStack.splice(0, newUndoStack.length - UNDO_STACK_MAX);
      }
      return {
        ...state,
        undoStack: newUndoStack,
        currentGenerationId: action.generationId,
        redoStack: [],
      };
    }

    case "POP_UNDO": {
      if (state.undoStack.length === 0) {
        return state;
      }
      const newUndoStack = state.undoStack.slice(0, -1);
      const previousGenerationId =
        state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        undoStack: newUndoStack,
        currentGenerationId: previousGenerationId,
        redoStack: [...state.redoStack, state.currentGenerationId],
      };
    }

    case "POP_REDO": {
      if (state.redoStack.length === 0) {
        return state;
      }
      const newRedoStack = state.redoStack.slice(0, -1);
      const nextGenerationId =
        state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        redoStack: newRedoStack,
        currentGenerationId: nextGenerationId,
        undoStack: [...state.undoStack, state.currentGenerationId],
      };
    }

    case "CLEAR_REDO":
      return {
        ...state,
        redoStack: [],
      };

    case "SET_GENERATING":
      return {
        ...state,
        isGenerating: action.isGenerating,
      };

    case "SET_CHAT_SESSION":
      return {
        ...state,
        chatSessionId: action.chatSessionId,
      };

    case "SET_SELECTED_MODEL":
      return {
        ...state,
        selectedModelId: action.modelId,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface CanvasDetailContextValue {
  state: CanvasDetailState;
  dispatch: Dispatch<CanvasDetailAction>;
}

const CanvasDetailContext = createContext<CanvasDetailContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface CanvasDetailProviderProps {
  initialGenerationId: string;
  children: ReactNode;
}

export function CanvasDetailProvider({
  initialGenerationId,
  children,
}: CanvasDetailProviderProps) {
  const [state, dispatch] = useReducer(canvasDetailReducer, {
    currentGenerationId: initialGenerationId,
    lastImageChangeSource: null,
    activeToolId: null,
    undoStack: [],
    redoStack: [],
    isGenerating: false,
    chatSessionId: null,
    selectedModelId: null,
  });

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
  // Suppressed when an input/textarea/contentEditable element has focus.
  // Suppressed when isGenerating is true.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle Cmd/Ctrl modifier
      const hasModifier = e.metaKey || e.ctrlKey;
      if (!hasModifier) return;

      // Only handle Z key
      if (e.key !== "z" && e.key !== "Z") return;

      // Suppress when input/textarea/contentEditable has focus
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return;
      }

      // Suppress during generation (read from closure — stable ref via state)
      if (state.isGenerating) return;

      if (e.shiftKey) {
        // Cmd/Ctrl+Shift+Z → Redo
        if (state.redoStack.length === 0) return;
        e.preventDefault();
        dispatch({ type: "POP_REDO" });
      } else {
        // Cmd/Ctrl+Z → Undo
        if (state.undoStack.length === 0) return;
        e.preventDefault();
        dispatch({ type: "POP_UNDO" });
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.isGenerating, state.undoStack.length, state.redoStack.length]);

  return (
    <CanvasDetailContext.Provider value={{ state, dispatch }}>
      {children}
    </CanvasDetailContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCanvasDetail(): CanvasDetailContextValue {
  const context = useContext(CanvasDetailContext);
  if (!context) {
    throw new Error(
      "useCanvasDetail must be used within CanvasDetailProvider"
    );
  }
  return context;
}
