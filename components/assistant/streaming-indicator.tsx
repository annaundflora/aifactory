"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StreamingIndicatorProps {
  visible: boolean;
}

// ---------------------------------------------------------------------------
// StreamingIndicator
// ---------------------------------------------------------------------------

/**
 * Animated three-dot indicator shown below the last assistant message
 * while the agent is streaming a response.
 *
 * Uses CSS-only animation (Tailwind animate-pulse with staggered delays)
 * as required by constraints -- no JS-based animation.
 */
export function StreamingIndicator({ visible }: StreamingIndicatorProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-start px-4 py-2"
      data-testid="streaming-indicator"
      aria-label="Assistant is thinking"
      role="status"
    >
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-2.5 rounded-bl-md">
        <span
          className={cn(
            "size-2 rounded-full bg-muted-foreground/60",
            "animate-pulse"
          )}
          style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
          aria-hidden="true"
        />
        <span
          className={cn(
            "size-2 rounded-full bg-muted-foreground/60",
            "animate-pulse"
          )}
          style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
          aria-hidden="true"
        />
        <span
          className={cn(
            "size-2 rounded-full bg-muted-foreground/60",
            "animate-pulse"
          )}
          style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
