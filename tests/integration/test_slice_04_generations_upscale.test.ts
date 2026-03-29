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
  getGeneration: vi.fn().mockResolvedValue({ id: "gen-001", projectId: "proj-001" }),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
  getProject: vi.fn().mockResolvedValue({ id: "proj-001", name: "Test", userId: "user-001" }),
  getSiblingsByBatchId: vi.fn().mockResolvedValue([]),
  getVariantFamily: vi.fn().mockResolvedValue([]),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

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

// ---------------------------------------------------------------------------
// Tests: upscaleImage - prompt simplification (Slice 04)
// ---------------------------------------------------------------------------

describe("generateImages upscale - prompt simplification (Slice 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-5: GIVEN das Interface in generations.ts
   * WHEN ein Upscale-Input erstellt wird
   * THEN benoetigt er kein promptStyle und kein negativePrompt
   *
   * The upscale input never had promptStyle/negativePrompt, but this test
   * verifies that the cleaned-up file still compiles correctly and the
   * upscale path remains unaffected by the prompt simplification.
   */
  it("should not require promptStyle or negativePrompt for upscale input", async () => {
    const mockGeneration = makeGeneration({ id: "gen-upscale-s04" });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    // Call with the standard upscale input -- no promptStyle/negativePrompt needed
    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    // If TypeScript compilation succeeded and we reach here, the interface
    // does not require promptStyle or negativePrompt
    expect(result).toBeTruthy();
    expect(GenerationService.upscale).toHaveBeenCalledTimes(1);
    expect(GenerationService.upscale).toHaveBeenCalledWith({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      sourceGenerationId: undefined,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });
  });

  it("should verify UpscaleImageInput interface has no promptStyle/negativePrompt", () => {
    const filePath = resolve(
      __dirname,
      "../../app/actions/generations.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // Extract the UpscaleImageInput interface block
    const interfaceMatch = content.match(
      /interface\s+UpscaleImageInput\s*\{[\s\S]*?\n\}/
    );
    expect(interfaceMatch).not.toBeNull();

    const interfaceBlock = interfaceMatch![0];

    // No promptStyle or negativePrompt
    expect(interfaceBlock).not.toContain("promptStyle");
    expect(interfaceBlock).not.toContain("negativePrompt");

    // Existing fields still present
    expect(interfaceBlock).toContain("projectId");
    expect(interfaceBlock).toContain("sourceImageUrl");
    expect(interfaceBlock).toContain("scale");
    expect(interfaceBlock).toContain("modelId");
    expect(interfaceBlock).toContain("modelParams");
  });
});
