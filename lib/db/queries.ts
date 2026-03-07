import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { projects, generations } from "./schema";

// ---------------------------------------------------------------------------
// Types (inferred from schema)
// ---------------------------------------------------------------------------
export type Project = typeof projects.$inferSelect;
export type Generation = typeof generations.$inferSelect;

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

export async function createGeneration(input: {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  modelParams?: Record<string, unknown>;
  promptMotiv?: string;
  promptStyle?: string;
}): Promise<Generation> {
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
