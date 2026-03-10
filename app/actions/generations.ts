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
  generationMode?: string;
  sourceImageUrl?: string;
  strength?: number;
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

  // Validate generationMode if provided
  if (
    input.generationMode !== undefined &&
    !["txt2img", "img2img"].includes(input.generationMode)
  ) {
    return { error: "Ungueltiger Generierungsmodus" };
  }

  // img2img-specific validation
  if (input.generationMode === "img2img") {
    if (!input.sourceImageUrl) {
      return { error: "Source-Image ist erforderlich fuer img2img" };
    }
    if (input.strength !== undefined && (input.strength < 0 || input.strength > 1)) {
      return { error: "Strength muss zwischen 0 und 1 liegen" };
    }
  }

  try {
    const generations = await GenerationService.generate(
      input.projectId,
      input.promptMotiv,
      input.promptStyle ?? '',
      input.negativePrompt,
      input.modelId,
      input.params,
      input.count,
      input.generationMode,
      input.sourceImageUrl,
      input.strength
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

export async function uploadSourceImage(
  input:
    | { projectId: string; file: File }
    | { projectId: string; url: string }
): Promise<{ url: string } | { error: string }> {
  const { projectId } = input;

  if (!projectId || projectId.trim().length === 0) {
    return { error: "Ungültige Projekt-ID" };
  }

  if ("url" in input) {
    // URL path: server-side fetch and proxy through R2
    let response: Response;
    try {
      response = await fetch(input.url);
    } catch {
      return { error: "Bild konnte nicht geladen werden" };
    }

    if (!response.ok) {
      return { error: "Bild konnte nicht geladen werden" };
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return { error: "Nur PNG, JPG, JPEG und WebP erlaubt" };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > MAX_FILE_SIZE) {
      return { error: "Datei darf maximal 10MB groß sein" };
    }

    try {
      const ext = MIME_TO_EXT[mimeType] ?? "png";
      const uuid = crypto.randomUUID();
      const key = `sources/${projectId}/${uuid}.${ext}`;
      const url = await StorageService.upload(buffer, key, mimeType);
      return { url };
    } catch (error: unknown) {
      console.error("uploadSourceImage (url) error:", error);
      return { error: "Bild konnte nicht hochgeladen werden" };
    }
  }

  // File path: existing logic
  const { file } = input;

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
