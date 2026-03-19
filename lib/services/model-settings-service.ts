import {
  getAllModelSettings,
  getModelSettingByModeTier,
  upsertModelSetting,
  seedModelSettingsDefaults,
  getModelByReplicateId,
  type ModelSetting,
} from "@/lib/db/queries";

export const ModelSettingsService = {
  /**
   * Returns all model settings. If the table is empty, seeds the defaults first.
   */
  async getAll(): Promise<ModelSetting[]> {
    const existing = await getAllModelSettings();
    if (existing.length > 0) {
      return existing;
    }

    await seedModelSettingsDefaults();
    return getAllModelSettings();
  },

  /**
   * Returns the model setting for a given mode+tier combination,
   * or undefined if no match exists.
   */
  async getForModeTier(
    mode: string,
    tier: string
  ): Promise<ModelSetting | undefined> {
    return getModelSettingByModeTier(mode, tier);
  },

  /**
   * Updates (upserts) a model setting for the given mode+tier.
   * Runs a compatibility check before writing to the DB.
   * Returns the updated ModelSetting on success, or an error object if incompatible.
   */
  async update(
    mode: string,
    tier: string,
    modelId: string,
    modelParams?: Record<string, unknown>
  ): Promise<ModelSetting | { error: string }> {
    const compatible = await ModelSettingsService.checkCompatibility(
      modelId,
      mode
    );
    if (!compatible) {
      return { error: "Model does not support this mode" };
    }

    return upsertModelSetting(mode, tier, modelId, modelParams ?? {});
  },

  /**
   * Seeds the 8 default model settings rows (idempotent via ON CONFLICT DO NOTHING).
   */
  async seedDefaults(): Promise<void> {
    return seedModelSettingsDefaults();
  },

  /**
   * Checks whether a model is compatible with the given mode.
   * - txt2img: always compatible (every model supports text-to-image), no DB lookup
   * - img2img, upscale, inpaint, outpaint: reads `capabilities` JSONB from DB
   * - Fallback: true when model not found in DB (allow selection, don't block)
   */
  async checkCompatibility(modelId: string, mode: string): Promise<boolean> {
    // txt2img is always compatible — no DB lookup needed
    if (mode === "txt2img") {
      return true;
    }

    try {
      const model = await getModelByReplicateId(modelId);

      // Fallback: model not in DB → allow selection
      if (!model) {
        return true;
      }

      const capabilities = model.capabilities as Record<string, boolean> | null;

      // Fallback: no capabilities data → allow selection
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
