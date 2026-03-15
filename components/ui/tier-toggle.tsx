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
  /** Hide specific tier values (e.g. "max" in upscale mode) */
  hiddenValues?: Tier[];
}

interface Segment {
  value: Tier;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENTS: Segment[] = [
  { value: "draft", label: "Draft" },
  { value: "quality", label: "Quality" },
  { value: "max", label: "Max" },
];

// ---------------------------------------------------------------------------
// TierToggle
// ---------------------------------------------------------------------------

/**
 * Segmented control for selecting the quality tier (Draft / Quality / Max).
 *
 * Fully controlled -- no internal state.
 * Use `hiddenValues` to hide specific tiers (e.g. "max" in upscale mode).
 */
export function TierToggle({
  tier,
  onTierChange,
  disabled = false,
  className,
  hiddenValues = [],
}: TierToggleProps) {
  return (
    <div
      role="group"
      aria-label="Quality tier"
      className={cn(
        "flex w-full rounded-lg border border-border-subtle bg-white dark:bg-card p-1 gap-1",
        disabled && "opacity-50",
        className,
      )}
      data-testid="tier-toggle"
    >
      {SEGMENTS.filter((s) => !hiddenValues.includes(s.value)).map((segment) => {
        const isActive = segment.value === tier;

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
