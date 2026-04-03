import {
  getAllModelSlots,
  getModelSlotsByMode,
  upsertModelSlot,
  seedModelSlotDefaults,
  getModelByReplicateId,
} from "@/lib/db/queries";
import type { ModelSlot } from "@/lib/db/queries";
import type { SlotNumber } from "@/lib/types";

/**
 * Checks whether a model is compatible with the given generation mode.
 *
 * - txt2img: always compatible (every model supports text-to-image)
 * - Other modes: reads `capabilities` JSONB from the models table
 * - Fallback: true when model not found in DB or capabilities missing
 */
async function checkCompatibility(
  modelId: string,
  mode: string
): Promise<boolean> {
  // txt2img is always compatible -- no DB lookup needed
  if (mode === "txt2img") {
    return true;
  }

  try {
    const model = await getModelByReplicateId(modelId);

    // Fallback: model not in DB -> allow selection
    if (!model) {
      return true;
    }

    const capabilities = model.capabilities as Record<string, boolean> | null;

    // Fallback: no capabilities data -> allow selection
    if (!capabilities) {
      return true;
    }

    // Check the specific capability for the requested mode
    const capabilityValue = capabilities[mode];

    // If the capability key doesn't exist, fallback to true
    if (capabilityValue === undefined) {
      return true;
    }

    return capabilityValue === true;
  } catch {
    // If DB lookup fails, fallback: allow selection (no filter)
    return true;
  }
}

/**
 * ModelSlotService — business logic for model slot CRUD.
 *
 * Encapsulates compatibility checks, min-1-active rule, auto-activation
 * on model assignment to empty slots, and seed-defaults on first access.
 */
export const ModelSlotService = {
  /**
   * Returns all model slots. If the table is empty, seeds the 15 default
   * rows first (5 modes x 3 slots), then returns them.
   */
  async getAll(): Promise<ModelSlot[]> {
    const slots = await getAllModelSlots();

    if (slots.length === 0) {
      await seedModelSlotDefaults();
      return getAllModelSlots();
    }

    return slots;
  },

  /**
   * Returns the 3 model slots for the given generation mode, ordered by
   * slot number ascending.
   */
  async getForMode(mode: string): Promise<ModelSlot[]> {
    return getModelSlotsByMode(mode);
  },

  /**
   * Updates the model assignment for a specific slot. Validates model
   * compatibility before writing. Auto-activates the slot if it was
   * previously empty (model_id was null).
   *
   * Returns the updated ModelSlot row, or `{ error: string }` on
   * business rule violation.
   */
  async update(
    mode: string,
    slot: SlotNumber,
    modelId: string,
    modelParams?: Record<string, unknown>
  ): Promise<ModelSlot | { error: string }> {
    // Check compatibility
    const compatible = await checkCompatibility(modelId, mode);
    if (!compatible) {
      return { error: "Model not compatible with mode" };
    }

    // Fetch the current slot state to determine auto-activation
    const modeSlots = await getModelSlotsByMode(mode);
    const currentSlot = modeSlots.find((s) => s.slot === slot);

    // Determine active state: auto-activate if slot was empty (model_id was null)
    let active: boolean;
    if (currentSlot && currentSlot.modelId === null) {
      // Slot was empty -> auto-activate on model assignment
      active = true;
    } else if (currentSlot) {
      // Slot already had a model -> preserve current active state
      active = currentSlot.active;
    } else {
      // Slot doesn't exist yet (shouldn't happen after seed, but be safe)
      active = false;
    }

    const params = modelParams ?? currentSlot?.modelParams as Record<string, unknown> ?? {};

    const updated = await upsertModelSlot(mode, slot, modelId, params, active);
    return updated;
  },

  /**
   * Toggles the active state of a model slot.
   *
   * Business rules:
   * - Cannot deactivate the last active slot for a mode (min-1-active)
   * - Cannot activate a slot with no model assigned (model_id is null)
   *
   * Returns the updated ModelSlot row, or `{ error: string }` on violation.
   */
  async toggleActive(
    mode: string,
    slot: SlotNumber,
    active: boolean
  ): Promise<ModelSlot | { error: string }> {
    const modeSlots = await getModelSlotsByMode(mode);
    const currentSlot = modeSlots.find((s) => s.slot === slot);

    if (!currentSlot) {
      return { error: "Slot not found" };
    }

    // Reject activating an empty slot (no model assigned)
    if (active && currentSlot.modelId === null) {
      return { error: "Cannot activate empty slot" };
    }

    // Reject deactivating the last active slot
    if (!active) {
      const activeCount = modeSlots.filter((s) => s.active).length;
      if (activeCount <= 1 && currentSlot.active) {
        return { error: "Cannot deactivate last active slot" };
      }
    }

    // Safe: activating an empty slot (modelId=null) is rejected above,
    // so modelId is non-null when active=true. When active=false, modelId
    // could theoretically be null (deactivating an already-inactive empty
    // slot) which is a harmless upsert preserving the same state.
    const updated = await upsertModelSlot(
      mode,
      slot,
      currentSlot.modelId as string,
      currentSlot.modelParams as Record<string, unknown>,
      active
    );
    return updated;
  },

  /**
   * Seeds the 15 default model slot rows (5 modes x 3 slots).
   * Idempotent — existing rows are not overwritten.
   */
  async seedDefaults(): Promise<void> {
    await seedModelSlotDefaults();
  },
};
