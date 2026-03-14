"use client";

import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GenerationMode, Tier } from "@/lib/types";
import type { ModelSetting } from "@/lib/db/queries";
import type { CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelModeSectionProps {
  mode: GenerationMode;
  settings: ModelSetting[];
  collectionModels: CollectionModel[];
  collectionError: string | null;
  compatibilityMap: Record<string, boolean>;
  onModelChange: (mode: GenerationMode, tier: Tier, modelId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<GenerationMode, string> = {
  txt2img: "TEXT TO IMAGE",
  img2img: "IMAGE TO IMAGE",
  upscale: "UPSCALE",
};

const TIERS_BY_MODE: Record<GenerationMode, Tier[]> = {
  txt2img: ["draft", "quality", "max"],
  img2img: ["draft", "quality", "max"],
  upscale: ["draft", "quality"],
};

const TIER_LABELS: Record<Tier, string> = {
  draft: "Draft",
  quality: "Quality",
  max: "Max",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelModeSection({
  mode,
  settings,
  collectionModels,
  collectionError,
  compatibilityMap,
  onModelChange,
}: ModelModeSectionProps) {
  const tiers = TIERS_BY_MODE[mode];

  const getSettingForTier = useCallback(
    (tier: Tier): ModelSetting | undefined => {
      return settings.find((s) => s.mode === mode && s.tier === tier);
    },
    [settings, mode]
  );

  const handleValueChange = useCallback(
    (tier: Tier, modelId: string) => {
      onModelChange(mode, tier, modelId);
    },
    [mode, onModelChange]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {MODE_LABELS[mode]}
      </h3>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {tiers.map((tier) => {
          const setting = getSettingForTier(tier);
          const currentModelId = setting?.modelId ?? "";

          return (
            <div
              key={tier}
              className="flex items-center gap-3"
            >
              <span className="text-sm font-medium w-16 shrink-0">
                {TIER_LABELS[tier]}
              </span>
              {collectionError ? (
                <p className="text-sm text-destructive">
                  Could not load models
                </p>
              ) : (
                <Select
                  value={currentModelId}
                  onValueChange={(value) => handleValueChange(tier, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a model">
                      {currentModelId || "Select a model"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {collectionModels.map((model) => {
                      const modelId = `${model.owner}/${model.name}`;
                      const isIncompatible =
                        mode === "img2img" && compatibilityMap[modelId] === false;

                      return (
                        <SelectItem
                          key={modelId}
                          value={modelId}
                          disabled={isIncompatible}
                        >
                          <span className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {model.owner}
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
