import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveModel } from "./resolve-model";

/**
 * Tests for slice-01-resolve-model-utility: resolveModel() extraction
 *
 * Pure unit tests for the synchronous resolveModel utility. No mocks needed --
 * resolveModel() is a pure function with no I/O, no DB access, no external
 * dependencies.
 *
 * Each test maps to an Acceptance Criterion from the slice spec.
 *
 * Mocking Strategy: no_mocks (as per slice spec)
 */

// ---------------------------------------------------------------------------
// Helpers: construct ModelSetting-shaped objects for testing
// ---------------------------------------------------------------------------

/**
 * Creates a minimal ModelSetting-compatible object.
 * We only use the fields that resolveModel() inspects: mode, tier, modelId,
 * modelParams. The remaining DB columns (id, createdAt, updatedAt) are
 * filled with plausible defaults.
 */
function makeModelSetting(overrides: {
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
}) {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    mode: overrides.mode,
    tier: overrides.tier,
    modelId: overrides.modelId,
    modelParams: overrides.modelParams,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

// ===========================================================================
// Unit Tests
// ===========================================================================

describe("resolveModel — Unit Tests", () => {
  // ---------------------------------------------------------------------------
  // AC-1: Findet Setting nach mode+tier und gibt modelId+modelParams zurueck
  // ---------------------------------------------------------------------------

  /**
   * AC-1: GIVEN ein Array von ModelSetting[] mit einem Eintrag
   *         { mode: "txt2img", tier: "draft", modelId: "black-forest-labs/flux-schnell", modelParams: { megapixels: "1" } }
   *       WHEN resolveModel(settings, "txt2img", "draft") aufgerufen wird
   *       THEN gibt die Funktion { modelId: "black-forest-labs/flux-schnell", modelParams: { megapixels: "1" } } zurueck
   */
  it("AC-1: should return modelId and modelParams for matching mode+tier", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-schnell",
        modelParams: { megapixels: "1" },
      }),
    ];

    const result = resolveModel(settings, "txt2img", "draft");

    expect(result).toEqual({
      modelId: "black-forest-labs/flux-schnell",
      modelParams: { megapixels: "1" },
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2: Gibt undefined zurueck wenn kein Setting fuer mode+tier existiert
  // ---------------------------------------------------------------------------

  /**
   * AC-2: GIVEN ein Array von ModelSetting[] mit Eintraegen fuer txt2img/draft und txt2img/quality
   *       WHEN resolveModel(settings, "txt2img", "max") aufgerufen wird (kein Eintrag fuer max)
   *       THEN gibt die Funktion undefined zurueck
   */
  it("AC-2: should return undefined when no setting matches mode+tier", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
      }),
      makeModelSetting({
        mode: "txt2img",
        tier: "quality",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: {},
      }),
    ];

    const result = resolveModel(settings, "txt2img", "max");

    expect(result).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // AC-3: Normalisiert null modelParams zu leerem Objekt
  // ---------------------------------------------------------------------------

  /**
   * AC-3: GIVEN ein ModelSetting mit modelParams: null
   *       WHEN resolveModel(settings, mode, tier) aufgerufen wird und der Eintrag matched
   *       THEN gibt die Funktion { modelId: "...", modelParams: {} } zurueck (null wird zu leerem Objekt normalisiert)
   */
  it("AC-3: should normalize null modelParams to empty object", () => {
    const settings = [
      makeModelSetting({
        mode: "img2img",
        tier: "quality",
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: null,
      }),
    ];

    const result = resolveModel(settings, "img2img", "quality");

    expect(result).toBeDefined();
    expect(result!.modelId).toBe("black-forest-labs/flux-2-pro");
    expect(result!.modelParams).toEqual({});
  });
});

// ===========================================================================
// Integration Tests — Refactoring Verification
// ===========================================================================

