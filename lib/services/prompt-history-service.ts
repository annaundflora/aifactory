import {
  getPromptHistoryQuery,
  getFavoritesQuery,
  toggleFavoriteQuery,
} from "@/lib/db/queries";

export interface PromptHistoryEntry {
  generationId: string;
  promptMotiv: string;
  promptStyle: string;
  negativePrompt: string | null;
  modelId: string;
  modelParams: Record<string, unknown>;
  isFavorite: boolean;
  createdAt: Date;
}

async function getHistory(
  offset: number,
  limit: number
): Promise<PromptHistoryEntry[]> {
  const rows = await getPromptHistoryQuery(offset, limit);
  return rows.map((row) => ({
    generationId: row.id,
    promptMotiv: row.promptMotiv,
    promptStyle: row.promptStyle ?? "",
    negativePrompt: row.negativePrompt,
    modelId: row.modelId,
    modelParams: (row.modelParams as Record<string, unknown>) ?? {},
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
  }));
}

async function getFavorites(
  offset: number,
  limit: number
): Promise<PromptHistoryEntry[]> {
  const rows = await getFavoritesQuery(offset, limit);
  return rows.map((row) => ({
    generationId: row.id,
    promptMotiv: row.promptMotiv,
    promptStyle: row.promptStyle ?? "",
    negativePrompt: row.negativePrompt,
    modelId: row.modelId,
    modelParams: (row.modelParams as Record<string, unknown>) ?? {},
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
  }));
}

async function toggleFavorite(
  generationId: string
): Promise<{ isFavorite: boolean }> {
  return toggleFavoriteQuery(generationId);
}

export const promptHistoryService = {
  getHistory,
  getFavorites,
  toggleFavorite,
};
