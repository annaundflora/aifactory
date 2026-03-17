import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user-001", email: "test@example.com" }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock ReferenceService
vi.mock("@/lib/services/reference-service", () => ({
  ReferenceService: {
    uploadFromGallery: vi.fn(),
  },
}));

// Mock DB modules to prevent DATABASE_URL requirement at import time
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/lib/db/queries", () => ({
  getGenerationReferences: vi.fn().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue({ id: "proj-xyz", name: "Test", userId: "user-001" }),
  getGeneration: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  referenceImages: {
    id: "id",
    projectId: "projectId",
    imageUrl: "imageUrl",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { addGalleryAsReference } from "../references";
import { revalidatePath } from "next/cache";
import { ReferenceService } from "@/lib/services/reference-service";

// Cast mocks for type safety
const mockUploadFromGallery = vi.mocked(ReferenceService.uploadFromGallery);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PROJECT_ID = "proj-xyz";
const TEST_GENERATION_ID = "gen-abc-123";
const TEST_IMAGE_URL = "https://r2.example.com/generations/img.png";

function fakeGalleryReference(overrides: Record<string, unknown> = {}) {
  return {
    id: "ref-gallery-001",
    projectId: TEST_PROJECT_ID,
    imageUrl: TEST_IMAGE_URL,
    originalFilename: null,
    width: null,
    height: null,
    sourceType: "gallery",
    sourceGenerationId: TEST_GENERATION_ID,
    createdAt: new Date("2026-03-12T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("addGalleryAsReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-5: GIVEN ein Aufruf von addGalleryAsReference mit gueltigen Parametern
  //       WHEN die Server Action ausgefuehrt wird
  //       THEN wird ReferenceService.uploadFromGallery mit den gleichen
  //            Parametern aufgerufen und das Ergebnis zurueckgegeben
  // =========================================================================
  it("AC-5: should call ReferenceService.uploadFromGallery and return result", async () => {
    const expectedRecord = fakeGalleryReference({
      id: "ref-gallery-uuid",
      sourceType: "gallery",
    });
    mockUploadFromGallery.mockResolvedValue(expectedRecord as any);

    const result = await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // Verify delegation to service
    expect(mockUploadFromGallery).toHaveBeenCalledTimes(1);
    expect(mockUploadFromGallery).toHaveBeenCalledWith({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // Verify result is passed through
    expect(result).toEqual(
      expect.objectContaining({
        id: "ref-gallery-uuid",
        imageUrl: TEST_IMAGE_URL,
        sourceType: "gallery",
      })
    );

    // Verify no error property on success
    expect(result).not.toHaveProperty("error");
  });

  // =========================================================================
  // AC-6: GIVEN ein Aufruf von addGalleryAsReference mit leerem projectId
  //       WHEN die Server Action ausgefuehrt wird
  //       THEN wird { error: "Ungueltige Projekt-ID" } zurueckgegeben
  //            OHNE den Service aufzurufen
  // =========================================================================
  it('AC-6: should return error for empty projectId without calling service', async () => {
    const result = await addGalleryAsReference({
      projectId: "",
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // Verify error response
    expect(result).toEqual({ error: "Ungueltige Projekt-ID" });

    // Verify service was NOT called
    expect(mockUploadFromGallery).not.toHaveBeenCalled();

    // Verify revalidatePath was NOT called
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-6 (whitespace): should return error for whitespace-only projectId", async () => {
    const result = await addGalleryAsReference({
      projectId: "   ",
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    expect(result).toEqual({ error: "Ungueltige Projekt-ID" });
    expect(mockUploadFromGallery).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-7: GIVEN ReferenceService.uploadFromGallery wirft einen Fehler
  //       WHEN addGalleryAsReference ausgefuehrt wird
  //       THEN wird { error: "Bild-URL erforderlich" } zurueckgegeben
  // =========================================================================
  it('AC-7: should return error message from service when uploadFromGallery fails', async () => {
    mockUploadFromGallery.mockRejectedValue(
      new Error("Bild-URL erforderlich")
    );

    const result = await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: "",
    });

    // Verify error is passed through from the service
    expect(result).toEqual({ error: "Bild-URL erforderlich" });

    // Verify revalidatePath was NOT called on error
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-7 (generation-id error): should return error for Generation-ID erforderlich", async () => {
    mockUploadFromGallery.mockRejectedValue(
      new Error("Generation-ID erforderlich")
    );

    const result = await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: "",
      imageUrl: TEST_IMAGE_URL,
    });

    expect(result).toEqual({ error: "Generation-ID erforderlich" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("AC-7 (unknown error): should return 'Unbekannter Fehler' for non-Error throws", async () => {
    mockUploadFromGallery.mockRejectedValue("some string error");

    const result = await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    expect(result).toEqual({ error: "Unbekannter Fehler" });
  });

  // =========================================================================
  // AC-8: GIVEN ein erfolgreicher addGalleryAsReference-Aufruf
  //       WHEN die Action abgeschlossen ist
  //       THEN wurde revalidatePath("/") aufgerufen
  // =========================================================================
  it('AC-8: should call revalidatePath after successful gallery reference creation', async () => {
    const expectedRecord = fakeGalleryReference();
    mockUploadFromGallery.mockResolvedValue(expectedRecord as any);

    await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // Verify revalidatePath was called with "/"
    expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("AC-8 (no revalidate on error): should NOT call revalidatePath when service throws", async () => {
    mockUploadFromGallery.mockRejectedValue(new Error("some error"));

    await addGalleryAsReference({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
