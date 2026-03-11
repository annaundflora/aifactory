"use client";

import { X } from "lucide-react";
import { type CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModelTriggerProps {
  models: CollectionModel[];
  onRemove: (model: CollectionModel) => void;
  onBrowse: () => void;
}

// ---------------------------------------------------------------------------
// ModelTrigger
// ---------------------------------------------------------------------------

export function ModelTrigger({ models, onRemove, onBrowse }: ModelTriggerProps) {
  const canRemove = models.length > 1;

  return (
    <div className="space-y-2" data-testid="model-trigger">
      {/* Mini-cards stack */}
      <div className="flex flex-col gap-1.5">
        {models.map((model) => (
          <div
            key={`${model.owner}/${model.name}`}
            className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            data-testid="model-trigger-item"
          >
            {/* Thumbnail 32x32 */}
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded">
              {model.cover_image_url ? (
                <img
                  src={model.cover_image_url}
                  alt={`${model.name} cover`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-muted to-muted-foreground/20" />
              )}
            </div>

            {/* Name + Owner */}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium leading-tight">
                {model.name}
              </span>
              <span className="truncate text-xs text-muted-foreground leading-tight">
                {model.owner}
              </span>
            </div>

            {/* X-Button — hidden when only 1 model (min-1 enforcement) */}
            {canRemove && (
              <button
                type="button"
                onClick={() => onRemove(model)}
                className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Remove ${model.name}`}
                data-testid="model-trigger-remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Browse Models link */}
      <button
        type="button"
        onClick={onBrowse}
        className="text-sm text-primary underline-offset-4 hover:underline"
        data-testid="browse-models-link"
      >
        Browse Models
      </button>
    </div>
  );
}
