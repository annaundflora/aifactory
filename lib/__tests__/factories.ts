import type { Generation } from "@/lib/db/queries";
import type { PromptHistoryEntry } from "@/lib/services/prompt-history-service";

/**
 * Creates a Generation object with sensible defaults.
 * All properties can be overridden via the `overrides` parameter.
 *
 * Reflects the cleaned schema (no promptStyle / negativePrompt).
 */
export function makeGeneration(
  overrides: Partial<Generation> = {}
): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A test prompt",
    promptMotiv: "A test prompt",
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    isFavorite: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    batchId: null,
    ...overrides,
  };
}

/**
 * Creates a PromptHistoryEntry object with sensible defaults.
 * All properties can be overridden via the `overrides` parameter.
 *
 * Reflects the cleaned interface (no promptStyle / negativePrompt).
 */
export function makeEntry(
  overrides: Partial<PromptHistoryEntry> = {}
): PromptHistoryEntry {
  return {
    generationId: "gen-001",
    promptMotiv: "A test prompt",
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    isFavorite: false,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}
