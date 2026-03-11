"use client";

import { useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { type Generation } from "@/lib/db/queries";
import { GenerationCard } from "@/components/workspace/generation-card";
import { type FilterValue } from "@/components/workspace/filter-chips";
import { useColumnCount } from "@/hooks/use-column-count";

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
  const columnCount = useColumnCount();

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

  // Distribute items round-robin across columns for row-wise ordering
  const columns = useMemo(() => {
    const cols: Generation[][] = Array.from({ length: columnCount }, () => []);
    completedGenerations.forEach((gen, i) => {
      cols[i % columnCount].push(gen);
    });
    return cols;
  }, [completedGenerations, columnCount]);

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

  // Masonry grid via flexbox with round-robin column distribution
  return (
    <div className="flex gap-4" data-testid="gallery-grid">
      {columns.map((col, i) => (
        <div key={i} className="flex-1 flex flex-col gap-4">
          {col.map((generation) => (
            <GenerationCard
              key={generation.id}
              generation={generation}
              onSelect={onSelectGeneration}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
