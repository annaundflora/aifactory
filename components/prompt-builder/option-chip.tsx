"use client";

import { Button } from "@/components/ui/button";

interface OptionChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function OptionChip({ label, selected, onToggle }: OptionChipProps) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      data-testid={`option-chip-${label}`}
      className="w-full text-xs"
    >
      {label}
    </Button>
  );
}
