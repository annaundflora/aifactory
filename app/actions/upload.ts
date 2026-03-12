"use server";

import { StorageService } from "@/lib/clients/storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// ---------------------------------------------------------------------------
// uploadSourceImage
// ---------------------------------------------------------------------------

export async function uploadSourceImage(
  input:
    | { projectId: string; file: File }
    | { projectId: string; url: string }
): Promise<{ url: string } | { error: string }> {
  const { projectId } = input;

  if (!projectId || projectId.trim().length === 0) {
    return { error: "Ungültige Projekt-ID" };
  }

  if ("url" in input) {
    // URL path: server-side fetch and proxy through R2
    let response: Response;
    try {
      response = await fetch(input.url);
    } catch {
      return { error: "Bild konnte nicht geladen werden" };
    }

    if (!response.ok) {
      return { error: "Bild konnte nicht geladen werden" };
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return { error: "Nur PNG, JPG, JPEG und WebP erlaubt" };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > MAX_FILE_SIZE) {
      return { error: "Datei darf maximal 10MB groß sein" };
    }

    try {
      const ext = MIME_TO_EXT[mimeType] ?? "png";
      const uuid = crypto.randomUUID();
      const key = `sources/${projectId}/${uuid}.${ext}`;
      const url = await StorageService.upload(buffer, key, mimeType);
      return { url };
    } catch (error: unknown) {
      console.error("uploadSourceImage (url) error:", error);
      return { error: "Bild konnte nicht hochgeladen werden" };
    }
  }

  // File path: existing logic
  const { file } = input;

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Nur PNG, JPG, JPEG und WebP erlaubt" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "Datei darf maximal 10MB groß sein" };
  }

  try {
    const ext = MIME_TO_EXT[file.type] ?? "png";
    const uuid = crypto.randomUUID();
    const key = `sources/${projectId}/${uuid}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await StorageService.upload(buffer, key, file.type);
    return { url };
  } catch (error: unknown) {
    console.error("uploadSourceImage error:", error);
    return { error: "Bild konnte nicht hochgeladen werden" };
  }
}
