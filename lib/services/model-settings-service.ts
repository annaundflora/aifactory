import { getModelByReplicateId } from "@/lib/db/queries";

/** @deprecated Legacy type kept for backward compat until consumers migrate to ModelSlot. */
type ModelSetting = {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Legacy ModelSettingsService -- the underlying model_settings table has been
 * replaced by model_slots (slice-01). Query functions were removed from
 * queries.ts. This service is kept as a compile-safe stub until later slices
 * migrate consumers to the new SlotService.
 */
export const ModelSettingsService = {
  /**
   * @deprecated model_settings table removed. Returns empty array.
   */
  async getAll(): Promise<ModelSetting[]> {
    return [];
  },

  /**
   * @deprecated model_settings table removed. Returns undefined.
   */
  async getForModeTier(
    _mode: string,
    _tier: string
  ): Promise<ModelSetting | undefined> {
    return undefined;
  },

  /**
   * @deprecated model_settings table removed. Returns error.
   */
  async update(
    _mode: string,
    _tier: string,
    _modelId: string,
    _modelParams?: Record<string, unknown>
  ): Promise<ModelSetting | { error: string }> {
    return { error: "model_settings table has been removed. Use model_slots." };
  },

  /**
   * @deprecated model_settings table removed. No-op.
   */
  async seedDefaults(): Promise<void> {
    // no-op: model_settings table no longer exists
  },

  /**
   * Checks whether a model is compatible with the given mode.
   * - txt2img: always compatible (every model supports text-to-image), no DB lookup
   * - img2img, upscale, inpaint, outpaint: reads `capabilities` JSONB from DB
   * - Fallback: true when model not found in DB (allow selection, don't block)
   */
  async checkCompatibility(modelId: string, mode: string): Promise<boolean> {
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
  },
};
