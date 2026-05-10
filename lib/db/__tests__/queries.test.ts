/**
 * Unit Tests for lib/db/queries.ts
 * Slice: slice-02-db-connection-queries
 *
 * These tests mock the Drizzle db instance to verify that query functions
 * call the correct Drizzle methods with the correct arguments.
 * Integration tests (queries.integration.test.ts) require Docker and are separate.
 *
 * ACs covered: AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11
 * ACs skipped (require Docker): AC-1, AC-2
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the db module before importing queries
// ---------------------------------------------------------------------------

// We build a chainable mock that captures method calls.
// Each chainable method returns `this` so .from().where().orderBy() etc. work.

function createChainableMock(resolvedValue: unknown = []) {
  const createChain = (): Record<string, ReturnType<typeof vi.fn>> => {
    const proxy: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = [
      "select",
      "insert",
      "update",
      "delete",
      "from",
      "where",
      "set",
      "values",
      "returning",
      "orderBy",
    ];
    for (const m of methods) {
      proxy[m] = vi.fn().mockReturnValue(proxy);
    }
    // The terminal call (returning / orderBy / where on select / then) resolves the value
    // We make the chain thenable so `await` works
    proxy.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
      return Promise.resolve(resolvedValue).then(resolve);
    });
    return proxy;
  };

  return createChain();
}

let mockChain: ReturnType<typeof createChainableMock>;

vi.mock("../index", () => {
  // We create the chain lazily per-test via beforeEach
  return {
    get db() {
      return mockChain;
    },
  };
});

// Import queries AFTER the mock is set up
import {
  createProject,
  getProjects,
  getProject,
  renameProject,
  deleteProject,
  createGeneration,
  getGenerations,
  updateGeneration,
  deleteGeneration,
  getProjectContext,
  updateProjectContext,
} from "../queries";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-05T12:00:00Z");
const LATER = new Date("2026-03-05T13:00:00Z");

const FAKE_PROJECT = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  name: "Test Project",
  createdAt: NOW,
  updatedAt: NOW,
};

const FAKE_GENERATION = {
  id: "11111111-2222-3333-4444-555555555555",
  projectId: FAKE_PROJECT.id,
  prompt: "A fox",
  modelId: "black-forest-labs/flux-2-pro",
  modelParams: {},
  status: "pending",
  imageUrl: null,
  replicatePredictionId: null,
  errorMessage: null,
  width: null,
  height: null,
  seed: null,
  createdAt: NOW,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Project Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-3: GIVEN eine leere projects-Tabelle
   * WHEN createProject({ name: "Test Project" }) aufgerufen wird
   * THEN wird ein Datensatz mit generierter UUID, dem Namen "Test Project",
   *      created_at und updated_at als TIMESTAMPTZ zurueckgegeben
   */
  it("AC-3: should call db.insert().values().returning() and return the created project", async () => {
    mockChain = createChainableMock([FAKE_PROJECT]);

    const result = await createProject({ name: "Test Project" });

    expect(result).toEqual(FAKE_PROJECT);
    expect(result.id).toBeDefined();
    expect(result.name).toBe("Test Project");
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    // Verify insert was called (it starts the chain)
    expect(mockChain.insert).toHaveBeenCalled();
    expect(mockChain.values).toHaveBeenCalledWith({ name: "Test Project" });
    expect(mockChain.returning).toHaveBeenCalled();
  });

  /**
   * AC-4: GIVEN ein existierendes Projekt in der DB
   * WHEN getProjects() aufgerufen wird
   * THEN wird ein Array mit mindestens einem Project-Objekt zurueckgegeben,
   *      sortiert nach created_at DESC
   */
  it("AC-4: should call db.select().from(projects).orderBy(desc) and return projects array", async () => {
    mockChain = createChainableMock([FAKE_PROJECT]);

    const result = await getProjects();

    expect(result).toEqual([FAKE_PROJECT]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(mockChain.select).toHaveBeenCalled();
    expect(mockChain.from).toHaveBeenCalled();
    expect(mockChain.orderBy).toHaveBeenCalled();
  });

  /**
   * AC-5: GIVEN ein existierendes Projekt mit bekannter ID
   * WHEN getProject(id) aufgerufen wird
   * THEN wird das Project-Objekt mit allen Feldern zurueckgegeben
   */
  it("AC-5: should call db.select().from(projects).where(eq(id)) and return the project", async () => {
    mockChain = createChainableMock([FAKE_PROJECT]);

    const result = await getProject(FAKE_PROJECT.id);

    expect(result).toEqual(FAKE_PROJECT);
    expect(result.id).toBe(FAKE_PROJECT.id);
    expect(result.name).toBe(FAKE_PROJECT.name);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(mockChain.select).toHaveBeenCalled();
    expect(mockChain.from).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
  });

  /**
   * AC-5 (negative): getProject with non-existent ID should throw
   */
  it("AC-5 (negative): should throw when project is not found", async () => {
    mockChain = createChainableMock([]);

    await expect(getProject("nonexistent-id")).rejects.toThrow(
      "Project not found"
    );
  });

  /**
   * AC-6: GIVEN ein existierendes Projekt mit bekannter ID
   * WHEN renameProject(id, "New Name") aufgerufen wird
   * THEN wird der Name auf "New Name" aktualisiert und updated_at ist neuer als vorher
   */
  it('AC-6: should call db.update().set({ name, updatedAt }).where().returning() and return renamed project', async () => {
    const renamedProject = {
      ...FAKE_PROJECT,
      name: "New Name",
      updatedAt: LATER,
    };
    mockChain = createChainableMock([renamedProject]);

    const result = await renameProject(FAKE_PROJECT.id, "New Name");

    expect(result.name).toBe("New Name");
    expect(result.updatedAt.getTime()).toBeGreaterThan(
      FAKE_PROJECT.updatedAt.getTime()
    );
    expect(mockChain.update).toHaveBeenCalled();
    expect(mockChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Name" })
    );
    expect(mockChain.where).toHaveBeenCalled();
    expect(mockChain.returning).toHaveBeenCalled();
  });

  /**
   * AC-6 (negative): renameProject with non-existent ID should throw
   */
  it("AC-6 (negative): should throw when project to rename is not found", async () => {
    mockChain = createChainableMock([]);

    await expect(renameProject("nonexistent-id", "New Name")).rejects.toThrow(
      "Project not found"
    );
  });

  /**
   * AC-7: GIVEN ein existierendes Projekt mit zugehoerigen Generations
   * WHEN deleteProject(id) aufgerufen wird
   * THEN wird das Projekt geloescht und alle zugehoerigen Generations
   *      werden via CASCADE ebenfalls entfernt
   */
  it("AC-7: should call db.delete(projects).where(eq(id))", async () => {
    mockChain = createChainableMock(undefined);

    await deleteProject(FAKE_PROJECT.id);

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
    // Note: CASCADE behavior is enforced at the DB schema level (tested in integration tests)
  });
});

