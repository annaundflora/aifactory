"use client";

import { useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCanvasDetail,
  type OutpaintDirection,
  type OutpaintSize,
} from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_OPTIONS: OutpaintSize[] = [25, 50, 100];

// ---------------------------------------------------------------------------
// OutpaintControls
// ---------------------------------------------------------------------------

/**
 * Renders 4 direction buttons at image edges (top, bottom, left, right)
 * and a size selector (25%, 50%, 100%).
 *
 * Reads `outpaintDirections` and `outpaintSize` from Canvas Detail Context
 * and dispatches `SET_OUTPAINT_DIRECTIONS` / `SET_OUTPAINT_SIZE` on interaction.
 *
 * No props required — all state comes from context.
 */
export function OutpaintControls() {
  const { state, dispatch } = useCanvasDetail();
  const { outpaintDirections, outpaintSize } = state;

  // -------------------------------------------------------------------------
  // Direction toggle (multi-select)
  // -------------------------------------------------------------------------

  const handleDirectionToggle = useCallback(
    (direction: OutpaintDirection) => {
      const isSelected = outpaintDirections.includes(direction);
      const next = isSelected
        ? outpaintDirections.filter((d) => d !== direction)
        : [...outpaintDirections, direction];
      dispatch({ type: "SET_OUTPAINT_DIRECTIONS", outpaintDirections: next });
    },
    [outpaintDirections, dispatch],
  );

  // -------------------------------------------------------------------------
  // Size selection (exclusive)
  // -------------------------------------------------------------------------

  const handleSizeSelect = useCallback(
    (size: OutpaintSize) => {
      dispatch({ type: "SET_OUTPAINT_SIZE", outpaintSize: size });
    },
    [dispatch],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="pointer-events-none absolute inset-0"
      data-testid="outpaint-controls"
    >
      {/* Top direction button + size selector */}
      <div className="pointer-events-auto absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center gap-1 pt-1">
        <DirectionButton
          direction="top"
          label="Top"
          icon={ChevronUp}
          isSelected={outpaintDirections.includes("top")}
          onToggle={handleDirectionToggle}
        />
        <SizeSelector
          currentSize={outpaintSize}
          onSelect={handleSizeSelect}
        />
      </div>

      {/* Bottom direction button */}
      <div className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pb-1">
        <SizeSelector
          currentSize={outpaintSize}
          onSelect={handleSizeSelect}
        />
        <DirectionButton
          direction="bottom"
          label="Bottom"
          icon={ChevronDown}
          isSelected={outpaintDirections.includes("bottom")}
          onToggle={handleDirectionToggle}
        />
      </div>

      {/* Left direction button */}
      <div className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pl-1">
        <DirectionButton
          direction="left"
          label="Left"
          icon={ChevronLeft}
          isSelected={outpaintDirections.includes("left")}
          onToggle={handleDirectionToggle}
        />
        <SizeSelector
          currentSize={outpaintSize}
          onSelect={handleSizeSelect}
          compact
        />
      </div>

      {/* Right direction button */}
      <div className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 pr-1">
        <DirectionButton
          direction="right"
          label="Right"
          icon={ChevronRight}
          isSelected={outpaintDirections.includes("right")}
          onToggle={handleDirectionToggle}
        />
        <SizeSelector
          currentSize={outpaintSize}
          onSelect={handleSizeSelect}
          compact
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectionButton (internal)
// ---------------------------------------------------------------------------

interface DirectionButtonProps {
  direction: OutpaintDirection;
  label: string;
  icon: typeof ChevronUp;
  isSelected: boolean;
  onToggle: (direction: OutpaintDirection) => void;
}

function DirectionButton({
  direction,
  label,
  icon: Icon,
  isSelected,
  onToggle,
}: DirectionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(direction)}
      aria-label={label}
      aria-pressed={isSelected}
      data-testid={`outpaint-direction-${direction}`}
      className={cn(
        "flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isSelected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SizeSelector (internal)
// ---------------------------------------------------------------------------

interface SizeSelectorProps {
  currentSize: OutpaintSize;
  onSelect: (size: OutpaintSize) => void;
  compact?: boolean;
}

function SizeSelector({ currentSize, onSelect, compact }: SizeSelectorProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-border bg-card",
        compact ? "flex-col" : "flex-row",
      )}
      data-testid="outpaint-size-selector"
    >
      {SIZE_OPTIONS.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onSelect(size)}
          aria-label={`${size}%`}
          aria-pressed={currentSize === size}
          data-testid={`outpaint-size-${size}`}
          className={cn(
            "px-2 py-0.5 text-xs font-medium transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            compact ? "w-full text-center" : "",
            currentSize === size
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-primary",
          )}
        >
          {size}%
        </button>
      ))}
    </div>
  );
}
