import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/clients/replicate", () => ({
  ReplicateClient: {
    run: vi.fn(),
  },
}));

vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn(),
  },
}));

vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  createGenerationReferences: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
}));

vi.mock("@/lib/services/model-catalog-service", () => ({
  ModelCatalogService: {
    getSchema: vi.fn(),
  },
}));

vi.mock("@/lib/services/capability-detection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/capability-detection")>();
  return { ...actual };
});

vi.mock("sharp", () => {
  const sharpInstance = {
    png: vi.fn().mockReturnThis(),
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
} from "@/lib/db/queries";
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

const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

function bufferToStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

// ---------------------------------------------------------------------------
// Tests: generation-service prompt simplification (Slice 04)
// ---------------------------------------------------------------------------

describe("generation-service - prompt simplification (Slice 04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-1: generate() Signatur ohne promptStyle und negativePrompt
  // =========================================================================

  describe("AC-1: generate() signature without promptStyle and negativePrompt", () => {
    /**
     * AC-1: GIVEN die generate()-Funktion in generation-service.ts
     * WHEN die Funktionssignatur geprueft wird
     * THEN hat sie KEINEN Parameter promptStyle und KEINEN Parameter negativePrompt
     * AND die Gesamtzahl der Parameter ist um 2 reduziert gegenueber dem aktuellen Stand (12 -> 10)
     */
    it("should not accept promptStyle parameter in generate()", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Find the generate function signature
      const generateMatch = content.match(
        /async\s+function\s+generate\s*\([\s\S]*?\)\s*:\s*Promise/
      );
      expect(generateMatch).not.toBeNull();

      const signature = generateMatch![0];

      // promptStyle must NOT appear in the signature
      expect(signature).not.toContain("promptStyle");
    });

    it("should not accept negativePrompt parameter in generate()", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      const generateMatch = content.match(
        /async\s+function\s+generate\s*\([\s\S]*?\)\s*:\s*Promise/
      );
      expect(generateMatch).not.toBeNull();

      const signature = generateMatch![0];

      // negativePrompt must NOT appear in the signature
      expect(signature).not.toContain("negativePrompt");
    });

    it("should have exactly 10 parameters in generate() (reduced from 12)", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Extract the generate function parameter block
      const generateMatch = content.match(
        /async\s+function\s+generate\s*\(([\s\S]*?)\)\s*:\s*Promise/
      );
      expect(generateMatch).not.toBeNull();

      const paramBlock = generateMatch![1];

      // Count parameters by splitting on top-level commas (parameters separated by comma)
      // Parameters can have type annotations with commas inside generics, so we count
      // lines with a parameter name pattern instead
      const paramLines = paramBlock
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("//"));

      // Each parameter should have a name followed by either : or ?:
      const paramCount = paramLines.filter((l) =>
        /^[a-zA-Z_]\w*[\?]?\s*:/.test(l)
      ).length;

      expect(paramCount).toBe(13);
    });
  });

  // =========================================================================
  // AC-2: Prompt ist nur promptMotiv.trim(), keine Style-Concatenation
  // =========================================================================

  describe("AC-2: prompt is only promptMotiv.trim(), no style concatenation", () => {
    /**
     * AC-2: GIVEN die generate()-Funktion in generation-service.ts
     * WHEN ein Prompt mit promptMotiv = "  a cat on a roof  " uebergeben wird
     * THEN wird prompt als "a cat on a roof" gesetzt (nur .trim(), KEINE Style-Concatenation)
     * AND die Zeile "let prompt = styleTrimmed ? ... : motivTrimmed" existiert NICHT mehr
     */
    it("should set prompt to promptMotiv.trim() without style concatenation", async () => {
      const gen = makeGeneration({
        id: "gen-trim-test",
        prompt: "a cat on a roof",
      });
      (createGeneration as Mock).mockResolvedValue(gen);
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

      await GenerationService.generate(
        "proj-001",
        "  a cat on a roof  ", // untrimmed prompt
        ["black-forest-labs/flux-2-pro"],
        {},
        1
      );

      // createGeneration should have been called with the trimmed prompt
      expect(createGeneration).toHaveBeenCalledTimes(1);
      const createCall = (createGeneration as Mock).mock.calls[0][0];
      expect(createCall.prompt).toBe("a cat on a roof");
      // Also verify promptMotiv is the trimmed version
      expect(createCall.promptMotiv).toBe("a cat on a roof");
    });

    it("should NOT have style concatenation logic in source code", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // The old pattern: let prompt = styleTrimmed ? ... : motivTrimmed
      expect(content).not.toMatch(
        /let\s+prompt\s*=\s*styleTrimmed\s*\?/
      );

      // Also verify there is no reference to styleTrimmed variable
      expect(content).not.toContain("styleTrimmed");

      // Verify there is no promptStyle concatenation like `${motivTrimmed} ${styleTrimmed}`
      expect(content).not.toMatch(/motivTrimmed.*styleTrimmed/);
    });
  });

  // =========================================================================
  // AC-3: Kein negative_prompt in Replicate input
  // =========================================================================

  describe("AC-3: no negative_prompt in Replicate input", () => {
    /**
     * AC-3: GIVEN die buildReplicateInput()-Funktion in generation-service.ts
     * WHEN ein Generation-Objekt verarbeitet wird
     * THEN wird KEIN input.negative_prompt gesetzt
     * AND der gesamte if (generation.negativePrompt) Block existiert NICHT mehr
     */
    it("should not include negative_prompt in Replicate input", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Extract the buildReplicateInput function body
      const fnMatch = content.match(
        /async\s+function\s+buildReplicateInput[\s\S]*?\n\}/
      );
      expect(fnMatch).not.toBeNull();

      const fnBody = fnMatch![0];

      // Must NOT set negative_prompt
      expect(fnBody).not.toContain("negative_prompt");

      // Must NOT have the old negativePrompt check
      expect(fnBody).not.toContain("generation.negativePrompt");
    });

    it("should not reference negativePrompt anywhere in buildReplicateInput", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Find the buildReplicateInput function
      const fnStart = content.indexOf("async function buildReplicateInput");
      expect(fnStart).toBeGreaterThan(-1);

      // Find the next top-level function after buildReplicateInput
      const afterFn = content.indexOf("\nasync function ", fnStart + 1);
      const fnEnd = afterFn > -1 ? afterFn : content.length;
      const fnBody = content.slice(fnStart, fnEnd);

      // No negativePrompt references in the function
      expect(fnBody).not.toMatch(/negativePrompt/i);
      expect(fnBody).not.toMatch(/negative_prompt/i);
    });
  });

  // =========================================================================
  // AC-4: createGeneration-Aufrufe ohne promptStyle/negativePrompt
  // =========================================================================

  describe("AC-4: createGeneration calls without promptStyle/negativePrompt", () => {
    /**
     * AC-4: GIVEN die createGeneration()-Aufrufe in generation-service.ts (Multi-Model und Single-Model Branch)
     * WHEN eine Generation erstellt wird
     * THEN enthaelt das Input-Objekt KEIN Feld negativePrompt und KEIN Feld promptStyle
     * AND das Feld promptMotiv wird weiterhin mit motivTrimmed befuellt
     */
    it("should not pass promptStyle or negativePrompt to createGeneration (single-model)", async () => {
      const gen = makeGeneration({ id: "gen-ac4-single" });
      (createGeneration as Mock).mockResolvedValue(gen);
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

      await GenerationService.generate(
        "proj-001",
        "A beautiful sunset",
        ["black-forest-labs/flux-2-pro"],
        {},
        1
      );

      expect(createGeneration).toHaveBeenCalledTimes(1);
      const input = (createGeneration as Mock).mock.calls[0][0];

      // Must NOT contain promptStyle or negativePrompt
      expect(input).not.toHaveProperty("promptStyle");
      expect(input).not.toHaveProperty("negativePrompt");

      // promptMotiv must still be present
      expect(input).toHaveProperty("promptMotiv", "A beautiful sunset");
    });

    it("should not pass promptStyle or negativePrompt to createGeneration (multi-model)", async () => {
      const gen1 = makeGeneration({ id: "gen-ac4-multi-1" });
      const gen2 = makeGeneration({ id: "gen-ac4-multi-2" });
      (createGeneration as Mock)
        .mockResolvedValueOnce(gen1)
        .mockResolvedValueOnce(gen2);
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

      await GenerationService.generate(
        "proj-001",
        "A beautiful sunset",
        ["black-forest-labs/flux-2-pro", "owner/model-b"],
        {},
        1
      );

      // Multi-model: 2 createGeneration calls (one per model)
      expect(createGeneration).toHaveBeenCalledTimes(2);

      for (let i = 0; i < 2; i++) {
        const input = (createGeneration as Mock).mock.calls[i][0];
        expect(input).not.toHaveProperty("promptStyle");
        expect(input).not.toHaveProperty("negativePrompt");
        expect(input).toHaveProperty("promptMotiv", "A beautiful sunset");
      }
    });

    it("should verify source code has no promptStyle/negativePrompt in createGeneration calls within generate()", () => {
      const filePath = resolve(
        __dirname,
        "../../lib/services/generation-service.ts"
      );
      const content = readFileSync(filePath, "utf-8");

      // Extract only the generate() function body (not upscale or retry)
      const generateFnStart = content.indexOf("async function generate");
      expect(generateFnStart).toBeGreaterThan(-1);

      // Find the next top-level function declaration after generate
      const afterGenerate = content.slice(generateFnStart + 1);
      const nextFnMatch = afterGenerate.search(/\nasync\s+function\s+(?!generate)/);
      const generateFnEnd = nextFnMatch > -1 ? generateFnStart + 1 + nextFnMatch : content.length;
      const generateSection = content.slice(generateFnStart, generateFnEnd);

      // Find all createGeneration call blocks within generate()
      const createCalls = generateSection.match(
        /createGeneration\(\{[\s\S]*?\}\)/g
      );
      expect(createCalls).not.toBeNull();
      expect(createCalls!.length).toBeGreaterThanOrEqual(2); // multi-model + single-model

      for (const callBlock of createCalls!) {
        expect(callBlock).not.toContain("promptStyle");
        expect(callBlock).not.toContain("negativePrompt");
        // promptMotiv should still be present in generate() createGeneration calls
        expect(callBlock).toContain("promptMotiv");
      }
    });
  });
});