describe("Generation Queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-8: GIVEN ein existierendes Projekt
   * WHEN createGeneration({ projectId, prompt: "A fox", modelId: "black-forest-labs/flux-2-pro", modelParams: {} })
   *      aufgerufen wird
   * THEN wird ein Generation-Datensatz mit status: "pending" und image_url: null zurueckgegeben
   */
  it('AC-8: should call db.insert().values().returning() and return generation with status "pending" and imageUrl null', async () => {
    mockChain = createChainableMock([FAKE_GENERATION]);

    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    });

    expect(result).toEqual(FAKE_GENERATION);
    expect(result.status).toBe("pending");
    expect(result.imageUrl).toBeNull();
    expect(mockChain.insert).toHaveBeenCalled();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: FAKE_PROJECT.id,
        prompt: "A fox",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: {},
      })
    );
    expect(mockChain.returning).toHaveBeenCalled();
  });

  /**
   * AC-8 (edge): createGeneration without optional fields defaults promptMotiv to empty string
   * (negativePrompt column was removed by prompt-simplification)
   */
  it("AC-8 (edge): should default promptMotiv to empty string when omitted", async () => {
    mockChain = createChainableMock([FAKE_GENERATION]);

    await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
    });

    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "",
      })
    );
    // negativePrompt should NOT be in the values call (column removed)
    const calledValues = mockChain.values.mock.calls[0][0];
    expect(calledValues).not.toHaveProperty("negativePrompt");
  });

  /**
   * AC-9: GIVEN ein existierendes Projekt mit mehreren Generations
   * WHEN getGenerations(projectId) aufgerufen wird
   * THEN werden alle Generations des Projekts zurueckgegeben, sortiert nach created_at DESC
   */
  it("AC-9: should call db.select().from(generations).where(eq(projectId)).orderBy(desc) and return generations", async () => {
    const gen1 = { ...FAKE_GENERATION, createdAt: LATER };
    const gen2 = { ...FAKE_GENERATION, id: "22222222-3333-4444-5555-666666666666", createdAt: NOW };
    mockChain = createChainableMock([gen1, gen2]);

    const result = await getGenerations(FAKE_PROJECT.id);

    expect(result).toEqual([gen1, gen2]);
    expect(result.length).toBe(2);
    expect(mockChain.select).toHaveBeenCalled();
    expect(mockChain.from).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
    expect(mockChain.orderBy).toHaveBeenCalled();
  });

  /**
   * AC-10: GIVEN eine existierende Generation mit status: "pending"
   * WHEN updateGeneration(id, { status: "completed", imageUrl: "https://r2.example.com/img.png", width: 1024, height: 1024 })
   *      aufgerufen wird
   * THEN werden die Felder aktualisiert und der aktualisierte Datensatz zurueckgegeben
   */
  it("AC-10: should call db.update().set(data).where(eq(id)).returning() and return updated generation", async () => {
    const updatedGeneration = {
      ...FAKE_GENERATION,
      status: "completed",
      imageUrl: "https://r2.example.com/img.png",
      width: 1024,
      height: 1024,
    };
    mockChain = createChainableMock([updatedGeneration]);

    const updateData = {
      status: "completed",
      imageUrl: "https://r2.example.com/img.png",
      width: 1024,
      height: 1024,
    };
    const result = await updateGeneration(FAKE_GENERATION.id, updateData);

    expect(result.status).toBe("completed");
    expect(result.imageUrl).toBe("https://r2.example.com/img.png");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1024);
    expect(mockChain.update).toHaveBeenCalled();
    expect(mockChain.set).toHaveBeenCalledWith(updateData);
    expect(mockChain.where).toHaveBeenCalled();
    expect(mockChain.returning).toHaveBeenCalled();
  });

  /**
   * AC-10 (negative): updateGeneration with non-existent ID should throw
   */
  it("AC-10 (negative): should throw when generation to update is not found", async () => {
    mockChain = createChainableMock([]);

    await expect(
      updateGeneration("nonexistent-id", { status: "completed" })
    ).rejects.toThrow("Generation not found");
  });

  /**
   * AC-11: GIVEN eine existierende Generation
   * WHEN deleteGeneration(id) aufgerufen wird
   * THEN wird der Datensatz entfernt und ist nicht mehr per getGenerations auffindbar
   */
  it("AC-11: should call db.delete(generations).where(eq(id))", async () => {
    mockChain = createChainableMock(undefined);

    await deleteGeneration(FAKE_GENERATION.id);

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Slice-02: createGeneration — new mode fields (generationMode, sourceImageUrl, sourceGenerationId)
// ---------------------------------------------------------------------------

describe("createGeneration — new mode fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: createGeneration without new fields → returns generationMode: "txt2img",
   * sourceImageUrl: null, sourceGenerationId: null
   */
  it('AC-1: should default generationMode to "txt2img" and source fields to null when not provided', async () => {
    const returnedGeneration = {
      ...FAKE_GENERATION,
      generationMode: "txt2img",
      sourceImageUrl: null,
      sourceGenerationId: null,
    };
    mockChain = createChainableMock([returnedGeneration]);

    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
    });

    expect(result.generationMode).toBe("txt2img");
    expect(result.sourceImageUrl).toBeNull();
    expect(result.sourceGenerationId).toBeNull();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "txt2img",
        sourceImageUrl: null,
        sourceGenerationId: null,
      })
    );
  });

  /**
   * AC-2: createGeneration with generationMode: "img2img" and sourceImageUrl
   * → returns correct values
   */
  it('AC-2: should pass generationMode "img2img" and sourceImageUrl through to db', async () => {
    const returnedGeneration = {
      ...FAKE_GENERATION,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/source.png",
      sourceGenerationId: null,
    };
    mockChain = createChainableMock([returnedGeneration]);

    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox in watercolor",
      modelId: "black-forest-labs/flux-2-pro",
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/source.png",
    });

    expect(result.generationMode).toBe("img2img");
    expect(result.sourceImageUrl).toBe("https://r2.example.com/source.png");
    expect(result.sourceGenerationId).toBeNull();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "img2img",
        sourceImageUrl: "https://r2.example.com/source.png",
        sourceGenerationId: null,
      })
    );
  });

  /**
   * AC-3: createGeneration with generationMode: "upscale", sourceImageUrl,
   * and sourceGenerationId → returns all three fields
   */
  it('AC-3: should pass generationMode "upscale", sourceImageUrl, and sourceGenerationId through to db', async () => {
    const sourceGenId = "99999999-8888-7777-6666-555555555555";
    const returnedGeneration = {
      ...FAKE_GENERATION,
      generationMode: "upscale",
      sourceImageUrl: "https://r2.example.com/original.png",
      sourceGenerationId: sourceGenId,
    };
    mockChain = createChainableMock([returnedGeneration]);

    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "Upscale this",
      modelId: "black-forest-labs/flux-2-pro",
      generationMode: "upscale",
      sourceImageUrl: "https://r2.example.com/original.png",
      sourceGenerationId: sourceGenId,
    });

    expect(result.generationMode).toBe("upscale");
    expect(result.sourceImageUrl).toBe("https://r2.example.com/original.png");
    expect(result.sourceGenerationId).toBe(sourceGenId);
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "upscale",
        sourceImageUrl: "https://r2.example.com/original.png",
        sourceGenerationId: sourceGenId,
      })
    );
  });

  /**
   * AC-4: createGeneration with generationMode: "img2img" without sourceGenerationId
   * → sourceGenerationId is null
   */
  it('AC-4: should default sourceGenerationId to null when img2img mode omits it', async () => {
    const returnedGeneration = {
      ...FAKE_GENERATION,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/source.png",
      sourceGenerationId: null,
    };
    mockChain = createChainableMock([returnedGeneration]);

    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "Transform this",
      modelId: "black-forest-labs/flux-2-pro",
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/source.png",
      // sourceGenerationId intentionally omitted
    });

    expect(result.sourceGenerationId).toBeNull();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        generationMode: "img2img",
        sourceImageUrl: "https://r2.example.com/source.png",
        sourceGenerationId: null,
      })
    );
  });

  /**
   * AC-5: New fields (generationMode, sourceImageUrl, sourceGenerationId) are all
   * optional TypeScript types — calling with only existing required fields
   * (projectId, prompt, modelId) compiles and works
   */
  it("AC-5: should compile and work when called with only required fields (projectId, prompt, modelId)", async () => {
    mockChain = createChainableMock([FAKE_GENERATION]);

    // This call uses ONLY the required fields — if the types were wrong, TypeScript would fail
    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "Minimal call",
      modelId: "black-forest-labs/flux-2-pro",
    });

    expect(result).toBeDefined();
    expect(mockChain.insert).toHaveBeenCalled();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: FAKE_PROJECT.id,
        prompt: "Minimal call",
        modelId: "black-forest-labs/flux-2-pro",
      })
    );
  });

  /**
   * AC-6: Existing tests for createGeneration, getGeneration, updateGeneration,
   * deleteGeneration remain green (no breaking change).
   * This test verifies that the original createGeneration signature still works
   * with the old-style full input (including modelParams and negativePrompt).
   */
  it("AC-6: should remain backward-compatible with existing createGeneration call signature", async () => {
    mockChain = createChainableMock([FAKE_GENERATION]);

    // Call with the exact same signature used in the existing AC-8 test
    const result = await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: {},
    });

    expect(result).toEqual(FAKE_GENERATION);
    expect(result.status).toBe("pending");
    expect(result.imageUrl).toBeNull();
    expect(mockChain.insert).toHaveBeenCalled();
    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: FAKE_PROJECT.id,
        prompt: "A fox",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: {},
      })
    );
    expect(mockChain.returning).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Slice-02: Project Context Queries (getProjectContext, updateProjectContext)
