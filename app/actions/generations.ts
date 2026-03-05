"use server";

import { GenerationService } from "@/lib/services/generation-service";
import { getModelById } from "@/lib/models";
import { getGenerations, type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateImagesInput {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  params: Record<string, unknown>;
  count: number;
}

interface RetryGenerationInput {
  id: string;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function generateImages(
  input: GenerateImagesInput
): Promise<Generation[] | { error: string }> {
  // AC-9: Empty prompt validation
  if (!input.prompt || input.prompt.trim().length === 0) {
    return { error: "Prompt darf nicht leer sein" };
  }

  // AC-10: Unknown model validation
  if (!getModelById(input.modelId)) {
    return { error: "Unbekanntes Modell" };
  }

  // AC-11: Count validation (1-4)
  if (
    !Number.isInteger(input.count) ||
    input.count < 1 ||
    input.count > 4
  ) {
    return { error: "Anzahl muss zwischen 1 und 4 liegen" };
  }

  try {
    const generations = await GenerationService.generate(
      input.projectId,
      input.prompt,
      input.negativePrompt,
      input.modelId,
      input.params,
      input.count
    );
    return generations;
  } catch (error: unknown) {
    console.error("generateImages error:", error);
    return {
      error:
        error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}

export async function retryGeneration(
  input: RetryGenerationInput
): Promise<Generation | { error: string }> {
  try {
    const generation = await GenerationService.retry(input.id);
    return generation;
  } catch (error: unknown) {
    // AC-8: Return error object for non-failed generations
    if (
      error instanceof Error &&
      error.message.includes("fehlgeschlagene Generierungen")
    ) {
      return { error: error.message };
    }
    console.error("retryGeneration error:", error);
    return {
      error:
        error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
}

export async function fetchGenerations(
  projectId: string
): Promise<Generation[]> {
  return getGenerations(projectId);
}
