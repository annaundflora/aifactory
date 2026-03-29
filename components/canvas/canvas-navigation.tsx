"use client";

import { useMemo, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasNavigationProps {
  allGenerations: Generation[];
  currentGenerationId: string;
  onNavigate: (id: string) => void;
}

// ---------------------------------------------------------------------------
// CanvasNavigation
// ---------------------------------------------------------------------------

/**
 * Prev/Next navigation buttons for browsing through all gallery images.
 * allGenerations is sorted newest-first (same as gallery order).
 * Buttons are hidden at boundaries (no wrapping/cycling).
 * Arrow keys (Left/Right) navigate when no text input has focus.
 */
export function CanvasNavigation({
  allGenerations,
  currentGenerationId,
  onNavigate,
}: CanvasNavigationProps) {
  const currentIndex = useMemo(
    () => allGenerations.findIndex((g) => g.id === currentGenerationId),
    [allGenerations, currentGenerationId]
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allGenerations.length - 1;

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    onNavigate(allGenerations[currentIndex - 1].id);
  }, [hasPrev, allGenerations, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    onNavigate(allGenerations[currentIndex + 1].id);
  }, [hasNext, allGenerations, currentIndex, onNavigate]);

  // Arrow key navigation: Left → prev (newer), Right → next (older)
  // Suppressed when input/textarea/contentEditable has focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext]);

  // Hide both buttons when there's only one image or index not found
  if (allGenerations.length <= 1 || currentIndex < 0) {
    return null;
  }

  return (
    <>
      {/* Prev button (towards newer images, i.e. lower index) */}
      {hasPrev && (
        <button
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md transition-colors hover:bg-background"
          onClick={goPrev}
          aria-label="Previous image"
          data-testid="canvas-nav-prev"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {/* Next button (towards older images, i.e. higher index) */}
      {hasNext && (
        <button
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md transition-colors hover:bg-background"
          onClick={goNext}
          aria-label="Next image"
          data-testid="canvas-nav-next"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </>
  );
}
