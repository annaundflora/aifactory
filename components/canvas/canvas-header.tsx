"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// UndoRedoButtons
// ---------------------------------------------------------------------------

/**
 * Undo and Redo icon buttons that read from CanvasDetailContext.
 * Must be rendered inside a CanvasDetailProvider.
 */
export function UndoRedoButtons() {
  const { state, dispatch } = useCanvasDetail();

  const canUndo = state.undoStack.length > 0 && !state.isGenerating;
  const canRedo = state.redoStack.length > 0 && !state.isGenerating;

  function handleUndo() {
    if (!canUndo) return;
    dispatch({ type: "POP_UNDO" });
  }

  function handleRedo() {
    if (!canRedo) return;
    dispatch({ type: "POP_REDO" });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleUndo}
        aria-label="Undo"
        aria-disabled={!canUndo || undefined}
        data-testid="undo-button"
        className={cn(!canUndo && "pointer-events-none opacity-40")}
        tabIndex={!canUndo ? -1 : 0}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleRedo}
        aria-label="Redo"
        aria-disabled={!canRedo || undefined}
        data-testid="redo-button"
        className={cn(!canRedo && "pointer-events-none opacity-40")}
        tabIndex={!canRedo ? -1 : 0}
      >
        <Redo2 className="size-4" />
      </Button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasHeaderProps {
  onBack: () => void;
  children?: ReactNode;
  modelSelectorSlot?: ReactNode;
  /** Optional override for the undo/redo area. Defaults to <UndoRedoButtons />. */
  undoRedoSlot?: ReactNode;
}

// ---------------------------------------------------------------------------
// CanvasHeader
// ---------------------------------------------------------------------------

export function CanvasHeader({
  onBack,
  children,
  modelSelectorSlot,
  undoRedoSlot,
}: CanvasHeaderProps) {
  // ESC shortcut: close detail view unless an input/textarea is focused
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.repeat) return;

      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement
      ) {
        return;
      }

      e.preventDefault();
      onBack();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <header
      className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 bg-card px-3"
      data-testid="canvas-header"
    >
      {/* Left: Back button */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to gallery"
          data-testid="canvas-back-button"
        >
          <ArrowLeft className="size-4" />
        </Button>
      </div>

      {/* Center: Model selector slot */}
      <div className="flex items-center gap-2" data-testid="model-selector-slot">
        {modelSelectorSlot}
      </div>

      {/* Right: Undo/Redo + children */}
      <div className="flex items-center gap-2" data-testid="undo-redo-slot">
        {undoRedoSlot ?? <UndoRedoButtons />}
        {children}
      </div>
    </header>
  );
}
