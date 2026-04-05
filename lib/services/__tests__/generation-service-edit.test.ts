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

// Mock ModelCatalogService
vi.mock("@/lib/services/model-catalog-service", () => ({
  ModelCatalogService: {
    getSchema: vi.fn(),
    getByReplicateId: vi.fn(),
  },
}));

// Mock capability-detection — keep real functions (pure)
vi.mock("@/lib/services/capability-detection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/capability-detection")>();
  return {
    ...actual,
  };
});

// Mock sharp
vi.mock("sharp", () => {
  const sharpInstance = {
    png: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn };
});

import { GenerationService } from "@/lib/services/generation-service";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  updateGeneration,
  type Generation,
} from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox in a forest",
    promptMotiv: "A fox in a forest",
    isFavorite: false,
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
    generationMode: "txt2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    batchId: null,
    ...overrides,
  } as Generation;
}

/** Common valid args for generate() calls in edit mode tests */
const PROJECT_ID = "proj-001";
const PROMPT = "A fox in a forest";
const MODEL_IDS = ["black-forest-labs/flux-2-pro"];
const PARAMS = {};
const COUNT = 1;
const SOURCE_IMAGE_URL = "https://r2.example.com/source.png";
const MASK_URL = "https://r2.example.com/mask.png";

/**
 * Set up default mocks for a successful generate() call.
 * The validation tests only care about whether generate() throws,
 * not about the downstream processing.
 */
