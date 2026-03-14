import { describe, it, expect, vi } from "vitest";
import type { ReferenceRole, ReferenceStrength } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Module-level mocks: generation-service.ts imports DB/storage/replicate
// at the top level. We mock these to prevent side effects (DATABASE_URL etc.)
// since we are only testing the pure function composeMultiReferencePrompt.
// The function under test itself is NOT mocked.
// ---------------------------------------------------------------------------

vi.mock("@/lib/clients/replicate", () => ({
  ReplicateClient: { run: vi.fn() },
}));

vi.mock("@/lib/clients/storage", () => ({
  StorageService: { upload: vi.fn() },
}));

vi.mock("@/lib/db/queries", () => ({
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
}));

vi.mock("@/lib/services/model-schema-service", () => ({
  ModelSchemaService: { getSchema: vi.fn() },
  getImg2ImgFieldName: vi.fn(),
}));

vi.mock("sharp", () => ({
  default: vi.fn(),
}));

// Now import the function under test (after mocks are hoisted)
import { composeMultiReferencePrompt } from "@/lib/services/generation-service";

// ---------------------------------------------------------------------------
// Helper type matching the function's expected input shape
// ---------------------------------------------------------------------------

interface PromptReference {
  slotPosition: number;
  role: ReferenceRole;
  strength: ReferenceStrength;
}

// ---------------------------------------------------------------------------
// composeMultiReferencePrompt -- Acceptance Tests (Slice 12)
// ---------------------------------------------------------------------------

