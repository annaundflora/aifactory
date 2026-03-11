import type { CollectionModel } from "@/lib/types/collection-model";

const CACHE_KEY = "text-to-image";
const CACHE_TTL_MS = 3_600_000; // 1 hour
const FETCH_TIMEOUT_MS = 5_000;
const API_URL =
  "https://api.replicate.com/v1/collections/text-to-image";

interface CacheEntry {
  models: CollectionModel[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export const CollectionModelService = {
  async getCollectionModels(): Promise<CollectionModel[] | { error: string }> {
    const now = Date.now();
    const cached = cache.get(CACHE_KEY);

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.models;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const apiToken = process.env.REPLICATE_API_TOKEN;

      if (!apiToken) {
        return { error: "REPLICATE_API_TOKEN ist nicht gesetzt" };
      }

      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`CollectionModelService: API-Fehler ${response.status} ${response.statusText}`);
        return { error: `API-Fehler: ${response.status} ${response.statusText}` };
      }

      const data = await response.json();

      // The Replicate Collections API returns { models: [...] }
      const rawModels: Record<string, unknown>[] = Array.isArray(data?.models)
        ? data.models
        : [];

      const models: CollectionModel[] = rawModels.map((m) => ({
        url: String(m.url ?? ""),
        owner: String(m.owner ?? ""),
        name: String(m.name ?? ""),
        description:
          m.description != null ? String(m.description) : null,
        cover_image_url:
          m.cover_image_url != null ? String(m.cover_image_url) : null,
        run_count: typeof m.run_count === "number" ? m.run_count : 0,
        created_at: typeof m.created_at === "string" ? m.created_at : "",
      }));

      cache.set(CACHE_KEY, { models, timestamp: now });

      return models;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        console.error("CollectionModelService: Anfrage-Timeout nach 5 Sekunden");
        return { error: "Anfrage-Timeout: Die API hat nicht innerhalb von 5 Sekunden geantwortet" };
      }
      console.error("CollectionModelService: Unerwarteter Fehler", err);
      return { error: err instanceof Error ? err.message : "Unbekannter Fehler" };
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /** Clears the in-memory cache. Useful for testing. */
  clearCache(): void {
    cache.clear();
  },
};

export const { getCollectionModels, clearCache } = CollectionModelService;
