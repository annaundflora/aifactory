/**
 * POST /api/sam/segment — Click-to-segment via SAM 2 (Meta).
 *
 * Accepts normalized click coordinates (0-1) and an image URL,
 * calls SAM 2 on Replicate (auto-segmentation mode), picks the mask
 * that contains the clicked point, uploads it to R2, and returns the URL.
 *
 * Auth: session cookie via requireAuth().
 * Runtime: nodejs (storage client needs Node APIs).
 */

import { requireAuth } from "@/lib/auth/guard";
import { StorageService } from "@/lib/clients/storage";
import { randomUUID } from "crypto";
import Replicate from "replicate";
import sharp from "sharp";

// Force Node.js runtime — storage client uses Node APIs
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAM_MODEL_VERSION =
  "meta/sam-2:fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83";
const SAM_TIMEOUT_MS = 60_000;
const MASK_KEY_PREFIX = "masks/";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SAMSegmentRequest {
  image_url: string;
  click_x: number;
  click_y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the image_url belongs to the allowed R2 domain.
 * Prevents SSRF attacks by rejecting arbitrary URLs.
 */
function isAllowedImageUrl(url: string): boolean {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const allowed = new URL(r2PublicUrl);
    return parsed.hostname === allowed.hostname;
  } catch {
    return false;
  }
}

/**
 * Check if a pixel at (x, y) in a grayscale/alpha mask buffer is non-zero.
 * Returns the count of non-zero pixels in a small region around the point
 * to handle edge cases.
 */
async function maskContainsPoint(
  maskUrl: string,
  clickX: number,
  clickY: number
): Promise<boolean> {
  const response = await fetch(maskUrl);
  if (!response.ok) return false;
  const buffer = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) return false;

  // Convert normalized coords to pixel coords
  const px = Math.round(clickX * width);
  const py = Math.round(clickY * height);

  // Sample a small 5x5 region around the click point
  const regionSize = 5;
  const left = Math.max(0, px - Math.floor(regionSize / 2));
  const top = Math.max(0, py - Math.floor(regionSize / 2));
  const regionW = Math.min(regionSize, width - left);
  const regionH = Math.min(regionSize, height - top);

  const { data } = await sharp(buffer)
    .grayscale()
    .extract({ left, top, width: regionW, height: regionH })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Count non-zero pixels (mask hit)
  let nonZero = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 128) nonZero++;
  }

  return nonZero > 0;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Auth check
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return Response.json({ error: authResult.error }, { status: 401 });
  }

  // 2. Parse request body
  let body: SAMSegmentRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const { image_url, click_x, click_y } = body;

  // 3. Validate image_url
  if (!image_url || typeof image_url !== "string") {
    return Response.json(
      { error: "image_url ist erforderlich" },
      { status: 400 }
    );
  }

  if (!isAllowedImageUrl(image_url)) {
    return Response.json(
      { error: "image_url ist ungueltig" },
      { status: 400 }
    );
  }

  // 4. Validate click coordinates
  if (
    typeof click_x !== "number" ||
    typeof click_y !== "number" ||
    !isFinite(click_x) ||
    !isFinite(click_y) ||
    click_x < 0 ||
    click_x > 1 ||
    click_y < 0 ||
    click_y > 1
  ) {
    return Response.json(
      { error: "Koordinaten muessen normalisiert sein (0-1)" },
      { status: 400 }
    );
  }

  // 5. Call SAM 2 via Replicate (auto-segmentation mode)
  try {
    const replicate = new Replicate();

    const output = await Promise.race([
      replicate.run(SAM_MODEL_VERSION, {
        input: {
          image: image_url,
          // Use fewer points for faster results; we just need the object at the click
          points_per_side: 16,
          pred_iou_thresh: 0.86,
          stability_score_thresh: 0.92,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("SAM timeout")),
          SAM_TIMEOUT_MS
        )
      ),
    ]);

    // SAM 2 returns { combined_mask: string, individual_masks: string[] }
    if (!output) {
      return Response.json(
        { error: "Kein Objekt erkannt. Versuche einen anderen Punkt." },
        { status: 422 }
      );
    }

    // Normalize output to array of mask URLs
    const maskOutputs: string[] = [];
    const samOutput = output as {
      combined_mask?: string;
      individual_masks?: string[];
    };
    if (samOutput.combined_mask) {
      maskOutputs.push(samOutput.combined_mask);
    }
    if (Array.isArray(samOutput.individual_masks)) {
      maskOutputs.push(...samOutput.individual_masks);
    }

    // Fallback: handle legacy array/string formats
    if (maskOutputs.length === 0) {
      if (Array.isArray(output)) {
        for (const item of output) {
          if (typeof item === "string") {
            maskOutputs.push(item);
          } else if (item && typeof item === "object" && "url" in item) {
            maskOutputs.push(
              typeof (item as { url: () => string }).url === "function"
                ? (item as { url: () => string }).url()
                : String((item as { url: string }).url)
            );
          }
        }
      } else if (typeof output === "string") {
        maskOutputs.push(output);
      }
    }

    if (maskOutputs.length === 0) {
      return Response.json(
        { error: "Kein Objekt erkannt. Versuche einen anderen Punkt." },
        { status: 422 }
      );
    }

    // 6. Find the mask that contains the clicked point.
    //    Skip the first output (combined mask) if there are multiple,
    //    as individual masks are more useful for inpainting.
    const candidates = maskOutputs.length > 1 ? maskOutputs.slice(1) : maskOutputs;

    let selectedMaskUrl: string | null = null;
    for (const maskUrl of candidates) {
      if (await maskContainsPoint(maskUrl, click_x, click_y)) {
        selectedMaskUrl = maskUrl;
        break;
      }
    }

    // Fallback: if no individual mask matched, try the combined mask
    if (!selectedMaskUrl && maskOutputs.length > 1) {
      if (await maskContainsPoint(maskOutputs[0], click_x, click_y)) {
        selectedMaskUrl = maskOutputs[0];
      }
    }

    // Last fallback: use the first mask if nothing matched (click was between segments)
    if (!selectedMaskUrl) {
      selectedMaskUrl = candidates[0] || maskOutputs[0];
    }

    // 7. Download the selected mask and re-upload to our R2
    const maskResponse = await fetch(selectedMaskUrl);
    if (!maskResponse.ok) {
      return Response.json(
        { error: "Maske konnte nicht geladen werden." },
        { status: 502 }
      );
    }
    const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());

    const maskKey = `${MASK_KEY_PREFIX}${randomUUID()}.png`;
    const uploadedMaskUrl = await StorageService.upload(
      maskBuffer,
      maskKey,
      "image/png"
    );

    // 8. Return mask URL
    return Response.json({ mask_url: uploadedMaskUrl }, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (
      message.includes("kein Output") ||
      message.includes("Replicate lieferte kein Output")
    ) {
      return Response.json(
        { error: "Kein Objekt erkannt. Versuche einen anderen Punkt." },
        { status: 422 }
      );
    }

    // All other Replicate / timeout errors → 502
    console.error("[SAM] Segmentation error:", message);
    return Response.json(
      { error: "SAM-Fehler. Versuche manuelles Maskieren." },
      { status: 502 }
    );
  }
}
