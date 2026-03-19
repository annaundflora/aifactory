import { eq, desc, sql, and, asc, or, notInArray } from "drizzle-orm";
import { db } from "./index";
import { projects, generations, assistantSessions, referenceImages, generationReferences, modelSettings, models } from "./schema";

// ---------------------------------------------------------------------------
// Types (inferred from schema)
// ---------------------------------------------------------------------------
export type Project = typeof projects.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type AssistantSession = typeof assistantSessions.$inferSelect;
export type ReferenceImage = typeof referenceImages.$inferSelect;
export type GenerationReference = typeof generationReferences.$inferSelect;
export type ModelSetting = typeof modelSettings.$inferSelect;
export type Model = typeof models.$inferSelect;

// ---------------------------------------------------------------------------
// Project Queries
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
  userId: string;
}): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({ name: input.name, userId: input.userId })
    .returning();
  return project;
}

export async function getProjects(userId: string): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function getProject(id: string, userId: string): Promise<Project> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }
  return project;
}

export async function renameProject(
  id: string,
  name: string,
  userId: string
): Promise<Project> {
  const [project] = await db
    .update(projects)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .returning();
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }
  return project;
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

// ---------------------------------------------------------------------------
// Generation Queries
// ---------------------------------------------------------------------------

export interface CreateGenerationInput {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  modelParams?: Record<string, unknown>;
  promptMotiv?: string;
  promptStyle?: string;
  generationMode?: string;
  sourceImageUrl?: string | null;
  sourceGenerationId?: string | null;
  batchId?: string;
}

export async function createGeneration(input: CreateGenerationInput): Promise<Generation> {
  const [generation] = await db
    .insert(generations)
    .values({
      projectId: input.projectId,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? null,
      modelId: input.modelId,
      modelParams: input.modelParams ?? {},
      promptMotiv: input.promptMotiv ?? '',
      promptStyle: input.promptStyle ?? '',
      generationMode: input.generationMode ?? 'txt2img',
      sourceImageUrl: input.sourceImageUrl ?? null,
      sourceGenerationId: input.sourceGenerationId ?? null,
      batchId: input.batchId ?? null,
    })
    .returning();
  return generation;
}

export async function getGeneration(id: string): Promise<Generation> {
  const [generation] = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id));
  if (!generation) {
    throw new Error(`Generation nicht gefunden: ${id}`);
  }
  return generation;
}

export async function getGenerations(
  projectId: string
): Promise<Generation[]> {
  return db
    .select()
    .from(generations)
    .where(eq(generations.projectId, projectId))
    .orderBy(desc(generations.createdAt));
}

export async function updateGeneration(
  id: string,
  data: Partial<Omit<Generation, "id" | "createdAt">>
): Promise<Generation> {
  const [generation] = await db
    .update(generations)
    .set(data)
    .where(eq(generations.id, id))
    .returning();
  if (!generation) {
    throw new Error(`Generation not found: ${id}`);
  }
  return generation;
}

export async function deleteGeneration(id: string): Promise<void> {
  await db.delete(generations).where(eq(generations.id, id));
}

/**
 * Returns all completed sibling generations for a given batchId,
 * sorted by createdAt ASC.
 *
 * Returns an empty array when batchId is null (no matching on NULL values).
 */
export async function getSiblingsByBatchId(
  batchId: string | null
): Promise<Generation[]> {
  if (batchId === null) {
    return [];
  }

  return db
    .select()
    .from(generations)
    .where(
      and(
        eq(generations.batchId, batchId),
        eq(generations.status, "completed")
      )
    )
    .orderBy(asc(generations.createdAt));
}

/**
 * Returns the "variant family" for a generation: source + all direct variants.
 *
 * Logic:
 * - familyRootId = sourceGenerationId ?? currentGenerationId
 * - Finds: the root itself + all variants pointing to the root + batch siblings
 * - Only completed generations, sorted by createdAt ASC.
 */
