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

import { generateImages } from "@/app/actions/generations";
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
    promptMotiv: "A fox",
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
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: GenerateImagesInput interface + generateImages action (Slice 04)
// ---------------------------------------------------------------------------

describe("generateImages action - prompt simplification (Slice 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-5: GenerateImagesInput Interface ohne promptStyle/negativePrompt
  // =========================================================================

  describe("AC-5: GenerateImagesInput interface without promptStyle/negativePrompt", () => {
    /**
     * AC-5: GIVEN das Interface GenerateImagesInput in generations.ts
     * WHEN das Interface geprueft wird
     * THEN hat es KEINE Property promptStyle und KEINE Property negativePrompt
     * AND die Properties promptMotiv, modelIds, params, count, references etc. sind unveraendert
     */
    it("should not accept promptStyle in GenerateImagesInput", () => {
      const filePath = resolve(
        __dirname,
        "../../app/actions/generations.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Extract the GenerateImagesInput interface block
      const interfaceMatch = content.match(
        /interface\s+GenerateImagesInput\s*\{[\s\S]*?\n\}/
      );
      expect(interfaceMatch).not.toBeNull();

      const interfaceBlock = interfaceMatch![0];

      // promptStyle must NOT be present
      expect(interfaceBlock).not.toContain("promptStyle");
    });

    it("should not accept negativePrompt in GenerateImagesInput", () => {
      const filePath = resolve(
        __dirname,
        "../../app/actions/generations.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      const interfaceMatch = content.match(
        /interface\s+GenerateImagesInput\s*\{[\s\S]*?\n\}/
      );
      expect(interfaceMatch).not.toBeNull();

      const interfaceBlock = interfaceMatch![0];

      // negativePrompt must NOT be present
      expect(interfaceBlock).not.toContain("negativePrompt");
    });

    it("should still contain required properties (promptMotiv, modelIds, params, count, references)", () => {
      const filePath = resolve(
        __dirname,
        "../../app/actions/generations.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      const interfaceMatch = content.match(
        /interface\s+GenerateImagesInput\s*\{[\s\S]*?\n\}/
      );
      expect(interfaceMatch).not.toBeNull();

      const interfaceBlock = interfaceMatch![0];

      // Required properties must still be present
      expect(interfaceBlock).toContain("promptMotiv");
      expect(interfaceBlock).toContain("modelIds");
      expect(interfaceBlock).toContain("params");
      expect(interfaceBlock).toContain("count");
      expect(interfaceBlock).toContain("references");
      expect(interfaceBlock).toContain("projectId");
      expect(interfaceBlock).toContain("generationMode");
      expect(interfaceBlock).toContain("sourceImageUrl");
      expect(interfaceBlock).toContain("strength");
      expect(interfaceBlock).toContain("sourceGenerationId");
    });
  });

  // =========================================================================
  // AC-6: generate()-Aufruf ohne promptStyle/negativePrompt Argumente
  // =========================================================================

  describe("AC-6: generateImages calls GenerationService.generate without promptStyle/negativePrompt", () => {
    /**
     * AC-6: GIVEN die Server Action generateImages() in generations.ts
     * WHEN der GenerationService.generate()-Aufruf geprueft wird
     * THEN wird KEIN input.promptStyle und KEIN input.negativePrompt weitergereicht
     * AND der Aufruf hat 10 Argumente (statt 12)
     * AND der Default input.promptStyle ?? '' existiert NICHT mehr
     */
    it("should call GenerationService.generate without promptStyle or negativePrompt", async () => {
      const mockGenerations = [makeGeneration({ id: "gen-ac6-001" })];
      (GenerationService.generate as Mock).mockResolvedValue(mockGenerations);

      await generateImages({
        projectId: "proj-001",
        promptMotiv: "A fox",
        modelIds: ["black-forest-labs/flux-2-pro"],
        params: {},
        count: 1,
      });

      expect(GenerationService.generate).toHaveBeenCalledTimes(1);

      // Verify the call arguments: should be exactly 10
      const callArgs = (GenerationService.generate as Mock).mock.calls[0];
      expect(callArgs).toHaveLength(10);

      // Verify the argument order matches the cleaned-up signature
      expect(callArgs[0]).toBe("proj-001");      // projectId
      expect(callArgs[1]).toBe("A fox");          // promptMotiv
      expect(callArgs[2]).toEqual(["black-forest-labs/flux-2-pro"]); // modelIds
      expect(callArgs[3]).toEqual({});             // params
      expect(callArgs[4]).toBe(1);                 // count
      expect(callArgs[5]).toBeUndefined();         // generationMode
      expect(callArgs[6]).toBeUndefined();         // sourceImageUrl
      expect(callArgs[7]).toBeUndefined();         // strength
      expect(callArgs[8]).toBeUndefined();         // references
      expect(callArgs[9]).toBeUndefined();         // sourceGenerationId
    });

    it("should call GenerationService.generate with 10 args for img2img with all fields", async () => {
      const mockGenerations = [makeGeneration({ id: "gen-ac6-002" })];
      (GenerationService.generate as Mock).mockResolvedValue(mockGenerations);

      await generateImages({
        projectId: "proj-001",
        promptMotiv: "A fox in the wild",
        modelIds: ["black-forest-labs/flux-2-pro"],
        params: { guidance: 7.5 },
        count: 2,
        generationMode: "img2img",
        sourceImageUrl: "https://r2.example.com/img.png",
        strength: 0.7,
        references: [{
          referenceImageId: "ref-1",
          imageUrl: "https://r2.example.com/ref.png",
          role: "style",
          strength: "strong",
          slotPosition: 1,
        }],
        sourceGenerationId: "gen-source-001",
      });

      expect(GenerationService.generate).toHaveBeenCalledTimes(1);

      const callArgs = (GenerationService.generate as Mock).mock.calls[0];
      // Exactly 10 arguments
      expect(callArgs).toHaveLength(10);

      // Verify all 10 positional args
      expect(callArgs[0]).toBe("proj-001");
      expect(callArgs[1]).toBe("A fox in the wild");
      expect(callArgs[2]).toEqual(["black-forest-labs/flux-2-pro"]);
      expect(callArgs[3]).toEqual({ guidance: 7.5 });
      expect(callArgs[4]).toBe(2);
      expect(callArgs[5]).toBe("img2img");
      expect(callArgs[6]).toBe("https://r2.example.com/img.png");
      expect(callArgs[7]).toBe(0.7);
      expect(callArgs[8]).toEqual([{
        referenceImageId: "ref-1",
        imageUrl: "https://r2.example.com/ref.png",
        role: "style",
        strength: "strong",
        slotPosition: 1,
      }]);
      expect(callArgs[9]).toBe("gen-source-001");
    });

    it("should not apply promptStyle default value in source code", () => {
      const filePath = resolve(
        __dirname,
        "../../app/actions/generations.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // The old pattern: input.promptStyle ?? ''
      expect(content).not.toMatch(/input\.promptStyle\s*\?\?\s*['"]/);

      // Also: no promptStyle reference in the generate() call at all
      expect(content).not.toMatch(/promptStyle/);
    });

    it("should not pass negativePrompt in the generate() call in source code", () => {
      const filePath = resolve(
        __dirname,
        "../../app/actions/generations.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // No negativePrompt in the file at all (neither in interface nor in call)
      expect(content).not.toContain("negativePrompt");
    });
  });
});
