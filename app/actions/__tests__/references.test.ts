import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

vi.mock("@/lib/services/reference-service", () => ({
  ReferenceService: {
    upload: vi.fn(),
    delete: vi.fn(),
    getByProject: vi.fn(),
    uploadFromGallery: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  uploadReferenceImage,
  deleteReferenceImage,
} from "@/app/actions/references";
import { ReferenceService } from "@/lib/services/reference-service";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Tests: uploadReferenceImage Server Action
// ---------------------------------------------------------------------------

describe("uploadReferenceImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-1: GIVEN ein Aufruf von uploadReferenceImage mit { projectId: "<UUID>", file: <PNG-File> }
   * WHEN die Action ausgefuehrt wird
   * THEN wird ReferenceService.upload({ projectId, file }) aufgerufen und das Ergebnis
   *      { id: "<UUID>", imageUrl: "https://...", width: 1920, height: 1080 } zurueckgegeben
   */
  it("AC-1: should call ReferenceService.upload with file and return { id, imageUrl, width, height }", async () => {
    const mockResult = {
      id: "ref-001",
      imageUrl: "https://cdn.example.com/references/proj-001/ref-001.png",
      width: 1920,
      height: 1080,
    };
    (ReferenceService.upload as Mock).mockResolvedValue(mockResult);

    const file = new File([new Uint8Array(1024)], "photo.png", {
      type: "image/png",
    });
    const result = await uploadReferenceImage({
      projectId: "proj-001",
      file,
    });

    expect(ReferenceService.upload).toHaveBeenCalledWith({
      projectId: "proj-001",
      file,
      url: undefined,
    });
    expect(result).toEqual(mockResult);
    expect(result).toHaveProperty("id", "ref-001");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("width", 1920);
    expect(result).toHaveProperty("height", 1080);
  });

  /**
   * AC-2: GIVEN ein Aufruf von uploadReferenceImage mit { projectId: "<UUID>", url: "https://example.com/photo.jpg" }
   * WHEN die Action ausgefuehrt wird
   * THEN wird ReferenceService.upload({ projectId, url }) aufgerufen und das Ergebnis
   *      { id: "<UUID>", imageUrl: "https://...", width: 800, height: 600 } zurueckgegeben
   */
  it("AC-2: should call ReferenceService.upload with url and return { id, imageUrl, width, height }", async () => {
    const mockResult = {
      id: "ref-002",
      imageUrl: "https://cdn.example.com/references/proj-001/ref-002.jpg",
      width: 800,
      height: 600,
    };
    (ReferenceService.upload as Mock).mockResolvedValue(mockResult);

    const result = await uploadReferenceImage({
      projectId: "proj-001",
      url: "https://example.com/photo.jpg",
    });

    expect(ReferenceService.upload).toHaveBeenCalledWith({
      projectId: "proj-001",
      file: undefined,
      url: "https://example.com/photo.jpg",
    });
    expect(result).toEqual(mockResult);
    expect(result).toHaveProperty("id", "ref-002");
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("width", 800);
    expect(result).toHaveProperty("height", 600);
  });

  /**
   * AC-3: GIVEN ein Aufruf von uploadReferenceImage mit leerem projectId (leerer String oder undefined)
   * WHEN die Action ausgefuehrt wird
   * THEN wird { error: "Ungueltige Projekt-ID" } zurueckgegeben OHNE den Service aufzurufen
   */
  it('AC-3: should return error for empty projectId without calling service (empty string)', async () => {
    const result = await uploadReferenceImage({
      projectId: "",
      file: new File([new Uint8Array(1)], "test.png", { type: "image/png" }),
    });

    expect(result).toEqual({ error: "Ungueltige Projekt-ID" });
    expect(ReferenceService.upload).not.toHaveBeenCalled();
  });

  it('AC-3: should return error for whitespace-only projectId without calling service', async () => {
    const result = await uploadReferenceImage({
      projectId: "   ",
      file: new File([new Uint8Array(1)], "test.png", { type: "image/png" }),
    });

    expect(result).toEqual({ error: "Ungueltige Projekt-ID" });
    expect(ReferenceService.upload).not.toHaveBeenCalled();
  });

  /**
   * AC-4: GIVEN ein Aufruf von uploadReferenceImage ohne file und ohne url
   * WHEN die Action ausgefuehrt wird
   * THEN wird { error: "Datei oder URL erforderlich" } zurueckgegeben OHNE den Service aufzurufen
   */
  it('AC-4: should return error when neither file nor url is provided', async () => {
    const result = await uploadReferenceImage({
      projectId: "proj-001",
    });

    expect(result).toEqual({ error: "Datei oder URL erforderlich" });
    expect(ReferenceService.upload).not.toHaveBeenCalled();
  });

  /**
   * AC-5: GIVEN ReferenceService.upload wirft einen Fehler mit Message "Nur PNG, JPG, JPEG und WebP erlaubt"
   * WHEN uploadReferenceImage ausgefuehrt wird
   * THEN wird { error: "Nur PNG, JPG, JPEG und WebP erlaubt" } zurueckgegeben (Error Message wird durchgereicht)
   */
  it('AC-5: should return error message from ReferenceService when upload fails', async () => {
    (ReferenceService.upload as Mock).mockRejectedValue(
      new Error("Nur PNG, JPG, JPEG und WebP erlaubt")
    );

    const file = new File([new Uint8Array(1024)], "photo.gif", {
      type: "image/gif",
    });
    const result = await uploadReferenceImage({
      projectId: "proj-001",
      file,
    });

    expect(result).toEqual({ error: "Nur PNG, JPG, JPEG und WebP erlaubt" });
  });

  it('AC-5: should return "Unbekannter Fehler" when service throws non-Error', async () => {
    (ReferenceService.upload as Mock).mockRejectedValue("string error");

    const file = new File([new Uint8Array(1024)], "photo.png", {
      type: "image/png",
    });
    const result = await uploadReferenceImage({
      projectId: "proj-001",
      file,
    });

    expect(result).toEqual({ error: "Unbekannter Fehler" });
  });

  /**
   * AC-6: GIVEN ein erfolgreicher uploadReferenceImage-Aufruf
   * WHEN die Action abgeschlossen ist
   * THEN wurde revalidatePath("/") aufgerufen
   */
  it('AC-6: should call revalidatePath after successful upload', async () => {
    const mockResult = {
      id: "ref-003",
      imageUrl: "https://cdn.example.com/references/proj-001/ref-003.png",
      width: 640,
      height: 480,
    };
    (ReferenceService.upload as Mock).mockResolvedValue(mockResult);

    await uploadReferenceImage({
      projectId: "proj-001",
      file: new File([new Uint8Array(1024)], "photo.png", {
        type: "image/png",
      }),
    });

    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it('AC-6: should NOT call revalidatePath when upload fails', async () => {
    (ReferenceService.upload as Mock).mockRejectedValue(
      new Error("Upload failed")
    );

    await uploadReferenceImage({
      projectId: "proj-001",
      file: new File([new Uint8Array(1024)], "photo.png", {
        type: "image/png",
      }),
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: deleteReferenceImage Server Action
// ---------------------------------------------------------------------------

describe("deleteReferenceImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-7: GIVEN ein Aufruf von deleteReferenceImage mit { id: "<UUID>" }
   * WHEN die Action ausgefuehrt wird
   * THEN wird ReferenceService.delete(id) aufgerufen, revalidatePath("/") ausgefuehrt
   *      und { success: true } zurueckgegeben
   */
  it('AC-7: should call ReferenceService.delete and return { success: true }', async () => {
    (ReferenceService.delete as Mock).mockResolvedValue(undefined);

    const result = await deleteReferenceImage({ id: "ref-to-delete" });

    expect(ReferenceService.delete).toHaveBeenCalledWith("ref-to-delete");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(result).toEqual({ success: true });
  });

  /**
   * AC-8: GIVEN ein Aufruf von deleteReferenceImage mit leerem id
   * WHEN die Action ausgefuehrt wird
   * THEN wird { error: "Ungueltige Referenz-ID" } zurueckgegeben OHNE den Service aufzurufen
   */
  it('AC-8: should return error for empty id without calling service (empty string)', async () => {
    const result = await deleteReferenceImage({ id: "" });

    expect(result).toEqual({ error: "Ungueltige Referenz-ID" });
    expect(ReferenceService.delete).not.toHaveBeenCalled();
  });

  it('AC-8: should return error for whitespace-only id without calling service', async () => {
    const result = await deleteReferenceImage({ id: "   " });

    expect(result).toEqual({ error: "Ungueltige Referenz-ID" });
    expect(ReferenceService.delete).not.toHaveBeenCalled();
  });

  /**
   * AC-9: GIVEN ReferenceService.delete wirft einen Fehler
   * WHEN deleteReferenceImage ausgefuehrt wird
   * THEN wird { success: false } zurueckgegeben
   */
  it('AC-9: should return { success: false } when ReferenceService.delete throws', async () => {
    (ReferenceService.delete as Mock).mockRejectedValue(
      new Error("Reference image not found: ref-nonexistent")
    );

    const result = await deleteReferenceImage({ id: "ref-nonexistent" });

    expect(ReferenceService.delete).toHaveBeenCalledWith("ref-nonexistent");
    expect(result).toEqual({ success: false });
  });
});

// ---------------------------------------------------------------------------
// Tests: Server Action directive
// ---------------------------------------------------------------------------

describe("Server Action directive", () => {
  /**
   * AC-10: GIVEN die Datei app/actions/references.ts
   * WHEN sie inspiziert wird
   * THEN beginnt sie mit "use server" Directive (Next.js Server Action Pflicht)
   */
  it('AC-10: should have "use server" as first line', () => {
    const filePath = resolve(__dirname, "..", "references.ts");
    const content = readFileSync(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();

    expect(firstLine).toBe('"use server";');
  });
});
