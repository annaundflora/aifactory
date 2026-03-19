/**
 * Capability Detection — Pure Functions
 *
 * Extracted from model-schema-service.ts. These functions transform OpenAPI
 * schema data into structured capability information. They have no side effects,
 * no network calls, and no database dependencies.
 */

export type SchemaProperties = Record<string, unknown>;

export interface Capabilities {
  txt2img: boolean;
  img2img: boolean;
  upscale: boolean;
  inpaint: boolean;
  outpaint: boolean;
}

/**
 * Detect the correct img2img image field name from a model's schema.
 * Returns the field name and whether it expects an array, or undefined if not supported.
 *
 * Priority:
 * 1. `input_images` (Flux 2 Pro/Flex/Max, GPT Image 1.5) — array
 * 2. `image_input` (Nano Banana Pro, Seedream, Gemini) — array
 * 3. `images` (Flux 2 Klein 4B) — array
 * 4. `input_image` (Flux Kontext Pro/Max) — single string
 * 5. `image_prompt` / `init_image` — single string (legacy, kept for future models)
 * 6. `image` is ONLY used if `mask` is NOT also present (mask = inpainting, not img2img)
 */
export function getImg2ImgFieldName(
  schema: SchemaProperties
): { field: string; isArray: boolean } | undefined {
  if ("input_images" in schema) {
    return { field: "input_images", isArray: true };
  }
  if ("image_input" in schema) {
    return { field: "image_input", isArray: true };
  }
  if ("images" in schema) {
    return { field: "images", isArray: true };
  }
  if ("input_image" in schema) {
    return { field: "input_image", isArray: false };
  }
  if ("image_prompt" in schema) {
    return { field: "image_prompt", isArray: false };
  }
  if ("init_image" in schema) {
    return { field: "init_image", isArray: false };
  }
  // `image` without `mask` = img2img; `image` with `mask` = inpainting (skip)
  if ("image" in schema && !("mask" in schema)) {
    return { field: "image", isArray: false };
  }
  return undefined;
}

/**
 * Returns the maximum number of reference images a model supports based on its schema.
 *
 * - If the model has no img2img field -> 0 (no support)
 * - If the img2img field is not an array (single string) -> 1
 * - If the img2img field is an array with `maxItems` -> that value
 * - If the img2img field is an array without `maxItems` -> Infinity (unbounded)
 */
export function getMaxImageCount(schema: SchemaProperties): number {
  const fieldInfo = getImg2ImgFieldName(schema);

  // No img2img field at all -> model does not support reference images
  if (!fieldInfo) {
    return 0;
  }

  // Single-value field (e.g. image_prompt, init_image, image) -> exactly 1 image
  if (!fieldInfo.isArray) {
    return 1;
  }

  // Array field -> check for maxItems constraint
  const fieldSchema = schema[fieldInfo.field];
  if (
    fieldSchema &&
    typeof fieldSchema === "object" &&
    "maxItems" in (fieldSchema as Record<string, unknown>)
  ) {
    const maxItems = (fieldSchema as Record<string, unknown>).maxItems;
    if (typeof maxItems === "number" && maxItems > 0) {
      return maxItems;
    }
  }

  // Array field without maxItems -> unlimited
  return Infinity;
}

/**
 * Resolves `$ref`-based enums in an OpenAPI schema so that properties contain
 * inline `enum` and `type` values instead of `allOf/$ref` references.
 *
 * This is a pure function that receives the `allSchemas` map as an explicit
 * parameter (unlike the old model-schema-service.ts which extracted it internally
 * from the API response).
 *
 * Returns a new object with resolved properties. The original is not mutated.
 */
