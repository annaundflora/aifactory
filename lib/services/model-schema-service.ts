type SchemaProperties = Record<string, unknown>;

const schemaCache = new Map<string, SchemaProperties>();

const MODEL_ID_REGEX = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
const FETCH_TIMEOUT_MS = 5000;

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

  /** Clears the in-memory cache. Useful for testing. */
  clearCache(): void {
    schemaCache.clear();
  },
};
