import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveActiveSlots } from "./resolve-model";

/**
 * Tests for slice-03-types-resolve-model: resolveActiveSlots()
 *
 * Pure unit tests for the synchronous resolveActiveSlots utility. No mocks
 * needed -- resolveActiveSlots() is a pure function with no I/O, no DB
 * access, no external dependencies.
 *
 * Mocking Strategy: no_mocks (as per slice spec)
 */

// ---------------------------------------------------------------------------
// Helpers: construct ModelSlot-shaped objects for testing
// ---------------------------------------------------------------------------

/**
 * Creates a minimal ModelSlot-compatible object.
 * resolveActiveSlots() inspects mode, slot, modelId, modelParams. The
 * remaining DB columns (id, createdAt, updatedAt) are filled with plausible
 * defaults.
 */
function makeModelSlot(overrides: {
  mode: string;
  slot: number;
  modelId: string | null;
  modelParams: unknown;
}) {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    mode: overrides.mode,
    slot: overrides.slot,
    modelId: overrides.modelId,
    modelParams: overrides.modelParams,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

// ===========================================================================
// Unit Tests — resolveActiveSlots()
// ===========================================================================

describe("resolveActiveSlots — Unit Tests", () => {
  it("returns every slot with a model for the given mode", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "black-forest-labs/flux-schnell",
        modelParams: {},
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "black-forest-labs/flux-2-pro",
        modelParams: { guidance: 3.5 },
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 3,
        modelId: "black-forest-labs/flux-2-max",
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    expect(result).toHaveLength(3);

    expect(result[0]).toEqual({
      modelId: "black-forest-labs/flux-schnell",
      modelParams: {},
    });
    expect(result[1]).toEqual({
      modelId: "black-forest-labs/flux-2-pro",
      modelParams: { guidance: 3.5 },
    });
    expect(result[2]).toEqual({
      modelId: "black-forest-labs/flux-2-max",
      modelParams: {},
    });
  });

  it("only includes slots matching the requested mode, not other modes", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "txt2img-model-1",
        modelParams: {},
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "txt2img-model-2",
        modelParams: {},
      }),
      makeModelSlot({
        mode: "img2img",
        slot: 1,
        modelId: "img2img-model-1",
        modelParams: { strength: 0.8 },
      }),
      makeModelSlot({
        mode: "img2img",
        slot: 2,
        modelId: "img2img-model-2",
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "img2img");

    expect(result).toHaveLength(2);
    expect(result[0].modelId).toBe("img2img-model-1");
    expect(result[0].modelParams).toEqual({ strength: 0.8 });
    expect(result[1].modelId).toBe("img2img-model-2");

    const modelIds = result.map((r) => r.modelId);
    expect(modelIds).not.toContain("txt2img-model-1");
    expect(modelIds).not.toContain("txt2img-model-2");
  });

  it("returns an empty array when no slot for the requested mode has a model", () => {
    const slots = [
      makeModelSlot({
        mode: "outpaint",
        slot: 1,
        modelId: null,
        modelParams: {},
      }),
      makeModelSlot({
        mode: "outpaint",
        slot: 2,
        modelId: null,
        modelParams: {},
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "txt2img-model",
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "outpaint");

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("skips slots where modelId is null", () => {
    const slots = [
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: null,
        modelParams: {},
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "valid-model",
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    expect(result).toHaveLength(1);
    expect(result[0].modelId).toBe("valid-model");
  });

  it("normalizes null modelParams to empty object", () => {
    const slots = [
      makeModelSlot({
        mode: "inpaint",
        slot: 1,
        modelId: "inpaint-model",
        modelParams: null,
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
  it("exports resolveActiveSlots and does not export resolveModel", () => {
    expect(typeof resolveActiveSlots).toBe("function");

    const source = readFileSync(
      resolve(__dirname, "./resolve-model.ts"),
      "utf-8",
    );

    expect(source).toMatch(/export\s+function\s+resolveActiveSlots\b/);
    expect(source).not.toMatch(/export\s+(?:function|const|let|var)\s+resolveModel\b/);
  });

  it("source imports ModelSlot from @/lib/db/queries, not ModelSetting", () => {
    const source = readFileSync(
      resolve(__dirname, "./resolve-model.ts"),
      "utf-8",
    );

    expect(source).toMatch(/import\s+type\s*\{[^}]*ModelSlot[^}]*\}\s*from\s*["']@\/lib\/db\/queries["']/);
    expect(source).not.toMatch(/ModelSetting/);
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
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 1,
        modelId: "model-one",
        modelParams: {},
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: "model-two",
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

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
      }),
      makeModelSlot({
        mode: "txt2img",
        slot: 2,
        modelId: null,
        modelParams: {},
      }),
    ];

    const result = resolveActiveSlots(slots, "txt2img");

    expect(result).toEqual([]);
  });
});
