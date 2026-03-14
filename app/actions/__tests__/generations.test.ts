import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/services/generation-service", () => ({
  GenerationService: {
    generate: vi.fn(),
    retry: vi.fn(),
    upscale: vi.fn(),
  },
}));

vi.mock("@/lib/db/queries", () => ({
  getGenerations: vi.fn(),
  createGeneration: vi.fn(),
  getGeneration: vi.fn(),
  updateGeneration: vi.fn(),
  deleteGeneration: vi.fn(),
}));

// Mock next/cache to prevent server-side Next.js errors
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock lib/clients/storage for deleteGeneration + uploadSourceImage tests
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));


import { generateImages, retryGeneration, deleteGeneration, upscaleImage } from "@/app/actions/generations";
import { uploadSourceImage } from "@/app/actions/upload";
import { GenerationService } from "@/lib/services/generation-service";
import { getGeneration, deleteGeneration as deleteGenerationFromDb, type Generation } from "@/lib/db/queries";
import { StorageService } from "@/lib/clients/storage";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: "gen-001",
    projectId: "proj-001",
    prompt: "A fox",
    negativePrompt: null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: {},
    status: "pending",
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    createdAt: new Date(),
    ...overrides,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Tests: generateImages Server Action
// ---------------------------------------------------------------------------

