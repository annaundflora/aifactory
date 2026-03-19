import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock ReplicateClient
vi.mock("@/lib/clients/replicate", () => ({
  ReplicateClient: {
    run: vi.fn(),
  },
}));

// Mock StorageService
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn(),
  },
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  createGenerationReferences: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
}));

// Mock ModelCatalogService (generation-service imports from model-catalog-service)
vi.mock("@/lib/services/model-catalog-service", () => ({
  ModelCatalogService: {
    getSchema: vi.fn(),
    getByReplicateId: vi.fn(),
  },
}));

// Mock capability-detection — keep real getImg2ImgFieldName (pure function)
vi.mock("@/lib/services/capability-detection", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/services/capability-detection")
  >();
  return {
    ...actual,
  };
});

// Mock sharp
vi.mock("sharp", () => {
  const sharpInstance = {
    png: vi.fn().mockReturnThis(),
    toBuffer: vi
      .fn()
      .mockResolvedValue(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
      ),
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn };
});

import {
  GenerationService,
  validateTotalMegapixels,
  composeMultiReferencePrompt,
  type ReferenceInput,
} from "@/lib/services/generation-service";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  createGenerationReferences,
  updateGeneration,
} from "@/lib/db/queries";
import type { Generation } from "@/lib/db/queries";
import { ModelCatalogService } from "@/lib/services/model-catalog-service";

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
    sourceImageUrl: "https://r2.example/source.png",
    sourceGenerationId: null,
    ...overrides,
  } as Generation;
}

/** Create a ReadableStream from a Buffer */
function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

/** PNG magic bytes buffer */
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
]);

