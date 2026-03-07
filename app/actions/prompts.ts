"use server";

import { SnippetService, type Snippet } from "@/lib/services/snippet-service";
import {
  PromptService,
  type ImproveResult,
} from "@/lib/services/prompt-service";
import {
  promptHistoryService,
  type PromptHistoryEntry,
} from "@/lib/services/prompt-history-service";

// UUID v4 format validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateSnippetInput(input: {
  text: string;
  category: string;
}): { error: string } | null {
  const text = input.text.trim();
  const category = input.category.trim();

  if (!text) {
    return { error: "Snippet-Text darf nicht leer sein" };
  }
  if (text.length > 500) {
    return { error: "Snippet-Text darf maximal 500 Zeichen lang sein" };
  }
  if (!category) {
    return { error: "Kategorie darf nicht leer sein" };
  }
  if (category.length > 100) {
    return { error: "Kategorie darf maximal 100 Zeichen lang sein" };
  }

  return null;
}

export async function createSnippet(input: {
  text: string;
  category: string;
}): Promise<Snippet | { error: string }> {
  const validationError = validateSnippetInput(input);
  if (validationError) {
    return validationError;
  }

  const text = input.text.trim();
  const category = input.category.trim();

  try {
    return await SnippetService.create(text, category);
  } catch {
    return { error: "Datenbankfehler" };
  }
}

export async function updateSnippet(input: {
  id: string;
  text: string;
  category: string;
}): Promise<Snippet | { error: string }> {
  const validationError = validateSnippetInput(input);
  if (validationError) {
    return validationError;
  }

  const text = input.text.trim();
  const category = input.category.trim();

  try {
    const snippet = await SnippetService.update(input.id, text, category);
    if (!snippet) {
      return { error: "Snippet nicht gefunden" };
    }
    return snippet;
  } catch {
    return { error: "Datenbankfehler" };
  }
}

export async function deleteSnippet(input: {
  id: string;
}): Promise<{ success: boolean } | { error: string }> {
  try {
    const deleted = await SnippetService.delete(input.id);
    return { success: deleted };
  } catch {
    return { error: "Datenbankfehler" };
  }
}

export async function getSnippets(): Promise<Record<string, Snippet[]>> {
  try {
    return await SnippetService.getAll();
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Prompt History Actions (Slice 11)
// ---------------------------------------------------------------------------

export async function getPromptHistory(input: {
  offset?: number;
  limit?: number;
}): Promise<PromptHistoryEntry[] | { error: string }> {
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;

  try {
    return await promptHistoryService.getHistory(offset, limit);
  } catch {
    return { error: "Fehler beim Laden der Prompt-History" };
  }
}

export async function getFavoritePrompts(input: {
  offset?: number;
  limit?: number;
}): Promise<PromptHistoryEntry[] | { error: string }> {
  const offset = input.offset ?? 0;
  const limit = input.limit ?? 50;

  try {
    return await promptHistoryService.getFavorites(offset, limit);
  } catch {
    return { error: "Fehler beim Laden der Favoriten" };
  }
}

export async function toggleFavorite(input: {
  generationId: string;
}): Promise<{ isFavorite: boolean } | { error: string }> {
  const generationId = (input.generationId ?? "").trim();

  if (!UUID_REGEX.test(generationId)) {
    return { error: "Ungueltige generationId: muss ein gueltiges UUID-Format haben" };
  }

  try {
    return await promptHistoryService.toggleFavorite(generationId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fehler beim Toggling des Favoriten";
    return { error: message };
  }
}

export async function improvePrompt(input: {
  prompt: string;
  modelId: string;
}): Promise<ImproveResult | { error: string }> {
  const prompt = input.prompt.trim();
  const modelId = (input.modelId ?? "").trim();

  if (!prompt) {
    return { error: "Prompt darf nicht leer sein" };
  }

  if (!modelId) {
    return { error: "modelId darf nicht leer sein" };
  }

  try {
    return await PromptService.improve(prompt, modelId);
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
