"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SessionSwitcherProps {
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// SessionSwitcher
// ---------------------------------------------------------------------------

/**
 * Icon button for the Sheet header that navigates to the session list.
 * Positioned between the ModelSelector and the close button in the header slot.
 *
 * AC-7: Click navigates to session list view.
 * AC-8: Visible as icon button (History icon) in sheet header.
 */
export function SessionSwitcher({ onClick }: SessionSwitcherProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      aria-label="Sessions anzeigen"
      data-testid="session-switcher"
    >
      <History className="size-4" />
    </Button>
  );
}