function makeReferenceInput(
  overrides: Partial<ReferenceInput> = {}
): ReferenceInput {
  return {
    referenceImageId: "ref-1",
    imageUrl: "https://r2.example/a.png",
    role: "style",
    strength: "strong",
    slotPosition: 1,
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

/**
 * Set up default mocks for background processing (fire-and-forget).
 * Ensures processGeneration can complete without errors.
 */
function setupBackgroundMocks() {
  (ReplicateClient.run as Mock).mockResolvedValue({
    output: bufferToStream(PNG_BUFFER),
    seed: 42,
    predictionId: "pred-001",
  });
  (StorageService.upload as Mock).mockResolvedValue(
    "https://r2.example/output.png"
  );
  (updateGeneration as Mock).mockImplementation(
    async (id: string, data: Partial<Generation>) =>
      makeGeneration({ id, ...data })
  );
  (createGenerationReferences as Mock).mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Tests: buildReplicateInput - Multi-Reference
// ---------------------------------------------------------------------------

describe("buildReplicateInput - Multi-Reference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-2: GIVEN generateImages wird mit 3 References (slotPosition 1, 3, 5) aufgerufen
   *       WHEN buildReplicateInput() den Replicate-Input baut
   *       THEN enthaelt input[img2imgField] ein Array mit 3 URLs, sortiert nach slotPosition aufsteigend
   */
  it("AC-2: should build input_images array with URLs sorted by slotPosition ascending", async () => {
    // Arrange: 3 references with out-of-order slotPositions
    const references: ReferenceInput[] = [
      makeReferenceInput({
        referenceImageId: "ref-5",
        imageUrl: "https://r2.example/c.png",
        slotPosition: 5,
      }),
      makeReferenceInput({
        referenceImageId: "ref-1",
        imageUrl: "https://r2.example/a.png",
        slotPosition: 1,
      }),
      makeReferenceInput({
        referenceImageId: "ref-3",
        imageUrl: "https://r2.example/b.png",
        slotPosition: 3,
      }),
    ];

    // ModelCatalogService.getSchema returns schema with input_images field
    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      input_images: { type: "array" },
    });

    // createGeneration returns a pending generation with img2img mode
    const pendingGen = makeGeneration({
      generationMode: "img2img",
      prompt:
        "A fox. Reference guidance: @image1 provides style reference with strong influence. @image3 provides style reference with strong influence. @image5 provides style reference with strong influence.",
    });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    // Act: trigger generate which internally calls buildReplicateInput
    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      undefined,
      0.6,
      references
    );

    // Allow fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 50));

    // Assert: ReplicateClient.run was called with input_images array sorted by slotPosition
    expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
    const callArgs = (ReplicateClient.run as Mock).mock.calls[0];
    const input = callArgs[1];

    expect(input.input_images).toEqual([
      "https://r2.example/a.png",
      "https://r2.example/b.png",
      "https://r2.example/c.png",
    ]);
    expect(input.input_images).toHaveLength(3);
  });

  /**
   * AC-5: GIVEN generateImages wird OHNE references aufgerufen (undefined oder leeres Array)
   *       und die Generation hat sourceImageUrl gesetzt
   *       WHEN buildReplicateInput() den Input baut
   *       THEN wird der bestehende Fallback-Pfad genutzt: input[img2imgField] enthaelt sourceImageUrl
   *       (als Array oder String je nach isArray-Flag)
   */
  it("AC-5: should fall back to sourceImageUrl when no references exist", async () => {
    const sourceUrl = "https://r2.example/source.png";

    // Schema with input_images (isArray: true)
    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      input_images: { type: "array" },
    });

    const pendingGen = makeGeneration({
      generationMode: "img2img",
      sourceImageUrl: sourceUrl,
    });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    // Act: generate without references (undefined)
    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      sourceUrl,
      0.6,
      undefined // no references
    );

    await new Promise((r) => setTimeout(r, 50));

    // Assert: fallback uses sourceImageUrl wrapped in array (because isArray is true)
    expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
    const input = (ReplicateClient.run as Mock).mock.calls[0][1];
    expect(input.input_images).toEqual([sourceUrl]);
  });

  it("AC-5: should fall back to sourceImageUrl as string when isArray is false", async () => {
    const sourceUrl = "https://r2.example/source.png";

    // Schema with image_prompt (isArray: false)
    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      image_prompt: { type: "string" },
    });

    const pendingGen = makeGeneration({
      generationMode: "img2img",
      sourceImageUrl: sourceUrl,
    });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      sourceUrl,
      0.6,
      undefined
    );

    await new Promise((r) => setTimeout(r, 50));

    const input = (ReplicateClient.run as Mock).mock.calls[0][1];
    expect(input.image_prompt).toBe(sourceUrl);
  });

  /**
   * AC-6: GIVEN generateImages wird mit References aufgerufen und promptMotiv "Extract @3 in style of @1",
   *       promptStyle "oil painting"
   *       WHEN der Prompt komponiert wird
   *       THEN wird composeMultiReferencePrompt() mit dem komponierten Prompt und den References aufgerufen
   *       und das Ergebnis als prompt an Replicate gesendet
   */
  it("AC-6: should call composeMultiReferencePrompt and use result as prompt when references exist", async () => {
    const references: ReferenceInput[] = [
      makeReferenceInput({ slotPosition: 1, role: "style", strength: "strong" }),
      makeReferenceInput({
        referenceImageId: "ref-3",
        imageUrl: "https://r2.example/b.png",
        slotPosition: 3,
        role: "content",
        strength: "moderate",
      }),
    ];

    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      input_images: { type: "array" },
    });

    // The prompt gets composed inside generate():
    // 1. motivTrimmed + styleTrimmed => "Extract @3 in style of @1. oil painting"
    // 2. composeMultiReferencePrompt maps @N -> @imageN and adds guidance
    // Expected composed prompt from the real composeMultiReferencePrompt:
    const expectedPrompt = composeMultiReferencePrompt(
      "Extract @3 in style of @1. oil painting",
      [
        { slotPosition: 1, role: "style", strength: "strong" },
        { slotPosition: 3, role: "content", strength: "moderate" },
      ]
    );

    const pendingGen = makeGeneration({
      generationMode: "img2img",
      prompt: expectedPrompt,
    });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "Extract @3 in style of @1",
      "oil painting",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      undefined,
      0.6,
      references
    );

    await new Promise((r) => setTimeout(r, 50));

    // Assert: createGeneration was called with the composed prompt containing @imageN tokens
    const createCall = (createGeneration as Mock).mock.calls[0][0];
    expect(createCall.prompt).toBe(expectedPrompt);
    expect(createCall.prompt).toContain("@image1");
    expect(createCall.prompt).toContain("@image3");
    expect(createCall.prompt).toContain("Reference guidance:");

    // Assert: Replicate was called with the composed prompt
    expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
    const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
    expect(replicateInput.prompt).toBe(expectedPrompt);
  });

  /**
   * AC-8: GIVEN generateImages wird mit references: [] (leeres Array) aufgerufen
   *       WHEN die Generation ausgefuehrt wird
   *       THEN wird composeMultiReferencePrompt NICHT aufgerufen, keine generation_references-Records erstellt,
   *       und die Generation laeuft wie bisher (Rueckwaertskompatibilitaet)
   */
  it("AC-8: should not call composeMultiReferencePrompt when references array is empty", async () => {
    const sourceUrl = "https://r2.example/source.png";

    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      input_images: { type: "array" },
    });

    const pendingGen = makeGeneration({
      generationMode: "img2img",
      sourceImageUrl: sourceUrl,
      prompt: "A fox", // plain prompt, no reference guidance
    });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      sourceUrl,
      0.6,
      [] // empty references array
    );

    await new Promise((r) => setTimeout(r, 50));

    // Assert: createGeneration prompt does NOT contain Reference guidance
    const createCall = (createGeneration as Mock).mock.calls[0][0];
    expect(createCall.prompt).toBe("A fox");
    expect(createCall.prompt).not.toContain("Reference guidance:");
    expect(createCall.prompt).not.toContain("@image");

    // Assert: no generation_references created
    expect(createGenerationReferences).not.toHaveBeenCalled();

    // Assert: fallback path used (sourceImageUrl in array)
    const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
    expect(replicateInput.input_images).toEqual([sourceUrl]);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateTotalMegapixels
