"use server";

import { revalidatePath } from "next/cache";
import {
  createProject as createProjectQuery,
  getProjects as getProjectsQuery,
  getProject as getProjectQuery,
  renameProject as renameProjectQuery,
  deleteProject as deleteProjectQuery,
  type Project,
} from "@/lib/db/queries";
import {
  generateForProject,
  refreshForProject,
} from "@/lib/services/thumbnail-service";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateProjectName(
  name: string
): { valid: true; trimmed: string } | { valid: false; error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 255) {
    return { valid: false, error: "Projektname darf nicht leer sein" };
  }
  return { valid: true, trimmed };
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
}): Promise<{ id: string; name: string; createdAt: Date } | { error: string }> {
  const validation = validateProjectName(input.name);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const project = await createProjectQuery({ name: validation.trimmed });
    // AC-7: Fire-and-forget thumbnail generation — do NOT await
    generateForProject(project.id).catch(console.error);
    revalidatePath("/");
    return { id: project.id, name: project.name, createdAt: project.createdAt };
  } catch (err) {
    console.error("createProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function getProjects(): Promise<Project[] | { error: string }> {
  try {
    return await getProjectsQuery();
  } catch (err) {
    console.error("getProjects DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function getProject(input: {
  id: string;
}): Promise<Project | { error: string }> {
  try {
    const project = await getProjectQuery(input.id);
    return project;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return { error: "Projekt nicht gefunden" };
    }
    console.error("getProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function renameProject(input: {
  id: string;
  name: string;
}): Promise<Project | { error: string }> {
  const validation = validateProjectName(input.name);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const project = await renameProjectQuery(input.id, validation.trimmed);
    revalidatePath("/");
    return project;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return { error: "Projekt nicht gefunden" };
    }
    console.error("renameProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function deleteProject(input: {
  id: string;
}): Promise<{ success: boolean } | { error: string }> {
  try {
    await deleteProjectQuery(input.id);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("deleteProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

// ---------------------------------------------------------------------------
// Thumbnail Actions (Slice 16)
// ---------------------------------------------------------------------------

/**
 * Trigger thumbnail generation/refresh for a project (fire-and-forget).
 * Validates projectId, starts refreshForProject without awaiting, revalidates
 * the root path, and returns the current project record.
 *
 * AC-9: happy path
 * AC-10: returns { error } for invalid/empty projectId
 */
export async function generateThumbnail(input: {
  projectId: string;
}): Promise<Project | { error: string }> {
  const projectId = input.projectId?.trim();

  // AC-10: Validate projectId — must be a non-empty UUID
  if (!projectId) {
    return { error: "projectId darf nicht leer sein" };
  }
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(projectId)) {
    return { error: "projectId ist keine gueltige UUID" };
  }

  let project: Project;
  try {
    project = await getProjectQuery(projectId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return { error: "Projekt nicht gefunden" };
    }
    console.error("generateThumbnail getProject error:", err);
    return { error: "Datenbankfehler" };
  }

  // AC-9: Fire-and-forget — do NOT await refreshForProject
  refreshForProject(projectId).catch((err) => {
    console.error(`generateThumbnail refreshForProject(${projectId}) error:`, err);
  });

  // AC-9: Revalidate root path so updated thumbnail_status is reflected
  revalidatePath("/");

  return project;
}
