// ---------------------------------------------------------------------------
// Slot & Generation Mode Types
// ---------------------------------------------------------------------------

/**
 * Slot number for model selection.
 * Each mode has exactly 3 fixed slots (1, 2, 3).
 */
export type SlotNumber = 1 | 2 | 3;

/**
 * Generation mode determining which model assignment to use.
 * - txt2img: text-to-image generation
 * - img2img: image-to-image transformation
 * - upscale: image upscaling
 * - inpaint: inpainting (image + mask based editing)
 * - outpaint: outpainting (expanding image boundaries)
 * - erase: object removal via mask
 * - instruction: instruction-based image editing
 */
export type GenerationMode = "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint" | "erase" | "instruction";

// ---------------------------------------------------------------------------
// Validation Constants
// ---------------------------------------------------------------------------

export const VALID_SLOTS = [1, 2, 3] as const;
export const VALID_GENERATION_MODES: readonly GenerationMode[] = ["txt2img", "img2img", "upscale", "inpaint", "outpaint", "erase", "instruction"] as const;