// ---------------------------------------------------------------------------

describe("validateTotalMegapixels", () => {
  /**
   * AC-3: GIVEN generateImages wird mit References aufgerufen und die Referenz-Bilder
   *       haben eine Gesamt-Aufloesung von 10 MP (z.B. 3x 2000x1667)
   *       WHEN die Megapixel-Validierung prueft
   *       THEN wird { error: "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)" }
   *       zurueckgegeben und KEIN Replicate API-Call ausgefuehrt
   */
  it("AC-3: should return error when total megapixels exceed 9 MP", () => {
    // 3 images at 2000x1667 = 3 * 3,334,000 = 10,002,000 pixels ~ 10 MP
    const references: ReferenceInput[] = [
      makeReferenceInput({ width: 2000, height: 1667, slotPosition: 1 }),
      makeReferenceInput({ width: 2000, height: 1667, slotPosition: 2 }),
      makeReferenceInput({ width: 2000, height: 1667, slotPosition: 3 }),
    ];

    const result = validateTotalMegapixels(references);

    expect(result).toBe(
      "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)"
    );
  });

  it("AC-3: should return error for exactly over 9 MP", () => {
    // 9,000,001 pixels = just over 9 MP
    const references: ReferenceInput[] = [
      makeReferenceInput({ width: 3001, height: 3000, slotPosition: 1 }),
    ];

    const result = validateTotalMegapixels(references);

    expect(result).toBe(
      "Gesamte Bildgroesse ueberschreitet API-Limit (max 9 MP)"
    );
  });

  /**
   * AC-4: GIVEN generateImages wird mit References aufgerufen und die Gesamt-Aufloesung ist 8.5 MP
   *       WHEN die Megapixel-Validierung prueft
   *       THEN wird die Generation normal ausgefuehrt (kein Fehler)
   */
  it("AC-4: should pass validation when total megapixels are within 9 MP limit", () => {
    // 8.5 MP: e.g. 2 images at ~2062x2062 = 2 * 4,251,844 = 8,503,688 ~ 8.5 MP
    const references: ReferenceInput[] = [
      makeReferenceInput({ width: 2062, height: 2062, slotPosition: 1 }),
      makeReferenceInput({ width: 2062, height: 2062, slotPosition: 2 }),
    ];

    const result = validateTotalMegapixels(references);

    expect(result).toBeNull();
  });

  it("AC-4: should pass validation at exactly 9 MP", () => {
    // Exactly 9,000,000 pixels = 9 MP
    const references: ReferenceInput[] = [
      makeReferenceInput({ width: 3000, height: 3000, slotPosition: 1 }),
    ];

    const result = validateTotalMegapixels(references);

    expect(result).toBeNull();
  });

  it("AC-4: should pass validation when references have no dimensions", () => {
    // No width/height => 0 MP total, should pass
    const references: ReferenceInput[] = [
      makeReferenceInput({ width: undefined, height: undefined, slotPosition: 1 }),
    ];

    const result = validateTotalMegapixels(references);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: createGenerationReferences integration in generate()
// ---------------------------------------------------------------------------

describe("createGenerationReferences - via generate()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-7: GIVEN generateImages wird mit 2 References aufgerufen und die Generation ist erfolgreich
   *       WHEN die generation_references-Records erstellt werden
   *       THEN werden genau 2 Records via createGenerationReferences() Batch-Insert erstellt (ein Call, kein Loop)
   */
  it("AC-7: should batch-insert generation references in a single call after successful generation", async () => {
    const references: ReferenceInput[] = [
      makeReferenceInput({
        referenceImageId: "ref-1",
        role: "style",
        strength: "strong",
        slotPosition: 1,
      }),
      makeReferenceInput({
        referenceImageId: "ref-2",
        imageUrl: "https://r2.example/b.png",
        role: "content",
        strength: "moderate",
        slotPosition: 2,
      }),
    ];

    (ModelCatalogService.getSchema as Mock).mockResolvedValue({
      input_images: { type: "array" },
    });

    const pendingGen = makeGeneration({ generationMode: "img2img" });
    (createGeneration as Mock).mockResolvedValue(pendingGen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "img2img",
      undefined,
      0.6,
      references
    );

    // Wait for fire-and-forget processing to complete
    await new Promise((r) => setTimeout(r, 100));

    // Assert: createGenerationReferences was called exactly once (batch, not loop)
    expect(createGenerationReferences).toHaveBeenCalledTimes(1);

    // Assert: called with array of 2 reference records
    const batchArg = (createGenerationReferences as Mock).mock.calls[0][0];
    expect(batchArg).toHaveLength(2);
    expect(batchArg[0]).toEqual({
      generationId: pendingGen.id,
      referenceImageId: "ref-1",
      role: "style",
      strength: "strong",
      slotPosition: 1,
    });
    expect(batchArg[1]).toEqual({
      generationId: pendingGen.id,
      referenceImageId: "ref-2",
      role: "content",
      strength: "moderate",
      slotPosition: 2,
    });
  });
});
