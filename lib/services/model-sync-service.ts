/**
 * ModelSyncService — Bulk sync orchestration from Replicate Collections API.
 *
 * Fetches 3 collections in parallel, deduplicates by replicate_id,
 * fetches schema per model (max 5 concurrent), runs resolveSchemaRefs +
 * detectCapabilities, upserts to DB, soft-deletes removed models, and
 * reports progress via callback.
 */

import { detectCapabilities, resolveSchemaRefs } from "@/lib/services/capability-detection";
import { getModelByReplicateId, upsertModel, deactivateModelsNotIn } from "@/lib/db/queries";
import type { SchemaProperties } from "@/lib/services/capability-detection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  synced: number;
  failed: number;
  new: number;
  updated: number;
}

export type ProgressCallback = (completed: number, total: number) => void;

/** Raw model data from the Replicate Collections API response. */
interface CollectionApiModel {
  owner: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  run_count: number | null;
  latest_version_id: string | null;
}

/** Deduplicated model with merged collection slugs. */
interface DeduplicatedModel {
  replicateId: string;
  owner: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  runCount: number | null;
  collections: string[];
  latestVersionId: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_SLUGS = ["text-to-image", "image-editing", "super-resolution"] as const;
const REPLICATE_API_BASE = "https://api.replicate.com/v1";
const MAX_CONCURRENT_SCHEMA_FETCHES = 5;
const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Concurrency Limiter (Queue-based slot system, max 5)
// ---------------------------------------------------------------------------

function createConcurrencyLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  function acquire(): Promise<void> {
    if (active < maxConcurrent) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active++;
        resolve();
      });
    });
  }

  function release(): void {
    active--;
    const next = queue.shift();
    if (next) next();
  }

  return { acquire, release };
}

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

function getApiToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN ist nicht gesetzt");
  }
  return token;
}

/**
 * Fetches a single Replicate collection and returns its models.
 * Returns an empty array on failure (partial success pattern).
 */
