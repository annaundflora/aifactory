"use client";

import { useEffect } from "react";
import { useTouchDragOptional } from "@/lib/touch-drag-context";
import type { GalleryDragPayload } from "@/lib/constants/drag-types";

/**
 * Registers a touch drag drop target in the TouchDragContext.
 * Returns `{ isOver }` so the component can show hover feedback.
 * Safe to use outside a TouchDragProvider — returns `{ isOver: false }`.
 */
export function useTouchDropTarget(
  id: string,
  onDrop: (payload: GalleryDragPayload) => void
) {
  const ctx = useTouchDragOptional();

  useEffect(() => {
    if (!ctx) return;
    ctx.registerDropTarget(id, onDrop);
    return () => ctx.unregisterDropTarget(id);
  }, [id, onDrop, ctx]);

  if (!ctx) return { isOver: false };

  return {
    isOver: ctx.state.isDragging && ctx.state.activeDropTargetId === id,
  };
}
