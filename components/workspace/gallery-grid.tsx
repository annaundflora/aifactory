"use client";

import { useMemo } from "react";
import { ImageIcon } from "lucide-react";
import { type Generation } from "@/lib/db/queries";
import { GenerationCard } from "@/components/workspace/generation-card";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GalleryGridProps {
  generations: Generation[];
  onSelectGeneration: (id: string) => void;
}

// ---------------------------------------------------------------------------
// GalleryGrid
// ---------------------------------------------------------------------------

export function GalleryGrid({
  generations,
  onSelectGeneration,
}: GalleryGridProps) {
  // Filter to only completed generations and sort by created_at DESC
  const completedGenerations = useMemo(() => {
    return generations
      .filter((g) => g.status === "completed")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [generations]);

  // Empty state
  if (completedGenerations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
        <ImageIcon className="size-16 opacity-40" />
        <p className="text-center text-sm">
          No generations yet. Enter a prompt and hit Generate!
        </p>
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
