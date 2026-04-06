import {
  getAllModelSlots,
  getModelSlotsByMode,
  upsertModelSlot,
  clearModelSlot,
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
 * Encapsulates compatibility checks and seed-defaults on first access.
 * Every slot with an assigned model is considered live; there is no
 * separate active toggle.
 */
export const ModelSlotService = {
  /**
   * Returns all model slots. If the table is empty, seeds the 21 default
   * rows first (7 modes x 3 slots), then returns them.
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
   * compatibility before writing.
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

    const modeSlots = await getModelSlotsByMode(mode);
    const currentSlot = modeSlots.find((s) => s.slot === slot);

    const params = modelParams ?? currentSlot?.modelParams as Record<string, unknown> ?? {};

    const updated = await upsertModelSlot(mode, slot, modelId, params);
    return updated;
  },

  /**
   * Clears a model slot (removes the model assignment).
   * Sets modelId=null, modelParams={}.
   *
   * Business rule: Cannot clear the last slot that has a model
   * for a given mode (at least one model must remain).
   */
  async clear(
    mode: string,
    slot: SlotNumber
  ): Promise<ModelSlot | { error: string }> {
    const modeSlots = await getModelSlotsByMode(mode);
    const currentSlot = modeSlots.find((s) => s.slot === slot);

    if (!currentSlot) {
      return { error: "Slot not found" };
    }

    if (currentSlot.modelId === null) {
      return { error: "Slot is already empty" };
    }

    // Check if this is the last slot with a model
    const slotsWithModels = modeSlots.filter((s) => s.modelId !== null);
    if (slotsWithModels.length <= 1) {
      return { error: "Cannot remove last model" };
    }

    return clearModelSlot(mode, slot);
  },

  /**
   * Seeds the 21 default model slot rows (7 modes x 3 slots).
   * Idempotent — existing rows are not overwritten.
   */
  async seedDefaults(): Promise<void> {
    await seedModelSlotDefaults();
  },
};
