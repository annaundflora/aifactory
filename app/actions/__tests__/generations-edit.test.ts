import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

// Mock GenerationService — the server action delegates to it
vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
  validateTotalMegapixels: vi.fn().mockReturnValue(null),
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  createGeneration: vi.fn(),
  getGeneration: vi.fn().mockResolvedValue({ id: "gen-001", projectId: "proj-001" }),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
  createGenerationReferences: vi.fn(),
  getProject: vi.fn().mockResolvedValue({ id: "proj-001", name: "Test", userId: "user-001" }),
  getSiblingsByBatchId: vi.fn().mockResolvedValue([]),
  getVariantFamily: vi.fn().mockResolvedValue([]),
  failStalePendingGenerations: vi.fn(),
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
import { GenerationService } from "@/lib/services/generation-service";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    generationMode: "inpaint",
    sourceImageUrl: "https://r2.example.com/source.png",
    sourceGenerationId: null,
    batchId: null,
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: Server Action maskUrl Passthrough
// ---------------------------------------------------------------------------

describe("generateImages Server Action — Edit Mode Passthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (GenerationService.generate as Mock).mockResolvedValue([makeGeneration()]);
  });

  // AC-14: GIVEN die Server Action generateImages wird mit maskUrl: "https://r2.example.com/mask.png" aufgerufen
  //        WHEN generationMode ist "inpaint"
  //        THEN wird maskUrl an GenerationService.generate() durchgereicht
  it('AC-14: should pass maskUrl through to GenerationService.generate for inpaint mode', async () => {
    const maskUrl = "https://r2.example.com/mask.png";

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox in a forest",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "inpaint",
      sourceImageUrl: "https://r2.example.com/source.png",
      maskUrl,
    });

    // Should not be an error
    expect(result).not.toHaveProperty("error");

    // GenerationService.generate should have been called with maskUrl passed through
    expect(GenerationService.generate).toHaveBeenCalledTimes(1);
    expect(GenerationService.generate).toHaveBeenCalledWith(
      "proj-001",                                    // projectId
      "A fox in a forest",                           // promptMotiv
      ["black-forest-labs/flux-2-pro"],              // modelIds
      {},                                            // params
      1,                                             // count
      "inpaint",                                     // generationMode
      "https://r2.example.com/source.png",           // sourceImageUrl
      undefined,                                     // strength
      undefined,                                     // references
      undefined,                                     // sourceGenerationId
      maskUrl,                                       // maskUrl
      undefined,                                     // outpaintDirections
      undefined                                      // outpaintSize
    );
  });

  // Additional: verify outpaintDirections and outpaintSize are also passed through
  it('should pass outpaintDirections and outpaintSize through to GenerationService.generate for outpaint mode', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "Expand the landscape",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "outpaint",
      sourceImageUrl: "https://r2.example.com/source.png",
      maskUrl: "https://r2.example.com/mask.png",
      outpaintDirections: ["top", "bottom"],
      outpaintSize: 100,
    });

    expect(result).not.toHaveProperty("error");

    expect(GenerationService.generate).toHaveBeenCalledWith(
      "proj-001",
      "Expand the landscape",
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      "outpaint",
      "https://r2.example.com/source.png",
      undefined,                                     // strength
      undefined,                                     // references
      undefined,                                     // sourceGenerationId
      "https://r2.example.com/mask.png",             // maskUrl
      ["top", "bottom"],                             // outpaintDirections
      100                                            // outpaintSize
    );
  });
});
