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
  negativePrompt: null,
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
   * AC-8 (edge): createGeneration with optional negativePrompt omitted defaults to null
   */
  it("AC-8 (edge): should default negativePrompt to null when omitted", async () => {
    mockChain = createChainableMock([FAKE_GENERATION]);

    await createGeneration({
      projectId: FAKE_PROJECT.id,
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
    });

    expect(mockChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        negativePrompt: null,
      })
    );
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
