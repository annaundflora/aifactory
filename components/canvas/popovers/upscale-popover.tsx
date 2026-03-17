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
import type { Tier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpscalePopoverProps {
  onUpscale: (params: { scale: 2 | 4; tier: Tier }) => void;
  isUpscaleDisabled: boolean;
}

// ---------------------------------------------------------------------------
// UpscalePopover
// ---------------------------------------------------------------------------

export function UpscalePopover({
  onUpscale,
  isUpscaleDisabled,
}: UpscalePopoverProps) {
  const { state, dispatch } = useCanvasDetail();
  const isOpen = state.activeToolId === "upscale";

  // Local tier state -- defaults to "draft", resets when popover reopens
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
      onUpscale({ scale, tier });
      // Close the popover after action
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: "upscale" });
    },
    [onUpscale, tier, dispatch]
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

        {/* Tier Toggle -- above scale buttons, no MaxQualityToggle for upscale */}
        <div className="mt-3" data-testid="upscale-tier-section">
          <TierToggle
            tier={tier}
            onTierChange={setTier}
            disabled={state.isGenerating}
            hiddenValues={["max"]}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => handleUpscale(2)}
            data-testid="upscale-2x-button"
          >
            2x Upscale
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => handleUpscale(4)}
            data-testid="upscale-4x-button"
          >
            4x Upscale
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
