import type { ModelSlot } from "@/lib/db/queries";
import type { GenerationMode } from "@/lib/types";

/**
 * Resolve model slots for a given generation mode.
 *
 * Filters the provided slots by mode and assigned model, then returns
 * an array of { modelId, modelParams } for each matching slot.
 *
 * - Slots with `modelId === null` are skipped.
 * - Null/undefined `modelParams` are normalized to `{}`.
 * - Result order follows the input array order (no sorting applied).
 */
export function resolveActiveSlots(
  slots: ModelSlot[],
  mode: GenerationMode,
): { modelId: string; modelParams: Record<string, unknown> }[] {
  return slots
    .filter(
      (s): s is ModelSlot & { modelId: string } =>
        s.mode === mode && s.modelId != null,
    )
    .map((s) => ({
      modelId: s.modelId,
      modelParams: (s.modelParams ?? {}) as Record<string, unknown>,
    }));
}
