import { eq, desc } from "drizzle-orm";
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
}): Promise<Generation> {
  const [generation] = await db
    .insert(generations)
    .values({
      projectId: input.projectId,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? null,
      modelId: input.modelId,
      modelParams: input.modelParams ?? {},
    })
    .returning();
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
