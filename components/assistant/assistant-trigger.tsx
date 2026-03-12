"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssistantTriggerProps {
  isOpen: boolean;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// AssistantTrigger
// ---------------------------------------------------------------------------

export function AssistantTrigger({ isOpen, onClick }: AssistantTriggerProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      data-testid="assistant-trigger-btn"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close Prompt Assistant" : "Open Prompt Assistant"}
      className={cn(
        isOpen &&
          "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
    >
      <Sparkles className="mr-1 size-3" />
      Assistent
    </Button>
  );
}
