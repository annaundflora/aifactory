"use client";

import { useEffect, useState, useTransition } from "react";
import { getSiblingGenerations } from "@/app/actions/generations";
import { type Generation } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SiblingThumbnailsProps {
  batchId: string | null;
  currentGenerationId: string;
  onSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// SiblingThumbnails
// ---------------------------------------------------------------------------

/**
 * Horizontal thumbnail row showing all sibling images from the same batch.
 * The currently active image is visually highlighted with a ring/border.
 * Not rendered when batchId is null (single-image generation).
 */
export function SiblingThumbnails({
  batchId,
  currentGenerationId,
  onSelect,
}: SiblingThumbnailsProps) {
  const [siblings, setSiblings] = useState<Generation[]>([]);
  const [isPending, startTransition] = useTransition();

  // Fetch siblings whenever batchId changes
  useEffect(() => {
    if (!batchId) {
      setSiblings([]);
      return;
    }

    startTransition(async () => {
      const result = await getSiblingGenerations(batchId);
      setSiblings(result);
    });
  }, [batchId]);

  // Don't render anything for single-image generations or single siblings
  if (!batchId || siblings.length <= 1) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center gap-2 py-2"
      data-testid="sibling-thumbnails"
    >
      {siblings.map((sibling) => {
        const isActive = sibling.id === currentGenerationId;
        return (
          <button
            key={sibling.id}
            onClick={() => onSelect(sibling.id)}
            className={cn(
              "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary ring-2 ring-primary/30"
                : "border-border/50 opacity-70 hover:border-border"
            )}
            aria-label={`Sibling image ${sibling.id}`}
            aria-current={isActive ? "true" : undefined}
            data-testid={`sibling-thumbnail-${sibling.id}`}
          >
            {sibling.imageUrl ? (
              <img
                src={sibling.imageUrl}
                alt={sibling.prompt || "Sibling image"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                --
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
