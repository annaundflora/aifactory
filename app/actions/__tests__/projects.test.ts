import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Mocks (as per Mocking Strategy: mock_external)
// ---------------------------------------------------------------------------

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock lib/db/queries
vi.mock("@/lib/db/queries", () => ({
  createProject: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import {
  createProject,
  getProjects,
  getProject,
  renameProject,
  deleteProject,
} from "../projects";

import { revalidatePath } from "next/cache";
import {
  createProject as createProjectQuery,
  getProjects as getProjectsQuery,
  getProject as getProjectQuery,
  renameProject as renameProjectQuery,
  deleteProject as deleteProjectQuery,
} from "@/lib/db/queries";

// Cast mocks for type safety
const mockCreateProjectQuery = vi.mocked(createProjectQuery);
const mockGetProjectsQuery = vi.mocked(getProjectsQuery);
const mockGetProjectQuery = vi.mocked(getProjectQuery);
const mockRenameProjectQuery = vi.mocked(renameProjectQuery);
const mockDeleteProjectQuery = vi.mocked(deleteProjectQuery);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test Project",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProject", () => {
  it("AC-1: should return error when name is empty or whitespace-only", async () => {
    /**
     * AC-1: GIVEN ein leerer Projektname (leer oder nur Whitespace)
     * WHEN createProject({ name: "" }) aufgerufen wird
     * THEN wird ein Fehler-Objekt { error: "Projektname darf nicht leer sein" } zurueckgegeben,
     *      KEIN DB-Eintrag wird erstellt
     */
    const resultEmpty = await createProject({ name: "" });
    expect(resultEmpty).toEqual({ error: "Projektname darf nicht leer sein" });

    const resultWhitespace = await createProject({ name: "   " });
    expect(resultWhitespace).toEqual({
      error: "Projektname darf nicht leer sein",
    });

    // No DB call should have been made
    expect(mockCreateProjectQuery).not.toHaveBeenCalled();
  });

  it("AC-2: should return error when name exceeds 255 characters", async () => {
    /**
     * AC-2: GIVEN ein Projektname mit mehr als 255 Zeichen
     * WHEN createProject({ name: "A".repeat(256) }) aufgerufen wird
     * THEN wird ein Fehler-Objekt { error: "Projektname darf nicht leer sein" } zurueckgegeben
     */
    const result = await createProject({ name: "A".repeat(256) });
    expect(result).toEqual({ error: "Projektname darf nicht leer sein" });
    expect(mockCreateProjectQuery).not.toHaveBeenCalled();
  });

  it("AC-3: should trim name, call createProject query, and revalidate path /", async () => {
    /**
     * AC-3: GIVEN ein gueltiger Projektname "  My Project  " (mit Whitespace)
     * WHEN createProject({ name: "  My Project  " }) aufgerufen wird
     * THEN wird der Name auf "My Project" getrimmt, ein Projekt mit UUID, name, createdAt
     *      zurueckgegeben und der Pfad / wird revalidiert
     */
    const project = fakeProject({ name: "My Project" });
    mockCreateProjectQuery.mockResolvedValueOnce(project as any);

    const result = await createProject({ name: "  My Project  " });

    expect(mockCreateProjectQuery).toHaveBeenCalledWith({
      name: "My Project",
    });
    expect(result).toEqual({
      id: project.id,
      name: "My Project",
      createdAt: project.createdAt,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("getProjects", () => {
  it("AC-4: should return all projects from query function", async () => {
    /**
     * AC-4: GIVEN Projekte existieren in der DB
     * WHEN getProjects() aufgerufen wird
     * THEN wird ein Array aller Projekte zurueckgegeben, sortiert nach createdAt DESC
     */
    const projectList = [
      fakeProject({ id: "id-1", name: "Project 1", createdAt: new Date("2026-02-01") }),
      fakeProject({ id: "id-2", name: "Project 2", createdAt: new Date("2026-01-01") }),
    ];
    mockGetProjectsQuery.mockResolvedValueOnce(projectList as any);

    const result = await getProjects();

    expect(mockGetProjectsQuery).toHaveBeenCalledOnce();
    expect(result).toEqual(projectList);
  });
});

describe("getProject", () => {
  it("AC-5: should return project by ID", async () => {
    /**
     * AC-5: GIVEN ein Projekt mit bekannter ID existiert
     * WHEN getProject({ id: "<uuid>" }) aufgerufen wird
     * THEN wird das Projekt-Objekt mit allen Feldern zurueckgegeben
     */
    const project = fakeProject();
    mockGetProjectQuery.mockResolvedValueOnce(project as any);

    const result = await getProject({ id: project.id });

    expect(mockGetProjectQuery).toHaveBeenCalledWith(project.id);
    expect(result).toEqual(project);
  });

  it("AC-6: should return error when project not found", async () => {
    /**
     * AC-6: GIVEN eine nicht existierende ID
     * WHEN getProject({ id: "<invalid-uuid>" }) aufgerufen wird
     * THEN wird ein Fehler-Objekt { error: "Projekt nicht gefunden" } zurueckgegeben
     */
    mockGetProjectQuery.mockRejectedValueOnce(
      new Error("Project not found: invalid-id")
    );

    const result = await getProject({ id: "invalid-id" });

    expect(result).toEqual({ error: "Projekt nicht gefunden" });
  });
});

describe("renameProject", () => {
  it("AC-7: should rename project, trim name, and revalidate path /", async () => {
    /**
     * AC-7: GIVEN ein existierendes Projekt
     * WHEN renameProject({ id: "<uuid>", name: "New Name" }) aufgerufen wird
     * THEN wird der Name aktualisiert, updatedAt ist neuer als vorher,
     *      und der Pfad / wird revalidiert
     */
    const updatedProject = fakeProject({
      name: "New Name",
      updatedAt: new Date("2026-03-01T00:00:00Z"),
    });
    mockRenameProjectQuery.mockResolvedValueOnce(updatedProject as any);

    const result = await renameProject({
      id: updatedProject.id,
      name: "  New Name  ",
    });

    expect(mockRenameProjectQuery).toHaveBeenCalledWith(
      updatedProject.id,
      "New Name"
    );
    expect(result).toEqual(updatedProject);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("AC-8: should return error when new name is empty", async () => {
    /**
     * AC-8: GIVEN ein existierendes Projekt
     * WHEN renameProject({ id: "<uuid>", name: "" }) aufgerufen wird
     * THEN wird ein Fehler-Objekt { error: "Projektname darf nicht leer sein" } zurueckgegeben,
     *      Name bleibt unveraendert
     */
    const result = await renameProject({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "",
    });

    expect(result).toEqual({ error: "Projektname darf nicht leer sein" });
    expect(mockRenameProjectQuery).not.toHaveBeenCalled();
  });
});

describe("deleteProject", () => {
  it("AC-9: should delete project and revalidate path /", async () => {
    /**
     * AC-9: GIVEN ein existierendes Projekt
     * WHEN deleteProject({ id: "<uuid>" }) aufgerufen wird
     * THEN wird { success: true } zurueckgegeben, das Projekt und alle zugehoerigen
     *      Generations sind aus der DB entfernt, und der Pfad / wird revalidiert
     */
    mockDeleteProjectQuery.mockResolvedValueOnce(undefined);

    const result = await deleteProject({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(mockDeleteProjectQuery).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("Error Handling", () => {
  it("AC-10: should return error object and log when query throws", async () => {
    /**
     * AC-10: GIVEN eine DB-Operation schlaegt fehl (unerwarteter Fehler)
     * WHEN eine beliebige Server Action aufgerufen wird
     * THEN wird ein Fehler-Objekt { error: "Datenbankfehler" } zurueckgegeben
     *      und der Fehler wird geloggt
     */
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = new Error("connection refused");

    // Test createProject DB error
    mockCreateProjectQuery.mockRejectedValueOnce(dbError);
    const createResult = await createProject({ name: "Valid Name" });
    expect(createResult).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockClear();

    // Test getProjects DB error
    mockGetProjectsQuery.mockRejectedValueOnce(dbError);
    const listResult = await getProjects();
    expect(listResult).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockClear();

    // Test getProject DB error (non "not found")
    mockGetProjectQuery.mockRejectedValueOnce(dbError);
    const getResult = await getProject({ id: "some-id" });
    expect(getResult).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockClear();

    // Test renameProject DB error
    mockRenameProjectQuery.mockRejectedValueOnce(dbError);
    const renameResult = await renameProject({ id: "some-id", name: "New" });
    expect(renameResult).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockClear();

    // Test deleteProject DB error
    mockDeleteProjectQuery.mockRejectedValueOnce(dbError);
    const deleteResult = await deleteProject({ id: "some-id" });
    expect(deleteResult).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("Module Declaration", () => {
  it('AC-11: should have "use server" as first line', () => {
    /**
     * AC-11: GIVEN app/actions/projects.ts existiert
     * WHEN die Datei inspiziert wird
     * THEN beginnt sie mit "use server" als erste Zeile
     */
    const filePath = path.resolve(__dirname, "..", "projects.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();
    expect(firstLine).toBe('"use server";');
  });
});
