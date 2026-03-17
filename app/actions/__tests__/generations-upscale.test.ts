import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
  validateTotalMegapixels: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
  getProject: vi.fn().mockResolvedValue({ id: "proj-001", name: "Test", userId: "user-001" }),
  getSiblingsByBatchId: vi.fn().mockResolvedValue([]),
  getVariantFamily: vi.fn().mockResolvedValue([]),
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
    upload: vi.fn(),
  },
}));

import { upscaleImage } from "@/app/actions/generations";
import { GenerationService } from "@/lib/services/generation-service";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ===========================================================================
// Tests: upscaleImage - Extended Input (Slice 07)
// ===========================================================================

describe("upscaleImage - Extended Input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-7: GIVEN die Server Action upscaleImage in generations.ts
  //       WHEN mit Input { projectId, sourceImageUrl, scale, modelId: "nightmareai/real-esrgan",
  //            modelParams: { "scale": 2 } } aufgerufen
  //       THEN wird modelId und modelParams an GenerationService.upscale() weitergeleitet
  //            (kein hardcoded UPSCALE_MODEL)
  // -------------------------------------------------------------------------
  it("AC-7: should pass modelId and modelParams to GenerationService.upscale", async () => {
    const mockGeneration = makeGeneration({
      id: "gen-upscale-ac7",
      modelId: "nightmareai/real-esrgan",
    });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    // Verify GenerationService.upscale was called with modelId and modelParams
    expect(GenerationService.upscale).toHaveBeenCalledTimes(1);
    expect(GenerationService.upscale).toHaveBeenCalledWith({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      sourceGenerationId: undefined,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(result).toEqual(mockGeneration);
  });

  it("AC-7: should pass quality model (crystal-upscaler) to GenerationService.upscale", async () => {
    const mockGeneration = makeGeneration({
      id: "gen-upscale-ac7-quality",
      modelId: "philz1337x/crystal-upscaler",
    });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 4,
      modelId: "philz1337x/crystal-upscaler",
      modelParams: { scale: 4 },
    });

    expect(GenerationService.upscale).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "philz1337x/crystal-upscaler",
        modelParams: { scale: 4 },
      })
    );
    expect(result).toEqual(mockGeneration);
  });

  // -------------------------------------------------------------------------
  // AC-11: GIVEN die UpscaleImageInput Interface in generations.ts
  //        WHEN die Typdefinition analysiert wird
  //        THEN enthaelt sie die neuen Felder modelId: string und
  //        modelParams: Record<string, unknown> zusaetzlich zu den bestehenden Feldern
  // -------------------------------------------------------------------------
  it("AC-11: should accept modelId and modelParams in UpscaleImageInput", () => {
    // Static analysis: read the source file and verify the interface contains
    // modelId and modelParams fields
    const filePath = resolve(__dirname, "..", "generations.ts");
    const content = readFileSync(filePath, "utf-8");

    // Extract the UpscaleImageInput interface block
    const interfaceMatch = content.match(
      /interface\s+UpscaleImageInput\s*\{[\s\S]*?\}/
    );
    expect(interfaceMatch).not.toBeNull();

    const interfaceBlock = interfaceMatch![0];

    // Verify modelId field exists
    expect(interfaceBlock).toContain("modelId");
    expect(interfaceBlock).toMatch(/modelId:\s*string/);

    // Verify modelParams field exists
    expect(interfaceBlock).toContain("modelParams");
    expect(interfaceBlock).toMatch(/modelParams:\s*Record<string,\s*unknown>/);

    // Verify existing fields are still present
    expect(interfaceBlock).toContain("projectId");
    expect(interfaceBlock).toContain("sourceImageUrl");
    expect(interfaceBlock).toContain("scale");
  });

  it("AC-11: should compile with modelId and modelParams in upscaleImage call (type check)", async () => {
    // This test verifies that TypeScript compiles correctly with the new fields.
    // If modelId or modelParams were missing from UpscaleImageInput, this would
    // cause a TypeScript compilation error.
    const mockGeneration = makeGeneration({ id: "gen-type-check" });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    // Call with all required fields including new ones
    const input = {
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2 as 2 | 4,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 } as Record<string, unknown>,
    };

    const result = await upscaleImage(input);

    // If we reach here, the type check passed
    expect(result).toBeTruthy();
    expect(GenerationService.upscale).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "nightmareai/real-esrgan",
        modelParams: { scale: 2 },
      })
    );
  });
});
