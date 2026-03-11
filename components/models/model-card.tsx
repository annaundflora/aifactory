"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRunCount } from "@/lib/utils/format-run-count";
import { type CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModelCardProps {
  model: CollectionModel;
  selected: boolean;
  disabled: boolean;
  onSelect: (model: CollectionModel) => void;
}

// ---------------------------------------------------------------------------
// ModelCard
// ---------------------------------------------------------------------------

export function ModelCard({ model, selected, disabled, onSelect }: ModelCardProps) {
  function handleClick() {
    if (!disabled) {
      onSelect(model);
    }
  }

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onSelect(model);
        }
      }}
      className={cn(
        "relative flex flex-col overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-md",
        selected && "ring-2 ring-primary",
        disabled && "opacity-50 pointer-events-none cursor-not-allowed"
      )}
    >
      {/* Cover image / Fallback gradient */}
      {model.cover_image_url ? (
        <div className="relative w-full aspect-video overflow-hidden">
          <img
            src={model.cover_image_url}
            alt={model.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-gradient-to-br from-muted to-muted-foreground/20" />
      )}

      {/* Checkbox overlay — top-right */}
      <div
        className={cn(
          "absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/80 bg-black/20"
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </div>

      {/* Card body */}
      <CardContent className="flex flex-col gap-1 p-3">
        {/* Name */}
        <p className="font-bold text-sm leading-tight truncate">{model.name}</p>

        {/* Owner */}
        <p className="text-xs text-muted-foreground truncate">{model.owner}</p>

        {/* Description */}
        {model.description && (
          <p
            className="text-xs text-muted-foreground line-clamp-2 mt-0.5"
            title={model.description}
          >
            {model.description}
          </p>
        )}

        {/* Run count badge */}
        <div className="mt-1">
          <Badge variant="secondary" className="text-xs">
            {formatRunCount(model.run_count)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
