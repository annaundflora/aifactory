import { describe, it, expect } from "vitest";
import { PROMPT_TEMPLATES, type PromptTemplate } from "@/lib/prompt-templates";

// ---------------------------------------------------------------------------
// Tests: Prompt Templates Config (Slice 15)
// ---------------------------------------------------------------------------

describe("Prompt Templates Config", () => {
  // -------------------------------------------------------------------------
  // AC-1: 5 Templates mit korrekten IDs
  // -------------------------------------------------------------------------
  it("AC-1: should export exactly 5 templates with IDs: product-shot, landscape, character-design, logo-design, abstract-art", () => {
    /**
     * AC-1: GIVEN `lib/prompt-templates.ts` wird importiert
     *       WHEN die exportierte Template-Liste gelesen wird
     *       THEN enthaelt sie genau 5 Templates mit den IDs
     *            "product-shot", "landscape", "character-design", "logo-design", "abstract-art"
     */
    // Arrange & Act
    const ids = PROMPT_TEMPLATES.map((t) => t.id);

    // Assert -- exactly 5 templates
    expect(PROMPT_TEMPLATES).toHaveLength(5);

    // Assert -- correct IDs in list
    expect(ids).toContain("product-shot");
    expect(ids).toContain("landscape");
    expect(ids).toContain("character-design");
    expect(ids).toContain("logo-design");
    expect(ids).toContain("abstract-art");
  });

  // -------------------------------------------------------------------------
  // AC-2: Template-Objekt-Struktur
  // -------------------------------------------------------------------------
  it("AC-2: should have id, label, motiv, style, negativePrompt as non-empty strings on each template", () => {
    /**
     * AC-2: GIVEN ein Template-Objekt aus der Liste
     *       WHEN seine Felder geprueft werden
     *       THEN hat es die Properties `id` (string), `label` (string),
     *            `motiv` (string, nicht leer), `style` (string, nicht leer),
     *            `negativePrompt` (string, nicht leer)
     */
    for (const template of PROMPT_TEMPLATES) {
      // Assert -- all required fields exist and are strings
      expect(typeof template.id).toBe("string");
      expect(typeof template.label).toBe("string");
      expect(typeof template.motiv).toBe("string");
      expect(typeof template.style).toBe("string");
      expect(typeof template.negativePrompt).toBe("string");

      // Assert -- all fields are non-empty
      expect(template.id.length).toBeGreaterThan(0);
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.motiv.length).toBeGreaterThan(0);
      expect(template.style.length).toBeGreaterThan(0);
      expect(template.negativePrompt.length).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // Additional: Verify labels match expected display names
  // -------------------------------------------------------------------------
  it("should have correct labels matching expected display names", () => {
    const labelMap = Object.fromEntries(
      PROMPT_TEMPLATES.map((t) => [t.id, t.label])
    );

    expect(labelMap["product-shot"]).toBe("Product Shot");
    expect(labelMap["landscape"]).toBe("Landscape");
    expect(labelMap["character-design"]).toBe("Character Design");
    expect(labelMap["logo-design"]).toBe("Logo Design");
    expect(labelMap["abstract-art"]).toBe("Abstract Art");
  });

  // -------------------------------------------------------------------------
  // Additional: Verify unique IDs
  // -------------------------------------------------------------------------
  it("should have unique IDs across all templates", () => {
    const ids = PROMPT_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // -------------------------------------------------------------------------
  // Additional: Type safety -- verify PromptTemplate type is exported
  // -------------------------------------------------------------------------
  it("should export PromptTemplate type that matches template objects", () => {
    // This is a compile-time check -- if this test compiles, the type is correct.
    const template: PromptTemplate = PROMPT_TEMPLATES[0];
    expect(template).toBeDefined();
    expect(template.id).toBeDefined();
    expect(template.label).toBeDefined();
    expect(template.motiv).toBeDefined();
    expect(template.style).toBeDefined();
    expect(template.negativePrompt).toBeDefined();
  });
});
