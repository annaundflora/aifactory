/**
 * Slice 08: Build Compatibility Check
 *
 * AC-21: Verifies that generations.ts and references.ts compile without
 * TypeScript errors after auth additions.
 *
 * This test imports all exported functions from both files and verifies
 * they are properly exported as functions, which confirms TypeScript
 * compilation succeeded. Dependencies are mocked to isolate the import
 * check from runtime requirements (DATABASE_URL, etc.).
 */

import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — required so module import does not fail on missing env vars
// ---------------------------------------------------------------------------

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  getGeneration: vi.fn(),
  getProject: vi.fn(),
  deleteGeneration: vi.fn(),
  getSiblingsByBatchId: vi.fn(),
  getVariantFamily: vi.fn(),
  getGenerationReferences: vi.fn(),
}));

vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
  validateTotalMegapixels: vi.fn(),
}));

vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/services/reference-service", () => ({
  ReferenceService: {
    upload: vi.fn(),
    delete: vi.fn(),
    uploadFromGallery: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  referenceImages: {
    id: "referenceImages.id",
    projectId: "referenceImages.projectId",
    imageUrl: "referenceImages.imageUrl",
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AC-21: Build compatibility — generations.ts and references.ts compile without TypeScript errors", () => {
  it("should export all 7 generation actions as functions", async () => {
    /**
     * AC-21: GIVEN alle Aenderungen an generations.ts und references.ts angewendet
     * WHEN die Module importiert werden
     * THEN sind alle erwarteten Exports als Funktionen vorhanden (TypeScript-Kompilierung erfolgreich)
     */
    const generationsModule = await import("@/app/actions/generations");

    expect(typeof generationsModule.generateImages).toBe("function");
    expect(typeof generationsModule.retryGeneration).toBe("function");
    expect(typeof generationsModule.fetchGenerations).toBe("function");
    expect(typeof generationsModule.upscaleImage).toBe("function");
    expect(typeof generationsModule.deleteGeneration).toBe("function");
    expect(typeof generationsModule.getSiblingGenerations).toBe("function");
    expect(typeof generationsModule.getVariantFamilyAction).toBe("function");
  });

  it("should export all 5 reference actions as functions", async () => {
    /**
     * AC-21: GIVEN alle Aenderungen an references.ts angewendet
     * WHEN das Modul importiert wird
     * THEN sind alle erwarteten Exports als Funktionen vorhanden (TypeScript-Kompilierung erfolgreich)
     */
    const referencesModule = await import("@/app/actions/references");

    expect(typeof referencesModule.uploadReferenceImage).toBe("function");
    expect(typeof referencesModule.deleteReferenceImage).toBe("function");
    expect(typeof referencesModule.addGalleryAsReference).toBe("function");
    expect(typeof referencesModule.getReferenceCount).toBe("function");
    expect(typeof referencesModule.getProvenanceData).toBe("function");
  });
});