export async function getVariantFamily(
  batchId: string | null,
  sourceGenerationId: string | null,
  currentGenerationId: string
): Promise<Generation[]> {
  const familyRootId = sourceGenerationId ?? currentGenerationId;

  const conditions = [];

  // Batch siblings (for txt2img N>1)
  if (batchId) {
    conditions.push(eq(generations.batchId, batchId));
  }

  // The family root (source image) itself
  conditions.push(eq(generations.id, familyRootId));

  // All direct variants of the family root
  conditions.push(eq(generations.sourceGenerationId, familyRootId));

  return db
    .select()
    .from(generations)
    .where(
      and(
        or(...conditions),
        eq(generations.status, "completed")
      )
    )
    .orderBy(asc(generations.createdAt));
}

// ---------------------------------------------------------------------------
// Thumbnail Queries (Slice 16)
// ---------------------------------------------------------------------------

/**
 * Updates a project's thumbnail URL and status.
 * Returns the updated Project record.
 * Throws if the project is not found.
 */
export async function updateProjectThumbnail(input: {
  projectId: string;
  thumbnailUrl: string | null;
  thumbnailStatus: string;
}): Promise<Project> {
  const [project] = await db
    .update(projects)
    .set({
      thumbnailUrl: input.thumbnailUrl,
      thumbnailStatus: input.thumbnailStatus,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, input.projectId))
    .returning();
  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }
  return project;
}

// ---------------------------------------------------------------------------
// Prompt History Queries (Slice 11)
// ---------------------------------------------------------------------------

export type PromptHistoryRow = {
  id: string;
  promptMotiv: string;
  promptStyle: string | null;
  negativePrompt: string | null;
  modelId: string;
  modelParams: unknown;
  isFavorite: boolean;
  createdAt: Date;
};

/**
 * Returns DISTINCT prompt combinations ordered by newest first.
 * Uses raw SQL for DISTINCT ON since Drizzle ORM does not natively support it.
 */
export async function getPromptHistoryQuery(
  userId: string,
  offset: number,
  limit: number
): Promise<PromptHistoryRow[]> {
  const rows = await db.execute(
    sql`
      SELECT * FROM (
        SELECT DISTINCT ON (g.prompt_motiv, g.prompt_style, g.negative_prompt, g.model_id)
          g.id,
          g.prompt_motiv AS "promptMotiv",
          g.prompt_style AS "promptStyle",
          g.negative_prompt AS "negativePrompt",
          g.model_id AS "modelId",
          g.model_params AS "modelParams",
          g.is_favorite AS "isFavorite",
          g.created_at AS "createdAt"
        FROM generations g
        INNER JOIN projects p ON g.project_id = p.id
        WHERE p.user_id = ${userId}
        ORDER BY g.prompt_motiv, g.prompt_style, g.negative_prompt, g.model_id, g.created_at DESC
      ) sub
      ORDER BY sub."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `
  );
  return rows as unknown as PromptHistoryRow[];
}

/**
 * Returns generations marked as favorite, ordered by newest first.
 */
export async function getFavoritesQuery(
  userId: string,
  offset: number,
  limit: number
): Promise<PromptHistoryRow[]> {
  const rows = await db
    .select({
      id: generations.id,
      promptMotiv: generations.promptMotiv,
      promptStyle: generations.promptStyle,
      negativePrompt: generations.negativePrompt,
      modelId: generations.modelId,
      modelParams: generations.modelParams,
      isFavorite: generations.isFavorite,
      createdAt: generations.createdAt,
    })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(and(eq(generations.isFavorite, true), eq(projects.userId, userId)))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as PromptHistoryRow[];
}

/**
 * Toggles the isFavorite field on a generation and returns the new value.
 * Throws if the generation is not found.
 */
export async function toggleFavoriteQuery(
  userId: string,
  generationId: string
): Promise<{ isFavorite: boolean }> {
  const [current] = await db
    .select({ isFavorite: generations.isFavorite })
    .from(generations)
    .innerJoin(projects, eq(generations.projectId, projects.id))
    .where(and(eq(generations.id, generationId), eq(projects.userId, userId)));

  if (!current) {
    throw new Error("Generation not found");
  }

  const newValue = !current.isFavorite;

  const [updated] = await db
    .update(generations)
    .set({ isFavorite: newValue })
    .where(eq(generations.id, generationId))
    .returning({ isFavorite: generations.isFavorite });

  if (!updated) {
    throw new Error("Generation not found");
  }

  return { isFavorite: updated.isFavorite };
}

// ---------------------------------------------------------------------------
// Assistant Session Queries
// ---------------------------------------------------------------------------

