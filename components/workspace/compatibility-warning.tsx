"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLUX_2_PRO_MODEL_ID = "black-forest-labs/flux-2-pro";

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

type WarningVariant = "hidden" | "partial" | "no-support";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CompatibilityWarningProps {
  /** Display name of the currently selected model */
  modelName: string;
  /** Maximum number of images the model supports (from getMaxImageCount) */
  maxImageCount: number;
  /** Number of currently loaded reference slots */
  slotCount: number;
  /** Slot positions of all loaded reference slots (e.g. [1, 2, 3, 4, 5]) */
  slotPositions: number[];
  /** Called with slot positions that exceed the model limit (should be dimmed) */
  onDimmedSlots?: (positions: number[]) => void;
  /** Called when user clicks the "Switch to FLUX 2 Pro" link */
  onSwitchModel?: (modelId: string) => void;
  /** Called to signal whether the generate button should be disabled */
  onGenerateDisabled?: (disabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompatibilityWarning({
  modelName,
  maxImageCount,
  slotCount,
  slotPositions,
  onDimmedSlots,
  onSwitchModel,
  onGenerateDisabled,
}: CompatibilityWarningProps) {
  // Determine the warning variant
  const variant: WarningVariant = useMemo(() => {
    if (slotCount === 0) return "hidden";
    if (maxImageCount === 0) return "no-support";
    if (maxImageCount < slotCount) return "partial";
    return "hidden";
  }, [maxImageCount, slotCount]);

  // Compute which slot positions exceed the limit (for partial)
  const dimmedPositions: number[] = useMemo(() => {
    if (variant !== "partial") return [];

    // Sort positions ascending and take those beyond the limit
    const sorted = [...slotPositions].sort((a, b) => a - b);
    return sorted.slice(maxImageCount);
  }, [variant, slotPositions, maxImageCount]);

  // ---------------------------------------------------------------------------
  // Side effects: notify parent about dimmed slots
  // ---------------------------------------------------------------------------

  useEffect(() => {
    onDimmedSlots?.(dimmedPositions);
  }, [dimmedPositions, onDimmedSlots]);

  // ---------------------------------------------------------------------------
  // Side effects: notify parent about generate disabled state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    onGenerateDisabled?.(variant === "no-support");
  }, [variant, onGenerateDisabled]);

  // ---------------------------------------------------------------------------
  // Render: hidden variant
  // ---------------------------------------------------------------------------

  if (variant === "hidden") {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render: no-support variant
  // ---------------------------------------------------------------------------

  if (variant === "no-support") {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        )}
        role="alert"
        data-testid="compatibility-warning"
        data-variant="no-support"
      >
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <p className="flex-1">
          <span data-testid="warning-text">
            {modelName} unterstuetzt keine Referenz-Bilder.
          </span>{" "}
          <button
            type="button"
            className="inline font-medium underline hover:text-destructive/80 transition-colors"
            onClick={() => onSwitchModel?.(FLUX_2_PRO_MODEL_ID)}
            data-testid="switch-model-link"
          >
            Switch to FLUX 2 Pro
          </button>
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: partial variant
  // ---------------------------------------------------------------------------

  const dimmedLabels = dimmedPositions.map((p) => `@${p}`).join(", ");

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400"
      )}
      role="alert"
      data-testid="compatibility-warning"
      data-variant="partial"
    >
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <p className="flex-1" data-testid="warning-text">
        {modelName} unterstuetzt max {maxImageCount} Referenz-Bilder.{" "}
        {dimmedLabels} {dimmedPositions.length === 1 ? "wird" : "werden"} ignoriert.
      </p>
    </div>
  );
}
