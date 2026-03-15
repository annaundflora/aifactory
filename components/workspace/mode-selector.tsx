"use client";

import { type LucideIcon, Type, ImagePlus, Scaling, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationMode = "txt2img" | "img2img" | "upscale";

interface ModeSelectorProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  disabledModes?: GenerationMode[];
}

interface ModeOption {
  value: GenerationMode;
  label: string;
  description: string;
  icon: LucideIcon;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "txt2img",
    label: "Text to Image",
    description: "Bild aus Text generieren",
    icon: Type,
  },
  {
    value: "img2img",
    label: "Image to Image",
    description: "Bild mit Referenzbild verändern",
    icon: ImagePlus,
  },
  {
    value: "upscale",
    label: "Upscale",
    description: "Bild hochskalieren",
    icon: Scaling,
  },
];

// ---------------------------------------------------------------------------
// ModeSelector
// ---------------------------------------------------------------------------

/**
 * Prominent dropdown for selecting the generation mode.
 * Fully controlled — no internal state. Shows current mode with icon,
 * dropdown reveals all options with descriptions.
 */
export function ModeSelector({
  value,
  onChange,
  disabledModes = [],
}: ModeSelectorProps) {
  const current = MODE_OPTIONS.find((o) => o.value === value) ?? MODE_OPTIONS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[state=open]:border-ring data-[state=open]:ring-[3px] data-[state=open]:ring-ring/50"
          data-testid="mode-selector"
        >
          <CurrentIcon className="size-4 shrink-0 text-primary" />
          <div className="flex-1 text-left min-w-0">
            <div>{current.label}</div>
            <div className="text-xs font-normal text-muted-foreground">{current.description}</div>
          </div>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === value;
          const isDisabled = disabledModes.includes(option.value);

          return (
            <DropdownMenuItem
              key={option.value}
              disabled={isDisabled}
              onClick={() => { if (!isDisabled) onChange(option.value); }}
              className={cn("flex items-start gap-3 px-3 py-2.5", isActive && "bg-accent")}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
              {isActive && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
