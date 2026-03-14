import {
  getAllModelSettings,
  getModelSettingByModeTier,
  upsertModelSetting,
  seedModelSettingsDefaults,
  type ModelSetting,
} from "@/lib/db/queries";
import { ModelSchemaService } from "@/lib/services/model-schema-service";

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
   * - txt2img: always compatible (every model supports text-to-image)
   * - upscale: always compatible (not schema-checked)
   * - img2img: delegates to ModelSchemaService.supportsImg2Img()
   */
  async checkCompatibility(modelId: string, mode: string): Promise<boolean> {
    // txt2img and upscale are always considered compatible
    if (mode !== "img2img") {
      return true;
    }

    try {
      return await ModelSchemaService.supportsImg2Img(modelId);
    } catch {
      // If schema fetch fails, conservatively return false
      return false;
    }
  },
};
