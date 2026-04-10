import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

/**
 * Generate a slugified download filename from a prompt and creation date.
 * Format: `{slug}_YYYY-MM-DD.png`
 * - Lowercase, special characters removed, spaces become hyphens
 * - Prompt portion is max 60 characters, truncated at last word boundary
 */
export function generateDownloadFilename(
  prompt: string,
  createdAt: Date | string,
): string {
  const date = new Date(createdAt);
  const dateStr = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");

  // Slugify: lowercase, remove non-alphanumeric (keep spaces/hyphens), collapse whitespace, trim
  let slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Truncate to max 60 characters at word (hyphen) boundary
  if (slug.length > 60) {
    slug = slug.slice(0, 60);
    const lastHyphen = slug.lastIndexOf("-");
    if (lastHyphen > 0) {
      slug = slug.slice(0, lastHyphen);
    }
  }

  return `${slug}_${dateStr}.png`;
}

/**
 * Download an image from a URL.
 *
 * On devices that support the Web Share API with file sharing (e.g. iOS/iPadOS
 * Safari), the native share sheet is used instead of a programmatic anchor
 * click. This avoids the iPad Safari bug where blob-URL navigation destroys the
 * SPA state.
 *
 * On all other devices, the existing anchor-click fallback is used.
 *
 * Client-side only.
 */
export async function downloadImage(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const blob = await response.blob();

  // Create a File object for potential Web Share API usage
  const file = new File([blob], filename, { type: blob.type });

  // Feature detection: check if the browser supports sharing files
  const canShareFile =
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFile) {
    // Web Share API path (iOS/iPadOS)
    const objectUrl = URL.createObjectURL(blob);
    try {
      await navigator.share({ files: [file] });
    } catch (error: unknown) {
      // AbortError means the user dismissed the share sheet — resolve silently
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      // Any other error is re-thrown for the caller to handle (e.g. toast)
      throw error;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } else {
    // Anchor-click fallback (Desktop browsers)
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
