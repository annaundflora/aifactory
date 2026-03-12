"use client";

import { useCallback } from "react";

// ---------------------------------------------------------------------------
// Suggestion Chip Texts
// ---------------------------------------------------------------------------

const SUGGESTION_CHIPS = [
  "Hilf mir einen Prompt zu schreiben",
  "Analysiere ein Referenzbild",
  "Verbessere meinen aktuellen Prompt",
  "Welches Modell passt zu meiner Idee?",
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StartscreenProps {
  hasSessions: boolean;
  onChipClick: (text: string) => void;
  onSessionHistoryClick: () => void;
}

// ---------------------------------------------------------------------------
// Startscreen
// ---------------------------------------------------------------------------

export function Startscreen({
  hasSessions,
  onChipClick,
  onSessionHistoryClick,
}: StartscreenProps) {
  const handleChipClick = useCallback(
    (text: string) => {
      console.log("[Startscreen] Chip clicked:", text);
      onChipClick(text);
    },
    [onChipClick]
  );

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-6"
      data-testid="startscreen"
    >
      {/* Welcome Text */}
      <h2
        className="mb-8 text-center text-lg font-medium text-foreground"
        data-testid="startscreen-welcome"
      >
        Womit kann ich dir helfen?
      </h2>

      {/* Suggestion Chips: 2x2 Grid */}
      <div
        className="grid w-full max-w-sm grid-cols-2 gap-3"
        data-testid="suggestion-chips"
      >
        {SUGGESTION_CHIPS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleChipClick(text)}
            className="rounded-lg border border-border bg-muted/50 px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-testid="suggestion-chip"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Session History Link */}
      {hasSessions && (
        <button
          type="button"
          onClick={onSessionHistoryClick}
          className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          data-testid="session-history-link"
        >
          Vergangene Sessions anzeigen
        </button>
      )}
    </div>
  );
}
