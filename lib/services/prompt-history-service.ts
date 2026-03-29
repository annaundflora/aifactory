import {
  getPromptHistoryQuery,
  getFavoritesQuery,
  toggleFavoriteQuery,
} from "@/lib/db/queries";

export interface PromptHistoryEntry {
  generationId: string;
  promptMotiv: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  isFavorite: boolean;
  createdAt: Date;
}

async function getHistory(
  userId: string,
  offset: number,
  limit: number
): Promise<PromptHistoryEntry[]> {
  const rows = await getPromptHistoryQuery(userId, offset, limit);
  return rows.map((row) => ({
    generationId: row.id,
    promptMotiv: row.promptMotiv,
    modelId: row.modelId,
    modelParams: (row.modelParams as Record<string, unknown>) ?? {},
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
  }));
}

async function getFavorites(
  userId: string,
  offset: number,
  limit: number
): Promise<PromptHistoryEntry[]> {
  const rows = await getFavoritesQuery(userId, offset, limit);
  return rows.map((row) => ({
    generationId: row.id,
    promptMotiv: row.promptMotiv,
    modelId: row.modelId,
    modelParams: (row.modelParams as Record<string, unknown>) ?? {},
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
  }));
}

async function toggleFavorite(
  userId: string,
  generationId: string
): Promise<{ isFavorite: boolean }> {
  return toggleFavoriteQuery(userId, generationId);
}

export const promptHistoryService = {
  getHistory,
  getFavorites,
  toggleFavorite,
};
