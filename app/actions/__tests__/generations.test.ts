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
}));

// Mock next/cache to prevent server-side Next.js errors
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { generateImages, retryGeneration } from "@/app/actions/generations";
import { GenerationService } from "@/lib/services/generation-service";
import type { Generation } from "@/lib/db/queries";

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
      prompt: "",
      modelId: "black-forest-labs/flux-2-pro",
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-9: should return error object for whitespace-only prompt', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      prompt: "   ",
      modelId: "black-forest-labs/flux-2-pro",
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-10: GIVEN generateImages wird mit unbekanntem modelId aufgerufen
  //         WHEN die Action ausgefuehrt wird
  //         THEN wird ein Fehler-Objekt { error: "Unbekanntes Modell" } zurueckgegeben
  it('AC-10: should return error object for unknown model ID', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      prompt: "A fox",
      modelId: "unknown/nonexistent-model",
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
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
      params: {},
      count: 5,
    });

    expect(result).toEqual({ error: "Anzahl muss zwischen 1 und 4 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-11: should return error object for count=0', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      prompt: "A fox",
      modelId: "black-forest-labs/flux-2-pro",
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
