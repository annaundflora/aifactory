"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaxQualityToggleProps {
  maxQuality: boolean;
  onMaxQualityChange: (value: boolean) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// MaxQualityToggle
// ---------------------------------------------------------------------------

/**
 * Toggle button for enabling / disabling "Max Quality" mode.
 *
 * Intended to be shown only when the quality tier is active.
 * Visibility logic is managed by the consuming component (conditional
 * rendering), not by this component.
 *
 * Uses `aria-pressed` for accessible toggle semantics.
 */
export function MaxQualityToggle({
  maxQuality,
  onMaxQualityChange,
  disabled = false,
}: MaxQualityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={maxQuality}
      aria-checked={maxQuality}
      aria-label="Max Quality"
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onMaxQualityChange(!maxQuality);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        maxQuality
          ? "bg-primary text-primary-foreground"
          : "bg-input text-muted-foreground border border-border-subtle hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50",
      )}
      data-testid="max-quality-toggle"
    >
      Max Quality
    </button>
  );
}
