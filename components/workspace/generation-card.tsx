"use client";

import { type Generation } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { modelIdToDisplayName } from "@/lib/utils/model-display-name";
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

      {/* Mode Badge (top-left: img2img / upscale indicator) */}
      {generation.generationMode && (
        <ModeBadge mode={generation.generationMode as Mode} />
      )}

      {/* Model badge overlay (bottom-left: model display name) */}
      {generation.modelId && (
        <Badge
          className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate bg-black/60 text-white border-transparent hover:bg-black/60"
        >
          {modelIdToDisplayName(generation.modelId)}
        </Badge>
      )}
    </button>
  );
}
