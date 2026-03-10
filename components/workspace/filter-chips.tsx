"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterValue = "all" | "txt2img" | "img2img" | "upscale";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterChip {
  value: FilterValue;
  label: string;
}

const CHIPS: FilterChip[] = [
  { value: "all", label: "Alle" },
  { value: "txt2img", label: "Text to Image" },
  { value: "img2img", label: "Image to Image" },
  { value: "upscale", label: "Upscale" },
];

export interface FilterChipsProps {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}

// ---------------------------------------------------------------------------
// FilterChips
// ---------------------------------------------------------------------------

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div role="group" className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const isActive = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) {
                onChange(chip.value);
              }
            }}
            className={
              isActive
                ? "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors bg-primary text-primary-foreground border border-primary"
                : "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors bg-background text-muted-foreground border border-border hover:border-primary hover:text-primary"
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