/**
 * Returns all sessions for a project, sorted by last_message_at DESC.
 */
export async function getSessionsByProject(
  projectId: string
): Promise<AssistantSession[]> {
  return db
    .select()
    .from(assistantSessions)
    .where(eq(assistantSessions.projectId, projectId))
    .orderBy(desc(assistantSessions.lastMessageAt));
}

/**
 * Returns a single session by id.
 * Throws if the session is not found.
 */
export async function getSessionById(
  id: string
): Promise<AssistantSession> {
  const [session] = await db
    .select()
    .from(assistantSessions)
    .where(eq(assistantSessions.id, id));
  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Reference Image Queries
// ---------------------------------------------------------------------------

export async function createReferenceImage(input: {
  projectId: string;
  imageUrl: string;
  originalFilename?: string;
  width?: number;
  height?: number;
  sourceType: string;
  sourceGenerationId?: string;
}): Promise<ReferenceImage> {
  const [referenceImage] = await db
    .insert(referenceImages)
    .values({
      projectId: input.projectId,
      imageUrl: input.imageUrl,
      originalFilename: input.originalFilename ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      sourceType: input.sourceType,
      sourceGenerationId: input.sourceGenerationId ?? null,
    })
    .returning();
  return referenceImage;
}

export async function deleteReferenceImage(id: string): Promise<void> {
  await db.delete(referenceImages).where(eq(referenceImages.id, id));
}

export async function getReferenceImagesByProject(
  projectId: string
): Promise<ReferenceImage[]> {
  return db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.projectId, projectId))
    .orderBy(asc(referenceImages.createdAt));
}

// ---------------------------------------------------------------------------
// Generation Reference Queries
// ---------------------------------------------------------------------------

export async function createGenerationReferences(
  refs: {
    generationId: string;
    referenceImageId: string;
    role: string;
    strength: string;
    slotPosition: number;
  }[]
): Promise<GenerationReference[]> {
  return db
    .insert(generationReferences)
    .values(refs)
    .returning();
}

export async function getGenerationReferences(
  generationId: string
): Promise<GenerationReference[]> {
  return db
    .select()
    .from(generationReferences)
    .where(eq(generationReferences.generationId, generationId))
    .orderBy(asc(generationReferences.slotPosition));
}

// ---------------------------------------------------------------------------
// Model Settings Queries
// ---------------------------------------------------------------------------

/**
 * Returns all model settings rows.
 */
export async function getAllModelSettings(): Promise<ModelSetting[]> {
  return db.select().from(modelSettings);
}

/**
 * Returns the model setting for a given mode+tier combination,
 * or undefined if no match exists.
 */
export async function getModelSettingByModeTier(
  mode: string,
  tier: string
): Promise<ModelSetting | undefined> {
  const [row] = await db
    .select()
    .from(modelSettings)
    .where(and(eq(modelSettings.mode, mode), eq(modelSettings.tier, tier)));
  return row;
}

/**
 * Inserts or updates a model setting for the given mode+tier combination.
 * Uses ON CONFLICT DO UPDATE on the (mode, tier) unique constraint.
 */
