import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { modelIdToDisplayName } from "../model-display-name";

describe("modelIdToDisplayName", () => {
  // ---------------------------------------------------------------------------
  // AC-1: Standard Model-ID mit owner/name
  // GIVEN die Funktion modelIdToDisplayName
  // WHEN modelIdToDisplayName("black-forest-labs/flux-1.1-pro") aufgerufen wird
  // THEN gibt sie "Flux 1.1 Pro" zurueck
  // ---------------------------------------------------------------------------
  it('AC-1: should convert "black-forest-labs/flux-1.1-pro" to "Flux 1.1 Pro"', () => {
    expect(modelIdToDisplayName("black-forest-labs/flux-1.1-pro")).toBe(
      "Flux 1.1 Pro",
    );
  });

  // ---------------------------------------------------------------------------
  // AC-2: Langer Model-Name mit mehreren Segmenten
  // GIVEN die Funktion modelIdToDisplayName
  // WHEN modelIdToDisplayName("stability-ai/stable-diffusion-xl-base-1.0") aufgerufen wird
  // THEN gibt sie "Stable Diffusion Xl Base 1.0" zurueck
  // ---------------------------------------------------------------------------
  it('AC-2: should convert "stability-ai/stable-diffusion-xl-base-1.0" to "Stable Diffusion Xl Base 1.0"', () => {
    expect(
      modelIdToDisplayName("stability-ai/stable-diffusion-xl-base-1.0"),
    ).toBe("Stable Diffusion Xl Base 1.0");
  });

  // ---------------------------------------------------------------------------
  // AC-3: Kurzer Model-Name
  // GIVEN die Funktion modelIdToDisplayName
  // WHEN modelIdToDisplayName("recraft-ai/recraft-v4") aufgerufen wird
  // THEN gibt sie "Recraft V4" zurueck
  // ---------------------------------------------------------------------------
  it('AC-3: should convert "recraft-ai/recraft-v4" to "Recraft V4"', () => {
    expect(modelIdToDisplayName("recraft-ai/recraft-v4")).toBe("Recraft V4");
  });

  // ---------------------------------------------------------------------------
  // AC-4: Fallback bei fehlender Slash-Trennung
  // GIVEN die Funktion modelIdToDisplayName
  // WHEN modelIdToDisplayName("single-segment") aufgerufen wird (kein / vorhanden)
  // THEN gibt sie "Single Segment" zurueck
  // ---------------------------------------------------------------------------
  it("AC-4: should handle model ID without slash by treating entire string as name", () => {
    expect(modelIdToDisplayName("single-segment")).toBe("Single Segment");
  });

  // ---------------------------------------------------------------------------
  // AC-5: Leerer String
  // GIVEN die Funktion modelIdToDisplayName
  // WHEN modelIdToDisplayName("") aufgerufen wird
  // THEN gibt sie "" zurueck
  // ---------------------------------------------------------------------------
  it("AC-5: should return empty string for empty input", () => {
    expect(modelIdToDisplayName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// AC-6 & AC-7: Source file import checks
// These verify that the refactored files no longer import from lib/models.
// ---------------------------------------------------------------------------
describe("No lib/models imports after refactoring", () => {
  // ---------------------------------------------------------------------------
  // AC-6: Kein Import von lib/models in lightbox-modal.tsx
  // GIVEN components/lightbox/lightbox-modal.tsx nach dem Refactoring
  // WHEN die Datei inspiziert wird
  // THEN existiert KEIN Import von @/lib/models
  // AND der Display-Name wird ueber modelIdToDisplayName abgeleitet
  // ---------------------------------------------------------------------------
  it("AC-6: lightbox-modal.tsx should not import from lib/models and should use modelIdToDisplayName", () => {
    const filePath = resolve(
      __dirname,
      "../../../components/lightbox/lightbox-modal.tsx",
    );
    const source = readFileSync(filePath, "utf-8");

    // Must NOT import from lib/models
    expect(source).not.toMatch(/@\/lib\/models/);
    expect(source).not.toMatch(/from\s+["'].*lib\/models["']/);

    // Must use modelIdToDisplayName
    expect(source).toMatch(/modelIdToDisplayName/);
  });

  // ---------------------------------------------------------------------------
  // AC-7: Kein Import von lib/models in prompt-service.ts
  // GIVEN lib/services/prompt-service.ts nach dem Refactoring
  // WHEN die Datei inspiziert wird
  // THEN existiert KEIN Import von @/lib/models
  // AND der Display-Name wird ueber modelIdToDisplayName abgeleitet
  // ---------------------------------------------------------------------------
  it("AC-7: prompt-service.ts should not import from lib/models and should use modelIdToDisplayName", () => {
    const filePath = resolve(
      __dirname,
      "../../services/prompt-service.ts",
    );
    const source = readFileSync(filePath, "utf-8");

    // Must NOT import from lib/models
    expect(source).not.toMatch(/@\/lib\/models/);
    expect(source).not.toMatch(/from\s+["'].*lib\/models["']/);

    // Must use modelIdToDisplayName
    expect(source).toMatch(/modelIdToDisplayName/);
  });
});
