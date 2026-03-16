"use client";

import { useCallback, useRef, type DragEvent } from "react";
import { type Generation } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { modelIdToDisplayName } from "@/lib/utils/model-display-name";
import { ModeBadge, type Mode } from "@/components/workspace/mode-badge";
import { GALLERY_DRAG_MIME_TYPE } from "@/lib/constants/drag-types";
import { useTouchDragOptional } from "@/lib/touch-drag-context";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GenerationCardProps {
  generation: Generation;
  onSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// GenerationCard
// ---------------------------------------------------------------------------

const LONG_PRESS_MS = 300;
const SCROLL_THRESHOLD = 10;

export function GenerationCard({ generation, onSelect }: GenerationCardProps) {
  const touchDrag = useTouchDragOptional();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchDraggingRef = useRef(false);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>) => {
      const payload = JSON.stringify({
        generationId: generation.id,
        imageUrl: generation.imageUrl,
      });
      e.dataTransfer.setData(GALLERY_DRAG_MIME_TYPE, payload);
      e.dataTransfer.effectAllowed = "copy";
    },
    [generation.id, generation.imageUrl]
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "touch" || !touchDrag) return;

      touchStartPosRef.current = { x: e.clientX, y: e.clientY };
      isTouchDraggingRef.current = false;

      const pointerId = e.pointerId;
      const target = e.target as HTMLElement;
      const clientX = e.clientX;
      const clientY = e.clientY;

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        isTouchDraggingRef.current = true;
        target.setPointerCapture?.(pointerId);
        touchDrag.startDrag(
          { generationId: generation.id, imageUrl: generation.imageUrl ?? "" },
          clientX,
          clientY
        );
      }, LONG_PRESS_MS);
    },
    [generation.id, generation.imageUrl, touchDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "touch") return;

      // If long press hasn't fired yet, check for scroll gesture
      if (longPressTimerRef.current !== null && touchStartPosRef.current) {
        const dx = e.clientX - touchStartPosRef.current.x;
        const dy = e.clientY - touchStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > SCROLL_THRESHOLD) {
          clearLongPress();
          return;
        }
      }

      if (isTouchDraggingRef.current && touchDrag) {
        touchDrag.updatePosition(e.clientX, e.clientY);
      }
    },
    [clearLongPress, touchDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "touch") return;

      clearLongPress();
      if (isTouchDraggingRef.current) {
        isTouchDraggingRef.current = false;
        touchDrag?.endDrag();
      }
    },
    [clearLongPress, touchDrag]
  );

  const handlePointerCancel = useCallback(() => {
    clearLongPress();
    if (isTouchDraggingRef.current) {
      isTouchDraggingRef.current = false;
      touchDrag?.cancelDrag();
    }
  }, [clearLongPress, touchDrag]);

  return (
    <button
      type="button"
      draggable="true"
      onDragStart={handleDragStart}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={() => {
        // Prevent click from firing after a touch drag
        if (touchDrag?.state.isDragging) return;
        onSelect(generation.id);
      }}
      style={{ touchAction: "auto" }}
      className="group relative w-full overflow-hidden rounded-lg border border-border bg-card cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Thumbnail */}
      <img
        src={generation.imageUrl ?? ""}
        alt={generation.prompt}
        className="block w-full h-auto object-cover"
        style={generation.imageUrl ? { viewTransitionName: `canvas-image-${generation.id}` } : undefined}
        loading="lazy"
        data-testid="generation-card-image"
      />

      {/* Hover overlay with prompt text */}
      <div className="absolute inset-0 flex items-end bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
        <p className="w-full p-3 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 line-clamp-2">
          {generation.prompt}
        </p>
      </div>

      {/* Mode Badge (top-left: img2img / upscale indicator) */}
      {generation.generationMode && (
        <ModeBadge mode={generation.generationMode as Mode} />
      )}

      {/* Model badge overlay (bottom-left: model display name) */}
      {generation.modelId && (
        <Badge
          className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate bg-black/60 text-white border-transparent hover:bg-black/60"
        >
          {modelIdToDisplayName(generation.modelId)}
        </Badge>
      )}
    </button>
  );
}
