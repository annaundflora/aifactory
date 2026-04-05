import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

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
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  createGenerationReferences: vi.fn(),
  getGeneration: vi.fn().mockResolvedValue({ id: "gen-001", projectId: "proj-001" }),
  updateGeneration: vi.fn(),
  getGenerations: vi.fn(),
  deleteGeneration: vi.fn(),
  getProject: vi.fn().mockResolvedValue({ id: "proj-001", name: "Test", userId: "user-001" }),
  getSiblingsByBatchId: vi.fn().mockResolvedValue([]),
  getVariantFamily: vi.fn().mockResolvedValue([]),
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

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/services/generation-service", async (importOriginal) => {
  // For acceptance tests of the action layer, we mock the generation service
  // to isolate the server action behavior
  const actual = await importOriginal<typeof import("@/lib/services/generation-service")>();
  return {
    ...actual,
    GenerationService: {
      generate: vi.fn(),
      retry: vi.fn(),
      upscale: vi.fn(),
    },
  };
});

import { generateImages } from "@/app/actions/generations";
import { GenerationService } from "@/lib/services/generation-service";
import { createGeneration, updateGeneration } from "@/lib/db/queries";
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
// Slice 04 Acceptance Tests
// ---------------------------------------------------------------------------

describe("Slice 04: Generation Service & Server Action - Acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-1: generate() Signatur
  // =========================================================================

  it(`AC-1: GIVEN die generate()-Funktion in generation-service.ts
     WHEN die Funktionssignatur geprueft wird
     THEN hat sie KEINEN Parameter promptStyle und KEINEN Parameter negativePrompt
     AND die Gesamtzahl der Parameter ist 13 (10 original + maskUrl, outpaintDirections, outpaintSize from slice-06a)`, () => {
    const filePath = resolve(
      __dirname,
      "../../lib/services/generation-service.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // Extract the full generate function signature
    const generateMatch = content.match(
      /async\s+function\s+generate\s*\(([\s\S]*?)\)\s*:\s*Promise/
    );
    expect(generateMatch).not.toBeNull();

    const fullSignature = generateMatch![0];
    const paramBlock = generateMatch![1];

    // No promptStyle or negativePrompt in signature
    expect(fullSignature).not.toContain("promptStyle");
    expect(fullSignature).not.toContain("negativePrompt");

    // Count parameters (13 expected: original 10 + maskUrl, outpaintDirections, outpaintSize from slice-06a)
    const paramLines = paramBlock
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^[a-zA-Z_]\w*[\?]?\s*:/.test(l));
    expect(paramLines).toHaveLength(13);

    // Verify the 3 new trailing params exist
    const paramNames = paramLines.map((l) => l.replace(/[\?]?\s*:.*$/, ""));
    expect(paramNames).toContain("maskUrl");
    expect(paramNames).toContain("outpaintDirections");
    expect(paramNames).toContain("outpaintSize");
  });

  // =========================================================================
  // AC-2: Prompt = promptMotiv.trim() only
  // =========================================================================

  it(`AC-2: GIVEN die generate()-Funktion in generation-service.ts
     WHEN ein Prompt mit promptMotiv = "  a cat on a roof  " uebergeben wird
     THEN wird prompt als "a cat on a roof" gesetzt (nur .trim(), KEINE Style-Concatenation)
     AND die Zeile "let prompt = styleTrimmed ? ... : motivTrimmed" existiert NICHT mehr`, () => {
    const filePath = resolve(
      __dirname,
      "../../lib/services/generation-service.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // The old style concatenation pattern must NOT exist
    expect(content).not.toMatch(/let\s+prompt\s*=\s*styleTrimmed\s*\?/);
    expect(content).not.toContain("styleTrimmed");

    // The new pattern should be: prompt = motivTrimmed (simple assignment)
    // Verify that motivTrimmed is used directly for prompt
    expect(content).toMatch(/let\s+prompt\s*=\s*motivTrimmed/);

    // Verify motivTrimmed is created from promptMotiv.trim()
    expect(content).toMatch(/motivTrimmed\s*=\s*promptMotiv\.trim\(\)/);
  });

  // =========================================================================
  // AC-3: No negative_prompt in buildReplicateInput
  // =========================================================================

  it(`AC-3: GIVEN die buildReplicateInput()-Funktion in generation-service.ts
     WHEN ein Generation-Objekt verarbeitet wird
     THEN wird KEIN input.negative_prompt gesetzt
     AND der gesamte if (generation.negativePrompt) Block existiert NICHT mehr`, () => {
    const filePath = resolve(
      __dirname,
      "../../lib/services/generation-service.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // Extract buildReplicateInput function
    const fnStart = content.indexOf("async function buildReplicateInput");
    expect(fnStart).toBeGreaterThan(-1);

    // Find the end of the function (next top-level declaration or end)
    const nextFnMatch = content.slice(fnStart + 1).search(/\n(?:async\s+)?function\s+/);
    const fnEnd = nextFnMatch > -1 ? fnStart + 1 + nextFnMatch : content.length;
    const fnBody = content.slice(fnStart, fnEnd);

    // No negative_prompt references
    expect(fnBody).not.toContain("negative_prompt");
    expect(fnBody).not.toContain("negativePrompt");
  });

  // =========================================================================
  // AC-4: createGeneration calls without promptStyle/negativePrompt
  // =========================================================================

  it(`AC-4: GIVEN die createGeneration()-Aufrufe in generation-service.ts (Multi-Model und Single-Model Branch)
     WHEN eine Generation erstellt wird
     THEN enthaelt das Input-Objekt KEIN Feld negativePrompt und KEIN Feld promptStyle
     AND das Feld promptMotiv wird weiterhin mit motivTrimmed befuellt`, () => {
    const filePath = resolve(
      __dirname,
      "../../lib/services/generation-service.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // Find all createGeneration({ ... }) blocks in the generate function
    const generateFnStart = content.indexOf("async function generate");
    expect(generateFnStart).toBeGreaterThan(-1);

    // Extract only the generate() function body (not upscale or retry)
    const afterGenerate = content.slice(generateFnStart + 1);
    const nextFnMatch = afterGenerate.search(/\nasync\s+function\s+(?!generate)/);
    const generateFnEnd = nextFnMatch > -1 ? generateFnStart + 1 + nextFnMatch : content.length;
    const generateSection = content.slice(generateFnStart, generateFnEnd);

    const createCalls = generateSection.match(
      /createGeneration\(\{[\s\S]*?\}\)/g
    );
    expect(createCalls).not.toBeNull();
    expect(createCalls!.length).toBeGreaterThanOrEqual(2);

    for (const callBlock of createCalls!) {
      // Must NOT contain promptStyle or negativePrompt
      expect(callBlock).not.toContain("promptStyle");
      expect(callBlock).not.toContain("negativePrompt");

      // promptMotiv must still be present in generate() createGeneration calls
      expect(callBlock).toContain("promptMotiv");
    }
  });

  // =========================================================================
  // AC-5: GenerateImagesInput Interface
  // =========================================================================

  it(`AC-5: GIVEN das Interface GenerateImagesInput in generations.ts
     WHEN das Interface geprueft wird
     THEN hat es KEINE Property promptStyle und KEINE Property negativePrompt
     AND die Properties promptMotiv, modelIds, params, count, references etc. sind unveraendert`, () => {
    const filePath = resolve(
      __dirname,
      "../../app/actions/generations.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // Extract GenerateImagesInput interface
    const interfaceMatch = content.match(
      /interface\s+GenerateImagesInput\s*\{[\s\S]*?\n\}/
    );
    expect(interfaceMatch).not.toBeNull();
    const interfaceBlock = interfaceMatch![0];

    // No promptStyle or negativePrompt
    expect(interfaceBlock).not.toContain("promptStyle");
    expect(interfaceBlock).not.toContain("negativePrompt");

    // Required properties still present
    expect(interfaceBlock).toContain("promptMotiv");
    expect(interfaceBlock).toContain("modelIds");
    expect(interfaceBlock).toContain("params");
    expect(interfaceBlock).toContain("count");
    expect(interfaceBlock).toContain("references");
    expect(interfaceBlock).toContain("projectId");
  });

  // =========================================================================
  // AC-6: generateImages() call without promptStyle/negativePrompt
  // =========================================================================

  it(`AC-6: GIVEN die Server Action generateImages() in generations.ts
     WHEN der GenerationService.generate()-Aufruf geprueft wird
     THEN wird KEIN input.promptStyle und KEIN input.negativePrompt weitergereicht
     AND der Aufruf hat 13 Argumente (10 original + maskUrl, outpaintDirections, outpaintSize from slice-06a)
     AND der Default input.promptStyle ?? '' existiert NICHT mehr`, async () => {
    const mockGenerations = [makeGeneration({ id: "gen-ac6" })];
    (GenerationService.generate as Mock).mockResolvedValue(mockGenerations);

    await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(GenerationService.generate).toHaveBeenCalledTimes(1);

    // Verify 13 arguments (10 original + maskUrl, outpaintDirections, outpaintSize from slice-06a)
    const callArgs = (GenerationService.generate as Mock).mock.calls[0];
    expect(callArgs).toHaveLength(13);

    // The 3 new trailing args should be undefined (not provided in input)
    expect(callArgs[10]).toBeUndefined(); // maskUrl
    expect(callArgs[11]).toBeUndefined(); // outpaintDirections
    expect(callArgs[12]).toBeUndefined(); // outpaintSize

    // Verify no promptStyle/negativePrompt in source code
    const filePath = resolve(
      __dirname,
      "../../app/actions/generations.ts"
    );
    const content = readFileSync(filePath, "utf-8");

    // No promptStyle references at all
    expect(content).not.toContain("promptStyle");
    // No negativePrompt references at all
    expect(content).not.toContain("negativePrompt");
  });

  // =========================================================================
  // AC-7: TypeScript compiler check (0 errors)
  // =========================================================================

  it(`AC-7: GIVEN alle Aenderungen aus AC-1 bis AC-6
     WHEN npx tsc --noEmit ausgefuehrt wird
     THEN meldet der TypeScript-Compiler 0 Fehler in generation-service.ts und generations.ts`, { timeout: 30_000 }, () => {
    // Run tsc --noEmit and check for errors in the specific files
    // Note: We only check the two target files, not the entire project
    const rootDir = resolve(__dirname, "../..");

    let tscOutput = "";
    let tscExitCode = 0;

    try {
      tscOutput = execSync("npx tsc --noEmit 2>&1", {
        cwd: rootDir,
        encoding: "utf-8",
        timeout: 60000,
      });
    } catch (error: unknown) {
      // tsc exits with code 2 if there are type errors
      const execError = error as { stdout?: string; stderr?: string; status?: number };
      tscOutput = (execError.stdout ?? "") + (execError.stderr ?? "");
      tscExitCode = execError.status ?? 1;
    }

    // Filter output for errors in our two target files
    const lines = tscOutput.split("\n");
    const targetFileErrors = lines.filter(
      (line) =>
        (line.includes("generation-service.ts") ||
          line.includes("actions/generations.ts")) &&
        line.includes("error TS")
    );

    // Zero errors in our target files
    expect(targetFileErrors).toHaveLength(0);
  });
});
