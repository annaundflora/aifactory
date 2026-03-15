export type SchemaProperties = Record<string, unknown>;

const schemaCache = new Map<string, SchemaProperties>();

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
const FETCH_TIMEOUT_MS = 5000;

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
 * - If the model has no img2img field → 0 (no support)
 * - If the img2img field is not an array (single string) → 1
 * - If the img2img field is an array with `maxItems` → that value
 * - If the img2img field is an array without `maxItems` → Infinity (unbounded)
 */
export function getMaxImageCount(schema: SchemaProperties): number {
  const fieldInfo = getImg2ImgFieldName(schema);

  // No img2img field at all → model does not support reference images
  if (!fieldInfo) {
    return 0;
  }

  // Single-value field (e.g. image_prompt, init_image, image) → exactly 1 image
  if (!fieldInfo.isArray) {
    return 1;
  }

  // Array field → check for maxItems constraint
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

  // Array field without maxItems → unlimited
  return Infinity;
}

export const ModelSchemaService = {
  async getSchema(modelId: string): Promise<SchemaProperties> {
    if (!MODEL_ID_REGEX.test(modelId)) {
      throw new Error("Ungueltiges Model-ID-Format");
    }

    const cached = schemaCache.get(modelId);
    if (cached) {
      return cached;
    }

    const [owner, name] = modelId.split("/");
    const apiToken = process.env.REPLICATE_API_TOKEN;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      throw new Error("Schema konnte nicht geladen werden");
    }

    const data = await response.json();

    const properties: SchemaProperties | undefined =
      data?.latest_version?.openapi_schema?.components?.schemas?.Input
        ?.properties;

    if (!properties) {
      throw new Error("Schema konnte nicht geladen werden");
    }

    // Resolve $ref-based enums (e.g. allOf: [{$ref: "#/components/schemas/resolution"}])
    // so that ParameterPanel can detect them via prop.enum
    const allSchemas =
      data?.latest_version?.openapi_schema?.components?.schemas as
        | Record<string, Record<string, unknown>>
        | undefined;

    if (allSchemas) {
      for (const [key, prop] of Object.entries(properties)) {
        const p = prop as Record<string, unknown>;
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
        properties[key] = p;
      }
    }

    schemaCache.set(modelId, properties);

    return properties;
  },

  async supportsImg2Img(modelId: string): Promise<boolean> {
    const properties = await ModelSchemaService.getSchema(modelId);
    return getImg2ImgFieldName(properties) !== undefined;
  },

  /** Clears the in-memory cache. Useful for testing. */
  clearCache(): void {
    schemaCache.clear();
  },
};
