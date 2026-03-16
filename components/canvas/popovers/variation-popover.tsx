"use client";

import { useState, useCallback, useEffect } from "react";
import { Copy, Sparkles } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TierToggle } from "@/components/ui/tier-toggle";
import type { Generation } from "@/lib/db/queries";
import type { Tier } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types (exported for slice-14)
// ---------------------------------------------------------------------------

export interface VariationParams {
  prompt: string;
  promptStyle: string;
  negativePrompt: string;
  count: number;
  tier: Tier;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  const [promptStyle, setPromptStyle] = useState(generation.promptStyle ?? "");
  const [negativePrompt, setNegativePrompt] = useState(generation.negativePrompt ?? "");
  const [count, setCount] = useState<number>(1);
  const [tier, setTier] = useState<Tier>("draft");

  // Reset form state when generation changes or popover reopens
  useEffect(() => {
    if (isOpen) {
      setPrompt(generation.prompt ?? "");
      setPromptStyle(generation.promptStyle ?? "");
      setNegativePrompt(generation.negativePrompt ?? "");
      setCount(1);
      setTier("draft");
    }
  }, [isOpen, generation.id]);

  // Handle popover open/close
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
      promptStyle,
      negativePrompt,
      count,
      tier,
    });
    // Close the popover by setting activeToolId to null via toggle
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" });
  }, [onGenerate, prompt, promptStyle, negativePrompt, count, tier, dispatch]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Anchor is invisible — positioned where the toolbar variation button is */}
      <PopoverAnchor asChild>
        <span
          data-testid="variation-popover-anchor"
          className="pointer-events-none absolute left-0 h-10 w-px"
          style={{ top: 8 }}
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
            <Copy className="size-4" />
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

          {/* Style */}
          <div className="space-y-1.5">
            <label
              htmlFor="variation-style"
              className="text-xs font-medium text-muted-foreground"
            >
              Style
            </label>
            <Textarea
              id="variation-style"
              data-testid="variation-style"
              value={promptStyle}
              onChange={(e) => setPromptStyle(e.target.value)}
              placeholder="Style prompt..."
              className="min-h-14 resize-none text-sm"
              rows={2}
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-1.5">
            <label
              htmlFor="variation-negative-prompt"
              className="text-xs font-medium text-muted-foreground"
            >
              Negative Prompt
            </label>
            <Textarea
              id="variation-negative-prompt"
              data-testid="variation-negative-prompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Negative prompt..."
              className="min-h-14 resize-none text-sm"
              rows={2}
            />
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

          {/* Tier Toggle */}
          <div className="space-y-2" data-testid="variation-tier-section">
            <TierToggle
              tier={tier}
              onTierChange={setTier}
              disabled={state.isGenerating}
            />
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
