import { describe, it, expect, expectTypeOf } from "vitest";
import type { Tier, GenerationMode, UpdateModelSettingInput } from "@/lib/types";
import { VALID_TIERS, VALID_GENERATION_MODES } from "@/lib/types";

describe("Type definitions", () => {
  // ---------------------------------------------------------------------------
  // Tier type (unchanged from prior slices)
  // ---------------------------------------------------------------------------

  it("should accept draft, quality, max as valid Tier values", () => {
    expect(VALID_TIERS).toEqual(["draft", "quality", "max"]);
    expect(VALID_TIERS).toHaveLength(3);

    const draft: Tier = "draft";
    const quality: Tier = "quality";
    const max: Tier = "max";
    expect(draft).toBe("draft");
    expect(quality).toBe("quality");
    expect(max).toBe("max");

    expectTypeOf<Tier>().toEqualTypeOf<"draft" | "quality" | "max">();
  });

  // ---------------------------------------------------------------------------
  // AC-1: GIVEN lib/types.ts
  //       WHEN der Type GenerationMode geprueft wird
  //       THEN akzeptiert er exakt die 5 Werte
  //            "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint"
  // ---------------------------------------------------------------------------
  it("AC-1: should accept all 5 generation modes including inpaint and outpaint", () => {
    // Type-level: GenerationMode is exactly the 5-member union
    expectTypeOf<GenerationMode>().toEqualTypeOf<
      "txt2img" | "img2img" | "upscale" | "inpaint" | "outpaint"
    >();

    // Runtime: all 5 values are assignable
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

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN lib/types.ts
  //       WHEN das Array VALID_GENERATION_MODES geprueft wird
  //       THEN enthaelt es exakt
  //            ["txt2img", "img2img", "upscale", "inpaint", "outpaint"]
  //            (5 Eintraege, Reihenfolge beibehalten)
  // ---------------------------------------------------------------------------
  it("AC-2: should export VALID_GENERATION_MODES with exactly 5 entries in order", () => {
    expect(VALID_GENERATION_MODES).toEqual([
      "txt2img",
      "img2img",
      "upscale",
      "inpaint",
      "outpaint",
    ]);
    expect(VALID_GENERATION_MODES).toHaveLength(5);

    // Verify each element by index for strict ordering
    expect(VALID_GENERATION_MODES[0]).toBe("txt2img");
    expect(VALID_GENERATION_MODES[1]).toBe("img2img");
    expect(VALID_GENERATION_MODES[2]).toBe("upscale");
    expect(VALID_GENERATION_MODES[3]).toBe("inpaint");
    expect(VALID_GENERATION_MODES[4]).toBe("outpaint");
  });

  // ---------------------------------------------------------------------------
  // UpdateModelSettingInput DTO (unchanged from prior slices)
  // ---------------------------------------------------------------------------
  it("should have mode, tier, and modelId fields with correct types", () => {
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("mode");
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("tier");
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("modelId");

    expectTypeOf<UpdateModelSettingInput["mode"]>().toEqualTypeOf<GenerationMode>();
    expectTypeOf<UpdateModelSettingInput["tier"]>().toEqualTypeOf<Tier>();
    expectTypeOf<UpdateModelSettingInput["modelId"]>().toEqualTypeOf<string>();

    const input: UpdateModelSettingInput = {
      mode: "inpaint",
      tier: "quality",
      modelId: "owner/model-name",
    };
    expect(input).toEqual({
      mode: "inpaint",
      tier: "quality",
      modelId: "owner/model-name",
    });
  });
});
