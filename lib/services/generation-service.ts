import sharp from "sharp";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  getGeneration,
  updateGeneration,
  type Generation,
} from "@/lib/db/queries";
import { getModelById, UPSCALE_MODEL } from "@/lib/models";
import { ModelSchemaService } from "@/lib/services/model-schema-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpscaleInput {
  projectId: string;
  sourceImageUrl: string;
  scale: 2 | 4;
  sourceGenerationId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect whether a buffer is PNG by checking the magic bytes.
 */
function isPng(buffer: Buffer): boolean {
  // PNG magic: 0x89 0x50 0x4E 0x47
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

/**
 * Convert a ReadableStream to a Buffer, optionally converting to PNG if needed.
 * Returns { buffer, width, height }.
 */
async function streamToPngBuffer(
  stream: ReadableStream
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Read stream into buffer
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buffer: any = Buffer.concat(chunks);

  // Convert to PNG if not already PNG (AC-6)
  if (!isPng(buffer)) {
    buffer = await sharp(buffer).png().toBuffer();
  }

  // Get dimensions
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  return { buffer, width, height };
}

// ---------------------------------------------------------------------------
// Core: process a single generation
// ---------------------------------------------------------------------------

async function processGeneration(generation: Generation): Promise<Generation> {
  const storageKey = `projects/${generation.projectId}/${generation.id}.png`;

  try {
    // 1. Call Replicate
    const result = await ReplicateClient.run(
      generation.modelId,
      await buildReplicateInput(generation)
    );

    // 2. Convert stream to PNG buffer + get dimensions
    const { buffer, width, height } = await streamToPngBuffer(result.output);

    // 3. Upload to R2
    const imageUrl = await StorageService.upload(buffer as unknown as Buffer, storageKey);

    // 4. Update DB to completed (AC-2)
    return await updateGeneration(generation.id, {
      status: "completed",
      imageUrl,
      width,
      height,
      seed: result.seed,
      replicatePredictionId: result.predictionId,
    });
  } catch (error: unknown) {
    // AC-3, AC-4: Mark as failed
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      `Generation ${generation.id} fehlgeschlagen: ${errorMessage}`
    );

    return await updateGeneration(generation.id, {
      status: "failed",
      errorMessage,
    });
  }
}

async function buildReplicateInput(
  generation: Generation
): Promise<Record<string, unknown>> {
  const params =
    typeof generation.modelParams === "object" && generation.modelParams !== null
      ? (generation.modelParams as Record<string, unknown>)
      : {};

  const input: Record<string, unknown> = {
    ...params,
    prompt: generation.prompt,
  };

  if (generation.negativePrompt) {
    input.negative_prompt = generation.negativePrompt;
  }

  if (generation.generationMode === "img2img" && generation.sourceImageUrl) {
    const schema = await ModelSchemaService.getSchema(generation.modelId);

    let fieldName: string | undefined;
    if ("image" in schema) {
      fieldName = "image";
    } else if ("image_prompt" in schema) {
      fieldName = "image_prompt";
    } else if ("init_image" in schema) {
      fieldName = "init_image";
    }

    if (fieldName) {
      input[fieldName] = generation.sourceImageUrl;
    }
    // prompt_strength is already spread from modelParams via params above
  }

  return input;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate N images: create pending DB records, then process them sequentially.
 * Returns the initial pending generations immediately for optimistic UI.
 * Each generation is processed independently (AC-5).
 */
async function generate(
  projectId: string,
  promptMotiv: string,
  promptStyle: string,
  negativePrompt: string | undefined,
  modelId: string,
  params: Record<string, unknown>,
  count: number,
  generationMode?: string,
  sourceImageUrl?: string,
  strength?: number
): Promise<Generation[]> {
  // Validate
  if (!promptMotiv || promptMotiv.trim().length === 0) {
    throw new Error("Prompt darf nicht leer sein");
  }
  if (!getModelById(modelId)) {
    throw new Error("Unbekanntes Modell");
  }
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("Anzahl muss zwischen 1 und 4 liegen");
  }

  // Validate generationMode value
  if (generationMode !== undefined && !["txt2img", "img2img"].includes(generationMode)) {
    throw new Error("Ungueltiger Generierungsmodus");
  }

  // Resolve effective mode
  const effectiveMode = generationMode ?? "txt2img";

  // img2img validation
  if (effectiveMode === "img2img") {
    if (!sourceImageUrl) {
      throw new Error("Source-Image ist erforderlich fuer img2img");
    }
    if (strength !== undefined && (strength < 0 || strength > 1)) {
      throw new Error("Strength muss zwischen 0 und 1 liegen");
    }
  }

  // Compose prompt from motiv + style
  const motivTrimmed = promptMotiv.trim();
  const styleTrimmed = promptStyle.trim();
  const prompt = styleTrimmed ? `${motivTrimmed}. ${styleTrimmed}` : motivTrimmed;

  // For img2img: embed prompt_strength in stored modelParams so retry works
  const storedParams =
    effectiveMode === "img2img"
      ? { ...params, prompt_strength: strength ?? 0.6 }
      : params;

  // AC-1: Create N pending records
  const pendingGenerations: Generation[] = [];
  for (let i = 0; i < count; i++) {
    const gen = await createGeneration({
      projectId,
      prompt,
      negativePrompt: negativePrompt?.trim() || undefined,
      modelId,
      modelParams: storedParams,
      promptMotiv: motivTrimmed,
      promptStyle: styleTrimmed,
      generationMode: effectiveMode,
      sourceImageUrl: sourceImageUrl ?? null,
    });
    pendingGenerations.push(gen);
  }

  // AC-5: Process sequentially to respect Replicate rate limits.
  // Each generation is independent — failures don't abort the queue.
  (async () => {
    for (const gen of pendingGenerations) {
      try {
        await processGeneration(gen);
      } catch (err) {
        console.error(`Generation ${gen.id} unexpected error:`, err);
      }
    }
  })().catch((err) => {
    console.error("Unexpected error in generation batch:", err);
  });

  // Return pending generations immediately for optimistic UI
  return pendingGenerations;
}

