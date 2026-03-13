import { eq, desc, sql, and, asc } from "drizzle-orm";
import { db } from "./index";
import { projects, generations, favoriteModels, projectSelectedModels, assistantSessions, referenceImages, generationReferences } from "./schema";

// ---------------------------------------------------------------------------
// Types (inferred from schema)
// ---------------------------------------------------------------------------
export type Project = typeof projects.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type AssistantSession = typeof assistantSessions.$inferSelect;
export type ReferenceImage = typeof referenceImages.$inferSelect;
export type GenerationReference = typeof generationReferences.$inferSelect;

// ---------------------------------------------------------------------------
// Project Queries
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
}): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({ name: input.name })
    .returning();
  return project;
}

export async function getProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(id: string): Promise<Project> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }
  return project;
}

export async function renameProject(
  id: string,
  name: string
): Promise<Project> {
  const [project] = await db
    .update(projects)
    .set({ name, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
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
  offset: number,
  limit: number
): Promise<PromptHistoryRow[]> {
  const rows = await db.execute(
    sql`
      SELECT * FROM (
        SELECT DISTINCT ON (prompt_motiv, prompt_style, negative_prompt, model_id)
          id,
          prompt_motiv AS "promptMotiv",
          prompt_style AS "promptStyle",
          negative_prompt AS "negativePrompt",
          model_id AS "modelId",
          model_params AS "modelParams",
          is_favorite AS "isFavorite",
          created_at AS "createdAt"
        FROM generations
        ORDER BY prompt_motiv, prompt_style, negative_prompt, model_id, created_at DESC
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
    .where(eq(generations.isFavorite, true))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as PromptHistoryRow[];
}

// ---------------------------------------------------------------------------
// Favorite Model Queries
// ---------------------------------------------------------------------------

export async function getFavoriteModelIds(): Promise<string[]> {
  const rows = await db
    .select({ modelId: favoriteModels.modelId })
    .from(favoriteModels)
    .orderBy(desc(favoriteModels.createdAt));
  return rows.map((r) => r.modelId);
}

export async function addFavoriteModel(modelId: string): Promise<void> {
  await db
    .insert(favoriteModels)
    .values({ modelId })
    .onConflictDoNothing();
}

export async function removeFavoriteModel(modelId: string): Promise<void> {
  await db.delete(favoriteModels).where(eq(favoriteModels.modelId, modelId));
}

// ---------------------------------------------------------------------------
// Project Selected Model Queries
// ---------------------------------------------------------------------------

export async function getProjectSelectedModelIds(
  projectId: string,
): Promise<string[]> {
  const rows = await db
    .select({ modelId: projectSelectedModels.modelId })
    .from(projectSelectedModels)
    .where(eq(projectSelectedModels.projectId, projectId))
    .orderBy(asc(projectSelectedModels.position));
  return rows.map((r) => r.modelId);
}

export async function saveProjectSelectedModelIds(
  projectId: string,
  modelIds: string[],
): Promise<void> {
  await db
    .delete(projectSelectedModels)
    .where(eq(projectSelectedModels.projectId, projectId));

  if (modelIds.length > 0) {
    await db.insert(projectSelectedModels).values(
      modelIds.map((modelId, i) => ({
        projectId,
        modelId,
        position: i,
      })),
    );
  }
}

/**
 * Toggles the isFavorite field on a generation and returns the new value.
 * Throws if the generation is not found.
 */
export async function toggleFavoriteQuery(
  generationId: string
): Promise<{ isFavorite: boolean }> {
  const [current] = await db
    .select({ isFavorite: generations.isFavorite })
    .from(generations)
    .where(eq(generations.id, generationId));

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
