import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock auth guard (needed for server action tests)
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

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
    delete: vi.fn(),
  },
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
  deleteGeneration: vi.fn(),
  getProject: vi.fn().mockResolvedValue({ id: "proj-001", name: "Test", userId: "user-001" }),
  getSiblingsByBatchId: vi.fn().mockResolvedValue([]),
  getVariantFamily: vi.fn().mockResolvedValue([]),
}));

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

// Mock next/cache (needed for server action tests)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { GenerationService } from "@/lib/services/generation-service";
import { ReplicateClient } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import {
  createGeneration,
  updateGeneration,
} from "@/lib/db/queries";
import type { Generation } from "@/lib/db/queries";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A red fox in a forest",
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    promptMotiv: "A red fox in a forest",
    isFavorite: false,
    createdAt: new Date(),
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

/**
 * Set up default mocks for background processing (fire-and-forget).
 * Many tests only care about the createGeneration call, not the background flow.
 */
function setupBackgroundMocks() {
  (ReplicateClient.run as Mock).mockResolvedValue({
    output: bufferToStream(PNG_BUFFER),
    predictionId: "pred-1",
    seed: 42,
  });
  (StorageService.upload as Mock).mockResolvedValue(
    "https://r2.example.com/img.png"
  );
  (updateGeneration as Mock).mockResolvedValue(
    makeGeneration({ status: "completed" })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Generation Service -- Prompt Simplification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default sharp mock behavior
    const sharpInst = {
      png: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(PNG_BUFFER),
      metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
    };
    (sharp as unknown as Mock).mockReturnValue(sharpInst);
  });

  // --------------------------------------------------------------------------
  // AC-1: Prompt is just promptMotiv.trim() (no style concatenation)
  // --------------------------------------------------------------------------
  it('should set prompt to promptMotiv.trim() without style concatenation', async () => {
    const gen = makeGeneration({
      id: "gen-ac1",
      prompt: "A red fox in a forest",
      promptMotiv: "A red fox in a forest",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A red fox in a forest",
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A red fox in a forest",
        promptMotiv: "A red fox in a forest",
      })
    );
    // No promptStyle or negativePrompt should be passed
    const callArgs = (createGeneration as Mock).mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("promptStyle");
    expect(callArgs).not.toHaveProperty("negativePrompt");
  });

  // --------------------------------------------------------------------------
  // AC-2: Trimming of promptMotiv
  // --------------------------------------------------------------------------
  it('should trim promptMotiv before passing to createGeneration', async () => {
    const gen = makeGeneration({
      id: "gen-ac2",
      prompt: "A red fox",
      promptMotiv: "A red fox",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "  A red fox  ",
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A red fox",
        promptMotiv: "A red fox",
      })
    );
  });

  // --------------------------------------------------------------------------
  // AC-3: Server Action accepts input without promptStyle/negativePrompt
  // --------------------------------------------------------------------------
  it('should accept GenerateImagesInput without promptStyle or negativePrompt', async () => {
    const gen = makeGeneration({
      id: "gen-ac3",
      prompt: "Eagle",
      promptMotiv: "Eagle",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    const { generateImages } = await import("@/app/actions/generations");

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "Eagle",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(Array.isArray(result)).toBe(true);
    expect((result as Generation[]).length).toBe(1);
    expect((result as Generation[])[0].id).toBe("gen-ac3");

    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "Eagle",
        prompt: "Eagle",
      })
    );
  });

  // --------------------------------------------------------------------------
  // AC-4: Empty promptMotiv in Server Action still rejected
  // --------------------------------------------------------------------------
  it('should return error when promptMotiv is empty in Server Action', async () => {
    const { generateImages } = await import("@/app/actions/generations");

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(createGeneration).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-5: generate() signature has 10 params (no promptStyle/negativePrompt)
  // --------------------------------------------------------------------------
  it("should work with the simplified 10-param signature", async () => {
    const gen1 = makeGeneration({ id: "gen-compat-1" });
    const gen2 = makeGeneration({ id: "gen-compat-2" });

    (createGeneration as Mock)
      .mockResolvedValueOnce(gen1)
      .mockResolvedValueOnce(gen2);
    setupBackgroundMocks();

    const result = await GenerationService.generate(
      "proj-001",
      "A fox",
      ["black-forest-labs/flux-2-pro"],
      {},
      2
    );

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("pending");
    expect(createGeneration).toHaveBeenCalledTimes(2);

    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-001",
        prompt: "A fox",
        promptMotiv: "A fox",
        modelId: "black-forest-labs/flux-2-pro",
      })
    );
  });

  // --------------------------------------------------------------------------
  // Edge case: whitespace-only promptMotiv is rejected
  // --------------------------------------------------------------------------
  it("should throw error when promptMotiv is whitespace-only", async () => {
    await expect(
      GenerationService.generate(
        "proj-001",
        "   ",
        ["black-forest-labs/flux-2-pro"],
        {},
        1
      )
    ).rejects.toThrow("Prompt darf nicht leer sein");

    expect(createGeneration).not.toHaveBeenCalled();
  });
});
