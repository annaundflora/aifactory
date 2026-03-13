"use client";

import { useState, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Types (exported for slice-14)
// ---------------------------------------------------------------------------

export type VariationStrength = "subtle" | "balanced" | "creative";

export interface VariationParams {
  prompt: string;
  strength: VariationStrength;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRENGTH_OPTIONS: { value: VariationStrength; label: string }[] = [
  { value: "subtle", label: "Subtle" },
  { value: "balanced", label: "Balanced" },
  { value: "creative", label: "Creative" },
];

const COUNT_OPTIONS = [1, 2, 3, 4] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VariationPopoverProps {
  generation: Generation;
  onGenerate: (params: VariationParams) => void;
}

// ---------------------------------------------------------------------------
// VariationPopover
// ---------------------------------------------------------------------------

export function VariationPopover({
  generation,
  onGenerate,
}: VariationPopoverProps) {
  const { state, dispatch } = useCanvasDetail();

  const isOpen = state.activeToolId === "variation";

  // Local form state
  const [prompt, setPrompt] = useState(generation.prompt ?? "");
  const [strength, setStrength] = useState<VariationStrength>("balanced");
  const [count, setCount] = useState<number>(1);

  // Reset form state when popover opens with new generation prompt
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Closing: reset activeToolId
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" });
      }
    },
    [dispatch]
  );

  // Handle generate action
  const handleGenerate = useCallback(() => {
    onGenerate({
      prompt,
      strength,
      count,
    });
    // Close the popover by setting activeToolId to null via toggle
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" });
  }, [onGenerate, prompt, strength, count, dispatch]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Anchor is invisible — positioned where the toolbar variation button is */}
      <PopoverAnchor asChild>
        <span
          data-testid="variation-popover-anchor"
          className="pointer-events-none absolute"
        />
      </PopoverAnchor>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-80"
        data-testid="variation-popover"
      >
        {/* Header */}
        <PopoverHeader className="mb-3">
          <PopoverTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Variation
          </PopoverTitle>
        </PopoverHeader>

        {/* Prompt Field */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="variation-prompt"
              className="text-xs font-medium text-muted-foreground"
            >
              Prompt
            </label>
            <Textarea
              id="variation-prompt"
              data-testid="variation-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the variation..."
              className="min-h-20 resize-none text-sm"
              rows={3}
            />
          </div>

          {/* Strength Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="variation-strength"
              className="text-xs font-medium text-muted-foreground"
            >
              Strength
            </label>
            <Select
              value={strength}
              onValueChange={(value) =>
                setStrength(value as VariationStrength)
              }
            >
              <SelectTrigger
                className="w-full"
                data-testid="variation-strength-trigger"
              >
                <SelectValue placeholder="Select strength" />
              </SelectTrigger>
              <SelectContent>
                {STRENGTH_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`variation-strength-${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Count Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Count
            </label>
            <div
              className="flex gap-1"
              role="radiogroup"
              aria-label="Variation count"
              data-testid="variation-count-selector"
            >
              {COUNT_OPTIONS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={count === n ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setCount(n)}
                  role="radio"
                  aria-checked={count === n}
                  data-testid={`variation-count-${n}`}
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={handleGenerate}
            data-testid="variation-generate-button"
          >
            <Sparkles className="size-4" />
            Generate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
