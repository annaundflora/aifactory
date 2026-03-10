import sharp from "sharp";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  getGeneration,
  updateGeneration,
  type Generation,
} from "@/lib/db/queries";

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;

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
 * Generate images: create pending DB records, then process them.
 *
 * Single model (modelIds.length === 1): creates `count` pending records
 * for that model and processes them sequentially (existing behavior).
 *
 * Multi-model (modelIds.length > 1): creates 1 pending record per model
 * with default params ({}), processes all in parallel via Promise.allSettled.
 * Partial failure is allowed — each rejected result marks its record as failed.
 */
async function generate(
  projectId: string,
  promptMotiv: string,
  promptStyle: string,
  negativePrompt: string | undefined,
  modelIds: string[],
  params: Record<string, unknown>,
  count: number
): Promise<Generation[]> {
  // Validate
  if (!promptMotiv || promptMotiv.trim().length === 0) {
    throw new Error("Prompt darf nicht leer sein");
  }
  if (
    !Array.isArray(modelIds) ||
    modelIds.length < 1 ||
    modelIds.length > 3
  ) {
    throw new Error("1-3 Modelle muessen ausgewaehlt sein");
  }
  for (const id of modelIds) {
    if (!id || !MODEL_ID_REGEX.test(id)) {
      throw new Error("Unbekanntes Modell");
    }
  }
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("Anzahl muss zwischen 1 und 4 liegen");
  }

  // Compose prompt from motiv + style
  const motivTrimmed = promptMotiv.trim();
  const styleTrimmed = promptStyle.trim();
  const prompt = styleTrimmed ? `${motivTrimmed}. ${styleTrimmed}` : motivTrimmed;

  const isMultiModel = modelIds.length > 1;

  if (isMultiModel) {
    // --- Multi-model branch: 1 record per model, default params, parallel ---
    const pendingGenerations: Generation[] = [];
    for (const modelId of modelIds) {
      const gen = await createGeneration({
        projectId,
        prompt,
        negativePrompt: negativePrompt?.trim() || undefined,
        modelId,
        modelParams: {},
        promptMotiv: motivTrimmed,
        promptStyle: styleTrimmed,
      });
      pendingGenerations.push(gen);
    }

    // Process all in parallel via Promise.allSettled (fire-and-forget).
    // Each rejected result marks the corresponding record as failed.
    (async () => {
      const results = await Promise.allSettled(
        pendingGenerations.map((gen) => processGeneration(gen))
      );
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "rejected") {
          const errorMessage =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          console.error(
            `Generation ${pendingGenerations[i].id} fehlgeschlagen: ${errorMessage}`
          );
          try {
            await updateGeneration(pendingGenerations[i].id, {
              status: "failed",
              errorMessage,
            });
          } catch (updateErr) {
            console.error(
              `Failed to mark generation ${pendingGenerations[i].id} as failed:`,
              updateErr
            );
          }
        }
      }
    })().catch((err) => {
      console.error("Unexpected error in multi-model generation batch:", err);
    });

    return pendingGenerations;
  }

  // --- Single-model branch: count records, sequential processing ---
  const modelId = modelIds[0];
  const pendingGenerations: Generation[] = [];
  for (let i = 0; i < count; i++) {
    const gen = await createGeneration({
      projectId,
      prompt,
      negativePrompt: negativePrompt?.trim() || undefined,
      modelId,
      modelParams: params,
      promptMotiv: motivTrimmed,
      promptStyle: styleTrimmed,
    });
    pendingGenerations.push(gen);
  }

  // Process sequentially to respect Replicate rate limits.
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

export const GenerationService = {
  generate,
  retry,
};
