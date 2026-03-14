import { describe, it, expect, expectTypeOf } from "vitest";
import type { Tier, GenerationMode, UpdateModelSettingInput } from "@/lib/types";
import { VALID_TIERS, VALID_GENERATION_MODES } from "@/lib/types";

describe("Type definitions", () => {
  // ---------------------------------------------------------------------------
  // AC-1: GIVEN lib/types.ts wird importiert
  //        WHEN der Typ Tier verwendet wird
  //        THEN akzeptiert er exakt die Werte "draft", "quality", "max" und keine anderen
  // ---------------------------------------------------------------------------
  it("should accept draft, quality, max as valid Tier values", () => {
    // Runtime validation via the VALID_TIERS constant
    expect(VALID_TIERS).toEqual(["draft", "quality", "max"]);
    expect(VALID_TIERS).toHaveLength(3);

    // Type-level assertions: valid values are assignable
    const draft: Tier = "draft";
    const quality: Tier = "quality";
    const max: Tier = "max";
    expect(draft).toBe("draft");
    expect(quality).toBe("quality");
    expect(max).toBe("max");

    // Type-level: Tier is exactly the union "draft" | "quality" | "max"
    expectTypeOf<Tier>().toEqualTypeOf<"draft" | "quality" | "max">();
  });

  // ---------------------------------------------------------------------------
  // AC-2: GIVEN lib/types.ts wird importiert
  //        WHEN der Typ GenerationMode verwendet wird
  //        THEN akzeptiert er exakt die Werte "txt2img", "img2img", "upscale" und keine anderen
  // ---------------------------------------------------------------------------
  it("should accept txt2img, img2img, upscale as valid GenerationMode values", () => {
    // Runtime validation via the VALID_GENERATION_MODES constant
    expect(VALID_GENERATION_MODES).toEqual(["txt2img", "img2img", "upscale"]);
    expect(VALID_GENERATION_MODES).toHaveLength(3);

    // Type-level assertions: valid values are assignable
    const txt2img: GenerationMode = "txt2img";
    const img2img: GenerationMode = "img2img";
    const upscale: GenerationMode = "upscale";
    expect(txt2img).toBe("txt2img");
    expect(img2img).toBe("img2img");
    expect(upscale).toBe("upscale");

    // Type-level: GenerationMode is exactly the union
    expectTypeOf<GenerationMode>().toEqualTypeOf<
      "txt2img" | "img2img" | "upscale"
    >();
  });

  // ---------------------------------------------------------------------------
  // AC-3: GIVEN lib/types.ts wird importiert
  //        WHEN der Typ UpdateModelSettingInput verwendet wird
  //        THEN hat er die Felder mode: GenerationMode, tier: Tier, modelId: string
  // ---------------------------------------------------------------------------
  it("should have mode, tier, and modelId fields with correct types", () => {
    // Type-level: verify the interface shape
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("mode");
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("tier");
    expectTypeOf<UpdateModelSettingInput>().toHaveProperty("modelId");

    // Verify the field types match expected types
    expectTypeOf<UpdateModelSettingInput["mode"]>().toEqualTypeOf<GenerationMode>();
    expectTypeOf<UpdateModelSettingInput["tier"]>().toEqualTypeOf<Tier>();
    expectTypeOf<UpdateModelSettingInput["modelId"]>().toEqualTypeOf<string>();

    // Runtime: verify a valid object can be constructed
    const input: UpdateModelSettingInput = {
      mode: "txt2img",
      tier: "draft",
      modelId: "owner/model-name",
    };
    expect(input).toEqual({
      mode: "txt2img",
      tier: "draft",
      modelId: "owner/model-name",
    });
  });
});
