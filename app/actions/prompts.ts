"use server";

import {
  PromptService,
  type ImproveResult,
} from "@/lib/services/prompt-service";
import {
  promptHistoryService,
  type PromptHistoryEntry,
} from "@/lib/services/prompt-history-service";
import { requireAuth } from "@/lib/auth/guard";
import { VALID_GENERATION_MODES, type GenerationMode } from "@/lib/types";

// UUID v4 format validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Prompt History Actions
// ---------------------------------------------------------------------------

export async function getPromptHistory(input: {
  offset?: number;
  limit?: number;
}): Promise<PromptHistoryEntry[] | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;

  return promptHistoryService.getHistory(auth.userId, offset, limit);
}

export async function getFavoritePrompts(input: {
  offset?: number;
  limit?: number;
}): Promise<PromptHistoryEntry[] | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;

  return promptHistoryService.getFavorites(auth.userId, offset, limit);
}

export async function toggleFavorite(input: {
  generationId: string;
}): Promise<{ isFavorite: boolean } | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const generationId = (input.generationId ?? "").trim();

  if (!UUID_REGEX.test(generationId)) {
    throw new Error("Ungueltige generationId: muss ein gueltiges UUID-Format haben");
  }

  return promptHistoryService.toggleFavorite(auth.userId, generationId);
}

export async function improvePrompt(input: {
  prompt: string;
  modelId: string;
  generationMode?: GenerationMode;
}): Promise<ImproveResult | { error: string }> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const prompt = input.prompt.trim();
  const modelId = (input.modelId ?? "").trim();

  if (!prompt) {
    return { error: "Prompt darf nicht leer sein" };
  }

  if (!modelId) {
    return { error: "modelId darf nicht leer sein" };
  }

  if (
    input.generationMode !== undefined &&
    !VALID_GENERATION_MODES.includes(input.generationMode)
  ) {
    return { error: "Ungueltiger Generierungsmodus" };
  }

  try {
    return await PromptService.improve(prompt, modelId, input.generationMode);
  } catch (error) {
    console.error("Prompt improvement failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Prompt-Verbesserung fehlgeschlagen",
    };
  }
}
