import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Mocks (as per Mocking Strategy: mock_external)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

vi.mock("@/lib/services/thumbnail-service", () => ({
  generateForProject: vi.fn().mockResolvedValue(undefined),
  refreshForProject: vi.fn().mockResolvedValue(undefined),
}));

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
  updateProjectContext: vi.fn(),
}));

import {
  createProject,
  getProjects,
  getProject,
  renameProject,
  deleteProject,
  updateProjectContext,
} from "../projects";

import { revalidatePath } from "next/cache";
import {
  createProject as createProjectQuery,
  getProjects as getProjectsQuery,
  getProject as getProjectQuery,
  renameProject as renameProjectQuery,
  deleteProject as deleteProjectQuery,
  updateProjectContext as updateProjectContextQuery,
} from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth/guard";

// Cast mocks for type safety
const mockCreateProjectQuery = vi.mocked(createProjectQuery);
const mockGetProjectsQuery = vi.mocked(getProjectsQuery);
const mockGetProjectQuery = vi.mocked(getProjectQuery);
const mockRenameProjectQuery = vi.mocked(renameProjectQuery);
const mockDeleteProjectQuery = vi.mocked(deleteProjectQuery);
const mockUpdateProjectContextQuery = vi.mocked(updateProjectContextQuery);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockRequireAuth = vi.mocked(requireAuth);

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
      userId: "user-001",
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

    expect(mockGetProjectQuery).toHaveBeenCalledWith(project.id, "user-001");
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
      "New Name",
      "user-001"
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
      "550e8400-e29b-41d4-a716-446655440000",
      "user-001"
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