export async function upsertModelSetting(
  mode: string,
  tier: string,
  modelId: string,
  modelParams: Record<string, unknown>
): Promise<ModelSetting> {
  const [row] = await db
    .insert(modelSettings)
    .values({
      mode,
      tier,
      modelId,
      modelParams,
    })
    .onConflictDoUpdate({
      target: [modelSettings.mode, modelSettings.tier],
      set: {
        modelId,
        modelParams,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/**
 * Seeds the 9 default model settings rows.
 * Uses ON CONFLICT DO NOTHING for idempotency — existing rows are not overwritten.
 *
 * Rows: txt2img(3) + img2img(2) + upscale(2) + inpaint(1) + outpaint(1) = 9
 */
export async function seedModelSettingsDefaults(): Promise<void> {
  const defaults = [
    { mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: {} },
    { mode: "txt2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: {} },
    { mode: "txt2img", tier: "max", modelId: "black-forest-labs/flux-2-max", modelParams: {} },
    { mode: "img2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { prompt_strength: 0.6 } },
    { mode: "img2img", tier: "quality", modelId: "black-forest-labs/flux-2-pro", modelParams: { prompt_strength: 0.6 } },
    { mode: "img2img", tier: "max", modelId: "black-forest-labs/flux-2-max", modelParams: { prompt_strength: 0.6 } },
    { mode: "upscale", tier: "draft", modelId: "philz1337x/crystal-upscaler", modelParams: { scale: 4 } },
    { mode: "upscale", tier: "quality", modelId: "nightmareai/real-esrgan", modelParams: { scale: 2 } },
    { mode: "inpaint", tier: "quality", modelId: "", modelParams: {} },
    { mode: "outpaint", tier: "quality", modelId: "", modelParams: {} },
  ];

  await db
    .insert(modelSettings)
    .values(defaults)
    .onConflictDoNothing({
      target: [modelSettings.mode, modelSettings.tier],
    });
}

// ---------------------------------------------------------------------------
// Model Queries (Catalog Reads)
// ---------------------------------------------------------------------------

/**
 * Returns all active models (is_active = true).
 */
export async function getActiveModels(): Promise<Model[]> {
  return db
    .select()
    .from(models)
    .where(eq(models.isActive, true));
}

/**
 * Returns active models that have a specific capability set to true.
 * Uses JSONB `capabilities->>'capability' = 'true'` filter.
 */
export async function getModelsByCapability(capability: string): Promise<Model[]> {
  return db
    .select()
    .from(models)
    .where(
      and(
        eq(models.isActive, true),
        sql`${models.capabilities}->>${capability} = 'true'`
      )
    );
}

/**
 * Returns a single active model by its replicate_id (owner/name format),
 * or null if not found or inactive.
 */
export async function getModelByReplicateId(replicateId: string): Promise<Model | null> {
  const [model] = await db
    .select()
    .from(models)
    .where(
      and(
        eq(models.replicateId, replicateId),
        eq(models.isActive, true)
      )
    );
  return model ?? null;
}

/**
 * Returns the input_schema JSONB for the model with the given replicate_id,
 * or null if the model is not found, is inactive, or has no schema.
 */
export async function getModelSchema(replicateId: string): Promise<unknown | null> {
  const [row] = await db
    .select({ inputSchema: models.inputSchema })
    .from(models)
    .where(
      and(
        eq(models.replicateId, replicateId),
        eq(models.isActive, true)
      )
    );
  return row?.inputSchema ?? null;
}

// ---------------------------------------------------------------------------
// Model Write Queries (Sync Service)
// ---------------------------------------------------------------------------

/**
 * Data shape for upserting a model into the `models` table.
 * Uses Drizzle `onConflictDoUpdate` on the `replicate_id` unique index.
 */
export interface ModelUpsertData {
  replicateId: string;
  owner: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  runCount: number | null;
  collections: string[] | null;
  capabilities: { [key: string]: boolean };
  inputSchema: unknown | null;
  versionHash: string | null;
}

/**
 * Inserts a new model or updates an existing one based on `replicate_id`.
 * On conflict (existing `replicate_id`), all fields are updated and
 * `updated_at` is set to the current time.
 */
export async function upsertModel(data: ModelUpsertData): Promise<void> {
  await db
    .insert(models)
    .values({
      replicateId: data.replicateId,
      owner: data.owner,
      name: data.name,
      description: data.description,
      coverImageUrl: data.coverImageUrl,
      runCount: data.runCount,
      collections: data.collections,
      capabilities: data.capabilities,
      inputSchema: data.inputSchema,
      versionHash: data.versionHash,
      isActive: true,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [models.replicateId],
      set: {
        owner: data.owner,
        name: data.name,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        runCount: data.runCount,
        collections: data.collections,
        capabilities: data.capabilities,
        inputSchema: data.inputSchema,
        versionHash: data.versionHash,
        isActive: true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

/**
 * Soft-deletes models whose `replicate_id` is NOT in the provided list.
 * Sets `is_active = false` for those models.
 * Only affects currently active models.
 */
export async function deactivateModelsNotIn(activeReplicateIds: string[]): Promise<void> {
  if (activeReplicateIds.length === 0) {
    // If no active IDs provided, deactivate all active models
    await db
      .update(models)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(models.isActive, true));
    return;
  }

  await db
    .update(models)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(models.isActive, true),
        notInArray(models.replicateId, activeReplicateIds)
      )
    );
}