describe("resolveModel — Refactoring Verification", () => {
  // ---------------------------------------------------------------------------
  // AC-4: TypeScript-Kompilierung nach Refactoring fehlerfrei
  // ---------------------------------------------------------------------------

  /**
   * AC-4: GIVEN prompt-area.tsx mit dem Import von resolveModel aus @/lib/utils/resolve-model
   *       WHEN pnpm tsc --noEmit ausgefuehrt wird
   *       THEN kompiliert das Projekt fehlerfrei
   *
   * Verification: We check that prompt-area.tsx imports resolveModel from
   * the correct module path. The actual tsc --noEmit check is run via the
   * acceptance command in CI (pnpm tsc --noEmit).
   */
  it("AC-4: prompt-area.tsx should import resolveModel from @/lib/utils/resolve-model", () => {
    const filePath = resolve(
      __dirname,
      "../../components/workspace/prompt-area.tsx",
    );
    const source = readFileSync(filePath, "utf-8");

    // Must import resolveModel from the new utility location
    expect(source).toMatch(
      /import\s*\{[^}]*resolveModel[^}]*\}\s*from\s*["']@\/lib\/utils\/resolve-model["']/,
    );
  });

  // ---------------------------------------------------------------------------
  // AC-5: Keine inline resolveModel-Definition mehr in prompt-area.tsx
  // ---------------------------------------------------------------------------

  /**
   * AC-5: GIVEN prompt-area.tsx nach dem Refactoring
   *       WHEN nach einer inline function resolveModel im Datei-Body gesucht wird
   *       THEN existiert KEINE inline-Definition mehr (die Funktion ist vollstaendig entfernt)
   */
  it("AC-5: should not contain an inline resolveModel definition in prompt-area.tsx", () => {
    const filePath = resolve(
      __dirname,
      "../../components/workspace/prompt-area.tsx",
    );
    const source = readFileSync(filePath, "utf-8");

    // Must NOT have a local function definition for resolveModel
    expect(source).not.toMatch(/function\s+resolveModel\s*\(/);

    // Must NOT have a const/let/var arrow function definition
    expect(source).not.toMatch(
      /(?:const|let|var)\s+resolveModel\s*=/,
    );
  });
});

// ===========================================================================
// Additional Edge Cases
// ===========================================================================

describe("resolveModel — Edge Cases", () => {
  it("should return undefined for an empty settings array", () => {
    const result = resolveModel([], "txt2img", "draft");

    expect(result).toBeUndefined();
  });

  it("should match the first entry when multiple settings have the same mode+tier", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "first-model",
        modelParams: { a: 1 },
      }),
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "second-model",
        modelParams: { b: 2 },
      }),
    ];

    const result = resolveModel(settings, "txt2img", "draft");

    expect(result).toEqual({
      modelId: "first-model",
      modelParams: { a: 1 },
    });
  });

  it("should not match when mode matches but tier does not", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "some-model",
        modelParams: {},
      }),
    ];

    const result = resolveModel(settings, "txt2img", "quality");

    expect(result).toBeUndefined();
  });

  it("should not match when tier matches but mode does not", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "draft",
        modelId: "some-model",
        modelParams: {},
      }),
    ];

    const result = resolveModel(settings, "img2img", "draft");

    expect(result).toBeUndefined();
  });

  it("should preserve complex nested modelParams", () => {
    const complexParams = {
      megapixels: "1",
      prompt_strength: 0.8,
      nested: { key: "value" },
    };
    const settings = [
      makeModelSetting({
        mode: "upscale",
        tier: "draft",
        modelId: "upscale-model",
        modelParams: complexParams,
      }),
    ];

    const result = resolveModel(settings, "upscale", "draft");

    expect(result).toEqual({
      modelId: "upscale-model",
      modelParams: complexParams,
    });
  });

  it("should treat undefined modelParams the same as null (normalize to empty object)", () => {
    const settings = [
      makeModelSetting({
        mode: "txt2img",
        tier: "max",
        modelId: "max-model",
        modelParams: undefined,
      }),
    ];

    const result = resolveModel(settings, "txt2img", "max");

    expect(result).toBeDefined();
    expect(result!.modelParams).toEqual({});
  });
});
