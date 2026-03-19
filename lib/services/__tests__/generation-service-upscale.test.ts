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
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
  createGenerationReferences: vi.fn(),
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
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    metadata: vi.fn().mockResolvedValue({ width: 2048, height: 1536 }),
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

/** PNG magic bytes for buffer mocking */
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

function bufferToStream(buffer: Buffer): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "Upscale 2x",
    negativePrompt: null,
    modelId: "nightmareai/real-esrgan",
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

function setupUpscaleProcessingMocks() {
  (ReplicateClient.run as Mock).mockResolvedValue({
    output: bufferToStream(PNG_BUFFER),
    predictionId: "pred-upscale",
    seed: 100,
  });
  (StorageService.upload as Mock).mockResolvedValue("https://r2.example.com/upscaled.png");
  (updateGeneration as Mock).mockResolvedValue(makeGeneration({ status: "completed" }));
}

// ===========================================================================
// Tests: GenerationService.upscale - Dynamic Model (Slice 07)
// ===========================================================================

describe("GenerationService.upscale - Dynamic Model", () => {
  const SOURCE_IMAGE_URL = "https://r2.example.com/source/upscale-input.png";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-8: GIVEN die Funktion upscale() in generation-service.ts
  //       WHEN mit modelId: "philz1337x/crystal-upscaler" und
  //       modelParams: { "scale": 4 } aufgerufen
  //       THEN wird das uebergebene modelId fuer den Replicate-Call und fuer
  //       createGeneration() verwendet (statt UPSCALE_MODEL Konstante)
  // -------------------------------------------------------------------------
  it("AC-8: should use provided modelId for Replicate call and createGeneration", async () => {
    const gen = makeGeneration({
      id: "gen-up-ac8",
      generationMode: "upscale",
      sourceImageUrl: SOURCE_IMAGE_URL,
      prompt: "Upscale 4x",
      modelId: "philz1337x/crystal-upscaler",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupUpscaleProcessingMocks();

    const result = await GenerationService.upscale({
      projectId: "proj-001",
      sourceImageUrl: SOURCE_IMAGE_URL,
      scale: 4,
      modelId: "philz1337x/crystal-upscaler",
      modelParams: { scale: 4 },
    });

    // 1. Verify createGeneration received the provided modelId (not hardcoded)
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "philz1337x/crystal-upscaler",
        generationMode: "upscale",
        sourceImageUrl: SOURCE_IMAGE_URL,
      })
    );

    // 2. Wait for fire-and-forget processing to complete
    await vi.waitFor(() => {
      expect(ReplicateClient.run).toHaveBeenCalled();
    });

    // 3. Verify ReplicateClient.run was called with the provided modelId
    expect(ReplicateClient.run).toHaveBeenCalledWith(
      "philz1337x/crystal-upscaler",
      expect.objectContaining({
        image: SOURCE_IMAGE_URL,
        scale: 4,
      })
    );

    // 4. Verify the returned generation has the correct modelId
    expect(result.modelId).toBe("philz1337x/crystal-upscaler");
  });

  it("AC-8: should use nightmareai/real-esrgan when provided as modelId", async () => {
    const gen = makeGeneration({
      id: "gen-up-ac8-draft",
      generationMode: "upscale",
      sourceImageUrl: SOURCE_IMAGE_URL,
      prompt: "Upscale 2x",
      modelId: "nightmareai/real-esrgan",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupUpscaleProcessingMocks();

    await GenerationService.upscale({
      projectId: "proj-001",
      sourceImageUrl: SOURCE_IMAGE_URL,
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    // Verify createGeneration received the provided modelId
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "nightmareai/real-esrgan",
      })
    );

    // Wait for fire-and-forget processing
    await vi.waitFor(() => {
      expect(ReplicateClient.run).toHaveBeenCalled();
    });

    // Verify Replicate was called with the provided modelId
    expect(ReplicateClient.run).toHaveBeenCalledWith(
      "nightmareai/real-esrgan",
      expect.objectContaining({
        image: SOURCE_IMAGE_URL,
        scale: 2,
      })
    );
  });

  it("AC-8: should merge modelParams into Replicate input (model-specific params)", async () => {
    const gen = makeGeneration({
      id: "gen-up-ac8-params",
      generationMode: "upscale",
      sourceImageUrl: SOURCE_IMAGE_URL,
      prompt: "Upscale 4x",
      modelId: "philz1337x/crystal-upscaler",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupUpscaleProcessingMocks();

    await GenerationService.upscale({
      projectId: "proj-001",
      sourceImageUrl: SOURCE_IMAGE_URL,
      scale: 4,
      modelId: "philz1337x/crystal-upscaler",
      modelParams: { scale: 4, noise_level: "low", denoise_strength: 0.5 },
    });

    // Wait for fire-and-forget processing
    await vi.waitFor(() => {
      expect(ReplicateClient.run).toHaveBeenCalled();
    });

    // Verify that modelParams are merged into Replicate input
    // image and scale take precedence over modelParams values
    const replicateInput = (ReplicateClient.run as Mock).mock.calls[0][1];
    expect(replicateInput).toEqual(
      expect.objectContaining({
        image: SOURCE_IMAGE_URL,
        scale: 4,  // from direct param, overrides modelParams.scale
        noise_level: "low",  // from modelParams
        denoise_strength: 0.5,  // from modelParams
      })
    );
  });

  it("AC-8: should NOT use hardcoded UPSCALE_MODEL constant", () => {
    // Static analysis: verify the generation-service.ts file does not import UPSCALE_MODEL
    const fs = require("fs");
    const path = require("path");
    const filePath = path.resolve(__dirname, "..", "generation-service.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    // The import of UPSCALE_MODEL should have been removed
    expect(content).not.toMatch(/import\s*\{[^}]*UPSCALE_MODEL[^}]*\}\s*from/);

    // The constant should not be referenced anywhere in the upscale function
    const upscaleSection = content.slice(
      content.indexOf("async function upscale("),
      content.indexOf("export const GenerationService")
    );
    expect(upscaleSection).not.toContain("UPSCALE_MODEL");
  });
});
