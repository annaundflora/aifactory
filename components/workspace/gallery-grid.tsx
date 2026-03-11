"use client";

import { useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { type Generation } from "@/lib/db/queries";
import { GenerationCard } from "@/components/workspace/generation-card";
import { type FilterValue } from "@/components/workspace/filter-chips";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GalleryGridProps {
  generations: Generation[];
  onSelectGeneration: (id: string) => void;
  modeFilter?: FilterValue;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_STATE_TEXT: Record<Exclude<FilterValue, "all">, string> = {
  txt2img: "No Text to Image generations yet",
  img2img: "No Image to Image generations yet",
  upscale: "No Upscale generations yet",
};

// ---------------------------------------------------------------------------
// GalleryGrid
// ---------------------------------------------------------------------------

export function GalleryGrid({
  generations,
  onSelectGeneration,
  modeFilter = "all",
}: GalleryGridProps) {
  // Filter to only completed generations, apply mode filter, and sort by created_at DESC
  const completedGenerations = useMemo(() => {
    return generations
      .filter((g) => g.status === "completed")
      .filter((g) =>
        modeFilter === "all" ? true : g.generationMode === modeFilter
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [generations, modeFilter]);

  // Empty state
  if (completedGenerations.length === 0) {
    const emptyText =
      modeFilter === "all"
        ? "No generations yet. Enter a prompt and hit Generate!"
        : EMPTY_STATE_TEXT[modeFilter];
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <ImageIcon className="size-16 opacity-40" />
        <p className="text-center text-sm">{emptyText}</p>
      </div>
    );
  }

  // Masonry grid via CSS columns
  return (
    <div
      className="columns-2 gap-4 sm:columns-3 lg:columns-4"
      data-testid="gallery-grid"
    >
      {completedGenerations.map((generation) => (
        <GenerationCard
          key={generation.id}
          generation={generation}
          onSelect={onSelectGeneration}
        />
      ))}
    </div>
  );
}
