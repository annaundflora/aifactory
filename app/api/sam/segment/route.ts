/**
 * POST /api/sam/segment — Click-to-segment via SAM 2 (Meta).
 *
 * Accepts normalized click coordinates (0-1) and an image URL,
 * calls SAM 2 on Replicate, uploads the resulting mask PNG to R2,
 * and returns the mask URL.
 *
 * Auth: session cookie via requireAuth().
 * Runtime: nodejs (storage client needs Node APIs).
 */

import { requireAuth } from "@/lib/auth/guard";
import { replicateRun } from "@/lib/clients/replicate";
import { StorageService } from "@/lib/clients/storage";
import { randomUUID } from "crypto";

// Force Node.js runtime — storage client uses Node APIs
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAM_MODEL_ID = "meta/sam-2";
const SAM_TIMEOUT_MS = 30_000;
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
    // If R2_PUBLIC_URL is not configured, reject all URLs for safety
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

  // 5. Call SAM 2 via Replicate
  try {
    const result = await Promise.race([
      replicateRun(SAM_MODEL_ID, {
        image: image_url,
        point_coords: [[click_x, click_y]],
        point_labels: [1], // 1 = foreground point
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("SAM timeout")),
          SAM_TIMEOUT_MS
        )
      ),
    ]);

    // Check for empty output (no object detected)
    if (!result || !result.output) {
      return Response.json(
        { error: "Kein Objekt erkannt. Versuche einen anderen Punkt." },
        { status: 422 }
      );
    }

    // 6. Upload mask PNG to R2
    const maskKey = `${MASK_KEY_PREFIX}${randomUUID()}.png`;
    const maskUrl = await StorageService.upload(
      result.output,
      maskKey,
      "image/png"
    );

    // 7. Return mask URL
    return Response.json({ mask_url: maskUrl }, { status: 200 });
  } catch (error: unknown) {
    // Check if the error message indicates empty mask / no object
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
