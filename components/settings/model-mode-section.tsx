"use client";

import type { GenerationMode } from "@/lib/types";
import type { ModelSlot } from "@/lib/db/queries";
import type { Model } from "@/lib/services/model-catalog-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmptyState = "empty:syncing" | "empty:never-synced" | "empty:failed" | "empty:partial" | null;

interface ModelModeSectionProps {
  mode: GenerationMode;
  slots: ModelSlot[];
  models: Model[];
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

const SLOT_LABELS: Record<number, string> = {
  1: "Slot 1",
  2: "Slot 2",
  3: "Slot 3",
};

const SLOTS = [1, 2, 3] as const;

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
  slots,
  models,
  syncState = "idle",
  hasEverSynced = false,
  syncFailed = false,
  otherModesHaveModels = false,
}: ModelModeSectionProps) {
  const modeSlots = SLOTS.map((slotNumber) =>
    slots.find((s) => s.mode === mode && s.slot === slotNumber) ?? null
  );

  // Determine the empty state for this section
  const emptyState: EmptyState =
    models.length === 0
      ? determineEmptyState(syncState, hasEverSynced, syncFailed, otherModesHaveModels)
      : null;

  /**
   * Resolve a human-readable display name for the model assigned to a slot.
   * Falls back to the raw modelId when the model is not in the catalog.
   */
  const getModelDisplayName = (modelId: string | null): string | null => {
    if (!modelId) return null;
    const model = models.find((m) => m.replicateId === modelId);
    return model ? model.name : modelId;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {MODE_LABELS[mode]}
      </h3>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {emptyState ? (
          <p className="text-sm text-muted-foreground" data-testid={`empty-state-${mode}`}>
            {EMPTY_STATE_MESSAGES[emptyState]}
          </p>
        ) : (
          modeSlots.map((slot, index) => {
            const slotNumber = SLOTS[index];
            const modelId = slot?.modelId ?? null;
            const isActive = slot?.active ?? false;
            const displayName = getModelDisplayName(modelId);

            return (
              <div
                key={slotNumber}
                className="flex items-center gap-3"
                data-testid={`slot-row-${mode}-${slotNumber}`}
              >
                <span className="text-sm font-medium w-16 shrink-0">
                  {SLOT_LABELS[slotNumber]}
                </span>
                <span className="text-sm flex-1 truncate">
                  {displayName ? (
                    displayName
                  ) : (
                    <span className="text-muted-foreground">not assigned</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-block size-2 rounded-full ${
                      isActive ? "bg-green-500" : "bg-gray-400"
                    }`}
                    data-testid={`status-dot-${mode}-${slotNumber}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {isActive ? "on" : "off"}
                  </span>
                </span>
              </div>
            );
          })
        )}
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
