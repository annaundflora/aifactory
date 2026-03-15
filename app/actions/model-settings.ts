"use server";

import { ModelSettingsService } from "@/lib/services/model-settings-service";
import type { ModelSetting } from "@/lib/db/queries";
import {
  VALID_GENERATION_MODES,
  VALID_TIERS,
  type UpdateModelSettingInput,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;

function validateUpdateInput(
  input: UpdateModelSettingInput
): { error: string } | null {
  // Validate mode
  if (!VALID_GENERATION_MODES.includes(input.mode)) {
    return { error: "Invalid generation mode" };
  }

  // Validate tier
  if (!VALID_TIERS.includes(input.tier)) {
    return { error: "Invalid tier" };
  }

  // Reject upscale + max combination
  if (input.mode === "upscale" && input.tier === "max") {
    return { error: "Upscale mode does not support max tier" };
  }

  // Validate modelId format
  if (!MODEL_ID_REGEX.test(input.modelId)) {
    return { error: "Invalid model ID format" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Returns all model settings. Delegates to ModelSettingsService.getAll()
 * which seeds defaults if the table is empty.
 */
export async function getModelSettings(): Promise<ModelSetting[]> {
  return ModelSettingsService.getAll();
}

/**
 * Updates a single model setting for the given mode+tier combination.
 * Validates input before delegating to ModelSettingsService.update().
 * Returns the updated ModelSetting on success, or an error object.
 */
export async function updateModelSetting(
  input: UpdateModelSettingInput
): Promise<ModelSetting | { error: string }> {
  const validationError = validateUpdateInput(input);
  if (validationError) {
    return validationError;
  }

  return ModelSettingsService.update(input.mode, input.tier, input.modelId);
}
