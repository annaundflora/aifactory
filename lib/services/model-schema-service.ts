type SchemaProperties = Record<string, unknown>;

const schemaCache = new Map<string, SchemaProperties>();

export const ModelSchemaService = {
  async getSchema(modelId: string): Promise<SchemaProperties> {
    const cached = schemaCache.get(modelId);
    if (cached) {
      return cached;
    }

    const [owner, name] = modelId.split("/");
    const apiToken = process.env.REPLICATE_API_TOKEN;

    const response = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

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
