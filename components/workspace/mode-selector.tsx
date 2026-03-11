"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationMode = "txt2img" | "img2img" | "upscale";

interface ModeSelectorProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  disabledModes?: GenerationMode[];
}

interface Segment {
  value: GenerationMode;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENTS: Segment[] = [
  { value: "txt2img", label: "Text to Image" },
  { value: "img2img", label: "Image to Image" },
  { value: "upscale", label: "Upscale" },
];

// ---------------------------------------------------------------------------
// ModeSelector
// ---------------------------------------------------------------------------

/**
 * Segmented control for selecting the generation mode.
 * Fully controlled — no internal state. All three segments are fixed.
 */
export function ModeSelector({
  value,
  onChange,
  disabledModes = [],
}: ModeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Generation mode"
      className="inline-flex w-full rounded-md border border-border bg-muted p-1 gap-1"
      data-testid="mode-selector"
    >
      {SEGMENTS.map((segment) => {
        const isActive = segment.value === value;
        const isDisabled = disabledModes.includes(segment.value);

        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            data-active={isActive}
            data-value={segment.value}
            onClick={() => {
              if (!isDisabled) {
                onChange(segment.value);
              }
            }}
            className={cn(
              "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
              isDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