describe("updateProjectContext (Slice 04)", () => {
  const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

  it("AC-1: returns updated row and revalidates project path on success (Happy-Path)", async () => {
    /**
     * AC-1: GIVEN ein angemeldeter User besitzt das Projekt projectId UND
     *       contextInstructions ist ein String mit <= 8000 Zeichen (post-trim)
     * WHEN updateProjectContext({ projectId, contextInstructions }) aufgerufen wird
     * THEN die Action ruft requireAuth() zuerst, dann den Query-Helper
     *      updateProjectContext({ projectId, userId, contextInstructions }) aus Slice 02
     *      mit dem getrimmten Wert; gibt { contextInstructions: string | null,
     *      contextUpdatedAt: Date } zurueck; ruft revalidatePath('/projects/' + projectId) einmal auf.
     */
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: "Use TypeScript best practices.",
      contextUpdatedAt: updatedAt,
    });

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "  Use TypeScript best practices.  ",
    });

    // Verify auth was called first
    expect(mockRequireAuth).toHaveBeenCalled();

    // Verify helper was called with object pattern + trimmed value
    expect(mockUpdateProjectContextQuery).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectContextQuery).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      userId: "user-001",
      contextInstructions: "Use TypeScript best practices.",
    });

    // Verify return shape
    expect(result).toEqual({
      contextInstructions: "Use TypeScript best practices.",
      contextUpdatedAt: updatedAt,
    });

    // Verify revalidatePath called exactly once with the project path
    expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/" + PROJECT_ID);
  });

  it("AC-2: returns { error: 'Unauthorized' } when requireAuth fails", async () => {
    /**
     * AC-2: GIVEN kein gueltiges Auth-Cookie (Session fehlt / abgelaufen)
     * WHEN updateProjectContext({ projectId, contextInstructions }) aufgerufen wird
     * THEN die Action gibt { error: "Unauthorized" } zurueck (durchgereicht von requireAuth());
     *      KEIN Aufruf des Query-Helpers, KEIN revalidatePath.
     */
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" } as any);

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "Some context",
    });

    expect(result).toEqual({ error: "Unauthorized" });
    expect(mockUpdateProjectContextQuery).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-3: returns length error when contextInstructions exceeds 8000 chars after trim", async () => {
    /**
     * AC-3: GIVEN ein angemeldeter User UND contextInstructions ist nach Trim laenger als 8000 Zeichen
     * WHEN updateProjectContext aufgerufen wird
     * THEN die Action gibt { error: "Context exceeds maximum length of 8000 characters." }
     *      zurueck (exakter Wortlaut); KEIN Helper-Call, KEIN revalidatePath.
     */
    const tooLong = "a".repeat(8001);

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: tooLong,
    });

    expect(result).toEqual({
      error: "Context exceeds maximum length of 8000 characters.",
    });
    expect(mockUpdateProjectContextQuery).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-3 boundary: accepts exactly 8000 chars (post-trim) without length error", async () => {
    /**
     * AC-3 Boundary: GIVEN contextInstructions ist nach Trim genau 8000 Zeichen
     * THEN KEIN Length-Error; Helper wird mit dem 8000-char-String aufgerufen.
     * Verifiziert die "<= 8000" Grenze aus AC-1 (post-trim).
     */
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    const exactly8000 = "a".repeat(8000);

    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: exactly8000,
      contextUpdatedAt: updatedAt,
    });

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: exactly8000,
    });

    expect(mockUpdateProjectContextQuery).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      userId: "user-001",
      contextInstructions: exactly8000,
    });
    expect(result).toEqual({
      contextInstructions: exactly8000,
      contextUpdatedAt: updatedAt,
    });
  });

  it("AC-3 trim wins: 8001-char string with surrounding whitespace becomes 8001 → length error", async () => {
    /**
     * AC-3 Combined: GIVEN ein 8001-Char-String mit Whitespace innen ist nach Trim immer noch
     *                > 8000 Zeichen → Length-Error.
     * Stellt sicher, dass Length-Check NACH Trim erfolgt.
     */
    const tooLongWithWs = "  " + "a".repeat(8001) + "  ";

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: tooLongWithWs,
    });

    expect(result).toEqual({
      error: "Context exceeds maximum length of 8000 characters.",
    });
    expect(mockUpdateProjectContextQuery).not.toHaveBeenCalled();
  });

  it("AC-4 (null): normalizes null to null when calling query helper (Clear-Pfad)", async () => {
    /**
     * AC-4: GIVEN contextInstructions === null (Clear-Pfad)
     * WHEN updateProjectContext aufgerufen wird
     * THEN die Action ruft den Query-Helper mit contextInstructions: null auf;
     *      gibt { contextInstructions: null, contextUpdatedAt: Date } zurueck;
     *      revalidatePath wird aufgerufen.
     */
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: null,
    });

    expect(mockUpdateProjectContextQuery).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      userId: "user-001",
      contextInstructions: null,
    });
    expect(result).toEqual({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/" + PROJECT_ID);
  });

  it("AC-4 (empty string): normalizes empty string to null when calling query helper (Clear-Pfad)", async () => {
    /**
     * AC-4: GIVEN contextInstructions === "" (Clear-Pfad)
     * WHEN updateProjectContext aufgerufen wird
     * THEN die Action normalisiert leeren String zu null und ruft den Query-Helper
     *      mit contextInstructions: null auf.
     */
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "",
    });

    expect(mockUpdateProjectContextQuery).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      userId: "user-001",
      contextInstructions: null,
    });
    expect(result).toEqual({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/" + PROJECT_ID);
  });

  it("AC-5: returns 'Projekt nicht gefunden' when query helper returns null", async () => {
    /**
     * AC-5: GIVEN Auth ist erfolgreich, aber Query-Helper liefert null
     *       (Ownership-Mismatch oder Projekt existiert nicht)
     * WHEN updateProjectContext aufgerufen wird
     * THEN die Action gibt { error: "Projekt nicht gefunden" } zurueck (404 statt 403,
     *      um Existenz-Leakage zu vermeiden); KEIN revalidatePath.
     */
    mockUpdateProjectContextQuery.mockResolvedValueOnce(null);

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "Some context",
    });

    expect(result).toEqual({ error: "Projekt nicht gefunden" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-6: returns 'Datenbankfehler' and logs when query helper throws", async () => {
    /**
     * AC-6: GIVEN der Query-Helper wirft eine unerwartete DB-Exception
     * WHEN updateProjectContext aufgerufen wird
     * THEN die Action gibt { error: "Datenbankfehler" } zurueck;
     *      Exception wird per console.error("updateProjectContext DB error:", err) geloggt;
     *      KEIN revalidatePath.
     */
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = new Error("connection refused");

    mockUpdateProjectContextQuery.mockRejectedValueOnce(dbError);

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "Some context",
    });

    expect(result).toEqual({ error: "Datenbankfehler" });
    expect(consoleSpy).toHaveBeenCalledWith(
      "updateProjectContext DB error:",
      dbError
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("AC-7: signature matches expected discriminated-union shape (compile-time check)", async () => {
    /**
     * AC-7: GIVEN der Caller kompiliert TypeScript
     * WHEN die neue Action aus app/actions/projects.ts importiert wird
     * THEN die Signatur lautet exakt:
     *   updateProjectContext(input: { projectId: string; contextInstructions: string | null })
     *     : Promise<{ contextInstructions: string | null; contextUpdatedAt: Date } | { error: string }>
     *
     * Verifiziert via Type-Assertion: Wenn die Signatur abweicht, schlaegt
     * `pnpm tsc --noEmit` fehl (nicht der Test selbst).
     */
    // Compile-time type assertion: input shape
    type Input = Parameters<typeof updateProjectContext>[0];
    type ExpectedInput = { projectId: string; contextInstructions: string | null };

    // Compile-time type assertion: return shape (discriminated union)
    type ReturnT = Awaited<ReturnType<typeof updateProjectContext>>;
    type ExpectedReturn =
      | { contextInstructions: string | null; contextUpdatedAt: Date }
      | { error: string };

    // These type assignments only compile if the types match exactly.
    const _inputCheck = (x: ExpectedInput): Input => x;
    const _returnCheck = (x: ReturnT): ExpectedReturn => x;
    void _inputCheck;
    void _returnCheck;

    // Runtime smoke check: callable with the expected input shape returns
    // a Promise that resolves to either success or error variant.
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: "x",
      contextUpdatedAt: updatedAt,
    });
    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "x",
    });

    // Discriminated-union runtime check
    if ("error" in result) {
      expect(typeof result.error).toBe("string");
    } else {
      expect(result.contextUpdatedAt).toBeInstanceOf(Date);
      expect(
        result.contextInstructions === null ||
          typeof result.contextInstructions === "string"
      ).toBe(true);
    }
  });

  it("AC-8: treats whitespace-only input as clear (calls helper with null), NOT as length violation", async () => {
    /**
     * AC-8: GIVEN Whitespace-Only-Input (z.B. "   \n\t  ")
     * WHEN updateProjectContext aufgerufen wird
     * THEN der Action trimmt zuerst, normalisiert das leere Resultat zu null
     *      (Clear-Pfad wie AC-4) — KEIN 8000-Char-Verletzung; Helper-Call mit null.
     */
    const updatedAt = new Date("2026-04-01T12:34:56Z");
    mockUpdateProjectContextQuery.mockResolvedValueOnce({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });

    const result = await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "   \n\t  ",
    });

    expect(mockUpdateProjectContextQuery).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      userId: "user-001",
      contextInstructions: null,
    });
    expect(result).toEqual({
      contextInstructions: null,
      contextUpdatedAt: updatedAt,
    });
    // Importantly: NOT a length error
    if ("error" in result) {
      expect(result.error).not.toBe(
        "Context exceeds maximum length of 8000 characters."
      );
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/" + PROJECT_ID);
  });

  it("AC-1 ordering: requireAuth runs BEFORE query helper", async () => {
    /**
     * AC-1 (ordering subset): Stellt sicher, dass requireAuth vor dem Helper-Call kommt.
     * Wenn requireAuth fehlschlaegt, darf der Helper NICHT aufgerufen werden.
     */
    mockRequireAuth.mockResolvedValueOnce({ error: "Unauthorized" } as any);

    await updateProjectContext({
      projectId: PROJECT_ID,
      contextInstructions: "Some context",
    });

    expect(mockRequireAuth).toHaveBeenCalled();
    expect(mockUpdateProjectContextQuery).not.toHaveBeenCalled();
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
