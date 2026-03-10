import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
  },
}));

vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
}));

// Mock next/cache to prevent server-side Next.js errors
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock lib/clients/storage for deleteGeneration tests
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    delete: vi.fn(),
  },
}));

import { generateImages, retryGeneration, deleteGeneration } from "@/app/actions/generations";
import { GenerationService } from "@/lib/services/generation-service";
import { getGeneration, deleteGeneration as deleteGenerationFromDb, type Generation } from "@/lib/db/queries";
import { StorageService } from "@/lib/clients/storage";
import { revalidatePath } from "next/cache";

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
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    createdAt: new Date(),
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: generateImages Server Action
// ---------------------------------------------------------------------------

describe("generateImages Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-9: GIVEN generateImages wird mit leerem Prompt aufgerufen
  //        WHEN die Action ausgefuehrt wird
  //        THEN wird ein Fehler-Objekt { error: "Prompt darf nicht leer sein" } zurueckgegeben
  it('AC-9: should return error object for empty prompt', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-9: should return error object for whitespace-only prompt', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "   ",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-10: GIVEN generateImages wird mit ungueltigem modelId-Format aufgerufen
  //         WHEN die Action ausgefuehrt wird
  //         THEN wird ein Fehler-Objekt { error: "Unbekanntes Modell" } zurueckgegeben
  it('AC-10: should return error object for invalid model ID format', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["INVALID/Model"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Unbekanntes Modell" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-11: GIVEN generateImages wird mit count=5 aufgerufen
  //         WHEN die Action ausgefuehrt wird
  //         THEN wird ein Fehler-Objekt { error: "Anzahl muss zwischen 1 und 4 liegen" } zurueckgegeben
  it('AC-11: should return error object for count outside 1-4 range (count=5)', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 5,
    });

    expect(result).toEqual({ error: "Anzahl muss zwischen 1 und 4 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-11: should return error object for count=0', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 0,
    });

    expect(result).toEqual({ error: "Anzahl muss zwischen 1 und 4 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-12: GIVEN app/actions/generations.ts existiert
  //         WHEN die Datei inspiziert wird
  //         THEN beginnt sie mit "use server" als erste Zeile
  it('AC-12: should have "use server" as first line', () => {
    const filePath = resolve(__dirname, "..", "generations.ts");
    const content = readFileSync(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();

    expect(firstLine).toBe('"use server";');
  });
});

// ---------------------------------------------------------------------------
// Tests: Slice-12 modelIds validation in generateImages Server Action
// ---------------------------------------------------------------------------

describe("generateImages Server Action — Slice-12 modelIds validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-5: GIVEN generateImages wird mit modelIds: [] (leeres Array) aufgerufen
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler { error: "1-3 Modelle muessen ausgewaehlt sein" } zurueckgegeben
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-5: should return validation error for empty modelIds array', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: [],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "1-3 Modelle muessen ausgewaehlt sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-6: GIVEN generateImages wird mit modelIds: ["m1", "m2", "m3", "m4"] (4 IDs) aufgerufen
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler { error: "1-3 Modelle muessen ausgewaehlt sein" } zurueckgegeben
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-6: should return validation error when more than three model IDs are provided', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["owner/m1", "owner/m2", "owner/m3", "owner/m4"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "1-3 Modelle muessen ausgewaehlt sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-7: GIVEN generateImages wird mit modelIds: ["UPPER/Case"] aufgerufen (ungueltige Format)
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler zurueckgegeben (ID entspricht nicht ^[a-z0-9-]+/[a-z0-9._-]+$)
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-7: should return validation error for model ID not matching owner/name regex', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["UPPER/Case"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Unbekanntes Modell" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: retryGeneration Server Action
// ---------------------------------------------------------------------------

describe("retryGeneration Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-7 (delegation): GIVEN eine failed Generation
  //                      WHEN retryGeneration aufgerufen wird
  //                      THEN wird an GenerationService.retry delegiert
  it("AC-7: should delegate to GenerationService for failed generation", async () => {
    const retriedGen = makeGeneration({ id: "gen-retry", status: "pending" });
    (GenerationService.retry as Mock).mockResolvedValue(retriedGen);

    const result = await retryGeneration({ id: "gen-retry" });

    expect(GenerationService.retry).toHaveBeenCalledWith("gen-retry");
    expect(result).toEqual(retriedGen);
  });

  // AC-8 (action level): GIVEN retryGeneration wird mit einer ID aufgerufen, deren Status NICHT "failed" ist
  //                        WHEN die Action ausgefuehrt wird
  //                        THEN wird ein Fehler-Objekt zurueckgegeben
  it("AC-8: should return error for non-failed generation", async () => {
    (GenerationService.retry as Mock).mockRejectedValue(
      new Error("Nur fehlgeschlagene Generierungen koennen wiederholt werden")
    );

    const result = await retryGeneration({ id: "gen-completed" });

    expect(result).toEqual({
      error: "Nur fehlgeschlagene Generierungen koennen wiederholt werden",
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteGeneration Server Action (Slice 13)
// ---------------------------------------------------------------------------

describe("deleteGeneration Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-11: GIVEN die deleteGeneration Server Action wird mit einer gueltigen Generation-ID aufgerufen
   * WHEN die Generation existiert und eine image_url hat
   * THEN wird der DB-Eintrag geloescht, das R2-Objekt geloescht und { success: true } zurueckgegeben
   */
  it("AC-11: should delete generation from DB and image from R2 and return success true", async () => {
    const gen = makeGeneration({
      id: "gen-to-delete",
      imageUrl: "https://cdn.example.com/images/gen-to-delete.png",
    });

    (getGeneration as Mock).mockResolvedValue(gen);
    (deleteGenerationFromDb as Mock).mockResolvedValue(undefined);
    (StorageService.delete as Mock).mockResolvedValue(undefined);

    const result = await deleteGeneration({ id: "gen-to-delete" });

    // Should fetch the generation first
    expect(getGeneration).toHaveBeenCalledWith("gen-to-delete");

    // DB delete first (data integrity)
    expect(deleteGenerationFromDb).toHaveBeenCalledWith("gen-to-delete");

    // R2 delete second — key extracted from URL
    expect(StorageService.delete).toHaveBeenCalledWith(
      "images/gen-to-delete.png"
    );

    // revalidatePath called for gallery update
    expect(revalidatePath).toHaveBeenCalledWith("/");

    // Return success
    expect(result).toEqual({ success: true });
  });

  it("AC-11: should still succeed when generation has no image_url", async () => {
    const gen = makeGeneration({
      id: "gen-no-image",
      imageUrl: null,
    });

    (getGeneration as Mock).mockResolvedValue(gen);
    (deleteGenerationFromDb as Mock).mockResolvedValue(undefined);

    const result = await deleteGeneration({ id: "gen-no-image" });

    expect(deleteGenerationFromDb).toHaveBeenCalledWith("gen-no-image");
    expect(StorageService.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  /**
   * AC-12: GIVEN die deleteGeneration Server Action wird mit einer nicht-existierenden ID aufgerufen
   * WHEN die Aktion ausgefuehrt wird
   * THEN wird { success: false } zurueckgegeben
   */
  it("AC-12: should return success false for non-existing generation ID", async () => {
    (getGeneration as Mock).mockRejectedValue(
      new Error("Generation not found")
    );

    const result = await deleteGeneration({ id: "gen-nonexistent" });

    expect(getGeneration).toHaveBeenCalledWith("gen-nonexistent");
    expect(deleteGenerationFromDb).not.toHaveBeenCalled();
    expect(StorageService.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });
});