/**
 * Retry a failed generation (AC-7, AC-8).
 */
async function retry(generationId: string): Promise<Generation> {
  const generation = await getGeneration(generationId);

  // AC-8: Only failed generations can be retried
  if (generation.status !== "failed") {
    throw new Error(
      "Nur fehlgeschlagene Generierungen koennen wiederholt werden"
    );
  }

  // AC-7: Reset to pending
  const resetGeneration = await updateGeneration(generationId, {
    status: "pending",
    errorMessage: null,
  });

  // Re-run the flow (fire-and-forget)
  processGeneration(resetGeneration).catch((err) => {
    console.error(`Retry generation ${generationId} unexpected error:`, err);
  });

  return resetGeneration;
}

/**
 * Upscale a single image using the fixed UPSCALE_MODEL.
 * Creates 1 pending Generation record with generationMode "upscale",
 * then processes it fire-and-forget.
 * Returns the pending generation immediately for optimistic UI.
 */
async function upscale(input: UpscaleInput): Promise<Generation> {
  const { projectId, sourceImageUrl, scale, sourceGenerationId } = input;

  // Validate scale: only 2 and 4 allowed
  if (scale !== 2 && scale !== 4) {
    throw new Error("Scale muss 2 oder 4 sein");
  }

  // Compose prompt
  let prompt = `Upscale ${scale}x`;
  if (sourceGenerationId) {
    const sourceGeneration = await getGeneration(sourceGenerationId);
    prompt = `${sourceGeneration.prompt} (Upscale ${scale}x)`;
  }

  // Create a single pending generation record
  const generation = await createGeneration({
    projectId,
    prompt,
    modelId: UPSCALE_MODEL,
    generationMode: "upscale",
    sourceImageUrl,
    sourceGenerationId: sourceGenerationId ?? null,
  });

  // Fire-and-forget: process the upscale asynchronously
  (async () => {
    const storageKey = `projects/${generation.projectId}/${generation.id}.png`;

    try {
      // Call Replicate with upscale-specific input (image + scale, no prompt)
      const result = await ReplicateClient.run(UPSCALE_MODEL, {
        image: sourceImageUrl,
        scale,
      });

      // Convert stream to PNG buffer + get dimensions
      const { buffer, width, height } = await streamToPngBuffer(result.output);

      // Upload to R2
      const imageUrl = await StorageService.upload(buffer as unknown as Buffer, storageKey);

      // Update DB to completed
      await updateGeneration(generation.id, {
        status: "completed",
        imageUrl,
        width,
        height,
        seed: result.seed,
        replicatePredictionId: result.predictionId,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `Upscale ${generation.id} fehlgeschlagen: ${errorMessage}`
      );

      await updateGeneration(generation.id, {
        status: "failed",
        errorMessage,
      });
    }
  })().catch((err) => {
    console.error("Unexpected error in upscale processing:", err);
  });

  // Return the pending generation immediately
  return generation;
}

export const GenerationService = {
  generate,
  retry,
  upscale,
};
