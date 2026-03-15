// ---------------------------------------------------------------------------
// Reference Types for Multi-Image Referencing
// ---------------------------------------------------------------------------

/**
 * Semantic role assigned to a reference image.
 * Determines how the AI model interprets the reference.
 */
export type ReferenceRole =
  | "general"
  | "style"
  | "content"
  | "structure"
  | "character"
  | "color";

/**
 * Influence strength of a reference image.
 * Translated into prompt hints for the AI model (FLUX.2 has no native weights).
 */
export type ReferenceStrength =
  | "subtle"
  | "moderate"
  | "strong"
  | "dominant";

/**
 * Data for a single reference slot in the UI.
 * Controlled component -- all data comes from parent via props.
 */
export interface ReferenceSlotData {
  /** Unique ID of the reference image (from DB) */
  id: string;
  /** URL to the uploaded image (R2) */
  imageUrl: string;
  /** Stable slot position (1-5, sparse numbering) */
  slotPosition: number;
  /** Semantic role */
  role: ReferenceRole;
  /** Influence strength */
  strength: ReferenceStrength;
  /** Original filename (optional) */
  originalFilename?: string;
  /** Image width in pixels (optional) */
  width?: number;
  /** Image height in pixels (optional) */
  height?: number;
}