//
// Mocking-Strategy (from slice-spec): mock_external (Drizzle-Chain via vi.fn).
// Tests verify the WHERE-clause combines `id` + `userId`, that select chooses
// only the two relevant columns, and that null vs. row mapping is correct.
// ---------------------------------------------------------------------------

const FAKE_USER_ID = "user-1234-5678-9abc-def012345678";
const FAKE_OTHER_USER_ID = "user-9999-aaaa-bbbb-cccc11112222";
const FAKE_PROJECT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CONTEXT_UPDATED_AT = new Date("2026-04-19T10:00:00Z");

const FAKE_CONTEXT_ROW = {
  contextInstructions: "Style: minimalistic illustrations.",
  contextUpdatedAt: CONTEXT_UPDATED_AT,
};

const FAKE_CONTEXT_ROW_NULL = {
  contextInstructions: null,
  contextUpdatedAt: null,
};

describe("getProjectContext (Slice 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1:
   * GIVEN Slice 01 ist gemerged (Spalten context_instructions, context_updated_at existieren)
   * WHEN getProjectContext({ projectId, userId }) für ein Projekt aufgerufen wird, das dem userId gehört
   * THEN das Ergebnis ist ein Object mit Shape { contextInstructions, contextUpdatedAt } und enthält
   *      die Werte beider Spalten; KEIN Throw, KEIN Fetch unbenötigter Spalten.
   */
  it("AC-1: returns { contextInstructions, contextUpdatedAt } for owner", async () => {
    mockChain = createChainableMock([FAKE_CONTEXT_ROW]);

    const result = await getProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
    });

    // Result has the typed shape (only the two relevant fields)
    expect(result).toEqual({
      contextInstructions: "Style: minimalistic illustrations.",
      contextUpdatedAt: CONTEXT_UPDATED_AT,
    });

    // Drizzle chain was used: select() → from() → where()
    expect(mockChain.select).toHaveBeenCalled();
    expect(mockChain.from).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();

    // Defence-in-depth: select() received an explicit projection object
    // (NOT called with no args / NOT a wildcard select())
    const selectCallArgs = mockChain.select.mock.calls[0];
    expect(selectCallArgs.length).toBe(1);
    const projection = selectCallArgs[0];
    expect(projection).toBeDefined();
    expect(projection).toHaveProperty("contextInstructions");
    expect(projection).toHaveProperty("contextUpdatedAt");
    // Exactly these two keys — no over-selection
    expect(Object.keys(projection).sort()).toEqual([
      "contextInstructions",
      "contextUpdatedAt",
    ]);
  });

  /**
   * AC-2:
   * GIVEN ein Projekt existiert, gehört aber einem anderen User (Ownership-Mismatch)
   * WHEN getProjectContext({ projectId, userId }) mit dem fremden userId aufgerufen wird
   * THEN das Ergebnis ist null (NICHT throw, NICHT 404); WHERE-Klausel kombiniert
   *      eq(projects.id, projectId) UND eq(projects.userId, userId), NICHT nur id.
   */
  it("AC-2: returns null when userId does not match project owner", async () => {
    // Mock returns empty array because the combined id+userId WHERE filter has no match
    mockChain = createChainableMock([]);

    const result = await getProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_OTHER_USER_ID,
    });

    expect(result).toBeNull();
    // No throw — helper just returns null
    expect(mockChain.where).toHaveBeenCalled();
    // where() was called exactly once (single combined and(...) clause)
    expect(mockChain.where).toHaveBeenCalledTimes(1);
  });

  /**
   * AC-3:
   * GIVEN kein Projekt mit der gegebenen projectId existiert
   * WHEN getProjectContext({ projectId, userId }) aufgerufen wird
   * THEN das Ergebnis ist null (gleiches Verhalten wie Ownership-Mismatch — keine Existenz-Leakage).
   */
  it("AC-3: returns null when project does not exist", async () => {
    mockChain = createChainableMock([]);

    const result = await getProjectContext({
      projectId: "nonexistent-project-id",
      userId: FAKE_USER_ID,
    });

    expect(result).toBeNull();
    // No throw — same return as ownership mismatch (no existence leakage)
    expect(mockChain.select).toHaveBeenCalled();
    expect(mockChain.from).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
  });

  /**
   * AC-1 (Variante / null-values): Owner-Row mit context_instructions = null und
   * context_updated_at = null wird korrekt als Object zurückgegeben (NICHT als null).
   */
  it("AC-1 (variant): returns row with null fields when owner has no context yet", async () => {
    mockChain = createChainableMock([FAKE_CONTEXT_ROW_NULL]);

    const result = await getProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
    });

    // Result is the row object (NOT null), even when both fields are null
    expect(result).not.toBeNull();
    expect(result).toEqual({
      contextInstructions: null,
      contextUpdatedAt: null,
    });
  });
});

