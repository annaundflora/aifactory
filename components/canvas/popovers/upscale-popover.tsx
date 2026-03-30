"use client";

import { useState, useCallback, useEffect } from "react";
import { ZoomIn } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { TierToggle } from "@/components/ui/tier-toggle";
import { ModelSlots } from "@/components/ui/model-slots";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import type { ModelSlot } from "@/lib/db/queries";
import type { Model } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Legacy Tier type (kept for backward compatibility until slice-15 cleanup)
// ---------------------------------------------------------------------------

/** @deprecated Use ModelSlots instead. Will be removed in slice-15. */
type Tier = "draft" | "quality" | "max";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpscalePopoverProps {
  onUpscale: (params: {
    scale: 2 | 4;
    modelIds?: string[];
    /** @deprecated Use modelIds instead. Will be removed in slice-15. */
    tier?: Tier;
  }) => void;
  isUpscaleDisabled: boolean;
  /** Model slot configuration for the new slot-based path. When provided together with `models`, replaces TierToggle. */
  modelSlots?: ModelSlot[];
  /** Available models for the new slot-based path. When provided together with `modelSlots`, replaces TierToggle. */
  models?: Model[];
}

// ---------------------------------------------------------------------------
// UpscalePopover
// ---------------------------------------------------------------------------

export function UpscalePopover({
  onUpscale,
  isUpscaleDisabled,
  modelSlots,
  models,
}: UpscalePopoverProps) {
  const { state, dispatch } = useCanvasDetail();
  const isOpen = state.activeToolId === "upscale";

  // Determine whether to use new ModelSlots path or legacy TierToggle path
  const useSlotPath = modelSlots !== undefined && models !== undefined;

  // Local tier state -- defaults to "draft", resets when popover reopens (legacy path only)
  const [tier, setTier] = useState<Tier>("draft");

  // Reset tier to draft whenever the popover opens
  useEffect(() => {
    if (isOpen) {
      setTier("draft");
    }
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Close the popover by clearing activeToolId
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" });
      }
    },
    [dispatch]
  );

  const handleUpscale = useCallback(
    (scale: 2 | 4) => {
      if (useSlotPath && modelSlots) {
        // New path: resolve active slot model IDs
        const activeSlots = resolveActiveSlots(modelSlots, "upscale");
        const modelIds = activeSlots.map((s) => s.modelId);
        onUpscale({ scale, modelIds });
      } else {
        // Legacy path: pass tier
        onUpscale({ scale, tier });
      }
      // Close the popover after action
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" });
    },
    [onUpscale, tier, dispatch, useSlotPath, modelSlots]
  );

  // -------------------------------------------------------------------------
  // Disabled state with tooltip
  // -------------------------------------------------------------------------

  if (isUpscaleDisabled) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              data-testid="upscale-disabled-trigger"
            >
              <button
                type="button"
                aria-disabled="true"
                aria-label="Upscale"
                data-testid="upscale-icon-disabled"
                className="pointer-events-none opacity-50"
                tabIndex={0}
              >
                <ZoomIn className="size-4" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Image too large for upscale
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // -------------------------------------------------------------------------
  // Normal state with popover
  // -------------------------------------------------------------------------

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <span
          data-testid="upscale-popover-anchor"
          className="pointer-events-none absolute left-0 h-10 w-px"
          style={{ top: 88 }}
        />
      </PopoverAnchor>

      <PopoverContent
        side="right"
        sideOffset={12}
        className="w-48"
        data-testid="upscale-popover"
      >
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <ZoomIn className="size-4" />
            Upscale
          </PopoverTitle>
        </PopoverHeader>

        {/* Model selection: ModelSlots (new path) or TierToggle (legacy path) */}
        <div className="mt-3" data-testid={useSlotPath ? "upscale-model-slots-section" : "upscale-tier-section"}>
          {useSlotPath ? (
            <ModelSlots
              mode="upscale"
              slots={modelSlots!}
              models={models!}
              variant="compact"
              disabled={state.isGenerating}
            />
          ) : (
            <TierToggle
              tier={tier}
              onTierChange={setTier}
              disabled={state.isGenerating}
              hiddenValues={["max"]}
            />
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => handleUpscale(2)}
            disabled={state.isGenerating}
            data-testid="upscale-2x-button"
          >
            2x Upscale
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => handleUpscale(4)}
            disabled={state.isGenerating}
            data-testid="upscale-4x-button"
          >
            4x Upscale
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
