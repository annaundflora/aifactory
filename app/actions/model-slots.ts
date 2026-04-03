"use server";

import { ModelSlotService } from "@/lib/services/model-slot-service";
import { VALID_GENERATION_MODES, VALID_SLOTS } from "@/lib/types";
import type { GenerationMode, SlotNumber } from "@/lib/types";
import type { ModelSlot } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth/guard";

// ---------------------------------------------------------------------------
// Data Transfer Objects (DTOs)
// ---------------------------------------------------------------------------

export type UpdateModelSlotInput = {
  mode: GenerationMode;
  slot: SlotNumber;
  modelId: string;
  modelParams?: Record<string, unknown>;
};

export type ToggleSlotActiveInput = {
  mode: GenerationMode;
  slot: SlotNumber;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;

function validateMode(mode: string): { error: string } | null {
  if (
    !(VALID_GENERATION_MODES as readonly string[]).includes(mode)
  ) {
    return { error: "Invalid generation mode" };
  }
  return null;
}

function validateSlot(slot: number): { error: string } | null {
  if (!(VALID_SLOTS as readonly number[]).includes(slot)) {
    return { error: "Invalid slot number" };
  }
  return null;
}

function validateModelId(modelId: string): { error: string } | null {
  if (!MODEL_ID_REGEX.test(modelId)) {
    return { error: "Invalid model ID format" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Returns all model slots. Delegates to ModelSlotService.getAll()
 * which seeds defaults if the table is empty.
 */
export async function getModelSlots(): Promise<
  ModelSlot[] | { error: string }
> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  return ModelSlotService.getAll();
}

/**
 * Updates the model assignment for a specific mode+slot combination.
 * Validates input (mode, slot, modelId format) before delegating to
 * ModelSlotService.update(). Returns the updated ModelSlot on success,
 * or an error object on validation failure or business rule violation.
 */
export async function updateModelSlot(
  input: UpdateModelSlotInput
): Promise<ModelSlot | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Validate mode
  const modeError = validateMode(input.mode);
  if (modeError) return modeError;

  // Validate slot
  const slotError = validateSlot(input.slot);
  if (slotError) return slotError;

  // Validate modelId format
  const modelIdError = validateModelId(input.modelId);
  if (modelIdError) return modelIdError;

  return ModelSlotService.update(
    input.mode,
    input.slot,
    input.modelId,
    input.modelParams
  );
}

/**
 * Toggles the active state of a model slot. Validates mode and slot
 * before delegating to ModelSlotService.toggleActive(). Returns the
 * updated ModelSlot on success, or an error object on validation failure
 * or business rule violation (e.g. min-1-active).
 */
export async function toggleSlotActive(
  input: ToggleSlotActiveInput
): Promise<ModelSlot | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Validate mode
  const modeError = validateMode(input.mode);
  if (modeError) return modeError;

  // Validate slot
  const slotError = validateSlot(input.slot);
  if (slotError) return slotError;

  return ModelSlotService.toggleActive(input.mode, input.slot, input.active);
}
