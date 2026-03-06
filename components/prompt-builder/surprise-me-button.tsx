"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dices } from "lucide-react";

interface SurpriseMeButtonProps {
  hasExistingSelection: boolean;
  onSurprise: (selections: { style: string; color: string }) => void;
  styleOptions: string[];
  colorOptions: string[];
}

function pickRandom(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)];
}

export function SurpriseMeButton({
  hasExistingSelection,
  onSurprise,
  styleOptions,
  colorOptions,
}: SurpriseMeButtonProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const doSurprise = useCallback(() => {
    const style = pickRandom(styleOptions);
    const color = pickRandom(colorOptions);
    onSurprise({ style, color });
    setShowConfirmation(false);
  }, [onSurprise, styleOptions, colorOptions]);

  const handleClick = useCallback(() => {
    if (hasExistingSelection) {
      setShowConfirmation(true);
    } else {
      doSurprise();
    }
  }, [hasExistingSelection, doSurprise]);

  const handleConfirm = useCallback(() => {
    doSurprise();
  }, [doSurprise]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  return (
    <div className="space-y-2" data-testid="surprise-me-container">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="w-full"
        data-testid="surprise-me-button"
      >
        <Dices className="size-4" />
        Surprise Me
      </Button>

      {showConfirmation && (
        <div
          className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm"
          data-testid="surprise-me-confirmation"
        >
          <span className="flex-1 text-muted-foreground">
            Aktuelle Auswahl ersetzen?
          </span>
          <Button
            type="button"
            variant="default"
            size="xs"
            onClick={handleConfirm}
            data-testid="surprise-me-confirm"
          >
            Bestätigen
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleCancel}
            data-testid="surprise-me-cancel"
          >
            Abbrechen
          </Button>
        </div>
      )}
    </div>
  );
}
