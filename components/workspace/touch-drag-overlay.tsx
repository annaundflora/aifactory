"use client";

import { createPortal } from "react-dom";
import { useTouchDrag } from "@/lib/touch-drag-context";

/**
 * Floating preview that follows the user's finger during a touch drag.
 * Rendered via portal so it floats above all content.
 */
export function TouchDragOverlay() {
  const { state } = useTouchDrag();

  if (!state.isDragging || !state.payload) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: state.currentX - 40,
        top: state.currentY - 40,
        width: 80,
        height: 80,
        pointerEvents: "none",
        zIndex: 9999,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        opacity: 0.9,
      }}
    >
      <img
        src={state.payload.imageUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        draggable={false}
      />
    </div>,
    document.body
  );
}
