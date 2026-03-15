"use client";

import { useEffect, useState, useTransition } from "react";
import { getVariantFamilyAction } from "@/app/actions/generations";
import { type Generation } from "@/lib/db/queries";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SiblingThumbnailsProps {
  batchId: string | null;
  sourceGenerationId: string | null;
  currentGenerationId: string;
  onSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// SiblingThumbnails
// ---------------------------------------------------------------------------

/**
 * Horizontal thumbnail row showing the variant family:
 * source image + all direct variants + batch siblings.
 * The currently active image is visually highlighted with a ring/border.
 */
export function SiblingThumbnails({
  batchId,
  sourceGenerationId,
  currentGenerationId,
  onSelect,
}: SiblingThumbnailsProps) {
  const [siblings, setSiblings] = useState<Generation[]>([]);
  const [isPending, startTransition] = useTransition();

  // Fetch variant family whenever relevant IDs change
  useEffect(() => {
    if (!batchId && !sourceGenerationId) {
      setSiblings([]);
      return;
    }

    startTransition(async () => {
      const result = await getVariantFamilyAction(batchId, sourceGenerationId, currentGenerationId);
      if (Array.isArray(result)) {
        setSiblings(result);
      }
    });
  }, [batchId, sourceGenerationId, currentGenerationId]);

  // Don't render anything for single images
  if (!batchId && !sourceGenerationId) {
    return null;
  }
  if (!isPending && siblings.length <= 1) {
    return null;
  }

  // Show skeleton placeholders while siblings are being fetched
  if (isPending && siblings.length === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-2"
        data-testid="sibling-thumbnails-loading"
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-2 py-2"
      data-testid="sibling-thumbnails"
    >
      {siblings.map((sibling, index) => {
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
                : "border-border/50 opacity-70 hover:border-border",
              isPending && "pointer-events-none opacity-50"
            )}
            aria-label={`Variant ${index + 1} of ${siblings.length}`}
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
