"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParameterPanel } from "@/components/workspace/parameter-panel";
import { useModelSchema } from "@/lib/hooks/use-model-schema";
import {
  updateModelSlot,
  clearModelSlot as clearModelSlotAction,
} from "@/app/actions/model-slots";
import { cn } from "@/lib/utils";
import type { GenerationMode, SlotNumber } from "@/lib/types";
import type { ModelSlot } from "@/lib/db/queries";
import type { Model } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelSlotsProps {
  mode: GenerationMode;
  slots: ModelSlot[];
  models: Model[];
  variant?: "stacked" | "compact";
  disabled?: boolean;
  onSlotsChanged?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns models compatible with the given mode by checking
 * the `capabilities` JSONB field. Models with `capabilities[mode] === true`
 * are included. Models without capabilities data are included as fallback.
 */
function getCompatibleModels(models: Model[], mode: GenerationMode): Model[] {
  return models.filter((model) => {
    const capabilities = model.capabilities as Record<string, boolean> | null;
    if (!capabilities) return true;
    const value = capabilities[mode];
    // Treat missing capability key as compatible (permissive fallback)
    if (value === undefined) return true;
    return value === true;
  });
}

// ---------------------------------------------------------------------------
// Slot Row Sub-Component
// ---------------------------------------------------------------------------

interface SlotRowProps {
  slot: ModelSlot;
  slotNumber: SlotNumber;
  mode: GenerationMode;
  compatibleModels: Model[];
  removable: boolean;
  disabled: boolean;
  variant: "stacked" | "compact";
  onSlotUpdate: (slot: ModelSlot) => void;
  onSlotRemoved: () => void;
  onError: (slot: ModelSlot) => void;
}

function SlotRow({
  slot,
  slotNumber,
  mode,
  compatibleModels,
  removable,
  disabled,
  variant,
  onSlotUpdate,
  onSlotRemoved,
  onError,
}: SlotRowProps) {
  const [isPending, startTransition] = useTransition();
  const hasModel = slot.modelId !== null;

  const showParams = variant === "stacked" && hasModel;
  const schemaResult = useModelSchema(
    showParams ? (slot.modelId ?? undefined) : undefined,
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      // Optimistic update: set model and auto-activate
      onSlotUpdate({ ...slot, modelId, active: true });

      startTransition(async () => {
        const result = await updateModelSlot({
          mode,
          slot: slotNumber,
          modelId,
          modelParams: (slot.modelParams as Record<string, unknown>) ?? {},
        });

        if (result && "error" in result) {
          onError(slot);
        } else {
          onSlotUpdate(result);
          window.dispatchEvent(new CustomEvent("model-slots-changed"));
        }
      });
    },
    [slot, slotNumber, mode, onSlotUpdate, onError],
  );

  const handleParamsChange = useCallback(
    (newParams: Record<string, unknown>) => {
      if (!slot.modelId) return;
      onSlotUpdate({ ...slot, modelParams: newParams });

      startTransition(async () => {
        const result = await updateModelSlot({
          mode,
          slot: slotNumber,
          modelId: slot.modelId!,
          modelParams: newParams,
        });

        if (result && "error" in result) {
          onError(slot);
        } else {
          onSlotUpdate(result);
          window.dispatchEvent(new CustomEvent("model-slots-changed"));
        }
      });
    },
    [slot, slotNumber, mode, onSlotUpdate, onError],
  );

  const handleRemove = useCallback(() => {
    if (!hasModel) {
      // Empty slot — just hide it, no server call needed
      onSlotRemoved();
      return;
    }

    // Optimistic update: clear model
    onSlotUpdate({ ...slot, modelId: null, modelParams: {}, active: false });

    startTransition(async () => {
      const result = await clearModelSlotAction({
        mode,
        slot: slotNumber,
      });

      if (result && "error" in result) {
        onError(slot);
      } else {
        onSlotUpdate(result);
        onSlotRemoved();
        window.dispatchEvent(new CustomEvent("model-slots-changed"));
      }
    });
  }, [slot, slotNumber, mode, hasModel, onSlotUpdate, onSlotRemoved, onError]);

  if (variant === "compact") {
    return (
      <div
        className="flex items-center gap-1.5 min-w-0"
        data-testid={`slot-row-${slotNumber}`}
      >
        <Select
          value={slot.modelId ?? undefined}
          onValueChange={handleModelChange}
          disabled={disabled || isPending}
        >
          <SelectTrigger
            size="sm"
            className="h-7 min-w-0 max-w-[140px] text-xs *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate *:data-[slot=select-value]:max-w-[100px]"
            data-testid={`slot-select-${slotNumber}`}
          >
            <SelectValue placeholder="--" />
          </SelectTrigger>
          <SelectContent>
            {compatibleModels.map((model) => (
              <SelectItem key={model.replicateId} value={model.replicateId}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || isPending}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            data-testid={`slot-remove-${slotNumber}`}
            aria-label={`Remove slot ${slotNumber}`}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Stacked variant (default)
  return (
    <div data-testid={`slot-row-${slotNumber}`}>
      <div className="flex items-center gap-2">
        <Select
          value={slot.modelId ?? undefined}
          onValueChange={handleModelChange}
          disabled={disabled || isPending}
        >
          <SelectTrigger
            className="w-full"
            data-testid={`slot-select-${slotNumber}`}
          >
            <SelectValue placeholder="select model" />
          </SelectTrigger>
          <SelectContent>
            {compatibleModels.map((model) => (
              <SelectItem key={model.replicateId} value={model.replicateId}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {removable && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || isPending}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            data-testid={`slot-remove-${slotNumber}`}
            aria-label={`Remove slot ${slotNumber}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Per-slot ParameterPanel: only for slots with a model in stacked variant */}
      {showParams && (
        <div className="mt-2" data-testid={`slot-params-${slotNumber}`}>
          <ParameterPanel
            schema={schemaResult.schema as Record<string, import("@/components/workspace/parameter-panel").SchemaProperty> | null}
            isLoading={schemaResult.isLoading}
            values={(slot.modelParams as Record<string, unknown>) ?? {}}
            onChange={handleParamsChange}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Slot Button Sub-Component
// ---------------------------------------------------------------------------

interface AddSlotButtonProps {
  variant: "stacked" | "compact";
  onClick: () => void;
}

function AddSlotButton({ variant, onClick }: AddSlotButtonProps) {
  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-2 text-xs text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        data-testid="add-slot-button"
      >
        <Plus className="size-3" />
        Model
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-muted-foreground/40 py-2 text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
      data-testid="add-slot-button"
    >
      <Plus className="size-4" />
      Add model
    </button>
  );
}

// ---------------------------------------------------------------------------
// ModelSlots Component
// ---------------------------------------------------------------------------

/**
 * ModelSlots component with stacked (default) and compact layout.
 *
 * Renders 3 slot rows with Radix Checkbox + Radix Select.
 * - Stacked: vertical layout with per-slot ParameterPanel for active slots.
 * - Compact: horizontal layout without ParameterPanels.
 *
 * Fully controlled via props. Data fetching happens in the consumer.
 */
export function ModelSlots({
  mode,
  slots,
  models,
  variant = "stacked",
  disabled = false,
  onSlotsChanged,
  className,
}: ModelSlotsProps) {
  // Local optimistic state: clone slots for immediate UI updates
  const [optimisticSlots, setOptimisticSlots] = useState<ModelSlot[]>(slots);

  // Sync optimistic state when props change (e.g. mode switch, external refresh)
  // Use a stable key check on slot IDs + model assignments
  const slotsKey = slots
    .map((s) => `${s.id}:${s.modelId}:${s.active}:${s.slot}`)
    .join("|");
  const [prevSlotsKey, setPrevSlotsKey] = useState(slotsKey);
  if (slotsKey !== prevSlotsKey) {
    setPrevSlotsKey(slotsKey);
    setOptimisticSlots(slots);
  }

  // Filter by current mode, then ensure exactly 3 slots sorted by slot number
  const sortedSlots = useMemo(() => {
    const slotMap = new Map<number, ModelSlot>();
    for (const s of optimisticSlots) {
      if (s.mode === mode) slotMap.set(s.slot, s);
    }
    return [1, 2, 3].map(
      (n) =>
        slotMap.get(n) ?? {
          id: `placeholder-${n}`,
          mode,
          slot: n,
          modelId: null,
          modelParams: {},
          active: n === 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
    ) as ModelSlot[];
  }, [optimisticSlots, mode]);

  // Progressive disclosure: always start with 1 visible slot
  const [visibleCount, setVisibleCount] = useState(1);

  // Reset visible count when mode changes
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    setVisibleCount(1);
  }

  // Filter models by mode compatibility
  const compatibleModels = useMemo(
    () =>
      getCompatibleModels(models, mode).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [models, mode],
  );

  const handleSlotUpdate = useCallback(
    (updatedSlot: ModelSlot) => {
      setOptimisticSlots((prev) =>
        prev.map((s) => (s.slot === updatedSlot.slot ? updatedSlot : s)),
      );
      onSlotsChanged?.();
    },
    [onSlotsChanged],
  );

  const handleSlotError = useCallback(
    (originalSlot: ModelSlot) => {
      setOptimisticSlots((prev) =>
        prev.map((s) => (s.slot === originalSlot.slot ? originalSlot : s)),
      );
    },
    [],
  );

  const handleSlotRemoved = useCallback(() => {
    setVisibleCount((c) => Math.max(1, c - 1));
  }, []);

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        isCompact ? "grid grid-cols-2 gap-2" : "space-y-3",
        className,
      )}
      data-testid="model-slots"
      data-variant={variant}
    >
      {sortedSlots.slice(0, visibleCount).map((slot, index) => (
        <SlotRow
          key={slot.slot}
          slot={slot}
          slotNumber={slot.slot as SlotNumber}
          mode={mode}
          compatibleModels={compatibleModels}
          removable={index > 0}
          disabled={disabled}
          variant={variant}
          onSlotUpdate={handleSlotUpdate}
          onSlotRemoved={handleSlotRemoved}
          onError={handleSlotError}
        />
      ))}
      {visibleCount < 3 && !disabled && (
        <AddSlotButton
          variant={variant}
          onClick={() => setVisibleCount((c) => Math.min(c + 1, 3))}
        />
      )}
    </div>
  );
}
