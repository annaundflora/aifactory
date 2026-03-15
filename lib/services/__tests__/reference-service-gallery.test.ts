import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock StorageService (R2 client) — we assert it is NOT called
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock DB queries
vi.mock("@/lib/db/queries", () => ({
  createReferenceImage: vi.fn(),
  deleteReferenceImage: vi.fn(),
  getReferenceImagesByProject: vi.fn(),
}));

// Mock DB (drizzle) — needed because reference-service imports db
vi.mock("@/lib/db/index", () => {
  const selectResult = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(selectResult),
    },
  };
});

// Mock sharp — needed because reference-service imports sharp at top level
vi.mock("sharp", () => {
  const sharpInstance = {
    metadata: vi.fn().mockResolvedValue({ width: 0, height: 0 }),
  };
  const sharpFn = vi.fn().mockReturnValue(sharpInstance);
  return { default: sharpFn };
});

// Mock drizzle-orm eq helper
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

// Mock schema (referenceImages table reference)
vi.mock("@/lib/db/schema", () => ({
  referenceImages: {
    id: "reference_images.id",
  },
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { ReferenceService } from "@/lib/services/reference-service";
import { StorageService } from "@/lib/clients/storage";
import { createReferenceImage } from "@/lib/db/queries";
import type { ReferenceImage } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_R2_PUBLIC_URL = "https://r2.example.com";
const TEST_PROJECT_ID = "proj-xyz";
const TEST_GENERATION_ID = "gen-abc-123";
const TEST_IMAGE_URL = `${TEST_R2_PUBLIC_URL}/generations/img.png`;

/** Create a fake ReferenceImage record as returned by createReferenceImage */
function makeGalleryReferenceImage(
  overrides: Partial<ReferenceImage> = {}
): ReferenceImage {
  return {
    id: "ref-gallery-001",
    projectId: TEST_PROJECT_ID,
    imageUrl: TEST_IMAGE_URL,
    originalFilename: null,
    width: null,
    height: null,
    sourceType: "gallery",
    sourceGenerationId: TEST_GENERATION_ID,
    createdAt: new Date(),
    ...overrides,
  } as ReferenceImage;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReferenceService.uploadFromGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = TEST_R2_PUBLIC_URL;
  });

  // =========================================================================
  // AC-1: GIVEN ein Gallery-Bild mit generationId und imageUrl
  //       WHEN ReferenceService.uploadFromGallery aufgerufen wird
  //       THEN wird createReferenceImage mit sourceType "gallery" und
  //            sourceGenerationId aufgerufen und das Objekt zurueckgegeben
  // =========================================================================
  it("AC-1: should create a reference image with sourceType gallery and correct sourceGenerationId", async () => {
    const expectedRecord = makeGalleryReferenceImage({
      id: "ref-gallery-uuid",
      imageUrl: TEST_IMAGE_URL,
      sourceType: "gallery",
      sourceGenerationId: TEST_GENERATION_ID,
    });
    (createReferenceImage as Mock).mockResolvedValue(expectedRecord);

    const result = await ReferenceService.uploadFromGallery({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // Verify createReferenceImage was called with correct parameters
    expect(createReferenceImage).toHaveBeenCalledTimes(1);
    expect(createReferenceImage).toHaveBeenCalledWith({
      projectId: TEST_PROJECT_ID,
      imageUrl: TEST_IMAGE_URL,
      sourceType: "gallery",
      sourceGenerationId: TEST_GENERATION_ID,
    });

    // Verify returned object contains the expected fields
    expect(result.id).toBe("ref-gallery-uuid");
    expect(result.imageUrl).toBe(TEST_IMAGE_URL);
    expect(result.sourceType).toBe("gallery");
    expect(result.sourceGenerationId).toBe(TEST_GENERATION_ID);
  });

  // =========================================================================
  // AC-2: GIVEN ein Aufruf von ReferenceService.uploadFromGallery
  //       WHEN die Methode ausgefuehrt wird
  //       THEN findet KEIN R2-Upload statt (kein Aufruf von StorageService.upload)
  // =========================================================================
  it("AC-2: should not call StorageService.upload", async () => {
    const expectedRecord = makeGalleryReferenceImage();
    (createReferenceImage as Mock).mockResolvedValue(expectedRecord);

    await ReferenceService.uploadFromGallery({
      projectId: TEST_PROJECT_ID,
      generationId: TEST_GENERATION_ID,
      imageUrl: TEST_IMAGE_URL,
    });

    // StorageService.upload must NOT have been called
    expect(StorageService.upload).not.toHaveBeenCalled();
    // StorageService.delete also should not be called
    expect(StorageService.delete).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-3: GIVEN ein Aufruf von ReferenceService.uploadFromGallery ohne imageUrl
  //       WHEN die Methode ausgefuehrt wird
  //       THEN wird ein Fehler geworfen mit Message "Bild-URL erforderlich"
  // =========================================================================
  it('AC-3: should throw error for empty imageUrl', async () => {
    await expect(
      ReferenceService.uploadFromGallery({
        projectId: TEST_PROJECT_ID,
        generationId: TEST_GENERATION_ID,
        imageUrl: "",
      })
    ).rejects.toThrow("Bild-URL erforderlich");

    // Verify no DB call was made
    expect(createReferenceImage).not.toHaveBeenCalled();
    // Verify no R2 upload was made
    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  it("AC-3 (whitespace): should throw error for whitespace-only imageUrl", async () => {
    await expect(
      ReferenceService.uploadFromGallery({
        projectId: TEST_PROJECT_ID,
        generationId: TEST_GENERATION_ID,
        imageUrl: "   ",
      })
    ).rejects.toThrow("Bild-URL erforderlich");

    expect(createReferenceImage).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-4: GIVEN ein Aufruf von ReferenceService.uploadFromGallery ohne generationId
  //       WHEN die Methode ausgefuehrt wird
  //       THEN wird ein Fehler geworfen mit Message "Generation-ID erforderlich"
  // =========================================================================
  it('AC-4: should throw error for empty generationId', async () => {
    await expect(
      ReferenceService.uploadFromGallery({
        projectId: TEST_PROJECT_ID,
        generationId: "",
        imageUrl: TEST_IMAGE_URL,
      })
    ).rejects.toThrow("Generation-ID erforderlich");

    // Verify no DB call was made
    expect(createReferenceImage).not.toHaveBeenCalled();
    // Verify no R2 upload was made
    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  it("AC-4 (whitespace): should throw error for whitespace-only generationId", async () => {
    await expect(
      ReferenceService.uploadFromGallery({
        projectId: TEST_PROJECT_ID,
        generationId: "   ",
        imageUrl: TEST_IMAGE_URL,
      })
    ).rejects.toThrow("Generation-ID erforderlich");

    expect(createReferenceImage).not.toHaveBeenCalled();
  });
});
