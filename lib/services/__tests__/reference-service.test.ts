import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock StorageService (R2 client)
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

// Mock DB (drizzle) for deleteRef internal lookup
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

// Mock sharp for image metadata extraction
vi.mock("sharp", () => {
  const sharpInstance = {
    metadata: vi.fn().mockResolvedValue({ width: 1920, height: 1080 }),
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
import {
  createReferenceImage,
  deleteReferenceImage,
  getReferenceImagesByProject,
} from "@/lib/db/queries";
import { db } from "@/lib/db/index";
import sharp from "sharp";
import type { ReferenceImage } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PROJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/** Create a minimal File-like object */
function makeFile(options: {
  name?: string;
  type: string;
  sizeBytes: number;
}): File {
  const buffer = Buffer.alloc(options.sizeBytes, 0);
  const blob = new Blob([buffer], { type: options.type });
  return new File([blob], options.name ?? "test-image.png", {
    type: options.type,
  });
}

/** Create a fake ReferenceImage record */
function makeReferenceImage(
  overrides: Partial<ReferenceImage> = {}
): ReferenceImage {
  return {
    id: "ref-001",
    projectId: TEST_PROJECT_ID,
    imageUrl: `https://r2.example.com/references/${TEST_PROJECT_ID}/some-uuid.png`,
    originalFilename: "test.png",
    width: 1920,
    height: 1080,
    sourceType: "upload",
    sourceGenerationId: null,
    createdAt: new Date(),
    ...overrides,
  } as ReferenceImage;
}

/** Setup default mock return values for a successful upload flow */
function setupSuccessfulUploadMocks(
  overrides: {
    width?: number;
    height?: number;
    r2Url?: string;
    recordId?: string;
  } = {}
) {
  const {
    width = 1920,
    height = 1080,
    r2Url = `https://r2.example.com/references/${TEST_PROJECT_ID}/mock-uuid.png`,
    recordId = "ref-001",
  } = overrides;

  const sharpInst = {
    metadata: vi.fn().mockResolvedValue({ width, height }),
  };
  (sharp as unknown as Mock).mockReturnValue(sharpInst);

  (StorageService.upload as Mock).mockResolvedValue(r2Url);

  const record = makeReferenceImage({
    id: recordId,
    imageUrl: r2Url,
    width,
    height,
  });
  (createReferenceImage as Mock).mockResolvedValue(record);

  return { sharpInst, record };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReferenceService.upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset crypto.randomUUID for predictable key generation
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "11111111-2222-3333-4444-555555555555"
    );
  });

  // =========================================================================
  // AC-1: GIVEN eine gueltige PNG-Datei (MIME image/png, 2MB, 1920x1080)
  //        WHEN ReferenceService.upload({ projectId, file }) aufgerufen wird
  //        THEN wird die Datei unter dem R2-Key references/<projectId>/<uuid>.png hochgeladen,
  //             ein DB-Eintrag via createReferenceImage erstellt mit sourceType: "upload",
  //             width: 1920, height: 1080, und das zurueckgegebene Objekt enthaelt
  //             { id, imageUrl, width, height }
  // =========================================================================
  it("AC-1: should upload a PNG file to R2 and create a DB record with width/height", async () => {
    const { sharpInst } = setupSuccessfulUploadMocks({
      width: 1920,
      height: 1080,
    });

    const file = makeFile({
      name: "photo.png",
      type: "image/png",
      sizeBytes: 2 * 1024 * 1024, // 2MB
    });

    const result = await ReferenceService.upload({
      projectId: TEST_PROJECT_ID,
      file,
    });

    // Verify R2 upload was called with correct key pattern
    expect(StorageService.upload).toHaveBeenCalledTimes(1);
    const uploadArgs = (StorageService.upload as Mock).mock.calls[0];
    expect(uploadArgs[1]).toBe(
      `references/${TEST_PROJECT_ID}/11111111-2222-3333-4444-555555555555.png`
    );
    expect(uploadArgs[2]).toBe("image/png");

    // Verify sharp was called to extract dimensions
    expect(sharp).toHaveBeenCalled();
    expect(sharpInst.metadata).toHaveBeenCalled();

    // Verify DB record was created with correct params
    expect(createReferenceImage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: TEST_PROJECT_ID,
        sourceType: "upload",
        width: 1920,
        height: 1080,
      })
    );

    // Verify return value shape
    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        imageUrl: expect.any(String),
        width: 1920,
        height: 1080,
      })
    );
  });

  // =========================================================================
  // AC-2: GIVEN eine gueltige URL zu einem JPEG-Bild (MIME image/jpeg, 5MB, 800x600)
  //        WHEN ReferenceService.upload({ projectId, url }) aufgerufen wird
  //        THEN wird das Bild per Server-Side Fetch heruntergeladen,
  //             unter references/<projectId>/<uuid>.jpg in R2 gespeichert,
  //             und ein DB-Eintrag mit width: 800, height: 600, sourceType: "upload" erstellt
  // =========================================================================
  it("AC-2: should fetch image from URL, upload to R2, and create DB record with dimensions", async () => {
    setupSuccessfulUploadMocks({ width: 800, height: 600 });

    const imageBuffer = Buffer.alloc(5 * 1024 * 1024, 0); // 5MB

    // Mock global fetch for URL download
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(imageBuffer, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      })
    );

    const result = await ReferenceService.upload({
      projectId: TEST_PROJECT_ID,
      url: "https://example.com/photo.jpg",
    });

    // Verify fetch was called with the URL and security options
    expect(fetchSpy).toHaveBeenCalledWith("https://example.com/photo.jpg", expect.objectContaining({
      redirect: "error",
    }));

    // Verify R2 key uses .jpg extension (from image/jpeg)
    const uploadArgs = (StorageService.upload as Mock).mock.calls[0];
    expect(uploadArgs[1]).toBe(
      `references/${TEST_PROJECT_ID}/11111111-2222-3333-4444-555555555555.jpg`
    );
    expect(uploadArgs[2]).toBe("image/jpeg");

    // Verify DB record sourceType and dimensions
    expect(createReferenceImage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: TEST_PROJECT_ID,
        sourceType: "upload",
        width: 800,
        height: 600,
      })
    );

    // Verify return shape
    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        imageUrl: expect.any(String),
        width: 800,
        height: 600,
      })
    );

    fetchSpy.mockRestore();
  });

  // =========================================================================
  // AC-3: GIVEN eine Datei mit MIME-Type image/gif
  //        WHEN ReferenceService.upload() aufgerufen wird
  //        THEN wird ein Fehler geworfen mit Message "Nur PNG, JPG, JPEG und WebP erlaubt"
  // =========================================================================
  it('AC-3: should reject file with unsupported MIME type (image/gif)', async () => {
    const file = makeFile({
      name: "animation.gif",
      type: "image/gif",
      sizeBytes: 1024,
    });

    await expect(
      ReferenceService.upload({ projectId: TEST_PROJECT_ID, file })
    ).rejects.toThrow("Nur PNG, JPG, JPEG und WebP erlaubt");

    // Verify no upload or DB call happened
    expect(StorageService.upload).not.toHaveBeenCalled();
    expect(createReferenceImage).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-4: GIVEN eine Datei mit 15MB Groesse (ueber dem 10MB-Limit)
  //        WHEN ReferenceService.upload() aufgerufen wird
  //        THEN wird ein Fehler geworfen mit Message "Datei darf maximal 10MB gross sein"
  // =========================================================================
  it('AC-4: should reject file exceeding 10MB size limit', async () => {
    const file = makeFile({
      name: "huge.png",
      type: "image/png",
      sizeBytes: 15 * 1024 * 1024, // 15MB
    });

    await expect(
      ReferenceService.upload({ projectId: TEST_PROJECT_ID, file })
    ).rejects.toThrow("Datei darf maximal 10MB gross sein");

    // Verify no upload or DB call happened
    expect(StorageService.upload).not.toHaveBeenCalled();
    expect(createReferenceImage).not.toHaveBeenCalled();
  });

  // =========================================================================
  // AC-7: GIVEN eine gueltige WebP-Datei
  //        WHEN ReferenceService.upload() aufgerufen wird
  //        THEN wird sharp(buffer).metadata() aufgerufen um width und height zu extrahieren,
  //             und die Werte werden im DB-Eintrag gespeichert
  // =========================================================================
  it("AC-7: should extract width and height via sharp metadata", async () => {
    const { sharpInst } = setupSuccessfulUploadMocks({
      width: 640,
      height: 480,
    });

    const file = makeFile({
      name: "photo.webp",
      type: "image/webp",
      sizeBytes: 512 * 1024,
    });

    await ReferenceService.upload({
      projectId: TEST_PROJECT_ID,
      file,
    });

    // Verify sharp was called with a Buffer
    expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
    // Verify .metadata() was called on the sharp instance
    expect(sharpInst.metadata).toHaveBeenCalledTimes(1);

    // Verify the extracted dimensions were passed to DB creation
    expect(createReferenceImage).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 640,
        height: 480,
      })
    );
  });

  // =========================================================================
  // AC-8: GIVEN der R2-Key-Pattern
  //        WHEN ein Upload ausgefuehrt wird
  //        THEN folgt der generierte Key dem Pattern references/{projectId}/{uuid}.{ext}
  //             wobei ext aus dem MIME-Type abgeleitet wird
  //             (image/png -> png, image/jpeg -> jpg, image/webp -> webp)
  // =========================================================================
  describe("AC-8: R2 key pattern references/{projectId}/{uuid}.{ext}", () => {
    it("should map image/png to .png extension", async () => {
      setupSuccessfulUploadMocks();

      const file = makeFile({
        name: "test.png",
        type: "image/png",
        sizeBytes: 1024,
      });

      await ReferenceService.upload({ projectId: TEST_PROJECT_ID, file });

      const key = (StorageService.upload as Mock).mock.calls[0][1] as string;
      expect(key).toBe(
        `references/${TEST_PROJECT_ID}/11111111-2222-3333-4444-555555555555.png`
      );
    });

    it("should map image/jpeg to .jpg extension", async () => {
      setupSuccessfulUploadMocks();

      const file = makeFile({
        name: "test.jpg",
        type: "image/jpeg",
        sizeBytes: 1024,
      });

      await ReferenceService.upload({ projectId: TEST_PROJECT_ID, file });

      const key = (StorageService.upload as Mock).mock.calls[0][1] as string;
      expect(key).toBe(
        `references/${TEST_PROJECT_ID}/11111111-2222-3333-4444-555555555555.jpg`
      );
    });

    it("should map image/webp to .webp extension", async () => {
      setupSuccessfulUploadMocks();

      const file = makeFile({
        name: "test.webp",
        type: "image/webp",
        sizeBytes: 1024,
      });

      await ReferenceService.upload({ projectId: TEST_PROJECT_ID, file });

      const key = (StorageService.upload as Mock).mock.calls[0][1] as string;
      expect(key).toBe(
        `references/${TEST_PROJECT_ID}/11111111-2222-3333-4444-555555555555.webp`
      );
    });

    it("should include a UUID segment in the key", async () => {
      setupSuccessfulUploadMocks();

      const file = makeFile({
        name: "test.png",
        type: "image/png",
        sizeBytes: 1024,
      });

      await ReferenceService.upload({ projectId: TEST_PROJECT_ID, file });

      const key = (StorageService.upload as Mock).mock.calls[0][1] as string;
      // Pattern: references/{projectId}/{uuid}.{ext}
      const regex = new RegExp(
        `^references/${TEST_PROJECT_ID}/[0-9a-f-]{36}\\.png$`
      );
      expect(key).toMatch(regex);
    });
  });

  // =========================================================================
  // Additional edge cases for upload validation
  // =========================================================================
  it("should reject URL-based upload with unsupported MIME type", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(Buffer.from("fake-gif"), {
        status: 200,
        headers: { "content-type": "image/gif" },
      })
    );

    await expect(
      ReferenceService.upload({
        projectId: TEST_PROJECT_ID,
        url: "https://example.com/anim.gif",
      })
    ).rejects.toThrow("Nur PNG, JPG, JPEG und WebP erlaubt");

    expect(StorageService.upload).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("should reject URL-based upload exceeding 10MB size limit", async () => {
    const largeBuffer = Buffer.alloc(15 * 1024 * 1024, 0);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(largeBuffer, {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );

    await expect(
      ReferenceService.upload({
        projectId: TEST_PROJECT_ID,
        url: "https://example.com/huge.png",
      })
    ).rejects.toThrow("Datei darf maximal 10MB gross sein");

    expect(StorageService.upload).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("should throw when neither file nor url is provided", async () => {
    await expect(
      ReferenceService.upload({ projectId: TEST_PROJECT_ID })
    ).rejects.toThrow("Entweder file oder url muss angegeben werden");
  });
});

describe("ReferenceService.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-5: GIVEN ein existierender Reference-Image-Eintrag mit bekannter id und imageUrl
  //             die auf einen R2-Key unter references/ zeigt
  //        WHEN ReferenceService.delete(id) aufgerufen wird
  //        THEN wird der R2-Key aus der imageUrl extrahiert, StorageService.delete(key) aufgerufen,
  //             und deleteReferenceImage(id) ausgefuehrt — beides erfolgreich
  // =========================================================================
  it("AC-5: should delete R2 object and DB record", async () => {
    const refId = "ref-delete-001";
    const imageUrl = `https://r2.example.com/references/${TEST_PROJECT_ID}/some-uuid.png`;
    const expectedR2Key = `references/${TEST_PROJECT_ID}/some-uuid.png`;

    // Mock the DB lookup (db.select().from().where()) to return the record
    const whereResult = [
      makeReferenceImage({ id: refId, imageUrl }),
    ];
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(whereResult),
    };
    (db.select as Mock).mockReturnValue(selectChain);

    // Mock storage delete
    (StorageService.delete as Mock).mockResolvedValue(undefined);

    // Mock DB delete
    (deleteReferenceImage as Mock).mockResolvedValue(undefined);

    await ReferenceService.delete(refId);

    // Verify R2 key was extracted correctly and StorageService.delete was called
    expect(StorageService.delete).toHaveBeenCalledTimes(1);
    expect(StorageService.delete).toHaveBeenCalledWith(expectedR2Key);

    // Verify DB record was deleted
    expect(deleteReferenceImage).toHaveBeenCalledTimes(1);
    expect(deleteReferenceImage).toHaveBeenCalledWith(refId);
  });

  it("should throw when reference image is not found in DB", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    (db.select as Mock).mockReturnValue(selectChain);

    await expect(ReferenceService.delete("nonexistent-id")).rejects.toThrow(
      "Reference image not found"
    );

    expect(StorageService.delete).not.toHaveBeenCalled();
    expect(deleteReferenceImage).not.toHaveBeenCalled();
  });
});

