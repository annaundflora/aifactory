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
  label?: string;
  expanded?: boolean;
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
  label,
  expanded = false,
  "data-testid": testId,
}: ToolbarButtonProps) {
  const button = (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-label={tooltip}
      aria-pressed={isActive}
      data-testid={testId}
      className={cn(
        "flex h-11 w-full items-center rounded-md transition-colors duration-150",
        expanded ? "justify-start gap-2 px-3" : "justify-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        disabled && "pointer-events-none opacity-50",
        isActive && "text-primary",
        !isActive &&
          !disabled &&
          "text-muted-foreground hover:text-primary"
      )}
    >
      <Icon className="size-6 shrink-0" />
      {expanded && label && (
        <span className="text-sm whitespace-nowrap">{label}</span>
      )}
    </button>
  );

  // When expanded, labels are visible — no tooltip needed
  if (expanded) {
    return <span className="flex w-full">{button}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-full">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
