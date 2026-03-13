"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ToolbarButtonProps {
  icon: LucideIcon;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  tooltip: string;
  "data-testid"?: string;
}

// ---------------------------------------------------------------------------
// ToolbarButton
// ---------------------------------------------------------------------------

export function ToolbarButton({
  icon: Icon,
  isActive = false,
  disabled = false,
  onClick,
  tooltip,
  "data-testid": testId,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          aria-pressed={isActive}
          data-testid={testId}
          className={cn(
            "flex h-10 w-full items-center justify-center transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            disabled && "pointer-events-none opacity-50",
            isActive &&
              "bg-accent text-accent-foreground",
            !isActive &&
              !disabled &&
              "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
