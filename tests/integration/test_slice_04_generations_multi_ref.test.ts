import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

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
  createGenerationReferences: vi.fn(),
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
    generationMode: "img2img",
    sourceImageUrl: null,
    sourceGenerationId: null,
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: generateImages multi-ref - prompt simplification (Slice 04)
// ---------------------------------------------------------------------------

describe("generateImages multi-ref - prompt simplification (Slice 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-6: GIVEN die Server Action generateImages() in generations.ts
   * WHEN der GenerationService.generate()-Aufruf mit references im multi-ref Szenario geprueft wird
   * THEN wird KEIN input.promptStyle und KEIN input.negativePrompt weitergereicht
   * AND der Aufruf hat 10 Argumente (statt 12)
   *
   * This tests the multi-reference scenario specifically, ensuring that even with
   * references the cleaned-up interface works correctly without promptStyle/negativePrompt.
   */
  it("should call GenerationService.generate without promptStyle or negativePrompt in multi-ref scenario", async () => {
    const pendingGen = makeGeneration({ id: "gen-multi-ref-001" });
    (GenerationService.generate as Mock).mockResolvedValue([pendingGen]);

    const references = [
      {
        referenceImageId: "ref-1",
        imageUrl: "https://r2.example/a.png",
        role: "style",
        strength: "strong",
        slotPosition: 1,
        width: 1920,
        height: 1080,
      },
      {
        referenceImageId: "ref-2",
        imageUrl: "https://r2.example/b.png",
        role: "content",
        strength: "moderate",
        slotPosition: 2,
        width: 1024,
        height: 768,
      },
    ];

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox with multiple references",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: { guidance: 7.5 },
      count: 1,
      generationMode: "img2img",
      references,
    });

    expect(GenerationService.generate).toHaveBeenCalledTimes(1);

    // Verify exactly 10 arguments
    const callArgs = (GenerationService.generate as Mock).mock.calls[0];
    expect(callArgs).toHaveLength(10);

    // Verify argument positions (no promptStyle/negativePrompt slots)
    expect(callArgs[0]).toBe("proj-001");          // projectId
    expect(callArgs[1]).toBe("A fox with multiple references"); // promptMotiv
    expect(callArgs[2]).toEqual(["black-forest-labs/flux-2-pro"]); // modelIds
    expect(callArgs[3]).toEqual({ guidance: 7.5 }); // params
    expect(callArgs[4]).toBe(1);                     // count
    expect(callArgs[5]).toBe("img2img");             // generationMode
    expect(callArgs[6]).toBeUndefined();             // sourceImageUrl
    expect(callArgs[7]).toBeUndefined();             // strength
    expect(callArgs[8]).toEqual(references);          // references (at position 8, not 10)
    expect(callArgs[9]).toBeUndefined();             // sourceGenerationId

    // Verify result is success
    expect(Array.isArray(result)).toBe(true);
    expect((result as Generation[])[0].id).toBe("gen-multi-ref-001");
  });

  it("should not include promptStyle or negativePrompt as arguments even with sourceGenerationId", async () => {
    const pendingGen = makeGeneration({ id: "gen-variant-001" });
    (GenerationService.generate as Mock).mockResolvedValue([pendingGen]);

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "Variant of a fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/source.png",
      strength: 0.6,
      sourceGenerationId: "gen-source-001",
    });

    const callArgs = (GenerationService.generate as Mock).mock.calls[0];

    // Exactly 10 arguments: the old promptStyle and negativePrompt slots are gone
    expect(callArgs).toHaveLength(10);

    // sourceGenerationId is now at position 9 (was previously at a higher index)
    expect(callArgs[9]).toBe("gen-source-001");

    expect(Array.isArray(result)).toBe(true);
  });
});
