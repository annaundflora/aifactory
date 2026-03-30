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
import { ParameterPanel, type SchemaProperties } from "@/components/workspace/parameter-panel";
import { useModelSchema } from "@/lib/hooks/use-model-schema";
import { ModelSlots } from "@/components/ui/model-slots";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import type { Generation, ModelSlot, Model } from "@/lib/db/queries";
import type { Tier } from "@/lib/types";

/** @deprecated Legacy type kept for backward compat until consumers migrate to ModelSlot. */
type ModelSetting = {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Legacy helper (inline replacement for removed resolveModel export)
// ---------------------------------------------------------------------------

/**
 * @deprecated Legacy model resolution from ModelSetting[]. Used only when
 * modelSlots/models props are not provided (backward compat until slice-12).
 */
function resolveModelLegacy(
  settings: ModelSetting[],
  mode: string,
  tier: string,
): { modelId: string; modelParams: Record<string, unknown> } | undefined {
  const setting = settings.find(
    (s) => s.mode === mode && s.tier === tier,
  );
  if (!setting) return undefined;
  return {
    modelId: setting.modelId,
    modelParams: (setting.modelParams ?? {}) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Types (exported for slice-12)
// ---------------------------------------------------------------------------

export type VariationStrength = "subtle" | "balanced" | "creative";

export interface VariationParams {
  prompt: string;
  promptStyle: string;
  negativePrompt: string;
  strength?: VariationStrength;
  count: number;
  /** Active model IDs from selected slots. */
  modelIds: string[];
  /** @deprecated Kept for backward compat until slice-12. Use `modelIds` instead. */
  tier?: Tier;
  imageParams?: Record<string, unknown>;
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
  /** New prop: model slot configurations. When provided (together with `models`), ModelSlots UI is rendered instead of TierToggle. */
  modelSlots?: ModelSlot[];
  /** New prop: available models for dropdown. Required together with `modelSlots` for new path. */
  models?: Model[];
  /** @deprecated Kept for backward compat until slice-12. Used only when `modelSlots`/`models` are not provided. */
  modelSettings?: ModelSetting[];
}

// ---------------------------------------------------------------------------
// VariationPopover
// ---------------------------------------------------------------------------

export function VariationPopover({
  generation,
  onGenerate,
  modelSlots,
  models,
  modelSettings = [],
}: VariationPopoverProps) {
  const { state, dispatch } = useCanvasDetail();

  const isOpen = state.activeToolId === "variation";

  // Determine which path to use: new (ModelSlots) or legacy (TierToggle)
  const useNewPath = modelSlots !== undefined && models !== undefined;

  // Local form state
  const [prompt, setPrompt] = useState(generation.prompt ?? "");
  const [promptStyle, setPromptStyle] = useState(generation.promptStyle ?? "");
  const [negativePrompt, setNegativePrompt] = useState(generation.negativePrompt ?? "");
  const [count, setCount] = useState<number>(1);

  // Legacy path state
  const [tier, setTier] = useState<Tier>("draft");
  const [imageParams, setImageParams] = useState<Record<string, unknown>>({});

  // Legacy path: resolve modelId from settings for schema fetching
  const resolved = !useNewPath
    ? resolveModelLegacy(modelSettings, "img2img", tier)
    : undefined;
  const { schema, isLoading, error } = useModelSchema(
    !useNewPath ? resolved?.modelId : undefined,
  );

  // Legacy path: reset imageParams when tier/model changes
  useEffect(() => {
    if (!useNewPath) {
      setImageParams({});
    }
  }, [resolved?.modelId, useNewPath]);

  // Reset form state when generation changes or popover reopens
  useEffect(() => {
    if (isOpen) {
      setPrompt(generation.prompt ?? "");
      setPromptStyle(generation.promptStyle ?? "");
      setNegativePrompt(generation.negativePrompt ?? "");
      setCount(1);
      setTier("draft");
      setImageParams({});
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
    [dispatch],
  );

  // Handle generate action
  const handleGenerate = useCallback(() => {
    if (useNewPath && modelSlots) {
      // New path: collect active slot modelIds via resolveActiveSlots
      const activeSlots = resolveActiveSlots(modelSlots, "txt2img");
      const modelIds = activeSlots.map((s) => s.modelId);

      onGenerate({
        prompt,
        promptStyle,
        negativePrompt,
        count,
        modelIds,
        // tier is intentionally NOT set (undefined) in new path
      });
    } else {
      // Legacy path: use tier
      onGenerate({
        prompt,
        promptStyle,
        negativePrompt,
        count,
        modelIds: [], // empty in legacy path — consumer uses tier instead
        tier,
        imageParams,
      });
    }

    // Close the popover by setting activeToolId to null via toggle
    dispatch({ type: "SET_ACTIVE_TOOL", toolId: "variation" });
  }, [
    useNewPath,
    modelSlots,
    onGenerate,
    prompt,
    promptStyle,
    negativePrompt,
    count,
    tier,
    imageParams,
    dispatch,
  ]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Anchor is invisible -- positioned where the toolbar variation button is */}
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

          {/* Model Selection: New path (ModelSlots) or Legacy path (TierToggle) */}
          {useNewPath && modelSlots && models ? (
            <div className="space-y-2" data-testid="variation-model-slots-section">
              <ModelSlots
                mode="txt2img"
                slots={modelSlots}
                models={models}
                variant="stacked"
                disabled={state.isGenerating}
              />
            </div>
          ) : (
            <>
              {/* Legacy: Tier Toggle */}
              <div className="space-y-2" data-testid="variation-tier-section">
                <TierToggle
                  tier={tier}
                  onTierChange={setTier}
                  disabled={state.isGenerating}
                />
              </div>

              {/* Legacy: Parameter Controls (schema-based) */}
              {!error && (
                <ParameterPanel
                  schema={schema as SchemaProperties | null}
                  isLoading={isLoading}
                  values={imageParams}
                  onChange={setImageParams}
                  primaryFields={["aspect_ratio", "megapixels", "resolution"]}
                />
              )}
            </>
          )}

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
