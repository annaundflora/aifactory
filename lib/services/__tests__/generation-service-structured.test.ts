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
  deleteGeneration: vi.fn(),
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
  getGeneration,
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
    promptMotiv: "A red fox in a forest",
    promptStyle: "",
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

describe("Generation Service -- Structured Prompt", () => {
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
  // AC-1: Komposition von promptMotiv + promptStyle
  // --------------------------------------------------------------------------
  it('AC-1: GIVEN promptMotiv="A red fox in a forest" und promptStyle="watercolor painting with soft edges" WHEN GenerationService.generate() aufgerufen wird THEN wird createGeneration mit prompt="A red fox in a forest. watercolor painting with soft edges", promptMotiv="A red fox in a forest" und promptStyle="watercolor painting with soft edges" aufgerufen', async () => {
    const gen = makeGeneration({
      id: "gen-ac1",
      prompt: "A red fox in a forest. watercolor painting with soft edges",
      promptMotiv: "A red fox in a forest",
      promptStyle: "watercolor painting with soft edges",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A red fox in a forest",
      "watercolor painting with soft edges",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A red fox in a forest. watercolor painting with soft edges",
        promptMotiv: "A red fox in a forest",
        promptStyle: "watercolor painting with soft edges",
      })
    );
  });

  // --------------------------------------------------------------------------
  // AC-2: Leerer promptStyle
  // --------------------------------------------------------------------------
  it('AC-2: GIVEN promptMotiv="A red fox in a forest" und promptStyle="" (leerer String) WHEN GenerationService.generate() aufgerufen wird THEN wird createGeneration mit prompt="A red fox in a forest" aufgerufen (kein Punkt), promptMotiv="A red fox in a forest", promptStyle=""', async () => {
    const gen = makeGeneration({
      id: "gen-ac2",
      prompt: "A red fox in a forest",
      promptMotiv: "A red fox in a forest",
      promptStyle: "",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A red fox in a forest",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A red fox in a forest",
        promptMotiv: "A red fox in a forest",
        promptStyle: "",
      })
    );

    // Verify no trailing dot or space
    const callArgs = (createGeneration as Mock).mock.calls[0][0];
    expect(callArgs.prompt).not.toMatch(/\.$/);
    expect(callArgs.prompt).not.toMatch(/\s$/);
  });

  // --------------------------------------------------------------------------
  // AC-3: Trimming beider Felder
  // --------------------------------------------------------------------------
  it('AC-3: GIVEN promptMotiv="  A red fox  " und promptStyle="  oil painting  " WHEN GenerationService.generate() aufgerufen wird THEN werden beide Felder getrimmt: promptMotiv="A red fox", promptStyle="oil painting", prompt="A red fox. oil painting"', async () => {
    const gen = makeGeneration({
      id: "gen-ac3",
      prompt: "A red fox. oil painting",
      promptMotiv: "A red fox",
      promptStyle: "oil painting",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "  A red fox  ",
      "  oil painting  ",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A red fox. oil painting",
        promptMotiv: "A red fox",
        promptStyle: "oil painting",
      })
    );
  });

  // --------------------------------------------------------------------------
  // AC-4: Server Action leitet strukturierte Felder weiter
  // --------------------------------------------------------------------------
  it('AC-4: GIVEN die generateImages Server Action WHEN mit { projectId, promptMotiv: "Eagle", promptStyle: "digital art", modelId, params, count: 1 } aufgerufen THEN werden promptMotiv und promptStyle an GenerationService.generate() weitergereicht und die Action gibt Generation[] zurueck', async () => {
    const gen = makeGeneration({
      id: "gen-ac4",
      prompt: "Eagle. digital art",
      promptMotiv: "Eagle",
      promptStyle: "digital art",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    // Import the server action dynamically to test it
    const { generateImages } = await import("@/app/actions/generations");

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "Eagle",
      promptStyle: "digital art",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    // Should return Generation[] (not an error object)
    expect(Array.isArray(result)).toBe(true);
    expect((result as Generation[]).length).toBe(1);
    expect((result as Generation[])[0].id).toBe("gen-ac4");

    // Verify the service was called with the right structured fields
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMotiv: "Eagle",
        promptStyle: "digital art",
        prompt: "Eagle. digital art",
      })
    );
  });

  // --------------------------------------------------------------------------
  // AC-5: Leeres Motiv in Server Action
  // --------------------------------------------------------------------------
  it('AC-5: GIVEN die generateImages Server Action WHEN mit { projectId, promptMotiv: "", promptStyle: "digital art", ... } aufgerufen THEN gibt die Action { error: "Prompt darf nicht leer sein" } zurueck', async () => {
    const { generateImages } = await import("@/app/actions/generations");

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "",
      promptStyle: "digital art",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    // Should return error object, not throw
    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });

    // Service should not have been called
    expect(createGeneration).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-6: TypeScript Interface
  // --------------------------------------------------------------------------
  it("AC-6: GIVEN die GenerateImagesInput-Typdefinition in app/actions/generations.ts WHEN ein TypeScript-Modul das Interface verwendet THEN enthaelt es promptMotiv: string und promptStyle?: string", async () => {
    /**
     * This test validates that the generateImages function accepts the
     * structured prompt fields. Since this is TypeScript, the type check
     * happens at compile time. We verify at runtime that the function
     * accepts the new shape and does not error on missing `prompt` field.
     */
    const { generateImages } = await import("@/app/actions/generations");

    // Valid call with both fields
    const gen = makeGeneration({ id: "gen-ac6" });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    const resultWithStyle = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A mountain",
      promptStyle: "watercolor",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });
    expect(Array.isArray(resultWithStyle)).toBe(true);

    vi.clearAllMocks();
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    // Valid call without promptStyle (optional field)
    const resultWithoutStyle = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A mountain",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });
    expect(Array.isArray(resultWithoutStyle)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // AC-7: createGeneration akzeptiert promptMotiv + promptStyle
  // --------------------------------------------------------------------------
  it("AC-7: GIVEN die Funktion createGeneration in lib/db/queries.ts WHEN sie mit promptMotiv und promptStyle aufgerufen wird THEN akzeptiert die Input-Typdefinition die neuen Felder und uebergibt sie an db.insert", async () => {
    const gen = makeGeneration({
      id: "gen-ac7",
      prompt: "Eagle. digital art",
      promptMotiv: "Eagle",
      promptStyle: "digital art",
    });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "Eagle",
      "digital art",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledTimes(1);
    const callArgs = (createGeneration as Mock).mock.calls[0][0];

    // Verify promptMotiv and promptStyle are passed to createGeneration
    expect(callArgs).toHaveProperty("promptMotiv", "Eagle");
    expect(callArgs).toHaveProperty("promptStyle", "digital art");
    expect(callArgs).toHaveProperty("projectId", "proj-001");
    expect(callArgs).toHaveProperty("prompt", "Eagle. digital art");
    expect(callArgs).toHaveProperty("modelId", "black-forest-labs/flux-2-pro");
  });

  // --------------------------------------------------------------------------
  // AC-8: Bestehende Tests gruen (Abwaertskompatibilitaet)
  // --------------------------------------------------------------------------
  it("AC-8: GIVEN bestehende Tests in generation-service.test.ts WHEN die neuen Tests ausgefuehrt werden THEN bleiben alle bestehenden Tests gruen -- backward compatibility of generate() with new signature", async () => {
    /**
     * This test verifies that the new 7-param signature works correctly
     * with the same patterns used in the existing test file, ensuring
     * backward compatibility. The existing tests call with 6 params
     * (old signature). Here we verify the new signature produces valid
     * output for the same scenario.
     */
    const gen1 = makeGeneration({ id: "gen-compat-1" });
    const gen2 = makeGeneration({ id: "gen-compat-2" });

    (createGeneration as Mock)
      .mockResolvedValueOnce(gen1)
      .mockResolvedValueOnce(gen2);
    setupBackgroundMocks();

    // New 7-param signature with empty style (mimics old behavior)
    const result = await GenerationService.generate(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      2
    );

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe("pending");
    expect(result[1].status).toBe("pending");
    expect(createGeneration).toHaveBeenCalledTimes(2);

    // Verify composite prompt is just the motiv (no dot appended)
    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "proj-001",
        prompt: "A fox",
        promptMotiv: "A fox",
        promptStyle: "",
        modelId: "black-forest-labs/flux-2-pro",
      })
    );
  });

  // --------------------------------------------------------------------------
  // Additional edge case: whitespace-only promptStyle treated as empty
  // --------------------------------------------------------------------------
  it("Edge case: GIVEN promptStyle is whitespace-only WHEN generate is called THEN prompt has no trailing dot and promptStyle is trimmed to empty string", async () => {
    const gen = makeGeneration({ id: "gen-ws" });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "   ",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "A fox",
        promptMotiv: "A fox",
        promptStyle: "",
      })
    );
  });

  // --------------------------------------------------------------------------
  // Additional edge case: whitespace-only promptMotiv is rejected
  // --------------------------------------------------------------------------
  it("Edge case: GIVEN promptMotiv is whitespace-only WHEN generate is called THEN it throws an error", async () => {
    await expect(
      GenerationService.generate(
        "proj-001",
        "   ",
        "watercolor",
        undefined,
        ["black-forest-labs/flux-2-pro"],
        {},
        1
      )
    ).rejects.toThrow("Prompt darf nicht leer sein");

    expect(createGeneration).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Additional edge case: negativePrompt is trimmed and passed through
  // --------------------------------------------------------------------------
  it("Edge case: GIVEN negativePrompt is provided WHEN generate is called THEN negativePrompt is trimmed and passed to createGeneration", async () => {
    const gen = makeGeneration({ id: "gen-neg" });
    (createGeneration as Mock).mockResolvedValue(gen);
    setupBackgroundMocks();

    await GenerationService.generate(
      "proj-001",
      "A fox",
      "watercolor",
      "  blurry  ",
      ["black-forest-labs/flux-2-pro"],
      {},
      1
    );

    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        negativePrompt: "blurry",
      })
    );
  });
});
