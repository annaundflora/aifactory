"use server";

import { revalidatePath } from "next/cache";
import { GenerationService, validateTotalMegapixels } from "@/lib/services/generation-service";
import {
  getGenerations,
  getGeneration,
  deleteGeneration as deleteGenerationFromDb,
  getSiblingsByBatchId,
  getVariantFamily,
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
  generationMode?: string;
  sourceImageUrl?: string;
  strength?: number;
  /** ID of the generation this variant was created from. */
  sourceGenerationId?: string;
  /** Multi-image references (slice-09+). Passed through for slice-13 to consume. */
  references?: Array<{
    referenceImageId: string;
    imageUrl: string;
    role: string;
    strength: string;
    slotPosition: number;
    width?: number;
    height?: number;
  }>;
}

interface UpscaleImageInput {
  projectId: string;
  sourceImageUrl: string;
  scale: 2 | 4;
  sourceGenerationId?: string;
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

  // Validate generationMode if provided
  if (
    input.generationMode !== undefined &&
    !["txt2img", "img2img"].includes(input.generationMode)
  ) {
    return { error: "Ungueltiger Generierungsmodus" };
  }

  // img2img-specific validation
  if (input.generationMode === "img2img") {
    if (!input.sourceImageUrl && (!input.references || input.references.length === 0)) {
      return { error: "Source-Image ist erforderlich fuer img2img" };
    }
    if (input.strength !== undefined && (input.strength < 0 || input.strength > 1)) {
      return { error: "Strength muss zwischen 0 und 1 liegen" };
    }
  }

  // AC-3, AC-4: Megapixel validation for references before API call
  if (input.references && input.references.length > 0) {
    const mpError = validateTotalMegapixels(input.references);
    if (mpError) {
      return { error: mpError };
    }
  }

  try {
    const generations = await GenerationService.generate(
      input.projectId,
      input.promptMotiv,
      input.promptStyle ?? '',
      input.negativePrompt,
      input.modelIds,
      input.params,
      input.count,
      input.generationMode,
      input.sourceImageUrl,
      input.strength,
      input.references,
      input.sourceGenerationId
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

// ---------------------------------------------------------------------------
// upscaleImage
// ---------------------------------------------------------------------------

export async function upscaleImage(
  input: UpscaleImageInput
): Promise<Generation | { error: string }> {
  // Validate projectId
  if (!input.projectId || input.projectId.trim().length === 0) {
    return { error: "Ungültige Projekt-ID" };
  }

  // Validate sourceImageUrl
  if (!input.sourceImageUrl) {
    return { error: "Source-Image ist erforderlich fuer img2img" };
  }

  // Validate scale: only 2 and 4 allowed
  if (input.scale !== 2 && input.scale !== 4) {
    return { error: "Scale muss 2 oder 4 sein" };
  }

  try {
    const generation = await GenerationService.upscale({
      projectId: input.projectId,
      sourceImageUrl: input.sourceImageUrl,
      scale: input.scale,
      sourceGenerationId: input.sourceGenerationId,
    });
    return generation;
  } catch (error: unknown) {
    console.error("upscaleImage error:", error);
    return {
      error:
        error instanceof Error ? error.message : "Unbekannter Fehler",
    };
  }
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

// ---------------------------------------------------------------------------
// getSiblingGenerations
// ---------------------------------------------------------------------------

/**
 * Returns all completed sibling generations for a given batchId.
 * Returns an empty array when batchId is null/undefined or on error.
 */
export async function getSiblingGenerations(
  batchId: string | null
): Promise<Generation[]> {
  if (!batchId) {
    return [];
  }

  try {
    return await getSiblingsByBatchId(batchId);
  } catch (error) {
    console.error("getSiblingGenerations error:", error);
    return [];
  }
}

/**
 * Returns the variant family for a generation:
 * source image + all direct variants + batch siblings.
 */
export async function getVariantFamilyAction(
  batchId: string | null,
  sourceGenerationId: string | null,
  currentGenerationId: string
): Promise<Generation[]> {
  try {
    return await getVariantFamily(batchId, sourceGenerationId, currentGenerationId);
  } catch (error) {
    console.error("getVariantFamilyAction error:", error);
    return [];
  }
}
