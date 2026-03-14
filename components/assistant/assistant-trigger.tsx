"use client";

import { Sparkles } from "lucide-react";
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
    <button
      type="button"
      onClick={onClick}
      data-testid="assistant-trigger-btn"
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close Prompt Assistant" : "Open Prompt Assistant"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        "border-[#E5E5E3] text-foreground dark:border-[#2A2A2A] dark:text-white",
        isOpen && "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent dark:border-transparent"
      )}
    >
      <Sparkles className="size-3.5 text-primary" />
      Assistent
    </button>
  );
}
