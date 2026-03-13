"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasHeaderProps {
  onBack: () => void;
  children?: ReactNode;
  modelSelectorSlot?: ReactNode;
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

      {/* Right: Undo/Redo slots + children */}
      <div className="flex items-center gap-2" data-testid="undo-redo-slot">
        {undoRedoSlot}
        {children}
      </div>
    </header>
  );
}
