"use client";

import { useMemo, type ReactNode } from "react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { CanvasHeader } from "@/components/canvas/canvas-header";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasDetailViewProps {
  generation: Generation;
  allGenerations: Generation[];
  onBack: () => void;
  toolbarSlot?: ReactNode;
  chatSlot?: ReactNode;
  modelSelectorSlot?: ReactNode;
  undoRedoSlot?: ReactNode;
}

// ---------------------------------------------------------------------------
// CanvasDetailView
// ---------------------------------------------------------------------------

export function CanvasDetailView({
  generation,
  allGenerations,
  onBack,
  toolbarSlot,
  chatSlot,
  modelSelectorSlot,
  undoRedoSlot,
}: CanvasDetailViewProps) {
  const { state } = useCanvasDetail();

  // Find the current generation from context to display the correct image
  const currentGeneration = useMemo(() => {
    return (
      allGenerations.find((g) => g.id === state.currentGenerationId) ??
      generation
    );
  }, [allGenerations, state.currentGenerationId, generation]);

  return (
    <div
      className="flex h-full flex-col"
      data-testid="canvas-detail-view"
    >
      {/* Header */}
      <CanvasHeader
        onBack={onBack}
        modelSelectorSlot={modelSelectorSlot}
        undoRedoSlot={undoRedoSlot}
      />

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbar slot (48px wide) */}
        <aside
          className="flex w-12 shrink-0 flex-col border-r border-border/80 bg-card"
          data-testid="toolbar-slot"
        >
          {toolbarSlot}
        </aside>

        {/* Center: Canvas area (flex: 1) */}
        <main
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/40 p-4"
          data-testid="canvas-area"
        >
          {currentGeneration.imageUrl ? (
            <img
              src={currentGeneration.imageUrl}
              alt={currentGeneration.prompt || "Generated image"}
              className="max-h-full max-w-full object-contain"
              data-testid="canvas-image"
            />
          ) : (
            <div className="flex items-center justify-center text-muted-foreground">
              No image available
            </div>
          )}
        </main>

        {/* Right: Chat slot (collapsible) */}
        <aside
          className="flex w-80 shrink-0 flex-col border-l border-border/80 bg-card"
          data-testid="chat-slot"
        >
          {chatSlot}
        </aside>
      </div>
    </div>
  );
}
