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
import type { Model } from "@/lib/services/model-catalog-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmptyState = "empty:syncing" | "empty:never-synced" | "empty:failed" | "empty:partial" | null;

interface ModelModeSectionProps {
  mode: GenerationMode;
  settings: ModelSetting[];
  models: Model[];
  onModelChange: (mode: GenerationMode, tier: Tier, modelId: string) => void;
  syncState?: "idle" | "syncing" | "sync_partial";
  hasEverSynced?: boolean;
  syncFailed?: boolean;
  otherModesHaveModels?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<GenerationMode, string> = {
  txt2img: "TEXT TO IMAGE",
  img2img: "IMAGE TO IMAGE",
  upscale: "UPSCALE",
  inpaint: "INPAINT",
  outpaint: "OUTPAINT",
};

const TIERS_BY_MODE: Record<GenerationMode, Tier[]> = {
  txt2img: ["draft", "quality", "max"],
  img2img: ["draft", "quality"],
  upscale: ["quality", "max"],
  inpaint: ["quality"],
  outpaint: ["quality"],
};

const TIER_LABELS: Record<Tier, string> = {
  draft: "Draft",
  quality: "Quality",
  max: "Max",
};

const EMPTY_STATE_MESSAGES: Record<Exclude<EmptyState, null>, string> = {
  "empty:syncing": "Loading models... please wait.",
  "empty:never-synced": 'No models available. Click "Sync Models" to load.',
  "empty:failed": 'Sync failed. Click "Sync Models" to retry.',
  "empty:partial": 'No models for this mode yet. Click "Sync Models" to retry.',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelModeSection({
  mode,
  settings,
  models,
  onModelChange,
  syncState = "idle",
  hasEverSynced = false,
  syncFailed = false,
  otherModesHaveModels = false,
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

  // Determine the empty state for this section
  const emptyState: EmptyState = models.length === 0 ? determineEmptyState(syncState, hasEverSynced, syncFailed, otherModesHaveModels) : null;

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
              {emptyState ? (
                <p className="text-sm text-muted-foreground" data-testid={`empty-state-${mode}`}>
                  {EMPTY_STATE_MESSAGES[emptyState]}
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
                    {models.map((model) => {
                      const modelId = model.replicateId;

                      return (
                        <SelectItem
                          key={modelId}
                          value={modelId}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function determineEmptyState(
  syncState: "idle" | "syncing" | "sync_partial",
  hasEverSynced: boolean,
  syncFailed: boolean,
  otherModesHaveModels: boolean
): Exclude<EmptyState, null> {
  if (syncState === "syncing") {
    return "empty:syncing";
  }
  if (syncState === "sync_partial" && otherModesHaveModels) {
    return "empty:partial";
  }
  // Check syncFailed before hasEverSynced so that a failed first sync
  // correctly returns "empty:failed" instead of "empty:never-synced"
  if (syncFailed) {
    return "empty:failed";
  }
  if (!hasEverSynced) {
    return "empty:never-synced";
  }
  // hasEverSynced is true, not syncing, not partial with other modes having models
  // This means the sync completed but produced no models for this mode
  if (otherModesHaveModels) {
    return "empty:partial";
  }
  return "empty:failed";
}
