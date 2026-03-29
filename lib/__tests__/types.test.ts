import { describe, it, expect, expectTypeOf } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests for slice-03-types-resolve-model: lib/types.ts
 *
 * Verifies that the Tier-based types have been replaced by Slot-based types,
 * while GenerationMode remains unchanged.
 *
 * Mocking Strategy: no_mocks (Pure Types, no I/O)
 */

// ---------------------------------------------------------------------------
// Import the CURRENT exports (post-refactor)
// ---------------------------------------------------------------------------
import type { SlotNumber, GenerationMode } from "@/lib/types";
import { VALID_SLOTS, VALID_GENERATION_MODES } from "@/lib/types";

// We also import the module as a namespace to check what exists at runtime
import * as typesModule from "@/lib/types";

describe("lib/types.ts — Slice 03 Acceptance Tests", () => {
  // ---------------------------------------------------------------------------
  // AC-1: GIVEN lib/types.ts wird importiert
  //       WHEN die Exports geprueft werden
  //       THEN existiert ein Type SlotNumber = 1 | 2 | 3
  //       AND existiert eine Konstante VALID_SLOTS mit Wert [1, 2, 3] as const
  //       AND der Type Tier existiert NICHT mehr
  //       AND die Konstante VALID_TIERS existiert NICHT mehr
  //       AND der UpdateModelSettingInput DTO existiert NICHT mehr
  // ---------------------------------------------------------------------------

  it("AC-1: should export SlotNumber type and VALID_SLOTS constant [1, 2, 3]", () => {
    // SlotNumber type-level check: must be exactly 1 | 2 | 3
    expectTypeOf<SlotNumber>().toEqualTypeOf<1 | 2 | 3>();

    // Runtime: VALID_SLOTS is [1, 2, 3]
    expect(VALID_SLOTS).toEqual([1, 2, 3]);
    expect(VALID_SLOTS).toHaveLength(3);
    expect(VALID_SLOTS[0]).toBe(1);
    expect(VALID_SLOTS[1]).toBe(2);
    expect(VALID_SLOTS[2]).toBe(3);

    // Verify VALID_SLOTS is an array with exactly these values
    expect(Array.isArray(VALID_SLOTS)).toBe(true);
  });

  it("AC-1: should NOT export Tier type or VALID_TIERS constant", () => {
    // Runtime check: VALID_TIERS must not exist as an export
    const moduleExports = typesModule as Record<string, unknown>;
    expect(moduleExports).not.toHaveProperty("VALID_TIERS");

    // Source-level check: Tier type must not be defined
    const source = readFileSync(
      resolve(__dirname, "../types.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(/export\s+type\s+Tier\b/);
    expect(source).not.toMatch(/export\s+(?:const|let|var)\s+VALID_TIERS\b/);
  });

  it("AC-1: should NOT export UpdateModelSettingInput", () => {
    // Runtime check
    const moduleExports = typesModule as Record<string, unknown>;
    expect(moduleExports).not.toHaveProperty("UpdateModelSettingInput");

    // Source-level check: UpdateModelSettingInput type/interface must not be defined
    const source = readFileSync(
      resolve(__dirname, "../types.ts"),
      "utf-8",
    );
    expect(source).not.toMatch(
      /export\s+(?:type|interface)\s+UpdateModelSettingInput\b/,
    );
  });

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN lib/types.ts enthaelt weiterhin
  //       WHEN GenerationMode und VALID_GENERATION_MODES geprueft werden
  //       THEN sind beide unveraendert vorhanden
  // ---------------------------------------------------------------------------

  it("AC-2: should still export GenerationMode and VALID_GENERATION_MODES unchanged", () => {
    // Type-level: GenerationMode is exactly the 5-member union
    expectTypeOf<GenerationMode>().toEqualTypeOf<
      "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint"
    >();

    // Runtime: VALID_GENERATION_MODES has all 5 entries in order
    expect(VALID_GENERATION_MODES).toEqual([
      "txt2img",
      "img2img",
      "upscale",
      "inpaint",
      "outpaint",
    ]);
    expect(VALID_GENERATION_MODES).toHaveLength(5);

    // Verify each value
    const txt2img: GenerationMode = "txt2img";
    const img2img: GenerationMode = "img2img";
    const upscale: GenerationMode = "upscale";
    const inpaint: GenerationMode = "inpaint";
    const outpaint: GenerationMode = "outpaint";

    expect(txt2img).toBe("txt2img");
    expect(img2img).toBe("img2img");
    expect(upscale).toBe("upscale");
    expect(inpaint).toBe("inpaint");
    expect(outpaint).toBe("outpaint");
  });
});
