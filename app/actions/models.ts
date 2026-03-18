"use server";

import { requireAuth } from "@/lib/auth/guard";
import { ModelCatalogService, type Model } from "@/lib/services/model-catalog-service";
import { resolveSchemaRefs } from "@/lib/services/capability-detection";
import { VALID_GENERATION_MODES, type GenerationMode } from "@/lib/types";
import { db } from "@/lib/db";
import { models } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
const FETCH_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// getModels
// ---------------------------------------------------------------------------

export async function getModels(input: {
  capability?: GenerationMode;
}): Promise<Model[] | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { capability } = input;

  // If capability is provided, validate it
  if (capability !== undefined) {
    if (!VALID_GENERATION_MODES.includes(capability)) {
      return { error: "Ungueltige Capability" };
    }
    return ModelCatalogService.getByCapability(capability);
  }

  // No capability filter: return all active models
  return ModelCatalogService.getAll();
}

// ---------------------------------------------------------------------------
// getModelSchema
// ---------------------------------------------------------------------------

export async function getModelSchema(input: {
  modelId: string;
}): Promise<{ properties: Record<string, unknown> } | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { modelId } = input;

  // Validate modelId format
  if (!modelId || !MODEL_ID_REGEX.test(modelId)) {
    return { error: "Ungueltiges Model-ID-Format" };
  }

  try {
    // DB-first: try to read schema from database
    const dbSchema = await ModelCatalogService.getSchema(modelId);

    if (dbSchema !== null && dbSchema !== undefined) {
      // Schema exists in DB, return it directly
      return { properties: dbSchema as Record<string, unknown> };
    }

    // On-the-fly fallback: fetch from Replicate API
    const properties = await fetchSchemaFromReplicate(modelId);

    // Store in DB if the model exists (best effort, don't fail the action)
    try {
      await storeSchemaInDb(modelId, properties);
    } catch {
      // Non-critical: schema was fetched successfully, just couldn't persist
      console.error(`Failed to store schema in DB for ${modelId}`);
    }

    return { properties };
  } catch {
    return { error: "Schema konnte nicht geladen werden" };
  }
}

// ---------------------------------------------------------------------------
// triggerSync
// ---------------------------------------------------------------------------

export async function triggerSync(): Promise<
  { status: "started" } | { error: string }
> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Delegation: the actual sync happens via the Route Handler (POST /api/models/sync).
  // This server action simply signals that the client should start the sync stream.
  return { status: "started" };
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Fetches a model's schema from the Replicate API and resolves $ref-based enums.
 */
async function fetchSchemaFromReplicate(
  modelId: string
): Promise<Record<string, unknown>> {
  const [owner, name] = modelId.split("/");
  const apiToken = process.env.REPLICATE_API_TOKEN;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error("Schema konnte nicht geladen werden");
    }

    const data = await response.json();

    const properties: Record<string, unknown> | undefined =
      data?.latest_version?.openapi_schema?.components?.schemas?.Input
        ?.properties;

    if (!properties) {
      throw new Error("Schema konnte nicht geladen werden");
    }

    // Resolve $ref-based enums
    const allSchemas =
      data?.latest_version?.openapi_schema?.components?.schemas as
        | Record<string, Record<string, unknown>>
        | undefined;

    if (allSchemas) {
      return resolveSchemaRefs(properties, allSchemas);
    }

    return properties;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Stores a fetched schema in the DB for the given model.
 * Updates the input_schema column if the model exists; otherwise does nothing.
 */
async function storeSchemaInDb(
  modelId: string,
  schema: Record<string, unknown>
): Promise<void> {
  await db
    .update(models)
    .set({
      inputSchema: schema,
      updatedAt: new Date(),
    })
    .where(eq(models.replicateId, modelId));
}