function setupDefaultMocks() {
  (createGeneration as Mock).mockResolvedValue(makeGeneration());
  (ReplicateClient.run as Mock).mockResolvedValue({
    output: bufferToStream(PNG_BUFFER),
    predictionId: "pred-1",
    seed: 42,
  });
  (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/result.png");
  (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GenerationService Edit Modes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe("Validation", () => {
    // AC-1: GIVEN generationMode ist "inpaint"
    //       WHEN GenerationService.generate() aufgerufen wird mit gueltigem sourceImageUrl und maskUrl
    //       THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)
    it('AC-1: should accept generationMode "inpaint" with sourceImageUrl and maskUrl', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "inpaint",
          SOURCE_IMAGE_URL,
          undefined, // strength
          undefined, // references
          undefined, // sourceGenerationId
          MASK_URL
        )
      ).resolves.not.toThrow();

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "inpaint",
          sourceImageUrl: SOURCE_IMAGE_URL,
        })
      );
    });

    // AC-2: GIVEN generationMode ist "erase"
    //       WHEN GenerationService.generate() aufgerufen wird mit gueltigem sourceImageUrl und maskUrl
    //       THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)
    it('AC-2: should accept generationMode "erase" with sourceImageUrl and maskUrl', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "erase",
          SOURCE_IMAGE_URL,
          undefined,
          undefined,
          undefined,
          MASK_URL
        )
      ).resolves.not.toThrow();

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "erase",
          sourceImageUrl: SOURCE_IMAGE_URL,
        })
      );
    });

    // AC-3: GIVEN generationMode ist "instruction"
    //       WHEN GenerationService.generate() aufgerufen wird mit gueltigem sourceImageUrl und Prompt
    //       THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)
    it('AC-3: should accept generationMode "instruction" with sourceImageUrl and prompt', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "instruction",
          SOURCE_IMAGE_URL
        )
      ).resolves.not.toThrow();

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "instruction",
          sourceImageUrl: SOURCE_IMAGE_URL,
        })
      );
    });

    // AC-4: GIVEN generationMode ist "outpaint"
    //       WHEN GenerationService.generate() aufgerufen wird mit gueltigem sourceImageUrl, outpaintDirections: ["top"] und outpaintSize: 50
    //       THEN wird KEIN Validation-Error geworfen (Modus wird akzeptiert)
    it('AC-4: should accept generationMode "outpaint" with sourceImageUrl, outpaintDirections, and outpaintSize', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "outpaint",
          SOURCE_IMAGE_URL,
          undefined, // strength
          undefined, // references
          undefined, // sourceGenerationId
          MASK_URL,
          ["top"],
          50
        )
      ).resolves.not.toThrow();

      expect(createGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          generationMode: "outpaint",
          sourceImageUrl: SOURCE_IMAGE_URL,
        })
      );
    });

    // AC-5: GIVEN generationMode ist "inpaint" und maskUrl fehlt
    //       WHEN GenerationService.generate() aufgerufen wird
    //       THEN wird Error "Maske ist erforderlich fuer Inpaint/Erase" geworfen
    it('AC-5: should throw "Maske ist erforderlich fuer Inpaint/Erase" when inpaint without maskUrl', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "inpaint",
          SOURCE_IMAGE_URL
          // no maskUrl
        )
      ).rejects.toThrow("Maske ist erforderlich fuer Inpaint/Erase");
    });

    // AC-6: GIVEN generationMode ist "erase" und maskUrl fehlt
    //       WHEN GenerationService.generate() aufgerufen wird
    //       THEN wird Error "Maske ist erforderlich fuer Inpaint/Erase" geworfen
    it('AC-6: should throw "Maske ist erforderlich fuer Inpaint/Erase" when erase without maskUrl', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "erase",
          SOURCE_IMAGE_URL
          // no maskUrl
        )
      ).rejects.toThrow("Maske ist erforderlich fuer Inpaint/Erase");
    });

    // AC-7: GIVEN generationMode ist "outpaint" und outpaintDirections ist leer
    //       WHEN GenerationService.generate() aufgerufen wird
    //       THEN wird Error "Mindestens eine Richtung erforderlich" geworfen
    it('AC-7: should throw "Mindestens eine Richtung erforderlich" when outpaint without outpaintDirections', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "outpaint",
          SOURCE_IMAGE_URL,
          undefined, // strength
          undefined, // references
          undefined, // sourceGenerationId
          MASK_URL,
          [],        // empty outpaintDirections
          50
        )
      ).rejects.toThrow("Mindestens eine Richtung erforderlich");
    });

    // AC-8: GIVEN generationMode ist "outpaint" und outpaintSize ist 99
    //       WHEN GenerationService.generate() aufgerufen wird
    //       THEN wird Error "Ungueltiger Erweiterungswert" geworfen
    it('AC-8: should throw "Ungueltiger Erweiterungswert" when outpaintSize is 99', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "outpaint",
          SOURCE_IMAGE_URL,
          undefined, // strength
          undefined, // references
          undefined, // sourceGenerationId
          MASK_URL,
          ["top"],
          99         // invalid size
        )
      ).rejects.toThrow("Ungueltiger Erweiterungswert");
    });

    // AC-13: GIVEN generationMode ist "invalidmode"
    //        WHEN GenerationService.generate() aufgerufen wird
    //        THEN wird Error "Ungueltiger Generierungsmodus" geworfen
    it('AC-13: should throw "Ungueltiger Generierungsmodus" for unknown generationMode', async () => {
      await expect(
        GenerationService.generate(
          PROJECT_ID,
          PROMPT,
          MODEL_IDS,
          PARAMS,
          COUNT,
          "invalidmode",
          SOURCE_IMAGE_URL
        )
      ).rejects.toThrow("Ungueltiger Generierungsmodus");
    });
  });

  // =========================================================================
  // buildReplicateInput Tests
  // =========================================================================

  describe("buildReplicateInput", () => {
    // AC-9: GIVEN eine Generation mit generationMode: "inpaint", sourceImageUrl und maskUrl
    //       WHEN buildReplicateInput() das Input-Objekt baut
    //       THEN enthaelt das Result die Keys image (= sourceImageUrl), mask (= maskUrl), prompt
    it("AC-9: should build inpaint input with image, mask, and prompt keys", async () => {
      (createGeneration as Mock).mockResolvedValue(
        makeGeneration({
          generationMode: "inpaint",
          sourceImageUrl: SOURCE_IMAGE_URL,
          modelParams: { maskUrl: MASK_URL },
          prompt: PROMPT,
        })
      );

      await GenerationService.generate(
        PROJECT_ID,
        PROMPT,
        MODEL_IDS,
        PARAMS,
        COUNT,
        "inpaint",
        SOURCE_IMAGE_URL,
        undefined,
        undefined,
        undefined,
        MASK_URL
      );

      // Wait for fire-and-forget processing to call ReplicateClient.run
      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput).toHaveProperty("image", SOURCE_IMAGE_URL);
      expect(replicateInput).toHaveProperty("mask", MASK_URL);
      expect(replicateInput).toHaveProperty("prompt", PROMPT);
      // Internal audit fields must not leak
      expect(replicateInput).not.toHaveProperty("maskUrl");
      expect(replicateInput).not.toHaveProperty("outpaintDirections");
      expect(replicateInput).not.toHaveProperty("outpaintSize");
    });

    // AC-10: GIVEN eine Generation mit generationMode: "erase", sourceImageUrl und maskUrl
    //        WHEN buildReplicateInput() das Input-Objekt baut
    //        THEN enthaelt das Result die Keys image (= sourceImageUrl), mask (= maskUrl) und KEINEN Key prompt
    it("AC-10: should build erase input with image and mask keys, without prompt", async () => {
      (createGeneration as Mock).mockResolvedValue(
        makeGeneration({
          generationMode: "erase",
          sourceImageUrl: SOURCE_IMAGE_URL,
          modelParams: { maskUrl: MASK_URL },
          prompt: PROMPT,
        })
      );

      await GenerationService.generate(
        PROJECT_ID,
        PROMPT,
        MODEL_IDS,
        PARAMS,
        COUNT,
        "erase",
        SOURCE_IMAGE_URL,
        undefined,
        undefined,
        undefined,
        MASK_URL
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput).toHaveProperty("image", SOURCE_IMAGE_URL);
      expect(replicateInput).toHaveProperty("mask", MASK_URL);
      expect(replicateInput).not.toHaveProperty("prompt");
      // Internal audit fields must not leak
      expect(replicateInput).not.toHaveProperty("maskUrl");
    });

    // AC-11: GIVEN eine Generation mit generationMode: "instruction", sourceImageUrl und Prompt
    //        WHEN buildReplicateInput() das Input-Objekt baut
    //        THEN enthaelt das Result die Keys image_url (= sourceImageUrl), prompt und KEINEN Key mask
    it("AC-11: should build instruction input with image_url and prompt keys, without mask", async () => {
      (createGeneration as Mock).mockResolvedValue(
        makeGeneration({
          generationMode: "instruction",
          sourceImageUrl: SOURCE_IMAGE_URL,
          modelParams: {},
          prompt: PROMPT,
        })
      );

      await GenerationService.generate(
        PROJECT_ID,
        PROMPT,
        MODEL_IDS,
        PARAMS,
        COUNT,
        "instruction",
        SOURCE_IMAGE_URL
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      expect(replicateInput).toHaveProperty("image_url", SOURCE_IMAGE_URL);
      expect(replicateInput).toHaveProperty("prompt", PROMPT);
      expect(replicateInput).not.toHaveProperty("mask");
      expect(replicateInput).not.toHaveProperty("image");
    });

    // AC-12: GIVEN eine Generation mit generationMode: "outpaint", sourceImageUrl, outpaintDirections und Prompt
    //        WHEN buildReplicateInput() das Input-Objekt baut
    //        THEN fetcht es das Source-Image, erstellt extended canvas + mask via sharp,
    //             uploaded beides zu R2 via StorageService.upload(),
    //             und uebergibt die R2-URLs als image/mask an ReplicateClient.run
    it("AC-12: should build outpaint input with image, mask, and prompt keys", async () => {
      const EXTENDED_IMAGE_URL = "https://r2.example.com/outpaint-ext.png";
      const GENERATED_MASK_URL = "https://r2.example.com/outpaint-mask.png";

      (createGeneration as Mock).mockResolvedValue(
        makeGeneration({
          generationMode: "outpaint",
          sourceImageUrl: SOURCE_IMAGE_URL,
          modelParams: { maskUrl: MASK_URL, outpaintDirections: ["top"], outpaintSize: 50 },
          prompt: PROMPT,
        })
      );

      // Mock fetch for source image retrieval (slice-13 server-side canvas extension)
      const sourceImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(sourceImageBuffer.buffer.slice(
          sourceImageBuffer.byteOffset,
          sourceImageBuffer.byteOffset + sourceImageBuffer.byteLength
        )),
      }));

      // Mock StorageService.upload to return distinct URLs for extended image and mask
      (StorageService.upload as Mock)
        .mockResolvedValueOnce(EXTENDED_IMAGE_URL)   // first call: extended image
        .mockResolvedValueOnce(GENERATED_MASK_URL)   // second call: generated mask
        .mockResolvedValue("https://r2.example.com/result.png"); // subsequent: final result

      await GenerationService.generate(
        PROJECT_ID,
        PROMPT,
        MODEL_IDS,
        PARAMS,
        COUNT,
        "outpaint",
        SOURCE_IMAGE_URL,
        undefined,
        undefined,
        undefined,
        MASK_URL,
        ["top"],
        50
      );

      await vi.waitFor(() => {
        expect(ReplicateClient.run).toHaveBeenCalledTimes(1);
      });

      // Verify fetch was called with the source image URL
      expect(fetch).toHaveBeenCalledWith(SOURCE_IMAGE_URL);

      // Verify StorageService.upload was called for extended image and mask
      expect(StorageService.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining("outpaint-ext-")
      );
      expect(StorageService.upload).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining("outpaint-mask-")
      );

      const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
      // image and mask should be the R2 URLs from StorageService.upload, not the original URLs
      expect(replicateInput).toHaveProperty("image", EXTENDED_IMAGE_URL);
      expect(replicateInput).toHaveProperty("mask", GENERATED_MASK_URL);
      expect(replicateInput).toHaveProperty("prompt", PROMPT);
      // Internal audit fields must not leak into Replicate input
      expect(replicateInput).not.toHaveProperty("maskUrl");
      expect(replicateInput).not.toHaveProperty("outpaintDirections");
      expect(replicateInput).not.toHaveProperty("outpaintSize");
    });
  });
});
