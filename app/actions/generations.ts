"use server";

import { revalidatePath } from "next/cache";
import { GenerationService } from "@/lib/services/generation-service";
import { getModelById } from "@/lib/models";
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
  modelId: string;
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
      input.promptMotiv,
      input.promptStyle ?? '',
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

// ---------------------------------------------------------------------------
// uploadSourceImage
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function uploadSourceImage(input: {
  projectId: string;
  file: File;
}): Promise<{ url: string } | { error: string }> {
  const { projectId, file } = input;

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Nur PNG, JPG, JPEG und WebP erlaubt" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "Datei darf maximal 10MB groß sein" };
  }

  try {
    const ext = MIME_TO_EXT[file.type] ?? "png";
    const uuid = crypto.randomUUID();
    const key = `sources/${projectId}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await StorageService.upload(buffer, key, file.type);
    return { url };
  } catch (error: unknown) {
    console.error("uploadSourceImage error:", error);
    return { error: "Bild konnte nicht hochgeladen werden" };
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
