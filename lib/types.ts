// ---------------------------------------------------------------------------
// Tier & Generation Mode Types
// ---------------------------------------------------------------------------

/**
 * Quality tier for model selection.
 * - draft: fast/cheap iteration
 * - quality: production/finishing
 * - max: premium quality (not available for upscale mode)
 */
export type Tier = "draft" | "quality" | "max";

/**
 * Generation mode determining which model assignment to use.
 * - txt2img: text-to-image generation
 * - img2img: image-to-image transformation
 * - upscale: image upscaling
 * - inpaint: inpainting (image + mask based editing)
 * - outpaint: outpainting (expanding image boundaries)
 */
export type GenerationMode = "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint";

// ---------------------------------------------------------------------------
// Validation Constants
// ---------------------------------------------------------------------------

export const VALID_TIERS: readonly Tier[] = ["draft", "quality", "max"] as const;
export const VALID_GENERATION_MODES: readonly GenerationMode[] = ["txt2img", "img2img", "upscale", "inpaint", "outpaint"] as const;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

/**
 * Input DTO for updating a model setting.
 * modelParams is not user-settable -- resolved from preset defaults.
 */
export interface UpdateModelSettingInput {
  mode: GenerationMode;
  tier: Tier;
  modelId: string;
}
