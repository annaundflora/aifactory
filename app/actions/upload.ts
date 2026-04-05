"use server";

import { StorageService } from "@/lib/clients/storage";
import { requireAuth } from "@/lib/auth/guard";
import { validateUrl } from "@/lib/security/url-validator";

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
// uploadMask — Upload a grayscale PNG mask to R2 (prefix: masks/)
// ---------------------------------------------------------------------------

export async function uploadMask(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const maskFile = formData.get("mask");
  if (!maskFile || typeof maskFile === "string") {
    return { error: "Mask-Upload fehlgeschlagen" };
  }

  if (maskFile.size > MAX_FILE_SIZE) {
    return { error: "Mask-Upload fehlgeschlagen" };
  }

  try {
    const uuid = crypto.randomUUID();
    const key = `masks/${uuid}.png`;
    const buffer = Buffer.from(await maskFile.arrayBuffer());
    const url = await StorageService.upload(buffer, key, "image/png");
    return { url };
  } catch (error: unknown) {
    console.error("uploadMask error:", error);
    return { error: "Mask-Upload fehlgeschlagen" };
  }
}

// ---------------------------------------------------------------------------
// uploadSourceImage
// ---------------------------------------------------------------------------

export async function uploadSourceImage(
  input:
    | { projectId: string; file: File }
    | { projectId: string; url: string }
): Promise<{ url: string } | { error: string }> {
  // Auth guard -- must be first check
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { projectId } = input;

  if (!projectId || projectId.trim().length === 0) {
    return { error: "Ungültige Projekt-ID" };
  }

  if ("url" in input) {
    // SSRF prevention -- validate URL before fetch
    const urlCheck = validateUrl(input.url);
    if (!urlCheck.valid) {
      return { error: urlCheck.reason };
    }

    // URL path: server-side fetch and proxy through R2
    // - redirect: 'error' prevents SSRF via open-redirect to private IPs
    // - AbortSignal.timeout prevents hanging on slow/unresponsive hosts
    let response: Response;
    try {
      response = await fetch(input.url, {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
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
