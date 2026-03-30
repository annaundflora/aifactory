"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ParameterPanel } from "@/components/workspace/parameter-panel";
import { useModelSchema } from "@/lib/hooks/use-model-schema";
import { updateModelSlot, toggleSlotActive } from "@/app/actions/model-slots";
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
  /** Hide per-slot ParameterPanels even in stacked variant (default: true) */
  showParameters?: boolean;
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

/**
 * Abbreviates a model name for compact layout display.
 * "black-forest-labs/flux-schnell" -> "flux-schnell"
 */
function abbreviateModelName(replicateId: string): string {
  const parts = replicateId.split("/");
  return parts.length > 1 ? parts[1] : replicateId;
}

// ---------------------------------------------------------------------------
// Slot Row Sub-Component (stacked variant)
// ---------------------------------------------------------------------------

interface SlotRowProps {
  slot: ModelSlot;
  slotNumber: SlotNumber;
  mode: GenerationMode;
  compatibleModels: Model[];
  allModels: Model[];
  isLastActive: boolean;
  disabled: boolean;
  variant: "stacked" | "compact";
  showParameters: boolean;
  onSlotUpdate: (slot: ModelSlot) => void;
  onError: (slot: ModelSlot) => void;
}

function SlotRow({
  slot,
  slotNumber,
  mode,
  compatibleModels,
  allModels,
  isLastActive,
  disabled,
  variant,
  showParameters,
  onSlotUpdate,
  onError,
}: SlotRowProps) {
  const [isPending, startTransition] = useTransition();
  const hasModel = slot.modelId !== null;
  const isActive = slot.active;

  // Checkbox is disabled when:
  // - component-level disabled
  // - slot has no model (can't activate empty slot)
  // - it's the last active slot (min-1-active rule)
  // - a transition is pending
  const checkboxDisabled =
    disabled || !hasModel || (isActive && isLastActive) || isPending;

  // Schema for parameter panel (only when showParameters is true, in stacked variant, for active slots with a model)
  const showParams = showParameters && variant === "stacked" && isActive && hasModel;
  const schemaResult = useModelSchema(
    showParams ? (slot.modelId ?? undefined) : undefined,
  );

  const handleCheckedChange = useCallback(
    (checked: CheckboxPrimitive.CheckedState) => {
      // Prevent deactivating last active slot (guard)
      if (isActive && isLastActive) return;

      const newActive = checked === true;
      // Optimistic update
      onSlotUpdate({ ...slot, active: newActive });

      startTransition(async () => {
        const result = await toggleSlotActive({
          mode,
          slot: slotNumber,
          active: newActive,
        });

        if (result && "error" in result) {
          // Rollback on error
          onError(slot);
        } else {
          // Confirm with server state
          onSlotUpdate(result);
          window.dispatchEvent(new CustomEvent("model-slots-changed"));
        }
      });
    },
    [slot, slotNumber, mode, isActive, isLastActive, onSlotUpdate, onError],
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
          // Rollback on error
          onError(slot);
        } else {
          // Confirm with server state
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
      // Optimistic update params
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

  if (variant === "compact") {
    return (
      <div
        className="flex items-center gap-1.5 min-w-0"
        data-testid={`slot-row-${slotNumber}`}
      >
        <CheckboxPrimitive.Root
          checked={isActive}
          onCheckedChange={handleCheckedChange}
          disabled={checkboxDisabled}
          className={cn(
            "size-4 shrink-0 rounded border border-input bg-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          data-testid={`slot-checkbox-${slotNumber}`}
          aria-label={`Slot ${slotNumber} active`}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center">
            <Check className="size-3" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

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
      </div>
    );
  }

  // Stacked variant (default)
  return (
    <div data-testid={`slot-row-${slotNumber}`}>
      <div className="flex items-center gap-2">
        <CheckboxPrimitive.Root
          checked={isActive}
          onCheckedChange={handleCheckedChange}
          disabled={checkboxDisabled}
          className={cn(
            "size-5 shrink-0 rounded border border-input bg-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          data-testid={`slot-checkbox-${slotNumber}`}
          aria-label={`Slot ${slotNumber} active`}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center">
            <Check className="size-3.5" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>

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
      </div>

      {/* Per-slot ParameterPanel: only for active slots with a model in stacked variant */}
      {showParams && (
        <div className="mt-2 ml-7" data-testid={`slot-params-${slotNumber}`}>
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
  showParameters = true,
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

  // Ensure we always show exactly 3 slots, sorted by slot number
  const sortedSlots = useMemo(() => {
    const slotMap = new Map<number, ModelSlot>();
    for (const s of optimisticSlots) {
      slotMap.set(s.slot, s);
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

  // Filter models by mode compatibility
  const compatibleModels = useMemo(
    () => getCompatibleModels(models, mode),
    [models, mode],
  );

  // Count active slots to enforce min-1-active rule
  const activeCount = useMemo(
    () => sortedSlots.filter((s) => s.active).length,
    [sortedSlots],
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
      // Rollback to the original slot state
      setOptimisticSlots((prev) =>
        prev.map((s) => (s.slot === originalSlot.slot ? originalSlot : s)),
      );
    },
    [],
  );

  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        isCompact ? "flex items-center gap-3" : "space-y-3",
        className,
      )}
      data-testid="model-slots"
      data-variant={variant}
    >
      {sortedSlots.map((slot) => (
        <SlotRow
          key={slot.slot}
          slot={slot}
          slotNumber={slot.slot as SlotNumber}
          mode={mode}
          compatibleModels={compatibleModels}
          allModels={models}
          isLastActive={slot.active && activeCount <= 1}
          disabled={disabled}
          variant={variant}
          showParameters={showParameters}
          onSlotUpdate={handleSlotUpdate}
          onError={handleSlotError}
        />
      ))}
    </div>
  );
}
