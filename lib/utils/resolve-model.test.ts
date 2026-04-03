import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveActiveSlots } from "./resolve-model";
import type { GenerationMode } from "@/lib/types";

/**
 * Tests for slice-03-types-resolve-model: resolveActiveSlots()
 *
 * Pure unit tests for the synchronous resolveActiveSlots utility. No mocks
 * needed -- resolveActiveSlots() is a pure function with no I/O, no DB
 * access, no external dependencies.
 *
 * Each test maps to an Acceptance Criterion from the slice-03 spec.
 *
 * Mocking Strategy: no_mocks (as per slice spec)
 */

// ---------------------------------------------------------------------------
// Helpers: construct ModelSlot-shaped objects for testing
// ---------------------------------------------------------------------------

/**
 * Creates a minimal ModelSlot-compatible object.
 * We use the fields that resolveActiveSlots() inspects: mode, slot, modelId,
 * modelParams, active. The remaining DB columns (id, createdAt, updatedAt)
 * are filled with plausible defaults.
 */
function makeModelSlot(overrides: {
  mode: string;
  slot: number;
  modelId: string | null;
  modelParams: unknown;
  active: boolean;
}) {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    mode: overrides.mode,
    slot: overrides.slot,
    modelId: overrides.modelId,
    modelParams: overrides.modelParams,
    active: overrides.active,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

// ===========================================================================
// Unit Tests — resolveActiveSlots()
// ===========================================================================

describe("resolveActiveSlots — Unit Tests", () => {
  // ---------------------------------------------------------------------------
  // AC-3: GIVEN ein Array von ModelSlot[] mit 3 Eintraegen fuer mode txt2img:
  //       slot 1 (active=true, modelId=flux-schnell, modelParams={}),
  //       slot 2 (active=true, modelId=flux-2-pro, modelParams={guidance: 3.5}),
  //       slot 3 (active=false, modelId=flux-2-max, modelParams={})
  //       WHEN resolveActiveSlots(slots, "txt2img") aufgerufen wird
  //       THEN wird ein Array mit exakt 2 Elementen zurueckgegeben
  //       AND Element 0 hat modelId === "black-forest-labs/flux-schnell" und modelParams === {}
  //       AND Element 1 hat modelId === "black-forest-labs/flux-2-pro" und modelParams === {guidance: 3.5}
  // ---------------------------------------------------------------------------

  it("AC-3: should return array of {modelId, modelParams} for active slots matching the given mode", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: { guidance: 3.5 },
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 3,
        modelId: "black-forest-labs/flux-2-max",
        modelParams: {},
        active: false,
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    // Exactly 2 active slots returned
    expect(result).toHaveLength(2);

    // Element 0: slot 1
    expect(result[0]).toEqual({
      modelId: "black-forest-labs/flux-schnell",
      modelParams: {},
    });

    // Element 1: slot 2
    expect(result[1]).toEqual({
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { guidance: 3.5 },
    });

    // Verify the inactive slot 3 is NOT included
    const modelIds = result.map((r) => r.modelId);
    expect(modelIds).not.toContain("black-forest-labs/flux-2-max");
  });

  // ---------------------------------------------------------------------------
  // AC-4: GIVEN ein Array von ModelSlot[] mit Eintraegen fuer txt2img und img2img
  //       WHEN resolveActiveSlots(slots, "img2img") aufgerufen wird
  //       THEN enthaelt das Ergebnis-Array NUR Eintraege mit mode img2img
  //       AND keine Eintraege mit mode txt2img
  // ---------------------------------------------------------------------------

  it("AC-4: should only include slots matching the requested mode, not other modes", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "txt2img-model-1",
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "txt2img-model-2",
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "img2img",
        slot: 1,
        modelId: "img2img-model-1",
        modelParams: { strength: 0.8 },
        active: true,
      }),
      makeModelSlot({
        mode: "img2img",
        slot: 2,
        modelId: "img2img-model-2",
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "img2img");

    // Only img2img slots returned
    expect(result).toHaveLength(2);
    expect(result[0].modelId).toBe("img2img-model-1");
    expect(result[0].modelParams).toEqual({ strength: 0.8 });
    expect(result[1].modelId).toBe("img2img-model-2");

    // No txt2img slots
    const modelIds = result.map((r) => r.modelId);
    expect(modelIds).not.toContain("txt2img-model-1");
    expect(modelIds).not.toContain("txt2img-model-2");
  });

  // ---------------------------------------------------------------------------
  // AC-5: GIVEN ein Array von ModelSlot[] wo KEIN Slot fuer mode outpaint active ist
  //       WHEN resolveActiveSlots(slots, "outpaint") aufgerufen wird
  //       THEN wird ein leeres Array [] zurueckgegeben
  // ---------------------------------------------------------------------------

  it("AC-5: should return empty array when no active slots exist for the given mode", () => {
    const slots = [
      makeModelSlot({
        mode: "outpaint",
        slot: 1,
        modelId: "outpaint-model",
        modelParams: {},
        active: false,
      }),
      makeModelSlot({
        mode: "outpaint",
        slot: 2,
        modelId: "outpaint-model-2",
        modelParams: {},
        active: false,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "txt2img-model",
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "outpaint");

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // AC-6: GIVEN ein ModelSlot mit active=true aber modelId=null
  //       WHEN resolveActiveSlots(slots, mode) aufgerufen wird
  //       THEN wird dieser Slot NICHT im Ergebnis-Array enthalten
  // ---------------------------------------------------------------------------

  it("AC-6: should skip active slots where modelId is null", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: null,
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "valid-model",
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    // Only the slot with non-null modelId should be included
    expect(result).toHaveLength(1);
    expect(result[0].modelId).toBe("valid-model");
  });

  // ---------------------------------------------------------------------------
  // AC-7: GIVEN ein ModelSlot mit active=true und modelParams=null
  //       WHEN resolveActiveSlots(slots, mode) aufgerufen wird
  //       THEN wird modelParams zu {} normalisiert
  // ---------------------------------------------------------------------------

  it("AC-7: should normalize null modelParams to empty object", () => {
    const slots = [
      makeModelSlot({
        mode: "inpaint",
        slot: 1,
        modelId: "inpaint-model",
        modelParams: null,
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "inpaint");

    expect(result).toHaveLength(1);
    expect(result[0].modelId).toBe("inpaint-model");
    expect(result[0].modelParams).toEqual({});
    expect(result[0].modelParams).not.toBeNull();
  });
});

// ===========================================================================
// Acceptance Tests — Export Verification
// ===========================================================================

describe("resolveActiveSlots — Export Verification", () => {
  // ---------------------------------------------------------------------------
  // AC-8: GIVEN lib/utils/resolve-model.ts wird importiert
  //       WHEN die Exports geprueft werden
  //       THEN existiert resolveActiveSlots als Named Export
  //       AND die Funktion resolveModel existiert NICHT mehr
  //       AND der Import-Type ist ModelSlot (aus @/lib/db/queries), NICHT ModelSetting
  //       AND der Import-Type Tier (aus @/lib/types) existiert NICHT mehr
  // ---------------------------------------------------------------------------

  it("AC-8: should export resolveActiveSlots and NOT export resolveModel", () => {
    // Verify resolveActiveSlots is a function (imported at module top-level)
    expect(typeof resolveActiveSlots).toBe("function");

    // Source-level check: resolveModel must NOT be exported
    const source = readFileSync(
      resolve(__dirname, "./resolve-model.ts"),
      "utf-8",
    );

    // resolveActiveSlots must be exported
    expect(source).toMatch(/export\s+function\s+resolveActiveSlots\b/);

    // resolveModel must NOT be exported
    expect(source).not.toMatch(/export\s+(?:function|const|let|var)\s+resolveModel\b/);
  });

  it("AC-8: source should import ModelSlot from @/lib/db/queries, not ModelSetting", () => {
    const source = readFileSync(
      resolve(__dirname, "./resolve-model.ts"),
      "utf-8",
    );

    // Must import ModelSlot from @/lib/db/queries
    expect(source).toMatch(/import\s+type\s*\{[^}]*ModelSlot[^}]*\}\s*from\s*["']@\/lib\/db\/queries["']/);

    // Must NOT import ModelSetting
    expect(source).not.toMatch(/ModelSetting/);

    // Must NOT import Tier from @/lib/types
    expect(source).not.toMatch(/import.*Tier.*from\s*["']@\/lib\/types["']/);
  });
});

// ===========================================================================
// Additional Edge Cases
// ===========================================================================

describe("resolveActiveSlots — Edge Cases", () => {
  it("should return empty array for an empty slots array", () => {
    const result = resolveActiveSlots([], "txt2img");
    expect(result).toEqual([]);
  });

  it("should return empty array when mode has no slots at all", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "model-1",
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "upscale");
    expect(result).toEqual([]);
  });

  it("should preserve input array order in results (no sorting)", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 3,
        modelId: "model-three",
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "model-one",
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "model-two",
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    // Order must match input, not slot number
    expect(result[0].modelId).toBe("model-three");
    expect(result[1].modelId).toBe("model-one");
    expect(result[2].modelId).toBe("model-two");
  });

  it("should preserve complex nested modelParams", () => {
    const complexParams = {
      megapixels: "1",
      prompt_strength: 0.8,
      nested: { key: "value", arr: [1, 2, 3] },
    };
    const slots = [
      makeModelSlot({
        mode: "upscale",
        slot: 1,
        modelId: "upscale-model",
        modelParams: complexParams,
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "upscale");

    expect(result).toHaveLength(1);
    expect(result[0].modelParams).toEqual(complexParams);
  });

  it("should treat undefined modelParams the same as null (normalize to empty object)", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "some-model",
        modelParams: undefined,
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    expect(result).toHaveLength(1);
    expect(result[0].modelParams).toEqual({});
  });

  it("should handle all slots having null modelId (returns empty array)", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: null,
        modelParams: {},
        active: true,
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: null,
        modelParams: {},
        active: true,
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    expect(result).toEqual([]);
  });
});
