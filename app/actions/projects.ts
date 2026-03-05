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
    revalidatePath("/");
    return { id: project.id, name: project.name, createdAt: project.createdAt };
  } catch (err) {
    console.error("createProject DB error:", err);
    return { error: "Datenbankfehler" };
  }
}

export async function getProjects(): Promise<Project[]> {
  try {
    return await getProjectsQuery();
  } catch (err) {
    console.error("getProjects DB error:", err);
    return [];
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
