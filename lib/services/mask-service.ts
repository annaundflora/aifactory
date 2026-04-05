// ---------------------------------------------------------------------------
// MaskService — Pure frontend utility for mask operations
// ---------------------------------------------------------------------------
// Four functions for Canvas mask processing:
//   1. toGrayscalePng   — Convert RGBA ImageData to grayscale PNG Blob
//   2. applyFeathering  — Gaussian blur feathering on mask edges
//   3. scaleToOriginal  — Scale mask from display to original resolution
//   4. validateMinSize  — Validate mask bounding box minimum size
//
// All functions are pure (no side effects) and work exclusively on Canvas data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. toGrayscalePng
// ---------------------------------------------------------------------------

/**
 * Convert an RGBA ImageData to a grayscale PNG Blob.
 *
 * - Pixels with alpha > 0 become white (rgb 255,255,255)
 * - Pixels with alpha = 0 become black (rgb 0,0,0)
 *
 * Returns a Blob of type "image/png".
 */
export async function toGrayscalePng(imageData: ImageData): Promise<Blob> {
  const { width, height, data } = imageData;

  // Create a new ImageData for the grayscale result
  const grayscaleData = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    // Binary decision: alpha > 0 → white, alpha = 0 → black
    const value = alpha > 0 ? 255 : 0;

    grayscaleData[i] = value;     // R
    grayscaleData[i + 1] = value; // G
    grayscaleData[i + 2] = value; // B
    grayscaleData[i + 3] = 255;   // A — fully opaque for PNG output
  }

  const grayscaleImageData = new ImageData(grayscaleData, width, height);

  // Render to OffscreenCanvas and export as PNG
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("MaskService: Failed to get 2D context from OffscreenCanvas");
  }

  ctx.putImageData(grayscaleImageData, 0, 0);

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return blob;
}

// ---------------------------------------------------------------------------
// 2. applyFeathering
// ---------------------------------------------------------------------------

/**
 * Apply Gaussian blur feathering to mask edges.
 *
 * Uses Canvas 2D `filter: blur(Npx)` on an OffscreenCanvas for
 * hardware-accelerated feathering. This produces gradient alpha values
 * at mask edges instead of hard transitions.
 *
 * Input/output dimensions are identical.
 */
export function applyFeathering(imageData: ImageData, radius: number): ImageData {
  const { width, height } = imageData;

  // Step 1: Draw the original mask onto a source canvas
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("MaskService: Failed to get 2D context for source canvas");
  }
  sourceCtx.putImageData(imageData, 0, 0);

  // Step 2: Draw the source onto a destination canvas with blur filter
  const destCanvas = new OffscreenCanvas(width, height);
  const destCtx = destCanvas.getContext("2d");
  if (!destCtx) {
    throw new Error("MaskService: Failed to get 2D context for destination canvas");
  }

  destCtx.filter = `blur(${radius}px)`;
  destCtx.drawImage(sourceCanvas, 0, 0);

  // Step 3: Extract the blurred result
  return destCtx.getImageData(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// 3. scaleToOriginal
// ---------------------------------------------------------------------------

/**
 * Scale mask ImageData from display resolution to original image resolution.
 *
 * Uses OffscreenCanvas `drawImage` with target dimensions for
 * hardware-accelerated scaling. Pixel positions are proportionally mapped.
 */
export function scaleToOriginal(
  imageData: ImageData,
  originalWidth: number,
  originalHeight: number
): ImageData {
  const { width, height } = imageData;

  // Step 1: Draw the source mask onto a canvas at display resolution
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) {
    throw new Error("MaskService: Failed to get 2D context for source canvas");
  }
  sourceCtx.putImageData(imageData, 0, 0);

  // Step 2: Draw scaled onto a target canvas at original resolution
  const destCanvas = new OffscreenCanvas(originalWidth, originalHeight);
  const destCtx = destCanvas.getContext("2d");
  if (!destCtx) {
    throw new Error("MaskService: Failed to get 2D context for destination canvas");
  }

  destCtx.drawImage(sourceCanvas, 0, 0, originalWidth, originalHeight);

  // Step 3: Extract the scaled result
  return destCtx.getImageData(0, 0, originalWidth, originalHeight);
}

// ---------------------------------------------------------------------------
// 4. validateMinSize
// ---------------------------------------------------------------------------

/**
 * Validate that the mask has a minimum bounding box size.
 *
 * Iterates over ImageData pixels to find the bounding box of all pixels
 * with alpha > 0. Returns whether both bounding box dimensions meet the
 * minimum size requirement.
 */
export function validateMinSize(
  imageData: ImageData,
  minSize: number
): { valid: boolean; boundingBox: { width: number; height: number } } {
  const { width, height, data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // No masked pixels found
  if (maxX < 0 || maxY < 0) {
    return { valid: false, boundingBox: { width: 0, height: 0 } };
  }

  const bbWidth = maxX - minX + 1;
  const bbHeight = maxY - minY + 1;

  return {
    valid: bbWidth >= minSize && bbHeight >= minSize,
    boundingBox: { width: bbWidth, height: bbHeight },
  };
}