describe("composeMultiReferencePrompt", () => {
  // =========================================================================
  // @-Token Replacement
  // =========================================================================

  describe("@-Token Replacement", () => {
    it("AC-1: GIVEN a prompt with @3 and @1 tokens AND references for slots 1 and 3 WHEN composeMultiReferencePrompt is called THEN @1 becomes @image1 and @3 becomes @image3", () => {
      // Arrange (GIVEN)
      const prompt =
        "Extract the building from @3 and render it in the style of @1";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "style", strength: "strong" },
        { slotPosition: 3, role: "content", strength: "moderate" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toContain("@image1");
      expect(result).toContain("@image3");
      expect(result).not.toMatch(
        /(?<!@image)@1(?!\d)/
      ); // no bare @1 remaining (that isn't part of @image1)
      expect(result).not.toMatch(
        /(?<!@image)@3(?!\d)/
      ); // no bare @3 remaining
    });

    it("AC-9: GIVEN a prompt with @1 appearing three times AND a reference for slot 1 WHEN composeMultiReferencePrompt is called THEN ALL occurrences of @1 are replaced with @image1", () => {
      // Arrange (GIVEN)
      const prompt = "@1 @1 @1";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "content", strength: "moderate" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      // The mapped prompt part (before guidance) should have exactly 3 @image1
      const mappedPart = result.split("Reference guidance:")[0];
      const matches = mappedPart.match(/@image1/g);
      expect(matches).toHaveLength(3);
      // No bare @1 tokens should remain in the mapped part
      expect(mappedPart).not.toMatch(/(?<!@image)@1(?!\d)/);
    });

    it("AC-6: GIVEN a prompt with @7 AND a reference only for slot 1 WHEN composeMultiReferencePrompt is called THEN @7 is NOT replaced (only tokens matching a reference slotPosition are mapped)", () => {
      // Arrange (GIVEN)
      const prompt = "Use @7 for reference";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "style", strength: "moderate" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      // @7 should remain as-is since no reference has slotPosition 7
      expect(result).toContain("@7");
      // @7 should NOT be converted to @image7
      expect(result).not.toContain("@image7");
    });

    it("AC-7: GIVEN a combined motiv+style prompt 'Draw @1. oil painting' AND a reference for slot 1 WHEN composeMultiReferencePrompt is called THEN @1 is correctly mapped to @image1", () => {
      // Arrange (GIVEN)
      const prompt = "Draw @1. oil painting";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "style", strength: "strong" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toContain("Draw @image1");
      expect(result).not.toMatch(/(?<!@image)@1(?!\d)/);
    });
  });

  // =========================================================================
  // Reference Guidance
  // =========================================================================

  describe("Reference Guidance", () => {
    it("AC-2: GIVEN a prompt mentioning @1 AND references for slots 1 (style/strong) and 3 (content/moderate) WHEN composeMultiReferencePrompt is called THEN the result contains 'Reference guidance:' with entries for BOTH references including role and strength", () => {
      // Arrange (GIVEN)
      const prompt = "A painting in @1 style";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "style", strength: "strong" },
        { slotPosition: 3, role: "content", strength: "moderate" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toContain("Reference guidance:");
      // Both references must appear in guidance
      expect(result).toContain("@image1");
      expect(result).toContain("@image3");
      // Role and strength for slot 1
      expect(result).toMatch(/@image1 provides style reference with strong influence/);
      // Role and strength for slot 3
      expect(result).toMatch(/@image3 provides content reference with moderate influence/);
    });

    it("AC-3: GIVEN a prompt WITHOUT any @-tokens AND a reference for slot 2 (style/dominant) WHEN composeMultiReferencePrompt is called THEN the result contains Reference guidance with @image2 as a context hint", () => {
      // Arrange (GIVEN)
      const prompt = "A beautiful landscape";
      const references: PromptReference[] = [
        { slotPosition: 2, role: "style", strength: "dominant" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toContain("Reference guidance:");
      expect(result).toContain("@image2");
      expect(result).toMatch(/@image2 provides style reference with dominant influence/);
    });

    it("AC-4: GIVEN a prompt mentioning @1 AND references for slots 1 (content/subtle) and 5 (color/dominant) WHEN composeMultiReferencePrompt is called THEN the guidance lists BOTH @image1 AND @image5 -- @image5 is included even though not mentioned in prompt", () => {
      // Arrange (GIVEN)
      const prompt = "Use @1 as base";
      const references: PromptReference[] = [
        { slotPosition: 1, role: "content", strength: "subtle" },
        { slotPosition: 5, role: "color", strength: "dominant" },
      ];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toContain("Reference guidance:");
      // Both references in guidance
      expect(result).toMatch(/@image1 provides content reference with subtle influence/);
      expect(result).toMatch(/@image5 provides color reference with dominant influence/);
    });

    it("AC-8: GIVEN references with all 5 roles and all 4 strength levels WHEN composeMultiReferencePrompt is called THEN the guidance contains correct English text for each combination", () => {
      // Arrange (GIVEN)
      const allRoles: ReferenceRole[] = [
        "style",
        "content",
        "structure",
        "character",
        "color",
      ];
      const allStrengths: ReferenceStrength[] = [
        "subtle",
        "moderate",
        "strong",
        "dominant",
      ];

      // We test a representative set: 5 references covering all roles,
      // and cycle through strengths.
      // Since slotPosition is 1-5, we use all 5 slots.
      const references: PromptReference[] = allRoles.map((role, i) => ({
        slotPosition: i + 1,
        role,
        strength: allStrengths[i % allStrengths.length],
      }));

      const prompt = "A test image";

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      // Verify each reference appears with correct role and strength text
      expect(result).toMatch(
        /@image1 provides style reference with subtle influence/
      );
      expect(result).toMatch(
        /@image2 provides content reference with moderate influence/
      );
      expect(result).toMatch(
        /@image3 provides structure reference with strong influence/
      );
      expect(result).toMatch(
        /@image4 provides character reference with dominant influence/
      );
      expect(result).toMatch(
        /@image5 provides color reference with subtle influence/
      );

      // Additionally verify all roles and strengths appear somewhere in output
      for (const role of allRoles) {
        expect(result).toContain(`provides ${role} reference`);
      }
      for (const strength of allStrengths) {
        expect(result).toContain(`${strength} influence`);
      }
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("AC-5: GIVEN a prompt 'Hello world' AND an empty references array WHEN composeMultiReferencePrompt is called THEN the prompt is returned unchanged (no 'Reference guidance:' appended)", () => {
      // Arrange (GIVEN)
      const prompt = "Hello world";
      const references: PromptReference[] = [];

      // Act (WHEN)
      const result = composeMultiReferencePrompt(prompt, references);

      // Assert (THEN)
      expect(result).toBe("Hello world");
      expect(result).not.toContain("Reference guidance:");
    });
  });

  // =========================================================================
  // Unit-level additional coverage
  // =========================================================================

  describe("Output structure", () => {
    it("should produce a result string that starts with the mapped prompt and ends with guidance", () => {
      const prompt = "Test @2 image";
      const references: PromptReference[] = [
        { slotPosition: 2, role: "structure", strength: "strong" },
      ];

      const result = composeMultiReferencePrompt(prompt, references);

      // The result should start with the mapped prompt text
      expect(result).toMatch(/^Test @image2 image/);
      // The result should end with the guidance sentence ending in a period
      expect(result).toMatch(/influence\.$/);
    });

    it("should sort references by slotPosition in guidance section", () => {
      const prompt = "A test";
      const references: PromptReference[] = [
        { slotPosition: 5, role: "color", strength: "dominant" },
        { slotPosition: 1, role: "style", strength: "subtle" },
        { slotPosition: 3, role: "content", strength: "moderate" },
      ];

      const result = composeMultiReferencePrompt(prompt, references);

      // Find positions of each @imageN in the guidance
      const guidancePart = result.split("Reference guidance:")[1];
      const pos1 = guidancePart.indexOf("@image1");
      const pos3 = guidancePart.indexOf("@image3");
      const pos5 = guidancePart.indexOf("@image5");

      expect(pos1).toBeLessThan(pos3);
      expect(pos3).toBeLessThan(pos5);
    });
  });
});
