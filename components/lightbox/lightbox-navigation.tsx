"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LightboxNavigationProps {
  generations: Generation[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

// ---------------------------------------------------------------------------
// LightboxNavigation
// ---------------------------------------------------------------------------

export function LightboxNavigation({
  generations,
  currentIndex,
  onNavigate,
}: LightboxNavigationProps) {
  const hasMultiple = generations.length > 1;

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    const nextIndex = (currentIndex + 1) % generations.length;
    onNavigate(nextIndex);
  }, [currentIndex, generations.length, hasMultiple, onNavigate]);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    const prevIndex =
      (currentIndex - 1 + generations.length) % generations.length;
    onNavigate(prevIndex);
  }, [currentIndex, generations.length, hasMultiple, onNavigate]);

  // Keyboard navigation (ArrowLeft / ArrowRight only)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  return (
    <>
      {/* Navigation Buttons */}
      {hasMultiple && (
        <>
          <button
            className="fixed left-4 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md transition-colors hover:bg-background"
            onClick={goPrev}
            aria-label="Previous"
            data-testid="lightbox-prev"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            className="fixed right-4 top-1/2 z-[60] -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-md transition-colors hover:bg-background"
            onClick={goNext}
            aria-label="Next"
            data-testid="lightbox-next"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

    </>
  );
}
