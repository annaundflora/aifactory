"use server";

import { revalidatePath } from "next/cache";
import {
  createProject as createProjectQuery,
  getProjects as getProjectsQuery,
  getProject as getProjectQuery,
  renameProject as renameProjectQuery,
  deleteProject as deleteProjectQuery,
  updateProjectContext as updateProjectContextQuery,
  type Project,
} from "@/lib/db/queries";
import {
  generateForProject,
  refreshForProject,
} from "@/lib/services/thumbnail-service";
import { requireAuth } from "@/lib/auth/guard";

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
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const validation = validateProjectName(input.name);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const project = await createProjectQuery({ name: validation.trimmed, userId: auth.userId });
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
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    return await getProjectsQuery(auth.userId);
  } catch (err) {
    console.error("getProjects DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function getProject(input: {
  id: string;
}): Promise<Project | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    const project = await getProjectQuery(input.id, auth.userId);
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
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const validation = validateProjectName(input.name);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const project = await renameProjectQuery(input.id, validation.trimmed, auth.userId);
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
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    await deleteProjectQuery(input.id, auth.userId);
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    console.error("deleteProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

// ---------------------------------------------------------------------------
// Project Context Actions
// ---------------------------------------------------------------------------

/**
 * Server Action to update a project's context instructions.
 *
 * Validation order:
 *   1. requireAuth() — Unauthorized → { error: "Unauthorized" }
 *   2. Trim + normalize empty/whitespace-only to null (Clear-Pfad)
 *   3. Length check (> 8000 chars after trim) → length error
 *   4. Query helper (ownership-strict via Slice 02)
 *   5. Helper returns null → "Projekt nicht gefunden"
 *   6. revalidatePath('/projects/' + projectId) + return updated row
 */
export async function updateProjectContext(input: {
  projectId: string;
  contextInstructions: string | null;
}): Promise<
  | { contextInstructions: string | null; contextUpdatedAt: Date }
  | { error: string }
> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // Trim + normalize empty/whitespace-only to null (Clear-Pfad).
  // Per architecture.md (Validation Rules + DTO): leerer String / null = "kein
  // Context"; Whitespace-only wird ebenfalls als Clear behandelt (AC-8).
  const raw = input.contextInstructions;
  let normalized: string | null;
  if (raw === null) {
    normalized = null;
  } else {
    const trimmed = raw.trim();
    normalized = trimmed.length === 0 ? null : trimmed;
  }

  // Length-Check operates on String.prototype.length (post-trim).
  if (normalized !== null && normalized.length > 8000) {
    return { error: "Context exceeds maximum length of 8000 characters." };
  }

  let row: { contextInstructions: string | null; contextUpdatedAt: Date | null } | null;
  try {
    row = await updateProjectContextQuery({
      projectId: input.projectId,
      userId: auth.userId,
      contextInstructions: normalized,
    });
  } catch (err) {
    console.error("updateProjectContext DB error:", err);
    return { error: "Datenbankfehler" };
  }

  // Helper returned null → ownership mismatch or project does not exist.
  // Map to "Projekt nicht gefunden" to avoid existence-leakage (architecture.md
  // → 404 statt 403 für Ownership-Mismatch).
  if (row === null) {
    return { error: "Projekt nicht gefunden" };
  }

  revalidatePath("/projects/" + input.projectId);

  // Helper returns contextUpdatedAt as Date (Postgres `now()` via .returning()).
  // The DB column is non-null after a successful UPDATE; cast to satisfy the
  // discriminated-union signature.
  return {
    contextInstructions: row.contextInstructions,
    contextUpdatedAt: row.contextUpdatedAt as Date,
  };
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
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

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
    project = await getProjectQuery(projectId, auth.userId);
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
