import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/db/queries", () => ({
  getSiblingsByBatchId: vi.fn(),
  // Re-export other symbols that generations.ts imports so the module loads
  getGenerations: vi.fn(),
  getGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
}));

// Mock next/cache to prevent server-side Next.js errors
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock external services that other actions in the same file import
vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: { generate: vi.fn(), retry: vi.fn(), upscale: vi.fn() },
  validateTotalMegapixels: vi.fn(),
}));

vi.mock("@/lib/clients/storage", () => ({
  StorageService: { delete: vi.fn(), upload: vi.fn() },
}));

import { getSiblingGenerations } from "@/app/actions/generations";
import { getSiblingsByBatchId, type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox",
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "completed",
    imageUrl: "https://cdn.example.com/img.png",
    replicatePredictionId: null,
    errorMessage: null,
    width: 1024,
    height: 1024,
    seed: null,
    promptMotiv: "A fox",
    promptStyle: "",
    isFavorite: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    batchId: "aaa-bbb-ccc",
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: getSiblingGenerations Server Action (Slice 04)
// ---------------------------------------------------------------------------

describe("getSiblingGenerations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN eine batchId die 3 completed Generations in der DB hat
   *       WHEN getSiblingGenerations("aaa-bbb-ccc") aufgerufen wird
   *       THEN wird ein Generation[] mit genau 3 Eintraegen zurueckgegeben,
   *            sortiert nach createdAt ASC
   */
  it("AC-1: should return completed generations for a valid batchId sorted by createdAt ASC", async () => {
    const siblings: Generation[] = [
      makeGeneration({
        id: "gen-a",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      }),
      makeGeneration({
        id: "gen-b",
        createdAt: new Date("2026-01-01T11:00:00Z"),
      }),
      makeGeneration({
        id: "gen-c",
        createdAt: new Date("2026-01-01T12:00:00Z"),
      }),
    ];
    (getSiblingsByBatchId as Mock).mockResolvedValue(siblings);

    const result = await getSiblingGenerations("aaa-bbb-ccc");

    // Should delegate to the DB query with the given batchId
    expect(getSiblingsByBatchId).toHaveBeenCalledWith("aaa-bbb-ccc");
    expect(getSiblingsByBatchId).toHaveBeenCalledTimes(1);

    // Must return exactly 3 entries
    expect(result).toHaveLength(3);

    // Must be sorted by createdAt ASC (the query handles ordering,
    // but we verify the action passes through correctly)
    expect(result[0].id).toBe("gen-a");
    expect(result[1].id).toBe("gen-b");
    expect(result[2].id).toBe("gen-c");
    expect(result[0].createdAt.getTime()).toBeLessThan(result[1].createdAt.getTime());
    expect(result[1].createdAt.getTime()).toBeLessThan(result[2].createdAt.getTime());
  });

  /**
   * AC-2: GIVEN eine batchId die keine Generations in der DB hat
   *       WHEN getSiblingGenerations("nonexistent-id") aufgerufen wird
   *       THEN wird ein leeres Array [] zurueckgegeben
   */
  it("AC-2: should return empty array when no generations match the batchId", async () => {
    (getSiblingsByBatchId as Mock).mockResolvedValue([]);

    const result = await getSiblingGenerations("nonexistent-id");

    expect(getSiblingsByBatchId).toHaveBeenCalledWith("nonexistent-id");
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  /**
   * AC-3: GIVEN batchId ist null oder undefined
   *       WHEN getSiblingGenerations(null) aufgerufen wird
   *       THEN wird ein leeres Array [] zurueckgegeben (kein DB-Aufruf fuer null-Werte)
   */
  it("AC-3: should return empty array when batchId is null or undefined", async () => {
    // Test with null
    const resultNull = await getSiblingGenerations(null);
    expect(resultNull).toEqual([]);
    expect(getSiblingsByBatchId).not.toHaveBeenCalled();

    // Test with undefined (cast to match the signature accepting null)
    const resultUndefined = await getSiblingGenerations(
      undefined as unknown as null
    );
    expect(resultUndefined).toEqual([]);
    // Still no DB call — the null-guard catches falsy values
    expect(getSiblingsByBatchId).not.toHaveBeenCalled();
  });

  /**
   * AC-4: GIVEN eine gueltige batchId die Generations mit gemischten Status hat
   *       (completed + failed + pending)
   *       WHEN getSiblingGenerations("mixed-batch") aufgerufen wird
   *       THEN werden nur Generations mit status: "completed" zurueckgegeben
   *
   * Note: The filtering is done by getSiblingsByBatchId at the DB layer.
   * We verify that the action delegates correctly and returns only what
   * the query returns (which by contract filters to completed only).
   */
  it("AC-4: should only return generations with status completed", async () => {
    // getSiblingsByBatchId only returns completed generations by contract
    const completedOnly: Generation[] = [
      makeGeneration({ id: "gen-completed-1", status: "completed" }),
      makeGeneration({ id: "gen-completed-2", status: "completed" }),
    ];
    (getSiblingsByBatchId as Mock).mockResolvedValue(completedOnly);

    const result = await getSiblingGenerations("mixed-batch");

    expect(getSiblingsByBatchId).toHaveBeenCalledWith("mixed-batch");
    expect(result).toHaveLength(2);
    // Every returned generation must have status "completed"
    for (const gen of result) {
      expect(gen.status).toBe("completed");
    }
  });

  /**
   * AC-5: GIVEN die Query getSiblingsByBatchId() wirft einen Fehler
   *       WHEN getSiblingGenerations("any-id") aufgerufen wird
   *       THEN wird ein leeres Array [] zurueckgegeben und der Fehler wird geloggt
   */
  it("AC-5: should return empty array and log error when query throws", async () => {
    const dbError = new Error("Database connection lost");
    (getSiblingsByBatchId as Mock).mockRejectedValue(dbError);
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await getSiblingGenerations("any-id");

    // Must return empty array on error, not throw
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);

    // Error must be logged
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "getSiblingGenerations error:",
      dbError
    );

    consoleSpy.mockRestore();
  });

  /**
   * AC-6: GIVEN die Server Action getSiblingGenerations
   *       WHEN deren Signatur geprueft wird
   *       THEN akzeptiert sie einen Parameter batchId: string | null
   *            und gibt Promise<Generation[]> zurueck
   */
  it("AC-6: should accept string or null as batchId parameter", async () => {
    (getSiblingsByBatchId as Mock).mockResolvedValue([]);

    // Verify it accepts a string and returns a promise resolving to an array
    const resultString = await getSiblingGenerations("some-batch-id");
    expect(Array.isArray(resultString)).toBe(true);

    // Verify it accepts null and returns a promise resolving to an array
    const resultNull = await getSiblingGenerations(null);
    expect(Array.isArray(resultNull)).toBe(true);

    // Verify the function is indeed async (returns a Promise)
    const promiseResult = getSiblingGenerations("test-id");
    expect(promiseResult).toBeInstanceOf(Promise);
    await promiseResult; // clean up
  });
});