async function fetchCollection(
  slug: string,
  apiToken: string
): Promise<{ slug: string; models: CollectionApiModel[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${REPLICATE_API_BASE}/collections/${slug}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[ModelSyncService] Collection fetch failed for ${slug}: ${response.status} ${response.statusText}`
      );
      return { slug, models: [] };
    }

    const data = await response.json();
    const rawModels: Record<string, unknown>[] = Array.isArray(data?.models)
      ? data.models
      : [];

    const models: CollectionApiModel[] = rawModels.map((m) => ({
      owner: String(m.owner ?? ""),
      name: String(m.name ?? ""),
      description: m.description != null ? String(m.description) : null,
      cover_image_url: m.cover_image_url != null ? String(m.cover_image_url) : null,
      run_count: typeof m.run_count === "number" ? m.run_count : null,
      latest_version_id: extractLatestVersionId(m),
    }));

    return { slug, models };
  } catch (err) {
    console.error(`[ModelSyncService] Collection fetch error for ${slug}:`, err);
    return { slug, models: [] };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts latest_version.id from a raw model object in the collections API response.
 * The collections API may include a nested latest_version object.
 */
function extractLatestVersionId(m: Record<string, unknown>): string | null {
  const latestVersion = m.latest_version;
  if (latestVersion && typeof latestVersion === "object") {
    const id = (latestVersion as Record<string, unknown>).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return null;
}

/**
 * Fetches model detail from Replicate API to get schema + latest_version.id.
 * Returns null on failure (the model will be skipped).
 */
async function fetchModelDetail(
  owner: string,
  name: string,
  apiToken: string
): Promise<{
  versionHash: string | null;
  inputProperties: SchemaProperties | null;
  allSchemas: Record<string, Record<string, unknown>> | null;
} | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${REPLICATE_API_BASE}/models/${owner}/${name}`,
      {
        headers: { Authorization: `Bearer ${apiToken}` },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.error(
        `[ModelSyncService] Model detail fetch failed for ${owner}/${name}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    const versionHash: string | null =
      typeof data?.latest_version?.id === "string"
        ? data.latest_version.id
        : null;

    const inputProperties: SchemaProperties | null =
      data?.latest_version?.openapi_schema?.components?.schemas?.Input?.properties ?? null;

    const allSchemas: Record<string, Record<string, unknown>> | null =
      data?.latest_version?.openapi_schema?.components?.schemas ?? null;

    return { versionHash, inputProperties, allSchemas };
  } catch (err) {
    console.error(`[ModelSyncService] Model detail fetch error for ${owner}/${name}:`, err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicates models across collections by replicate_id (owner/name).
 * Merges collection slugs for models that appear in multiple collections.
 */
function deduplicateModels(
  collectionResults: { slug: string; models: CollectionApiModel[] }[]
): DeduplicatedModel[] {
  const modelMap = new Map<string, DeduplicatedModel>();

  for (const { slug, models } of collectionResults) {
    for (const model of models) {
      const replicateId = `${model.owner}/${model.name}`;
      const existing = modelMap.get(replicateId);

      if (existing) {
        // Merge: add this collection slug if not already present
        if (!existing.collections.includes(slug)) {
          existing.collections.push(slug);
        }
        // Update run_count if newer data has it
        if (model.run_count != null) {
          existing.runCount = model.run_count;
        }
        // Prefer non-null latest_version_id
        if (model.latest_version_id != null) {
          existing.latestVersionId = model.latest_version_id;
        }
      } else {
        modelMap.set(replicateId, {
          replicateId,
          owner: model.owner,
          name: model.name,
          description: model.description,
          coverImageUrl: model.cover_image_url,
          runCount: model.run_count,
          collections: [slug],
          latestVersionId: model.latest_version_id,
        });
      }
    }
  }

  return Array.from(modelMap.values());
}

// ---------------------------------------------------------------------------
// Sync Orchestration
// ---------------------------------------------------------------------------

/**
 * Processes a single model: checks delta-sync, fetches schema if needed,
 * detects capabilities, and upserts to DB.
 *
 * Returns an object indicating whether the model was new, updated, or skipped.
 */
async function processModel(
  model: DeduplicatedModel,
  apiToken: string,
  limiter: { acquire: () => Promise<void>; release: () => void }
): Promise<{ status: "new" | "updated" | "skipped"; failed: false } | { failed: true }> {
  try {
    // Check if model exists in DB for delta-sync
    const existingModel = await getModelByReplicateId(model.replicateId);

    // Delta-sync: if version_hash is unchanged, skip schema fetch entirely
    if (
      existingModel &&
      existingModel.versionHash &&
      model.latestVersionId &&
      existingModel.versionHash === model.latestVersionId
    ) {
      // Version unchanged - upsert to update collections/run_count/is_active
      // but keep existing schema and capabilities (no schema fetch needed)
      await upsertModel({
        replicateId: model.replicateId,
        owner: model.owner,
        name: model.name,
        description: model.description,
        coverImageUrl: model.coverImageUrl,
        runCount: model.runCount,
        collections: model.collections,
        capabilities: existingModel.capabilities as Record<string, boolean>,
        inputSchema: existingModel.inputSchema,
        versionHash: existingModel.versionHash,
      });
      return { status: "skipped", failed: false };
    }

    // Version changed or new model - fetch schema via model detail API
    await limiter.acquire();
    let detail: Awaited<ReturnType<typeof fetchModelDetail>>;
    try {
      detail = await fetchModelDetail(model.owner, model.name, apiToken);
    } finally {
      limiter.release();
    }

    if (!detail) {
      // Could not fetch model detail - skip
      return { failed: true };
    }

    // Process schema: resolve refs and detect capabilities
    let resolvedProperties: SchemaProperties | null = null;

    if (detail.inputProperties) {
      resolvedProperties = detail.allSchemas
        ? resolveSchemaRefs(detail.inputProperties, detail.allSchemas)
        : detail.inputProperties;
    }

    const capabilities = detectCapabilities(
      resolvedProperties ?? {},
      model.description,
      model.collections
    );

    await upsertModel({
      replicateId: model.replicateId,
      owner: model.owner,
      name: model.name,
      description: model.description,
      coverImageUrl: model.coverImageUrl,
      runCount: model.runCount,
      collections: model.collections,
      capabilities: { ...capabilities },
      inputSchema: resolvedProperties,
      versionHash: detail.versionHash,
    });

    const isNew = !existingModel;
    return { status: isNew ? "new" : "updated", failed: false };
  } catch (err) {
    console.error(`[ModelSyncService] Error processing ${model.replicateId}:`, err);
    return { failed: true };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs a full sync of all 3 Replicate collections.
 *
 * 1. Fetches 3 collections in parallel
 * 2. Deduplicates by replicate_id
 * 3. For each model (max 5 concurrent schema fetches):
 *    a. Delta-sync check (version_hash comparison)
 *    b. Fetch schema if changed (GET /v1/models/{owner}/{name})
 *    c. resolveSchemaRefs + detectCapabilities
 *    d. Upsert to DB
 * 4. Soft-delete models not in any collection
 * 5. Returns SyncResult
 */
async function syncAll(
  onProgress?: ProgressCallback
): Promise<SyncResult> {
  const apiToken = getApiToken();

  // Step 1: Fetch all 3 collections in parallel
  const collectionResults = await Promise.all(
    COLLECTION_SLUGS.map((slug) => fetchCollection(slug, apiToken))
  );

  // Step 2: Deduplicate by replicate_id
  const deduplicated = deduplicateModels(collectionResults);
  const total = deduplicated.length;

  // Step 3: Process each model with concurrency limit on schema fetches
  const limiter = createConcurrencyLimiter(MAX_CONCURRENT_SCHEMA_FETCHES);
  let completed = 0;
  let synced = 0;
  let failed = 0;
  let newCount = 0;
  let updatedCount = 0;

  // Process all models with controlled concurrency
  await Promise.all(
    deduplicated.map(async (model) => {
      const result = await processModel(model, apiToken, limiter);
      completed++;

      if (result.failed) {
        failed++;
      } else {
        synced++;
        const { status } = result;
        if (status === "new") {
          newCount++;
        } else if (status === "updated") {
          updatedCount++;
        }
      }

      if (onProgress) {
        onProgress(completed, total);
      }

      return result;
    })
  );

  // Step 4: Soft-delete models not in any collection
  const activeReplicateIds = deduplicated.map((m) => m.replicateId);
  await deactivateModelsNotIn(activeReplicateIds);

  // Step 5: Return result
  return {
    synced,
    failed,
    new: newCount,
    updated: updatedCount,
  };
}

export const ModelSyncService = {
  syncAll,
};