export function resolveSchemaRefs(
  properties: SchemaProperties,
  allSchemas: Record<string, Record<string, unknown>>
): SchemaProperties {
  const resolved: SchemaProperties = { ...properties };

  for (const [key, prop] of Object.entries(resolved)) {
    if (!prop || typeof prop !== "object") {
      continue;
    }

    const p = { ...(prop as Record<string, unknown>) };

    if (p.allOf && Array.isArray(p.allOf)) {
      for (const entry of p.allOf as Record<string, unknown>[]) {
        if (typeof entry.$ref === "string") {
          // Extract schema name from "#/components/schemas/resolution"
          const refName = (entry.$ref as string).split("/").pop();
          if (refName && allSchemas[refName]) {
            const refSchema = allSchemas[refName];
            // Merge enum and type from referenced schema into the property
            if (refSchema.enum) {
              p.enum = refSchema.enum;
            }
            if (refSchema.type && !p.type) {
              p.type = refSchema.type;
            }
          }
        }
      }
      // Remove allOf since it's now resolved
      delete p.allOf;
    }

    resolved[key] = p;
  }

  return resolved;
}

/**
 * Checks if the schema has any image input field (from the img2img priority list)
 * regardless of whether mask is present. Used internally for upscale detection.
 */
function hasAnyImageInput(schema: SchemaProperties): boolean {
  return (
    "input_images" in schema ||
    "image_input" in schema ||
    "images" in schema ||
    "input_image" in schema ||
    "image_prompt" in schema ||
    "init_image" in schema ||
    "image" in schema
  );
}

/**
 * Detects model capabilities from OpenAPI schema, model description, and
 * collection membership.
 *
 * Detection rules (from architecture.md):
 *
 * | Capability | Detection Rule                                                          |
 * |------------|-------------------------------------------------------------------------|
 * | txt2img    | Schema has `prompt` field                                               |
 * | img2img    | Schema has image input field (priority list) WITHOUT `mask` field        |
 * | inpaint    | Schema has `image` + `mask`, OR description contains "inpainting"       |
 * | outpaint   | Description contains "outpainting"/"expand", OR schema has `outpaint`   |
 * | upscale    | In `super-resolution` collection, OR `scale` param + image w/o `prompt` |
 */
export function detectCapabilities(
  schema: SchemaProperties,
  description: string | null,
  collectionSlugs: string[]
): Capabilities {
  const descLower = (description ?? "").toLowerCase();

  // --- txt2img ---
  // Schema has `prompt` field
  const txt2img = "prompt" in schema;

  // --- inpaint ---
  // Schema has `image` + `mask` fields, OR description contains "inpainting"
  const hasImageAndMask = "image" in schema && "mask" in schema;
  const descriptionMentionsInpaint = descLower.includes("inpainting");
  const inpaint = hasImageAndMask || descriptionMentionsInpaint;

  // --- img2img ---
  // Schema has image input field (priority list) WITHOUT `mask`.
  // If inpaint is detected via image+mask, img2img is false for the `image` field case.
  // getImg2ImgFieldName already excludes image+mask, so we use it directly.
  const img2imgField = getImg2ImgFieldName(schema);
  const img2img = img2imgField !== undefined && !inpaint;

  // --- outpaint ---
  // Description contains "outpainting" or "expand", OR schema has `outpaint` parameter
  const descriptionMentionsOutpaint =
    descLower.includes("outpainting") || descLower.includes("expand");
  const schemaHasOutpaint = "outpaint" in schema;
  const outpaint = descriptionMentionsOutpaint || schemaHasOutpaint;

  // --- upscale ---
  // Model in `super-resolution` collection, OR has `scale` parameter + image input without `prompt`
  const inSuperResolution = collectionSlugs.includes("super-resolution");
  const hasScale = "scale" in schema;
  const hasImageInput = hasAnyImageInput(schema);
  const hasPrompt = "prompt" in schema;
  const schemaBasedUpscale = hasScale && hasImageInput && !hasPrompt;
  const upscale = inSuperResolution || schemaBasedUpscale;

  return {
    txt2img,
    img2img,
    upscale,
    inpaint,
    outpaint,
  };
}
