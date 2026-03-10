"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrengthSliderProps {
  value: number;
  onChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "Subtle", value: 0.3 },
  { label: "Balanced", value: 0.6 },
  { label: "Creative", value: 0.85 },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StrengthSlider({ value, onChange }: StrengthSliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Strength</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        aria-label="Strength"
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) onChange(parsed);
        }}
        className="w-full accent-primary"
      />

      <div className="flex gap-2">
        {PRESETS.map((preset) => {
          const isActive = value === preset.value;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(preset.value)}
              className={
                isActive
                  ? "flex-1 rounded-md border px-2 py-1 text-xs font-medium border-primary bg-primary text-primary-foreground"
                  : "flex-1 rounded-md border px-2 py-1 text-xs font-medium border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
