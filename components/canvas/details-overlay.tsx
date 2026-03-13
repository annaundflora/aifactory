"use client";

import { ChevronUp } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { ProvenanceRow } from "@/components/lightbox/provenance-row";
import { modelIdToDisplayName } from "@/lib/utils/model-display-name";
import { Button } from "@/components/ui/button";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DetailsOverlayProps {
  generation: Generation;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract well-known generation parameters from the modelParams JSONB field.
 * The Replicate API uses snake_case keys like `num_inference_steps` and
 * `guidance_scale`. We normalise them here for display.
 */
function extractParams(generation: Generation) {
  const params =
    typeof generation.modelParams === "object" &&
    generation.modelParams !== null
      ? (generation.modelParams as Record<string, unknown>)
      : {};

  const steps =
    (params.num_inference_steps as number | undefined) ??
    (params.steps as number | undefined) ??
    null;

  const cfgScale =
    (params.guidance_scale as number | undefined) ??
    (params.guidance as number | undefined) ??
    (params.cfg_scale as number | undefined) ??
    null;

  return { steps, cfgScale };
}

/**
 * Check whether the generation has reference-inputs (provenance data) by
 * looking at the generationMode. img2img generations typically have
 * reference inputs.
 */
function hasReferenceInputs(generation: Generation): boolean {
  return generation.generationMode === "img2img";
}

// ---------------------------------------------------------------------------
// DetailsOverlay Component
// ---------------------------------------------------------------------------

export function DetailsOverlay({ generation }: DetailsOverlayProps) {
  const { state, dispatch } = useCanvasDetail();

  const isExpanded = state.activeToolId === "details";
  const { steps, cfgScale } = extractParams(generation);
  const modelName = modelIdToDisplayName(generation.modelId);

  const sizeLabel =
    generation.width && generation.height
      ? `${generation.width}x${generation.height}`
      : null;

  const handleHide = () => {
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "details" });
  };

  return (
    <div
      data-testid="details-overlay"
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      style={{ maxHeight: isExpanded ? "500px" : "0px" }}
    >
      <div className="border-b border-border/80 bg-card px-4 py-3">
        {/* Header row with title and hide button */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHide}
            data-testid="details-hide-button"
            className="gap-1 text-xs text-muted-foreground"
          >
            <ChevronUp className="size-3.5" />
            Hide
          </Button>
        </div>

        {/* Prompt */}
        <div className="mb-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Prompt
          </h3>
          <p
            className="text-sm text-foreground leading-relaxed"
            data-testid="details-prompt"
          >
            {generation.prompt}
          </p>
        </div>

        {/* Generation parameters */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {modelName && (
            <span data-testid="details-model">
              <span className="text-muted-foreground">Model:</span>{" "}
              <span className="text-foreground font-medium">{modelName}</span>
            </span>
          )}
          {steps !== null && (
            <span data-testid="details-steps">
              <span className="text-muted-foreground">Steps:</span>{" "}
              <span className="text-foreground font-medium">{steps}</span>
            </span>
          )}
          {cfgScale !== null && (
            <span data-testid="details-cfg">
              <span className="text-muted-foreground">CFG:</span>{" "}
              <span className="text-foreground font-medium">{cfgScale}</span>
            </span>
          )}
          {generation.seed !== null && (
            <span data-testid="details-seed">
              <span className="text-muted-foreground">Seed:</span>{" "}
              <span className="text-foreground font-medium">
                {generation.seed}
              </span>
            </span>
          )}
          {sizeLabel && (
            <span data-testid="details-size">
              <span className="text-muted-foreground">Size:</span>{" "}
              <span className="text-foreground font-medium">{sizeLabel}</span>
            </span>
          )}
        </div>

        {/* Provenance (only for img2img generations with reference inputs) */}
        {hasReferenceInputs(generation) && (
          <div data-testid="details-provenance-section">
            <ProvenanceRow generationId={generation.id} />
          </div>
        )}
      </div>
    </div>
  );
}