describe("ReferenceService.getByProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // AC-6: GIVEN 3 Reference-Image-Eintraege fuer projectId = "proj-A"
  //        WHEN ReferenceService.getByProject("proj-A") aufgerufen wird
  //        THEN wird getReferenceImagesByProject("proj-A") aufgerufen und die 3 Eintraege zurueckgegeben
  // =========================================================================
  it('AC-6: should delegate to getReferenceImagesByProject and return results', async () => {
    const projectId = "proj-A";
    const records = [
      makeReferenceImage({ id: "ref-1", projectId }),
      makeReferenceImage({ id: "ref-2", projectId }),
      makeReferenceImage({ id: "ref-3", projectId }),
    ];

    (getReferenceImagesByProject as Mock).mockResolvedValue(records);

    const result = await ReferenceService.getByProject(projectId);

    // Verify delegation to query function
    expect(getReferenceImagesByProject).toHaveBeenCalledTimes(1);
    expect(getReferenceImagesByProject).toHaveBeenCalledWith(projectId);

    // Verify all 3 records returned
    expect(result).toHaveLength(3);
    expect(result).toEqual(records);
  });

  it("should return empty array when project has no reference images", async () => {
    (getReferenceImagesByProject as Mock).mockResolvedValue([]);

    const result = await ReferenceService.getByProject("empty-project");

    expect(getReferenceImagesByProject).toHaveBeenCalledWith("empty-project");
    expect(result).toEqual([]);
  });
});
