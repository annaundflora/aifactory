"use client";

import { useCallback } from "react";
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
import { ModelSlots } from "@/components/ui/model-slots";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import type { ModelSlot, Model } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpscalePopoverProps {
  onUpscale: (params: {
    scale: 2 | 4;
    modelIds?: string[];
  }) => void;
  isUpscaleDisabled: boolean;
  /** Model slot configurations for the ModelSlots UI. */
  modelSlots: ModelSlot[];
  /** Available models for dropdown population. */
  models: Model[];
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
      const activeSlots = resolveActiveSlots(modelSlots, "upscale");
      const modelIds = activeSlots.map((s) => s.modelId);
      onUpscale({ scale, modelIds });
      // Close the popover after action
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" });
    },
    [onUpscale, dispatch, modelSlots]
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

        {/* Model selection */}
        <div className="mt-3" data-testid="upscale-model-slots-section">
          <ModelSlots
            mode="upscale"
            slots={modelSlots}
            models={models}
            variant="compact"
            disabled={state.isGenerating}
          />
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
