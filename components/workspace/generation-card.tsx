"use client";

import { type Generation } from "@/lib/db/queries";
import { ModeBadge, type Mode } from "@/components/workspace/mode-badge";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GenerationCardProps {
  generation: Generation;
  onSelect: (id: string) => void;
}

// ---------------------------------------------------------------------------
// GenerationCard
// ---------------------------------------------------------------------------

export function GenerationCard({ generation, onSelect }: GenerationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(generation.id)}
      className="group relative w-full overflow-hidden rounded-lg border border-border bg-card break-inside-avoid mb-4 cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Thumbnail */}
      <img
        src={generation.imageUrl ?? ""}
        alt={generation.prompt}
        className="block w-full h-auto object-cover"
        loading="lazy"
      />

      {/* Hover overlay with prompt text */}
      <div className="absolute inset-0 flex items-end bg-black/0 transition-colors duration-200 group-hover:bg-black/40">
        <p className="w-full p-3 text-xs text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 line-clamp-2">
          {generation.prompt}
        </p>
      </div>

      {/* Mode Badge */}
      {generation.generationMode && (
        <ModeBadge mode={generation.generationMode as Mode} />
      )}
    </button>
  );
}
