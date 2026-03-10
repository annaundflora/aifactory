"use server";

import { revalidatePath } from "next/cache";
import { GenerationService } from "@/lib/services/generation-service";
import {
  getGenerations,
  getGeneration,
  deleteGeneration as deleteGenerationFromDb,
  type Generation,
} from "@/lib/db/queries";
import { StorageService } from "@/lib/clients/storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateImagesInput {
  projectId: string;
  promptMotiv: string;
  promptStyle?: string;
  negativePrompt?: string;
  modelIds: string[];
  params: Record<string, unknown>;
  count: number;
}

interface RetryGenerationInput {
  id: string;
}

interface DeleteGenerationInput {
  id: string;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function generateImages(
  input: GenerateImagesInput
): Promise<Generation[] | { error: string }> {
  // AC-9: Empty prompt validation
  if (!input.promptMotiv || input.promptMotiv.trim().length === 0) {
    return { error: "Prompt darf nicht leer sein" };
  }

  // Slice-12: modelIds array validation (1-3 models)
  const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
  if (
    !Array.isArray(input.modelIds) ||
    input.modelIds.length < 1 ||
    input.modelIds.length > 3
  ) {
    return { error: "1-3 Modelle muessen ausgewaehlt sein" };
  }

  // Slice-12: Each model ID must match owner/name pattern
  for (const id of input.modelIds) {
    if (!MODEL_ID_REGEX.test(id)) {
      return { error: "Unbekanntes Modell" };
    }
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
      input.promptMotiv,
      input.promptStyle ?? '',
      input.negativePrompt,
      input.modelIds,
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

export async function deleteGeneration(
  input: DeleteGenerationInput
): Promise<{ success: boolean }> {
  try {
    // Fetch the generation first to check existence and get image_url
    let generation: Generation;
    try {
      generation = await getGeneration(input.id);
    } catch {
      // Generation not found
      return { success: false };
    }

    // DB DELETE first (data integrity)
    await deleteGenerationFromDb(input.id);

    // R2 DELETE second — extract key from image_url
    if (generation.imageUrl) {
      try {
        // Extract the R2 object key from the full URL
        const url = new URL(generation.imageUrl);
        const key = url.pathname.startsWith("/")
          ? url.pathname.slice(1)
          : url.pathname;
        await StorageService.delete(key);
      } catch (error) {
        // Log but don't fail — DB record is already deleted
        console.error("Failed to delete R2 object:", error);
      }
    }

    // Revalidate gallery
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("deleteGeneration error:", error);
    return { success: false };
  }
}
