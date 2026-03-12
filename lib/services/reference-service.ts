import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/index";
import { referenceImages } from "@/lib/db/schema";
import { StorageService } from "@/lib/clients/storage";
import {
  createReferenceImage,
  deleteReferenceImage,
  getReferenceImagesByProject,
  type ReferenceImage,
} from "@/lib/db/queries";

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract width and height from an image buffer using sharp.
 */
async function extractDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
  };
}

/**
 * Extract the R2 key from a full imageUrl.
 * The StorageService.upload returns `${publicUrl}/${key}`,
 * so the key is everything after the last occurrence of the public URL prefix.
 * We look for the `references/` prefix in the URL to extract the key.
 */
function extractR2Key(imageUrl: string): string {
  const idx = imageUrl.indexOf("references/");
  if (idx === -1) {
    throw new Error(`Kann R2-Key nicht aus URL extrahieren: ${imageUrl}`);
  }
  return imageUrl.slice(idx);
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * Upload a reference image from a File or URL.
 * Validates MIME type and file size, uploads to R2, extracts dimensions
 * via sharp, and creates a DB record.
 */
async function upload(input: {
  projectId: string;
  file?: File;
  url?: string;
}): Promise<{ id: string; imageUrl: string; width: number; height: number }> {
  const { projectId, file, url } = input;

  let buffer: Buffer;
  let mimeType: string;
  let originalFilename: string | undefined;

  if (url) {
    // URL path: server-side fetch
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error("Bild konnte nicht geladen werden");
    }

    if (!response.ok) {
      throw new Error("Bild konnte nicht geladen werden");
    }

    mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error("Nur PNG, JPG, JPEG und WebP erlaubt");
    }

    buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > MAX_FILE_SIZE) {
      throw new Error("Datei darf maximal 10MB gross sein");
    }

    // Try to extract filename from URL
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      originalFilename = pathParts[pathParts.length - 1] || undefined;
    } catch {
      // ignore invalid URLs
    }
  } else if (file) {
    // File path
    mimeType = file.type;

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error("Nur PNG, JPG, JPEG und WebP erlaubt");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Datei darf maximal 10MB gross sein");
    }

    buffer = Buffer.from(await file.arrayBuffer());
    originalFilename = file.name || undefined;
  } else {
    throw new Error("Entweder file oder url muss angegeben werden");
  }

  // Extract dimensions via sharp
  const { width, height } = await extractDimensions(buffer);

  // Generate R2 key
  const ext = MIME_TO_EXT[mimeType] ?? "png";
  const uuid = crypto.randomUUID();
  const key = `references/${projectId}/${uuid}.${ext}`;

  // Upload to R2
  const imageUrl = await StorageService.upload(buffer, key, mimeType);

  // Create DB record
  const record = await createReferenceImage({
    projectId,
    imageUrl,
    originalFilename,
    width,
    height,
    sourceType: "upload",
  });

  return {
    id: record.id,
    imageUrl: record.imageUrl,
    width: width,
    height: height,
  };
}

/**
 * Delete a reference image: remove from R2 and delete DB record.
 */
async function deleteRef(id: string): Promise<void> {
  // Fetch the record to get the imageUrl
  const [record] = await db
    .select()
    .from(referenceImages)
    .where(eq(referenceImages.id, id));

  if (!record) {
    throw new Error(`Reference image not found: ${id}`);
  }

  // Extract R2 key and delete from storage
  const r2Key = extractR2Key(record.imageUrl);
  await StorageService.delete(r2Key);

  // Delete DB record
  await deleteReferenceImage(id);
}

/**
 * Get all reference images for a project, ordered by createdAt.
 */
async function getByProject(projectId: string): Promise<ReferenceImage[]> {
  return getReferenceImagesByProject(projectId);
}

/**
 * Register an existing gallery image as a reference image.
 * No R2 upload occurs — the gallery image URL is reused directly.
 * Only a DB record with sourceType "gallery" is created.
 */
async function uploadFromGallery(input: {
  projectId: string;
  generationId: string;
  imageUrl: string;
}): Promise<ReferenceImage> {
  const { projectId, generationId, imageUrl } = input;

  if (!imageUrl || imageUrl.trim().length === 0) {
    throw new Error("Bild-URL erforderlich");
  }

  if (!generationId || generationId.trim().length === 0) {
    throw new Error("Generation-ID erforderlich");
  }

  // Create DB record only — no R2 upload, no dimension extraction
  const record = await createReferenceImage({
    projectId,
    imageUrl,
    sourceType: "gallery",
    sourceGenerationId: generationId,
  });

  return record;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const ReferenceService = {
  upload,
  uploadFromGallery,
  delete: deleteRef,
  getByProject,
};
