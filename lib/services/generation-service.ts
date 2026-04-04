import sharp from "sharp";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  createGenerationReferences,
  getGeneration,
  updateGeneration,
  type Generation,
} from "@/lib/db/queries";
import { ModelCatalogService } from "@/lib/services/model-catalog-service";
import { getImg2ImgFieldName, type SchemaProperties } from "@/lib/services/capability-detection";
import type { ReferenceRole, ReferenceStrength } from "@/lib/types/reference";
import { VALID_GENERATION_MODES } from "@/lib/types";

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpscaleInput {
  projectId: string;
  sourceImageUrl: string;
  scale: 2 | 4;
  sourceGenerationId?: string;
  /** Model ID for upscaling (resolved from settings). */
  modelId: string;
  /** Model parameters for upscaling (resolved from settings). Merged with image/scale for Replicate call. */
  modelParams: Record<string, unknown>;
}

/**
 * Input shape for a single reference image in the generation pipeline.
 * Passed from UI via server action to the generation service.
 */
export interface ReferenceInput {
  referenceImageId: string;
  imageUrl: string;
  role: string;
  strength: string;
  slotPosition: number;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Megapixel Validation
// ---------------------------------------------------------------------------

const MAX_TOTAL_MEGAPIXELS = 9;

/**
 * Validate that the total megapixels of all reference images do not exceed
 * the FLUX.2 API limit of 9 MP.
 *
 * Returns null if valid, or an error message string if invalid.
 */
export function validateTotalMegapixels(
  references: ReferenceInput[]
): string | null {
  let totalPixels = 0;
  for (const ref of references) {
    if (ref.width && ref.height) {
      totalPixels += ref.width * ref.height;
    }
  }
  const totalMegapixels = totalPixels / 1_000_000;
  if (totalMegapixels > MAX_TOTAL_MEGAPIXELS) {
    return "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)";
  }
  return null;
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
// Prompt @-Token Mapping (Slice 12)
// ---------------------------------------------------------------------------

/**
 * Input shape for a single reference in prompt composition.
 * Subset of ReferenceSlotData -- only the fields needed for prompt mapping.
 */
interface PromptReference {
  slotPosition: number;
  role: ReferenceRole;
  strength: ReferenceStrength;
}

/**
 * Compose a multi-reference prompt by mapping @N tokens to @imageN,
 * and appending role/strength guidance for the AI model.
 *
 * Pure function -- no DB/API calls, no side effects.
 *
 * Algorithm (from architecture.md):
 *   Step 1: Replace @N with @imageN for tokens matching a reference slotPosition
 *   Step 2: Append "Reference guidance:" with role/strength for ALL references
 *   Step 3: Unused references (not @-mentioned in original prompt) are included too
 *
 * @param prompt - The already-composed prompt string (motiv + style)
 * @param references - Array of references with slotPosition, role, and strength
 * @returns Enhanced prompt string with @imageN tokens and reference guidance
 */
export function composeMultiReferencePrompt(
  prompt: string,
  references: PromptReference[]
): string {
  // AC-5: Empty references array -> return prompt unchanged
  if (references.length === 0) {
    return prompt;
  }

  // Build a lookup map: slotPosition -> reference
  const refMap = new Map<number, PromptReference>();
  for (const ref of references) {
    refMap.set(ref.slotPosition, ref);
  }

  // Step 1: Replace @N tokens with @imageN
  // Only replace tokens whose N matches a reference slotPosition (AC-6)
  // Regex /@(\d+)/g as specified in constraints
  const mappedPrompt = prompt.replace(/@(\d+)/g, (_match, digitStr: string) => {
    const n = parseInt(digitStr, 10);
    if (refMap.has(n)) {
      return `@image${n}`;
    }
    // AC-6: Token does not match any reference -- leave unchanged
    return _match;
  });

  // Step 2 + 3: Build reference guidance for ALL references
  // Sort by slotPosition for consistent ordering
  const sortedRefs = [...references].sort(
    (a, b) => a.slotPosition - b.slotPosition
  );

  const guidanceEntries = sortedRefs
    .filter((ref) => ref.role !== "general")
    .map((ref) => {
      return `@image${ref.slotPosition} provides ${ref.role} reference with ${ref.strength} influence`;
    });

  // Skip guidance entirely when all references are "general"
  if (guidanceEntries.length === 0) {
    return mappedPrompt;
  }

  const guidance = `Reference guidance: ${guidanceEntries.join(". ")}.`;

  // Combine mapped prompt with guidance
  return `${mappedPrompt}. ${guidance}`;
}

// ---------------------------------------------------------------------------
// Core: process a single generation
// ---------------------------------------------------------------------------

async function processGeneration(
  generation: Generation,
  references?: ReferenceInput[]
): Promise<Generation> {
  const storageKey = `projects/${generation.projectId}/${generation.id}.png`;

  try {
    // 1. Call Replicate
    const result = await ReplicateClient.run(
      generation.modelId,
      await buildReplicateInput(generation, references)
    );

    // 2. Convert stream to PNG buffer + get dimensions
    const { buffer, width, height } = await streamToPngBuffer(result.output);

    // 3. Upload to R2
    const imageUrl = await StorageService.upload(buffer as unknown as Buffer, storageKey);

    // 4. Update DB to completed (AC-2)
    const updatedGeneration = await updateGeneration(generation.id, {
      status: "completed",
      imageUrl,
      width,
      height,
      seed: result.seed,
      replicatePredictionId: result.predictionId,
    });

    // 5. Create generation_references records AFTER successful generation (AC-1, AC-7)
    if (references && references.length > 0) {
      await createGenerationReferences(
        references.map((ref) => ({
          generationId: generation.id,
          referenceImageId: ref.referenceImageId,
          role: ref.role,
          strength: ref.strength,
          slotPosition: ref.slotPosition,
        }))
      );
    }

    return updatedGeneration;
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
  generation: Generation,
  references?: ReferenceInput[]
): Promise<Record<string, unknown>> {
  const params =
    typeof generation.modelParams === "object" && generation.modelParams !== null
      ? (generation.modelParams as Record<string, unknown>)
      : {};

  const input: Record<string, unknown> = {
    ...params,
    prompt: generation.prompt,
  };

  if (generation.generationMode === "img2img") {
    const rawSchema = await ModelCatalogService.getSchema(generation.modelId);
    const schema = (rawSchema ?? {}) as SchemaProperties;
    const img2imgField = getImg2ImgFieldName(schema);

    if (img2imgField) {
      // AC-2: Multi-image references path -- URLs sorted by slotPosition ASC
      if (references && references.length > 0) {
        const referenceUrls = [...references]
          .sort((a, b) => a.slotPosition - b.slotPosition)
          .map((r) => r.imageUrl);
        input[img2imgField.field] = referenceUrls;
      } else if (generation.sourceImageUrl) {
        // AC-5: Backwards-compatible fallback -- single sourceImageUrl
        input[img2imgField.field] = img2imgField.isArray
          ? [generation.sourceImageUrl]
          : generation.sourceImageUrl;
      }
    }
    // prompt_strength is already spread from modelParams via params above
  }

  // Inpaint: image + mask + prompt (FLUX Fill Pro)
  if (generation.generationMode === "inpaint") {
    input.image = generation.sourceImageUrl;
    input.mask = params.maskUrl as string;
    // prompt is already set above from generation.prompt
  }

  // Erase: image + mask, no prompt (Bria Eraser)
  if (generation.generationMode === "erase") {
    input.image = generation.sourceImageUrl;
    input.mask = params.maskUrl as string;
    delete input.prompt;
  }

  // Instruction: image_url + prompt, no mask (FLUX Kontext Pro)
  if (generation.generationMode === "instruction") {
    input.image_url = generation.sourceImageUrl;
    // prompt is already set above from generation.prompt
  }

  // Outpaint: image + mask + prompt (FLUX Fill Pro, reused)
  if (generation.generationMode === "outpaint") {
    input.image = generation.sourceImageUrl;
    input.mask = params.maskUrl as string;
    // prompt is already set above from generation.prompt
  }

  // Remove internal audit fields that were stored in modelParams for retry/audit
  // but must not be sent to the Replicate API (strict schema validation).
  delete input.maskUrl;
  delete input.outpaintDirections;
  delete input.outpaintSize;

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
 * with default params ({}), processes sequentially to avoid Replicate rate limits.
 * Partial failure is allowed — each failed generation is marked independently.
 */
async function generate(
  projectId: string,
  promptMotiv: string,
  modelIds: string[],
  params: Record<string, unknown>,
  count: number,
  generationMode?: string,
  sourceImageUrl?: string,
  strength?: number,
  references?: ReferenceInput[],
  sourceGenerationId?: string,
  maskUrl?: string,
  outpaintDirections?: string[],
  outpaintSize?: number
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

  // Validate generationMode value
  if (generationMode !== undefined && !(VALID_GENERATION_MODES as readonly string[]).includes(generationMode)) {
    throw new Error("Ungueltiger Generierungsmodus");
  }

  // Resolve effective mode
  const effectiveMode = generationMode ?? "txt2img";

  // Normalize references: undefined or empty array both mean "no references"
  const effectiveReferences = references && references.length > 0 ? references : undefined;

  // img2img validation
  if (effectiveMode === "img2img") {
    if (!sourceImageUrl && !effectiveReferences) {
      throw new Error("Source-Image ist erforderlich fuer img2img");
    }
    if (strength !== undefined && (strength < 0 || strength > 1)) {
      throw new Error("Strength muss zwischen 0 und 1 liegen");
    }
  }

  // Edit mode validations
  const EDIT_MODES = ["inpaint", "erase", "instruction", "outpaint"];
  if (EDIT_MODES.includes(effectiveMode)) {
    if (!sourceImageUrl) {
      throw new Error("Source-Image ist erforderlich");
    }
  }

  // maskUrl required for inpaint/erase
  if ((effectiveMode === "inpaint" || effectiveMode === "erase") && !maskUrl) {
    throw new Error("Maske ist erforderlich fuer Inpaint/Erase");
  }

  // outpaint validations
  if (effectiveMode === "outpaint") {
    if (!outpaintDirections || outpaintDirections.length === 0) {
      throw new Error("Mindestens eine Richtung erforderlich");
    }
    const VALID_DIRECTIONS = ["top", "bottom", "left", "right"];
    for (const dir of outpaintDirections) {
      if (!VALID_DIRECTIONS.includes(dir)) {
        throw new Error("Mindestens eine Richtung erforderlich");
      }
    }
    const VALID_OUTPAINT_SIZES = [25, 50, 100];
    if (outpaintSize === undefined || !VALID_OUTPAINT_SIZES.includes(outpaintSize)) {
      throw new Error("Ungueltiger Erweiterungswert");
    }
  }

  // AC-3, AC-4: Megapixel validation for references before API call
  if (effectiveReferences) {
    const mpError = validateTotalMegapixels(effectiveReferences);
    if (mpError) {
      throw new Error(mpError);
    }
  }

  // Prompt is just the trimmed motiv (no style concatenation)
  const motivTrimmed = promptMotiv.trim();
  let prompt = motivTrimmed;

  // AC-6, AC-8: Apply composeMultiReferencePrompt when references exist
  if (effectiveReferences) {
    prompt = composeMultiReferencePrompt(prompt, effectiveReferences.map((r) => ({
      slotPosition: r.slotPosition,
      role: r.role as ReferenceRole,
      strength: r.strength as ReferenceStrength,
    })));
  }

  // For img2img: embed prompt_strength in stored modelParams so retry works
  // For edit modes: embed maskUrl, outpaintDirections, outpaintSize for retry/audit
  let storedParams: Record<string, unknown>;
  if (effectiveMode === "img2img") {
    storedParams = { ...params, prompt_strength: strength ?? 0.6 };
  } else if (EDIT_MODES.includes(effectiveMode)) {
    storedParams = {
      ...params,
      ...(maskUrl ? { maskUrl } : {}),
      ...(outpaintDirections ? { outpaintDirections } : {}),
      ...(outpaintSize !== undefined ? { outpaintSize } : {}),
    };
  } else {
    storedParams = params;
  }

  // Generate a shared batchId for all generations in this request
  const batchId = crypto.randomUUID();

  const isMultiModel = modelIds.length > 1;

  if (isMultiModel) {
    // --- Multi-model branch: 1 record per model, default params, sequential ---
    const pendingGenerations: Generation[] = [];
    for (const modelId of modelIds) {
      const gen = await createGeneration({
        projectId,
        prompt,
        modelId,
        modelParams: {},
        promptMotiv: motivTrimmed,
        generationMode: effectiveMode,
        sourceImageUrl: sourceImageUrl ?? null,
        sourceGenerationId: sourceGenerationId ?? null,
        batchId,
      });
      pendingGenerations.push(gen);
    }

    // Process sequentially to avoid Replicate rate limits.
    // Each generation is independent — failures don't abort the queue.
    (async () => {
      for (const gen of pendingGenerations) {
        try {
          await processGeneration(gen, effectiveReferences);
        } catch (err) {
          console.error(`Generation ${gen.id} unexpected error:`, err);
        }
      }
    })().catch(async (err) => {
      console.error("Unexpected error in multi-model generation batch:", err);
      for (const gen of pendingGenerations) {
        try {
          const current = await getGeneration(gen.id);
          if (current.status === "pending") {
            await updateGeneration(gen.id, {
              status: "failed",
              errorMessage: "Unerwarteter Server-Fehler bei der Verarbeitung",
            });
          }
        } catch { /* best effort */ }
      }
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
      modelId,
      modelParams: storedParams,
      promptMotiv: motivTrimmed,
      generationMode: effectiveMode,
      sourceImageUrl: sourceImageUrl ?? null,
      sourceGenerationId: sourceGenerationId ?? null,
      batchId,
    });
    pendingGenerations.push(gen);
  }

  // Process sequentially to respect Replicate rate limits.
  // Each generation is independent — failures don't abort the queue.
  (async () => {
    for (const gen of pendingGenerations) {
      try {
        await processGeneration(gen, effectiveReferences);
      } catch (err) {
        console.error(`Generation ${gen.id} unexpected error:`, err);
      }
    }
  })().catch(async (err) => {
    console.error("Unexpected error in generation batch:", err);
    for (const gen of pendingGenerations) {
      try {
        const current = await getGeneration(gen.id);
        if (current.status === "pending") {
          await updateGeneration(gen.id, {
            status: "failed",
            errorMessage: "Unerwarteter Server-Fehler bei der Verarbeitung",
          });
        }
      } catch { /* best effort */ }
    }
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
 * Upscale a single image using the provided model from settings.
 * Creates 1 pending Generation record with generationMode "upscale",
 * then processes it fire-and-forget.
 * Returns the pending generation immediately for optimistic UI.
 */
async function upscale(input: UpscaleInput): Promise<Generation> {
  const { projectId, sourceImageUrl, scale, sourceGenerationId, modelId, modelParams } = input;

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
    modelId,
    generationMode: "upscale",
    sourceImageUrl,
    sourceGenerationId: sourceGenerationId ?? null,
  });

  // Fire-and-forget: process the upscale asynchronously
  (async () => {
    const storageKey = `projects/${generation.projectId}/${generation.id}.png`;

    try {
      // Call Replicate with upscale-specific input (image + scale, no prompt)
      // Merge model-specific params from settings, with image/scale taking precedence
      const replicateInput: Record<string, unknown> = {
        ...modelParams,
        image: sourceImageUrl,
        scale,
      };
      const result = await ReplicateClient.run(modelId, replicateInput);

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
  })().catch(async (err) => {
    console.error("Unexpected error in upscale processing:", err);
    try {
      const current = await getGeneration(generation.id);
      if (current.status === "pending") {
        await updateGeneration(generation.id, {
          status: "failed",
          errorMessage: "Unerwarteter Server-Fehler beim Upscaling",
        });
      }
    } catch { /* best effort */ }
  });

  // Return the pending generation immediately
  return generation;
}

export const GenerationService = {
  generate,
  retry,
  upscale,
};
