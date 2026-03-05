"use server";

import { SnippetService, type Snippet } from "@/lib/services/snippet-service";
import {
  PromptService,
  type ImproveResult,
} from "@/lib/services/prompt-service";

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

export async function improvePrompt(input: {
  prompt: string;
}): Promise<ImproveResult | { error: string }> {
  const prompt = input.prompt.trim();

  if (!prompt) {
    return { error: "Prompt darf nicht leer sein" };
  }

  try {
    return await PromptService.improve(prompt);
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