describe("generateImages Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-9: GIVEN generateImages wird mit leerem Prompt aufgerufen
  //        WHEN die Action ausgefuehrt wird
  //        THEN wird ein Fehler-Objekt { error: "Prompt darf nicht leer sein" } zurueckgegeben
  it('AC-9: should return error object for empty prompt', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-9: should return error object for whitespace-only prompt', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "   ",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Prompt darf nicht leer sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-10: GIVEN generateImages wird mit ungueltigem modelId-Format aufgerufen
  //         WHEN die Action ausgefuehrt wird
  //         THEN wird ein Fehler-Objekt { error: "Unbekanntes Modell" } zurueckgegeben
  it('AC-10: should return error object for invalid model ID format', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["INVALID/Model"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Unbekanntes Modell" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-11: GIVEN generateImages wird mit count=5 aufgerufen
  //         WHEN die Action ausgefuehrt wird
  //         THEN wird ein Fehler-Objekt { error: "Anzahl muss zwischen 1 und 4 liegen" } zurueckgegeben
  it('AC-11: should return error object for count outside 1-4 range (count=5)', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 5,
    });

    expect(result).toEqual({ error: "Anzahl muss zwischen 1 und 4 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  it('AC-11: should return error object for count=0', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 0,
    });

    expect(result).toEqual({ error: "Anzahl muss zwischen 1 und 4 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-12: GIVEN app/actions/generations.ts existiert
  //         WHEN die Datei inspiziert wird
  //         THEN beginnt sie mit "use server" als erste Zeile
  it('AC-12: should have "use server" as first line', () => {
    const filePath = resolve(__dirname, "..", "generations.ts");
    const content = readFileSync(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();

    expect(firstLine).toBe('"use server";');
  });
});

// ---------------------------------------------------------------------------
// Tests: Slice-12 modelIds validation in generateImages Server Action
// ---------------------------------------------------------------------------

describe("generateImages Server Action — Slice-12 modelIds validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-5: GIVEN generateImages wird mit modelIds: [] (leeres Array) aufgerufen
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler { error: "1-3 Modelle muessen ausgewaehlt sein" } zurueckgegeben
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-5: should return validation error for empty modelIds array', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: [],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "1-3 Modelle muessen ausgewaehlt sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-6: GIVEN generateImages wird mit modelIds: ["m1", "m2", "m3", "m4"] (4 IDs) aufgerufen
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler { error: "1-3 Modelle muessen ausgewaehlt sein" } zurueckgegeben
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-6: should return validation error when more than three model IDs are provided', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["owner/m1", "owner/m2", "owner/m3", "owner/m4"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "1-3 Modelle muessen ausgewaehlt sein" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  // AC-7: GIVEN generateImages wird mit modelIds: ["UPPER/Case"] aufgerufen (ungueltige Format)
  //        WHEN die Validierung in der Server Action ausgefuehrt wird
  //        THEN wird ein Validierungsfehler zurueckgegeben (ID entspricht nicht ^[a-z0-9-]+/[a-z0-9._-]+$)
  //        AND KEIN Generation-Record wird erstellt
  it('Slice12-AC-7: should return validation error for model ID not matching owner/name regex', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["UPPER/Case"],
      params: {},
      count: 1,
    });

    expect(result).toEqual({ error: "Unbekanntes Modell" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: retryGeneration Server Action
// ---------------------------------------------------------------------------

describe("retryGeneration Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-7 (delegation): GIVEN eine failed Generation
  //                      WHEN retryGeneration aufgerufen wird
  //                      THEN wird an GenerationService.retry delegiert
  it("AC-7: should delegate to GenerationService for failed generation", async () => {
    const retriedGen = makeGeneration({ id: "gen-retry", status: "pending" });
    (GenerationService.retry as Mock).mockResolvedValue(retriedGen);

    const result = await retryGeneration({ id: "gen-retry" });

    expect(GenerationService.retry).toHaveBeenCalledWith("gen-retry");
    expect(result).toEqual(retriedGen);
  });

  // AC-8 (action level): GIVEN retryGeneration wird mit einer ID aufgerufen, deren Status NICHT "failed" ist
  //                        WHEN die Action ausgefuehrt wird
  //                        THEN wird ein Fehler-Objekt zurueckgegeben
  it("AC-8: should return error for non-failed generation", async () => {
    (GenerationService.retry as Mock).mockRejectedValue(
      new Error("Nur fehlgeschlagene Generierungen koennen wiederholt werden")
    );

    const result = await retryGeneration({ id: "gen-completed" });

    expect(result).toEqual({
      error: "Nur fehlgeschlagene Generierungen koennen wiederholt werden",
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteGeneration Server Action (Slice 13)
// ---------------------------------------------------------------------------

describe("deleteGeneration Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-11: GIVEN die deleteGeneration Server Action wird mit einer gueltigen Generation-ID aufgerufen
   * WHEN die Generation existiert und eine image_url hat
   * THEN wird der DB-Eintrag geloescht, das R2-Objekt geloescht und { success: true } zurueckgegeben
   */
  it("AC-11: should delete generation from DB and image from R2 and return success true", async () => {
    const gen = makeGeneration({
      id: "gen-to-delete",
      imageUrl: "https://cdn.example.com/images/gen-to-delete.png",
    });

    (getGeneration as Mock).mockResolvedValue(gen);
    (deleteGenerationFromDb as Mock).mockResolvedValue(undefined);
    (StorageService.delete as Mock).mockResolvedValue(undefined);

    const result = await deleteGeneration({ id: "gen-to-delete" });

    // Should fetch the generation first
    expect(getGeneration).toHaveBeenCalledWith("gen-to-delete");

    // DB delete first (data integrity)
    expect(deleteGenerationFromDb).toHaveBeenCalledWith("gen-to-delete");

    // R2 delete second — key extracted from URL
    expect(StorageService.delete).toHaveBeenCalledWith(
      "images/gen-to-delete.png"
    );

    // revalidatePath called for gallery update
    expect(revalidatePath).toHaveBeenCalledWith("/");

    // Return success
    expect(result).toEqual({ success: true });
  });

  it("AC-11: should still succeed when generation has no image_url", async () => {
    const gen = makeGeneration({
      id: "gen-no-image",
      imageUrl: null,
    });

    (getGeneration as Mock).mockResolvedValue(gen);
    (deleteGenerationFromDb as Mock).mockResolvedValue(undefined);

    const result = await deleteGeneration({ id: "gen-no-image" });

    expect(deleteGenerationFromDb).toHaveBeenCalledWith("gen-no-image");
    expect(StorageService.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  /**
   * AC-12: GIVEN die deleteGeneration Server Action wird mit einer nicht-existierenden ID aufgerufen
   * WHEN die Aktion ausgefuehrt wird
   * THEN wird { success: false } zurueckgegeben
   */
  it("AC-12: should return success false for non-existing generation ID", async () => {
    (getGeneration as Mock).mockRejectedValue(
      new Error("Generation not found")
    );

    const result = await deleteGeneration({ id: "gen-nonexistent" });

    expect(getGeneration).toHaveBeenCalledWith("gen-nonexistent");
    expect(deleteGenerationFromDb).not.toHaveBeenCalled();
    expect(StorageService.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false });
  });
});

// ---------------------------------------------------------------------------
// Tests: uploadSourceImage Server Action (Slice 08)
// ---------------------------------------------------------------------------

describe("uploadSourceImage Server Action", () => {
  const PROJECT_ID = "proj-upload-test";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid-1234" as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeFile(name: string, type: string, sizeInBytes: number): File {
    return new File([new Uint8Array(sizeInBytes)], name, { type });
  }

  /**
   * AC-1: GIVEN a valid PNG file (5MB) and a valid projectId
   * WHEN uploadSourceImage is called
   * THEN it returns { url: string } where url contains "sources/{projectId}/"
   */
  it('AC-1: valid PNG (5MB) returns { url } containing sources/{projectId}/', async () => {
    const fakeUrl = `https://cdn.example.com/sources/${PROJECT_ID}/test-uuid-1234.png`;
    (StorageService.upload as Mock).mockResolvedValue(fakeUrl);

    const file = makeFile("photo.png", "image/png", 5 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toHaveProperty("url");
    expect((result as { url: string }).url).toContain(`sources/${PROJECT_ID}/`);
  });

  /**
   * AC-2: GIVEN a valid JPEG file (2MB)
   * WHEN uploadSourceImage is called
   * THEN it returns { url: string } (JPEG accepted)
   */
  it('AC-2: valid JPEG (2MB) returns { url }', async () => {
    const fakeUrl = `https://cdn.example.com/sources/${PROJECT_ID}/test-uuid-1234.jpg`;
    (StorageService.upload as Mock).mockResolvedValue(fakeUrl);

    const file = makeFile("photo.jpg", "image/jpeg", 2 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toHaveProperty("url");
    expect((result as { url: string }).url).toBeTruthy();
  });

  /**
   * AC-3: GIVEN a valid WebP file (3MB)
   * WHEN uploadSourceImage is called
   * THEN it returns { url: string } (WebP accepted)
   */
  it('AC-3: valid WebP (3MB) returns { url }', async () => {
    const fakeUrl = `https://cdn.example.com/sources/${PROJECT_ID}/test-uuid-1234.webp`;
    (StorageService.upload as Mock).mockResolvedValue(fakeUrl);

    const file = makeFile("photo.webp", "image/webp", 3 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toHaveProperty("url");
    expect((result as { url: string }).url).toBeTruthy();
  });

  /**
   * AC-4: GIVEN a GIF file (invalid type)
   * WHEN uploadSourceImage is called
   * THEN it returns { error: "Nur PNG, JPG, JPEG und WebP erlaubt" } without calling R2
   */
  it('AC-4: GIF (invalid type) returns error and does not call StorageService', async () => {
    const file = makeFile("animation.gif", "image/gif", 1 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toEqual({ error: "Nur PNG, JPG, JPEG und WebP erlaubt" });
    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  /**
   * AC-5: GIVEN a PDF file (invalid type)
   * WHEN uploadSourceImage is called
   * THEN it returns { error: "Nur PNG, JPG, JPEG und WebP erlaubt" } without calling R2
   */
  it('AC-5: PDF (invalid type) returns error and does not call StorageService', async () => {
    const file = makeFile("document.pdf", "application/pdf", 1 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toEqual({ error: "Nur PNG, JPG, JPEG und WebP erlaubt" });
    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  /**
   * AC-6: GIVEN a PNG file over 10MB (11MB)
   * WHEN uploadSourceImage is called
   * THEN it returns { error: "Datei darf maximal 10MB groß sein" } without calling R2
   */
  it('AC-6: PNG over 10MB returns size error and does not call StorageService', async () => {
    const file = makeFile("huge.png", "image/png", 11 * 1024 * 1024 + 1);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toEqual({ error: "Datei darf maximal 10MB groß sein" });
    expect(StorageService.upload).not.toHaveBeenCalled();
  });

  /**
   * AC-7: GIVEN a PNG file exactly 10MB
   * WHEN uploadSourceImage is called
   * THEN it returns { url: string } (boundary allowed)
   */
  it('AC-7: PNG exactly 10MB (boundary) returns { url }', async () => {
    const fakeUrl = `https://cdn.example.com/sources/${PROJECT_ID}/test-uuid-1234.png`;
    (StorageService.upload as Mock).mockResolvedValue(fakeUrl);

    const file = makeFile("exact10mb.png", "image/png", 10 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toHaveProperty("url");
    expect((result as { url: string }).url).toBeTruthy();
  });

  /**
   * AC-8: GIVEN StorageService.upload throws an error
   * WHEN uploadSourceImage is called
   * THEN it returns { error: "Bild konnte nicht hochgeladen werden" } and calls console.error
   */
  it('AC-8: StorageService.upload throws returns upload error and logs to console.error', async () => {
    (StorageService.upload as Mock).mockRejectedValue(new Error("R2 down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const file = makeFile("photo.png", "image/png", 1 * 1024 * 1024);
    const result = await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(result).toEqual({ error: "Bild konnte nicht hochgeladen werden" });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  /**
   * AC-9: GIVEN a valid PNG file
   * WHEN uploadSourceImage is called
   * THEN StorageService.upload is called with key matching sources/{projectId}/{uuid}.png and contentType "image/png"
   */
  it('AC-9: valid PNG calls StorageService.upload with correct key and contentType', async () => {
    (StorageService.upload as Mock).mockResolvedValue("https://cdn.example.com/img.png");

    const file = makeFile("photo.png", "image/png", 1 * 1024 * 1024);
    await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(StorageService.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      `sources/${PROJECT_ID}/test-uuid-1234.png`,
      "image/png"
    );
  });

  /**
   * AC-10: GIVEN a valid JPEG file
   * WHEN uploadSourceImage is called
   * THEN StorageService.upload is called with key matching sources/{projectId}/{uuid}.jpg and contentType "image/jpeg"
   */
  it('AC-10: valid JPEG calls StorageService.upload with correct key and contentType', async () => {
    (StorageService.upload as Mock).mockResolvedValue("https://cdn.example.com/img.jpg");

    const file = makeFile("photo.jpg", "image/jpeg", 1 * 1024 * 1024);
    await uploadSourceImage({ projectId: PROJECT_ID, file });

    expect(StorageService.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      `sources/${PROJECT_ID}/test-uuid-1234.jpg`,
      "image/jpeg"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: generateImages img2img extensions (Slice 09, AC 1-5)
// ---------------------------------------------------------------------------

describe("generateImages img2img extensions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN generateImages wird mit generationMode: "img2img" aber ohne sourceImageUrl aufgerufen
   * WHEN die Action die Eingaben validiert
   * THEN gibt sie { error: "Source-Image ist erforderlich fuer img2img" } zurueck
   *      und ruft GenerationService.generate() nicht auf
   */
  it('AC-1: should return error when generationMode is img2img and sourceImageUrl is missing', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      // sourceImageUrl intentionally omitted
    });

    expect(result).toEqual({ error: "Source-Image ist erforderlich fuer img2img" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  /**
   * AC-2: GIVEN generateImages wird mit generationMode: "img2img", einer gueltigen sourceImageUrl
   *       und strength: 1.5 aufgerufen
   * WHEN die Action die Eingaben validiert
   * THEN gibt sie { error: "Strength muss zwischen 0 und 1 liegen" } zurueck
   *      und ruft GenerationService.generate() nicht auf
   */
  it('AC-2: should return error when strength is greater than 1', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
      strength: 1.5,
    });

    expect(result).toEqual({ error: "Strength muss zwischen 0 und 1 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  /**
   * AC-3: GIVEN generateImages wird mit generationMode: "img2img", einer gueltigen sourceImageUrl
   *       und strength: -0.1 aufgerufen
   * WHEN die Action die Eingaben validiert
   * THEN gibt sie { error: "Strength muss zwischen 0 und 1 liegen" } zurueck
   *      und ruft GenerationService.generate() nicht auf
   */
  it('AC-3: should return error when strength is less than 0', async () => {
    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
      strength: -0.1,
    });

    expect(result).toEqual({ error: "Strength muss zwischen 0 und 1 liegen" });
    expect(GenerationService.generate).not.toHaveBeenCalled();
  });

  /**
   * AC-4: GIVEN generateImages wird mit generationMode: "img2img",
   *       sourceImageUrl: "https://r2.example.com/sources/p1/abc.png" und strength: 0.6 aufgerufen
   * WHEN die Validierung erfolgreich ist
   * THEN delegiert die Action an GenerationService.generate() mit den Feldern
   *      generationMode, sourceImageUrl und strength und gibt das Ergebnis (Generation[]) zurueck
   */
  it('AC-4: should call GenerationService.generate with generationMode, sourceImageUrl and strength for img2img', async () => {
    const mockGenerations = [makeGeneration({ id: "gen-img2img-001" })];
    (GenerationService.generate as Mock).mockResolvedValue(mockGenerations);

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      generationMode: "img2img",
      sourceImageUrl: "https://r2.example.com/sources/p1/abc.png",
      strength: 0.6,
    });

    expect(GenerationService.generate).toHaveBeenCalledWith(
      "proj-001",          // projectId
      "A fox",             // promptMotiv
      "",                  // promptStyle (defaults to '')
      undefined,           // negativePrompt
      ["black-forest-labs/flux-2-pro"], // modelIds
      {},                  // params
      1,                   // count
      "img2img",           // generationMode
      "https://r2.example.com/sources/p1/abc.png", // sourceImageUrl
      0.6,                 // strength
      undefined            // references
    );
    expect(result).toEqual(mockGenerations);
  });

  /**
   * AC-5: GIVEN generateImages wird ohne generationMode aufgerufen (bestehender txt2img-Call)
   * WHEN die Action delegiert
   * THEN ruft sie GenerationService.generate() auf ohne Validierungsfehler;
   *      bestehende Tests bleiben gruen
   */
  it('AC-5: should delegate to GenerationService.generate without error when generationMode is absent', async () => {
    const mockGenerations = [makeGeneration({ id: "gen-txt2img-001" })];
    (GenerationService.generate as Mock).mockResolvedValue(mockGenerations);

    const result = await generateImages({
      projectId: "proj-001",
      promptMotiv: "A fox",
      modelIds: ["black-forest-labs/flux-2-pro"],
      params: {},
      count: 1,
      // generationMode intentionally omitted (txt2img path)
    });

    expect(GenerationService.generate).toHaveBeenCalledTimes(1);
    // Should pass undefined for the new optional fields
    expect(GenerationService.generate).toHaveBeenCalledWith(
      "proj-001",
      "A fox",
      "",
      undefined,
      ["black-forest-labs/flux-2-pro"],
      {},
      1,
      undefined,  // generationMode
      undefined,  // sourceImageUrl
      undefined,  // strength
      undefined   // references
    );
    expect(result).toEqual(mockGenerations);
  });
});

// ---------------------------------------------------------------------------
// Tests: upscaleImage Server Action (Slice 09, AC 6-10)
// ---------------------------------------------------------------------------

describe("upscaleImage Server Action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-6: GIVEN upscaleImage wird mit scale: 3 (ungueltig) aufgerufen
   * WHEN die Action die Eingaben validiert
   * THEN gibt sie { error: "Scale muss 2 oder 4 sein" } zurueck
   *      und ruft GenerationService.upscale() nicht auf
   */
  it('AC-6: should return error when scale is not 2 or 4', async () => {
    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 3 as 2 | 4,  // intentionally invalid
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(result).toEqual({ error: "Scale muss 2 oder 4 sein" });
    expect(GenerationService.upscale).not.toHaveBeenCalled();
  });

  /**
   * AC-7: GIVEN upscaleImage wird ohne sourceImageUrl aufgerufen
   * WHEN die Action die Eingaben validiert
   * THEN gibt sie { error: "Source-Image ist erforderlich fuer img2img" } zurueck
   *      und ruft GenerationService.upscale() nicht auf
   */
  it('AC-7: should return error when sourceImageUrl is missing in upscaleImage', async () => {
    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "",  // empty = missing
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(result).toEqual({ error: "Source-Image ist erforderlich fuer img2img" });
    expect(GenerationService.upscale).not.toHaveBeenCalled();
  });

  /**
   * AC-8: GIVEN upscaleImage wird mit { projectId, sourceImageUrl: "https://r2.example.com/img.png", scale: 2 }
   *       aufgerufen
   * WHEN die Validierung erfolgreich ist
   * THEN delegiert die Action an GenerationService.upscale() mit allen uebergebenen Feldern
   *      und gibt das zurueckgegebene Generation-Objekt zurueck
   */
  it('AC-8: should call GenerationService.upscale with correct args and return Generation', async () => {
    const mockGeneration = makeGeneration({ id: "gen-upscale-001" });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(GenerationService.upscale).toHaveBeenCalledWith({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      sourceGenerationId: undefined,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });
    expect(result).toEqual(mockGeneration);
  });

  /**
   * AC-9: GIVEN upscaleImage wird mit { projectId, sourceImageUrl, scale: 4, sourceGenerationId: "uuid-123" }
   *       aufgerufen
   * WHEN die Validierung erfolgreich ist
   * THEN delegiert die Action an GenerationService.upscale() mit sourceGenerationId: "uuid-123"
   */
  it('AC-9: should pass sourceGenerationId to GenerationService.upscale when provided', async () => {
    const mockGeneration = makeGeneration({ id: "gen-upscale-002" });
    (GenerationService.upscale as Mock).mockResolvedValue(mockGeneration);

    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 4,
      sourceGenerationId: "uuid-123",
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(GenerationService.upscale).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceGenerationId: "uuid-123",
      })
    );
    expect(GenerationService.upscale).toHaveBeenCalledWith({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 4,
      sourceGenerationId: "uuid-123",
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });
    expect(result).toEqual(mockGeneration);
  });

  /**
   * AC-10: GIVEN GenerationService.upscale() wirft einen Fehler waehrend eines validen upscaleImage-Aufrufs
   * WHEN die Action den Fehler erhaelt
   * THEN gibt sie { error: string } zurueck und loggt mit console.error -- kein Throw nach aussen
   */
  it('AC-10: should return error object when GenerationService.upscale throws', async () => {
    (GenerationService.upscale as Mock).mockRejectedValue(
      new Error("Replicate API unavailable")
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await upscaleImage({
      projectId: "proj-001",
      sourceImageUrl: "https://r2.example.com/img.png",
      scale: 2,
      modelId: "nightmareai/real-esrgan",
      modelParams: { scale: 2 },
    });

    expect(result).toEqual({ error: "Replicate API unavailable" });
    expect(consoleSpy).toHaveBeenCalled();
    // Verify no throw propagated — the fact that we reach this assertion proves it
    expect(result).toHaveProperty("error");

    consoleSpy.mockRestore();
  });
});
