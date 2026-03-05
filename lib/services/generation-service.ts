import sharp from "sharp";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  getGeneration,
  updateGeneration,
  type Generation,
} from "@/lib/db/queries";
import { getModelById } from "@/lib/models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
      buildReplicateInput(generation)
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

function buildReplicateInput(
  generation: Generation
): Record<string, unknown> {
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

  return input;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate N images: create pending DB records, then process them in parallel.
 * Returns the initial pending generations immediately-ish.
 * Each generation is processed independently (AC-5).
 */
async function generate(
  projectId: string,
  prompt: string,
  negativePrompt: string | undefined,
  modelId: string,
  params: Record<string, unknown>,
  count: number
): Promise<Generation[]> {
  // Validate
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt darf nicht leer sein");
  }
  if (!getModelById(modelId)) {
    throw new Error("Unbekanntes Modell");
  }
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("Anzahl muss zwischen 1 und 4 liegen");
  }

  // AC-1: Create N pending records
  const pendingGenerations: Generation[] = [];
  for (let i = 0; i < count; i++) {
    const gen = await createGeneration({
      projectId,
      prompt: prompt.trim(),
      negativePrompt: negativePrompt?.trim() || undefined,
      modelId,
      modelParams: params,
    });
    pendingGenerations.push(gen);
  }

  // AC-5: Process all in parallel (fire-and-forget from caller perspective,
  // but we use allSettled so failures don't abort others)
  Promise.allSettled(
    pendingGenerations.map((gen) => processGeneration(gen))
  ).catch((err) => {
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

export const GenerationService = {
  generate,
  retry,
};
