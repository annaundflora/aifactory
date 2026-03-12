"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Model Definitions
// ---------------------------------------------------------------------------

export const ASSISTANT_MODELS = [
  {
    slug: "anthropic/claude-sonnet-4.6",
    displayName: "Sonnet 4.6",
  },
  {
    slug: "openai/gpt-5.4",
    displayName: "GPT-5.4",
  },
  {
    slug: "google/gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro",
  },
] as const;

export const DEFAULT_MODEL_SLUG = "anthropic/claude-sonnet-4.6";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModelSelectorProps {
  value: string;
  onChange: (modelSlug: string) => void;
}

// ---------------------------------------------------------------------------
// ModelSelector
// ---------------------------------------------------------------------------

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className="h-7 gap-1 border-none bg-transparent px-2 text-xs shadow-none focus-visible:ring-0"
        data-testid="model-selector-trigger"
        aria-label="Select model"
      >
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent data-testid="model-selector-content">
        {ASSISTANT_MODELS.map((model) => (
          <SelectItem
            key={model.slug}
            value={model.slug}
            data-testid={`model-option-${model.slug}`}
          >
            {model.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
