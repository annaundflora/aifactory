"use client";

import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierToggleProps {
  tier: Tier;
  onTierChange: (tier: Tier) => void;
  disabled?: boolean;
  className?: string;
}

interface Segment {
  value: Extract<Tier, "draft" | "quality">;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENTS: Segment[] = [
  { value: "draft", label: "Draft" },
  { value: "quality", label: "Quality" },
];

// ---------------------------------------------------------------------------
// TierToggle
// ---------------------------------------------------------------------------

/**
 * Segmented control for selecting the quality tier (Draft / Quality).
 *
 * Fully controlled -- no internal state. The `max` tier is handled
 * separately via the `MaxQualityToggle` component.
 *
 * Visual pattern follows `ModeSelector` (segmented control with
 * `bg-primary text-primary-foreground` for the active segment).
 */
export function TierToggle({
  tier,
  onTierChange,
  disabled = false,
  className,
}: TierToggleProps) {
  return (
    <div
      role="group"
      aria-label="Quality tier"
      className={cn(
        "inline-flex rounded-lg border border-border-subtle bg-input p-1 gap-1",
        disabled && "opacity-50",
        className,
      )}
      data-testid="tier-toggle"
    >
      {SEGMENTS.map((segment) => {
        // When tier is "max", Quality is considered the active visual segment
        // because max is a sub-state of quality.
        const isActive =
          segment.value === tier ||
          (segment.value === "quality" && tier === "max");

        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={isActive}
            disabled={disabled}
            data-active={isActive}
            data-value={segment.value}
            onClick={() => {
              if (!disabled) {
                onTierChange(segment.value);
              }
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
