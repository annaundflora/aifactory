"use client";

import { Maximize2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

/** Tolerance for floating-point comparison of zoom vs fit level */
const FIT_TOLERANCE = 0.01;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ZoomControlsProps {
  /** useCanvasZoom return value — passed from parent to avoid duplicate hook calls */
  canvasZoom: {
    fitLevel: number;
    zoomToStep: (direction: "in" | "out") => void;
    resetToFit: () => void;
  };
}

// ---------------------------------------------------------------------------
// ZoomControls
// ---------------------------------------------------------------------------

/**
 * Floating zoom control panel positioned bottom-right inside the canvas area.
 *
 * Vertical stack layout: Fit -> Zoom-In (+) -> Percent Display -> Zoom-Out (-)
 *
 * Reads zoomLevel from CanvasDetailContext and uses useCanvasZoom hook functions
 * for zoom actions. Disabled states are derived from MIN_ZOOM / MAX_ZOOM bounds.
 */
export function ZoomControls({ canvasZoom }: ZoomControlsProps) {
  const { state } = useCanvasDetail();
  const { zoomLevel } = state;
  const { fitLevel, zoomToStep, resetToFit } = canvasZoom;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isAtMax = zoomLevel >= MAX_ZOOM - FIT_TOLERANCE;
  const isAtMin = zoomLevel <= MIN_ZOOM + FIT_TOLERANCE;
  const isFitActive = Math.abs(zoomLevel - fitLevel) < FIT_TOLERANCE;
  const percentDisplay = `${Math.round(zoomLevel * 100)}%`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn(
        "absolute bottom-4 right-4 z-20",
        "flex flex-col items-center gap-1 rounded-lg border border-border/80 bg-card p-1 shadow-md"
      )}
      data-testid="zoom-controls"
    >
      {/* Fit Button */}
      <Button
        variant={isFitActive ? "secondary" : "ghost"}
        size="icon-sm"
        onClick={resetToFit}
        aria-label="Fit"
        data-testid="zoom-fit-btn"
      >
        <Maximize2 className="size-4" />
      </Button>

      {/* Zoom In Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomToStep("in")}
        disabled={isAtMax}
        aria-label="Zoom in"
        data-testid="zoom-in-btn"
      >
        <Plus className="size-4" />
      </Button>

      {/* Percent Display */}
      <span
        className="select-none text-xs font-mono text-muted-foreground"
        data-testid="zoom-percent"
      >
        {percentDisplay}
      </span>

      {/* Zoom Out Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => zoomToStep("out")}
        disabled={isAtMin}
        aria-label="Zoom out"
        data-testid="zoom-out-btn"
      >
        <Minus className="size-4" />
      </Button>
    </div>
  );
}
