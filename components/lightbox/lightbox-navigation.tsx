"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { type Generation } from "@/lib/db/queries";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteGeneration } from "@/app/actions/generations";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LightboxNavigationProps {
  generations: Generation[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// LightboxNavigation
// ---------------------------------------------------------------------------

export function LightboxNavigation({
  generations,
  currentIndex,
  onNavigate,
  onDelete,
}: LightboxNavigationProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasMultiple = generations.length > 1;
  const currentGeneration = generations[currentIndex];

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
      if (showConfirm) return;
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
  }, [goNext, goPrev, showConfirm]);

  // Delete handlers
  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowConfirm(false);
  };

  const handleDeleteConfirm = async () => {
    if (!currentGeneration || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteGeneration({ id: currentGeneration.id });
      if (result.success) {
        setShowConfirm(false);
        onDelete();
      } else {
        toast.error("Löschen fehlgeschlagen");
        setShowConfirm(false);
      }
    } catch {
      toast.error("Löschen fehlgeschlagen");
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

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

      {/* Delete Button */}
      <button
        className="fixed bottom-4 right-4 z-[60] rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        onClick={handleDeleteClick}
        aria-label="Delete"
        data-testid="lightbox-delete"
        disabled={isDeleting}
      >
        <Trash2 className="size-5" />
      </button>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Delete Generation"
        description="Are you sure you want to delete this generation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
}
