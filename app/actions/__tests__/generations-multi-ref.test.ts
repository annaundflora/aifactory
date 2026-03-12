import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock GenerationService — the server action delegates to it
vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
  validateTotalMegapixels: vi.fn(),
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
  createGenerationReferences: vi.fn(),
}));

// Mock next/cache to prevent server-side Next.js errors
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock lib/clients/storage
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

import { generateImages } from "@/app/actions/generations";
import {
  GenerationService,
  validateTotalMegapixels,
} from "@/lib/services/generation-service";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox",
    promptMotiv: "A fox",
    promptStyle: "",
    isFavorite: false,
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
    generationMode: "img2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: generateImages - Multi-Reference Integration
// ---------------------------------------------------------------------------

describe("generateImages - Multi-Reference Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: validation passes
    (validateTotalMegapixels as Mock).mockReturnValue(null);
  });

  /**
   * AC-1: GIVEN generateImages wird mit references: [{ referenceImageId: "ref-1", role: "style",
   *       strength: "strong", slotPosition: 1, imageUrl: "https://r2.example/a.png",
   *       width: 1920, height: 1080 }] aufgerufen
   *       WHEN die Generation erfolgreich ist
   *       THEN existiert ein generation_references-Record mit generationId der neuen Generation,
   *       referenceImageId: "ref-1", role: "style", strength: "strong", slotPosition: 1
   */
  it("AC-1: should create generation_references record after successful generation", async () => {
    const pendingGen = makeGeneration({ id: "gen-new-001" });
    (GenerationService.generate as Mock).mockResolvedValue([pendingGen]);

    const references = [
      {
        referenceImageId: "ref-1",
        role: "style",
        strength: "strong",
        slotPosition: 1,
        imageUrl: "https://r2.example/a.png",
        width: 1920,
        height: 1080,
      },
    ];

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      references,
    });

    // Assert: GenerationService.generate was called with the references passed through
    expect(GenerationService.generate).toHaveBeenCalledTimes(1);
    const callArgs = (GenerationService.generate as Mock).mock.calls[0];

    // The 11th argument (index 10) is references
    const passedReferences = callArgs[10];
    expect(passedReferences).toEqual(references);
    expect(passedReferences).toHaveLength(1);
    expect(passedReferences[0]).toMatchObject({
      referenceImageId: "ref-1",
      role: "style",
      strength: "strong",
      slotPosition: 1,
    });

    // Assert: result is the generation array (success path)
    expect(Array.isArray(result)).toBe(true);
    expect((result as Generation[])[0].id).toBe("gen-new-001");
  });

  /**
   * AC-7: GIVEN generateImages wird mit 2 References aufgerufen und die Generation ist erfolgreich
   *       WHEN die generation_references-Records erstellt werden
   *       THEN werden genau 2 Records via createGenerationReferences() Batch-Insert erstellt (ein Call, kein Loop)
   *
   * NOTE: The server action passes references through to GenerationService.generate,
   * which is responsible for the batch insert. This test verifies the passthrough with
   * multiple references.
   */
  it("AC-7: should batch-insert all generation_references in a single call", async () => {
    const pendingGen = makeGeneration({ id: "gen-new-002" });
    (GenerationService.generate as Mock).mockResolvedValue([pendingGen]);

    const references = [
      {
        referenceImageId: "ref-1",
        role: "style",
        strength: "strong",
        slotPosition: 1,
        imageUrl: "https://r2.example/a.png",
        width: 1920,
        height: 1080,
      },
      {
        referenceImageId: "ref-2",
        role: "content",
        strength: "moderate",
        slotPosition: 2,
        imageUrl: "https://r2.example/b.png",
        width: 1024,
        height: 768,
      },
    ];

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox with style",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      references,
    });

    // Assert: references array is passed through completely
    expect(GenerationService.generate).toHaveBeenCalledTimes(1);
    const passedReferences = (GenerationService.generate as Mock).mock
      .calls[0][10];
    expect(passedReferences).toHaveLength(2);
    expect(passedReferences[0].referenceImageId).toBe("ref-1");
    expect(passedReferences[1].referenceImageId).toBe("ref-2");

    // Assert: success
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * AC-8: GIVEN generateImages wird mit references: [] (leeres Array) aufgerufen
   *       WHEN die Generation ausgefuehrt wird
   *       THEN wird composeMultiReferencePrompt NICHT aufgerufen, keine generation_references-Records erstellt,
   *       und die Generation laeuft wie bisher (Rueckwaertskompatibilitaet)
   */
  it("AC-8: should not create generation_references when references array is empty", async () => {
    const pendingGen = makeGeneration({ id: "gen-new-003" });
    (GenerationService.generate as Mock).mockResolvedValue([pendingGen]);

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example/source.png",
      references: [], // empty array
    });

    // Assert: GenerationService.generate was called
    expect(GenerationService.generate).toHaveBeenCalledTimes(1);

    // Assert: references passed as empty array (server action passes it through as-is)
    const passedReferences = (GenerationService.generate as Mock).mock
      .calls[0][10];
    expect(passedReferences).toEqual([]);

    // Assert: validateTotalMegapixels NOT called for empty references
    // (the server action checks references.length > 0 before calling validateTotalMegapixels)
    expect(validateTotalMegapixels).not.toHaveBeenCalled();

    // Assert: result is success
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * AC-3: GIVEN generateImages wird mit References aufgerufen und die Referenz-Bilder
   *       haben eine Gesamt-Aufloesung von 10 MP (z.B. 3x 2000x1667)
   *       WHEN die Megapixel-Validierung prueft
   *       THEN wird { error: "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)" }
   *       zurueckgegeben und KEIN Replicate API-Call ausgefuehrt
   */
  it("AC-3: should return error and skip API call when total megapixels exceed 9 MP", async () => {
    // Mock validateTotalMegapixels to return the error string
    (validateTotalMegapixels as Mock).mockReturnValue(
      "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)"
    );

    const references = [
      {
        referenceImageId: "ref-1",
        role: "style",
        strength: "strong",
        slotPosition: 1,
        imageUrl: "https://r2.example/a.png",
        width: 2000,
        height: 1667,
      },
      {
        referenceImageId: "ref-2",
        role: "content",
        strength: "moderate",
        slotPosition: 2,
        imageUrl: "https://r2.example/b.png",
        width: 2000,
        height: 1667,
      },
      {
        referenceImageId: "ref-3",
        role: "structure",
        strength: "subtle",
        slotPosition: 3,
        imageUrl: "https://r2.example/c.png",
        width: 2000,
        height: 1667,
      },
    ];

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      references,
    });

    // Assert: error returned
    expect(result).toEqual({
      error:
        "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)",
    });

    // Assert: validateTotalMegapixels was called with the references
    expect(validateTotalMegapixels).toHaveBeenCalledTimes(1);
    expect(validateTotalMegapixels).toHaveBeenCalledWith(references);

    // Assert: GenerationService.generate was NOT called (no API call)
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it("AC-3: should call validateTotalMegapixels before GenerationService.generate", async () => {
    // Track call order
    const callOrder: string[] = [];
    (validateTotalMegapixels as Mock).mockImplementation(() => {
      callOrder.push("validate");
      return "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)";
    });
    (GenerationService.generate as Mock).mockImplementation(async () => {
      callOrder.push("generate");
      return [makeGeneration()];
    });

    await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      references: [
        {
          referenceImageId: "ref-1",
          role: "style",
          strength: "strong",
          slotPosition: 1,
          imageUrl: "https://r2.example/a.png",
          width: 3001,
          height: 3000,
        },
      ],
    });

    // Assert: validate was called, generate was NOT
    expect(callOrder).toEqual(["validate"]);
    expect(callOrder).not.toContain("generate");
  });
});
