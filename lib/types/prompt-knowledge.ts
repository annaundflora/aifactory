// ---------------------------------------------------------------------------
// Prompt Knowledge System -- TypeScript Interfaces
// ---------------------------------------------------------------------------
//
// These interfaces define the schema for data/prompt-knowledge.json.
// Used by the TS Knowledge Lookup (lib/services/prompt-knowledge.ts)
// and consumed by the Improver prompt-service for system-prompt injection.
// ---------------------------------------------------------------------------

/**
 * Information about negative prompt support for a model.
 */
export interface NegativePromptInfo {
  /** Whether the model supports a dedicated negative prompt input. */
  supported: boolean;
  /** Guidance note on how to handle negatives for this model. */
  note: string;
}

/**
 * Mode-specific knowledge (e.g. txt2img, img2img).
 * Contains tips tailored to a particular generation mode.
 */
export interface ModeKnowledge {
  /** Mode-specific prompting tips (2-4 items). */
  tips: string[];
}

/**
 * Knowledge entry for a specific model (or model family prefix).
 * Contains prompting guidance, strengths, tips, and things to avoid.
 */
export interface ModelKnowledge {
  /** Human-readable display name for the model family. */
  displayName: string;
  /** Preferred prompt style: natural language or keyword-based. */
  promptStyle: "natural" | "keywords";
  /** Information about negative prompt support. */
  negativePrompts: NegativePromptInfo;
  /** Key strengths of this model (2-4 items). */
  strengths: string[];
  /** General prompting tips for this model (3-6 items). */
  tips: string[];
  /** Things to avoid when prompting this model (2-4 items). */
  avoid: string[];
  /** Optional mode-specific knowledge (txt2img, img2img). */
  modes?: Record<"txt2img" | "img2img", ModeKnowledge>;
}

/**
 * Fallback knowledge used when no model-specific prefix match is found.
 */
export interface FallbackKnowledge {
  /** Display name for the fallback section (typically "Generic"). */
  displayName: string;
  /** General prompting tips (at least 3 items). */
  tips: string[];
  /** Things to avoid (at least 2 items). */
  avoid: string[];
}

/**
 * Top-level structure of the prompt-knowledge.json file.
 */
export interface PromptKnowledgeFile {
  /** Model-specific knowledge entries, keyed by model prefix. */
  models: Record<string, ModelKnowledge>;
  /** Fallback knowledge for unrecognized models. */
  fallback: FallbackKnowledge;
}