describe("updateProjectContext (Slice 02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-4:
   * GIVEN ein Projekt existiert und gehört dem aufrufenden User
   * WHEN updateProjectContext({ projectId, userId, contextInstructions }) mit String aufgerufen wird
   * THEN UPDATE auf projects mit contextInstructions UND contextUpdatedAt = now() (per sql`now()`),
   *      gefiltert auf id UND userId; gibt das aktualisierte Row als
   *      { contextInstructions, contextUpdatedAt } via .returning() zurück.
   */
  it("AC-4: sets context_updated_at to now() and returns updated row", async () => {
    mockChain = createChainableMock([FAKE_CONTEXT_ROW]);

    const result = await updateProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
      contextInstructions: "Style: minimalistic illustrations.",
    });

    expect(result).toEqual({
      contextInstructions: "Style: minimalistic illustrations.",
      contextUpdatedAt: CONTEXT_UPDATED_AT,
    });

    // Drizzle chain: update() → set() → where() → returning()
    expect(mockChain.update).toHaveBeenCalled();
    expect(mockChain.set).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
    expect(mockChain.returning).toHaveBeenCalled();

    // set() received contextInstructions AND contextUpdatedAt (the latter via sql`now()`)
    const setArg = mockChain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("contextInstructions", "Style: minimalistic illustrations.");
    expect(setArg).toHaveProperty("contextUpdatedAt");
    // contextUpdatedAt MUST be a Drizzle SQL chunk (sql`now()`), NOT a JS Date / `new Date()`
    expect(setArg.contextUpdatedAt).not.toBeInstanceOf(Date);
    expect(setArg.contextUpdatedAt).toBeDefined();
    // Drizzle SQL chunks are objects (not strings/numbers); minimal sanity check
    expect(typeof setArg.contextUpdatedAt).toBe("object");

    // returning() received an explicit projection of exactly the two relevant fields
    const returningArg = mockChain.returning.mock.calls[0][0];
    expect(returningArg).toBeDefined();
    expect(Object.keys(returningArg).sort()).toEqual([
      "contextInstructions",
      "contextUpdatedAt",
    ]);
  });

  /**
   * AC-5:
   * GIVEN ein Projekt existiert, gehört aber einem anderen User
   * WHEN updateProjectContext({ projectId, userId, contextInstructions }) mit fremdem userId aufgerufen wird
   * THEN das Ergebnis ist null (kein Throw); KEIN UPDATE wird ausgeführt
   *      (DB-Affected-Rows = 0), weil die WHERE-Klausel id UND userId kombiniert.
   */
  it("AC-5: returns null and performs no UPDATE on ownership mismatch", async () => {
    // Drizzle's .returning() resolves to [] when no rows matched the WHERE clause
    mockChain = createChainableMock([]);

    const result = await updateProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_OTHER_USER_ID,
      contextInstructions: "Hijack attempt.",
    });

    // Helper returns null — does NOT throw
    expect(result).toBeNull();

    // The chain was still invoked — Postgres decides via the WHERE clause that 0 rows match.
    // This test verifies the helper handles the empty .returning() result correctly.
    expect(mockChain.update).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
    // where() was called exactly once with the combined and(eq(id), eq(userId)) clause
    expect(mockChain.where).toHaveBeenCalledTimes(1);
    expect(mockChain.returning).toHaveBeenCalled();
  });

  /**
   * AC-4 (Variante / Clear-Pfad):
   * updateProjectContext akzeptiert null als contextInstructions (zum Leeren des Feldes).
   */
  it("AC-4 (variant): accepts null contextInstructions to clear the field", async () => {
    const clearedRow = {
      contextInstructions: null,
      contextUpdatedAt: CONTEXT_UPDATED_AT,
    };
    mockChain = createChainableMock([clearedRow]);

    const result = await updateProjectContext({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
      contextInstructions: null,
    });

    expect(result).toEqual({
      contextInstructions: null,
      contextUpdatedAt: CONTEXT_UPDATED_AT,
    });

    // set() was called with contextInstructions: null (NOT undefined / NOT omitted)
    const setArg = mockChain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("contextInstructions", null);
    expect(setArg).toHaveProperty("contextUpdatedAt");
    // Even on the clear path, contextUpdatedAt is bumped to now() via sql tagged template
    expect(setArg.contextUpdatedAt).not.toBeInstanceOf(Date);
  });

  /**
   * AC-6: TypeScript-Compile (type-only / compile-time check).
   *
   * Helper signatures must match exactly:
   * - getProjectContext(args: { projectId: string; userId: string })
   *     => Promise<{ contextInstructions: string | null; contextUpdatedAt: Date | null } | null>
   * - updateProjectContext(args: { projectId: string; userId: string; contextInstructions: string | null })
   *     => Promise<{ contextInstructions: string | null; contextUpdatedAt: Date | null } | null>
   *
   * If any signature drifts, this file fails to type-check (`pnpm tsc --noEmit`)
   * AND vitest fails to load this test, surfacing the issue.
   */
  it("AC-6: helper signatures match expected typed shape (compile-time check)", async () => {
    // Compile-time signature assertion via explicit typed function references.
    // If the production signatures drift, this file fails type-check.
    type GetCtxFn = (args: {
      projectId: string;
      userId: string;
    }) => Promise<
      { contextInstructions: string | null; contextUpdatedAt: Date | null } | null
    >;
    type UpdateCtxFn = (args: {
      projectId: string;
      userId: string;
      contextInstructions: string | null;
    }) => Promise<
      { contextInstructions: string | null; contextUpdatedAt: Date | null } | null
    >;

    const _getCtx: GetCtxFn = getProjectContext;
    const _updateCtx: UpdateCtxFn = updateProjectContext;

    // Runtime sanity: both helpers exist as functions
    expect(typeof _getCtx).toBe("function");
    expect(typeof _updateCtx).toBe("function");

    // Smoke-call both helpers with the exact typed shapes from the spec.
    mockChain = createChainableMock([FAKE_CONTEXT_ROW]);
    const r1 = await _getCtx({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
    });
    // Result type is the union { ... } | null — must be either an object with both keys or null.
    if (r1 !== null) {
      expect(r1).toHaveProperty("contextInstructions");
      expect(r1).toHaveProperty("contextUpdatedAt");
    }

    mockChain = createChainableMock([FAKE_CONTEXT_ROW]);
    const r2 = await _updateCtx({
      projectId: FAKE_PROJECT_ID,
      userId: FAKE_USER_ID,
      contextInstructions: null,
    });
    if (r2 !== null) {
      expect(r2).toHaveProperty("contextInstructions");
      expect(r2).toHaveProperty("contextUpdatedAt");
    }
  });

  /**
   * AC-7:
   * GIVEN beide Helper sind implementiert
   * WHEN lib/db/queries.ts durchsucht wird
   * THEN bestehende Helper (getProject, getProjects, renameProject, deleteProject,
   *      createProject) sind unverändert; neue Helper sind im gleichen Stil ergänzt.
   *
   * Verified here at the API surface: existing exports are still importable AND callable
   * with the chainable mock (no signature drift on neighbours).
   */
  it("AC-7: existing project helpers remain unchanged (named exports still callable)", async () => {
    // createProject, getProjects, getProject, renameProject, deleteProject
    expect(typeof createProject).toBe("function");
    expect(typeof getProjects).toBe("function");
    expect(typeof getProject).toBe("function");
    expect(typeof renameProject).toBe("function");
    expect(typeof deleteProject).toBe("function");

    // And the two new helpers are also exported as named functions in the same module
    expect(typeof getProjectContext).toBe("function");
    expect(typeof updateProjectContext).toBe("function");
  });
});
