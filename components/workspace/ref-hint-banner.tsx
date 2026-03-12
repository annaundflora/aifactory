"use client";

import { useState, useEffect, useMemo } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ref-hint-dismissed";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RefHintBannerProps {
  /** Currently filled reference slots */
  slots: ReferenceSlotData[];
  /** Current generation mode -- banner only shows in img2img */
  mode?: "txt2img" | "img2img" | "upscale";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RefHintBanner({
  slots,
  mode = "img2img",
}: RefHintBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    // Check localStorage on initial render (SSR-safe via typeof check)
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  // Hydration guard: re-check localStorage after mount to handle SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setDismissed(true);
    }
  }, []);

  // Compute sorted @-numbers from filled slots
  const slotNumbers = useMemo(() => {
    return slots
      .map((s) => s.slotPosition)
      .sort((a, b) => a - b);
  }, [slots]);

  // ---------------------------------------------------------------------------
  // Dismiss handler
  // ---------------------------------------------------------------------------

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  // ---------------------------------------------------------------------------
  // Visibility logic
  // ---------------------------------------------------------------------------

  // Not visible when:
  // - No slots are filled
  // - Not in img2img mode
  // - User has dismissed it
  if (slots.length === 0 || mode !== "img2img" || dismissed) {
    return null;
  }

  // Build the dynamic @-number text
  const atNumbers = slotNumbers.map((n) => `@${n}`).join(", ");
  const hintText = `Tipp: Nutze ${atNumbers} im Prompt um Referenzen anzusprechen`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-accent bg-accent/50 px-3 py-2 text-sm text-accent-foreground"
      )}
      role="status"
      data-testid="ref-hint-banner"
    >
      <Info className="size-4 shrink-0" data-testid="info-icon" />

      <p className="flex-1" data-testid="hint-text">
        {hintText}
      </p>

      <button
        type="button"
        onClick={handleDismiss}
        className="flex size-5 shrink-0 items-center justify-center rounded-full text-accent-foreground/70 hover:bg-accent-foreground/10 hover:text-accent-foreground transition-colors"
        aria-label="Dismiss hint"
        data-testid="dismiss-button"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
