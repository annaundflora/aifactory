"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { CanvasHeader } from "@/components/canvas/canvas-header";
import { CanvasImage } from "@/components/canvas/canvas-image";
import { CanvasNavigation } from "@/components/canvas/canvas-navigation";
import { SiblingThumbnails } from "@/components/canvas/sibling-thumbnails";
import { Button } from "@/components/ui/button";
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
  const [chatOpen, setChatOpen] = useState(true);

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
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setChatOpen((prev) => !prev)}
          aria-label={chatOpen ? "Close chat panel" : "Open chat panel"}
          data-testid="chat-toggle-button"
        >
          {chatOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </CanvasHeader>

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
              style={{
                viewTransitionName: `canvas-image-${currentGeneration.id}`,
              }}
              data-testid="canvas-image"
            />
          ) : (
            <div className="flex items-center justify-center text-muted-foreground">
              No image available
            </div>
          )}
        </main>

        {/* Right: Chat slot (collapsible, initial visible) */}
        {chatOpen && (
          <aside
            className="flex w-80 shrink-0 flex-col border-l border-border/80 bg-card"
            data-testid="chat-slot"
          >
            {chatSlot}
          </aside>
        )}
      </div>
    </div>
  );
}
