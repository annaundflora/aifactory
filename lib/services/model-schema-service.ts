type SchemaProperties = Record<string, unknown>;

const schemaCache = new Map<string, SchemaProperties>();

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Detect the correct img2img image field name from a model's schema.
 * Returns the field name and whether it expects an array, or undefined if not supported.
 *
 * Priority:
 * 1. `input_images` (Flux 2 Pro, GPT Image 1.5) — array
 * 2. `image_input` (Nano Banana Pro, Seedream, Gemini) — array
 * 3. `image_prompt` / `init_image` — single string (legacy, kept for future models)
 * 4. `image` is ONLY used if `mask` is NOT also present (mask = inpainting, not img2img)
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
