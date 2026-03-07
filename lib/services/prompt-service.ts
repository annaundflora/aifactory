import { openRouterClient } from "@/lib/clients/openrouter";

const IMPROVE_SYSTEM_PROMPT = `You are an expert prompt engineer for AI image generation. Your task is to improve the user's prompt to produce better, more detailed, and more visually compelling images.

Rules:
- Keep the core intent and subject of the original prompt
- Add specific details about lighting, composition, style, and mood where appropriate
- Use descriptive, vivid language
- Keep the improved prompt concise but effective (not overly long)
- Output ONLY the improved prompt text, nothing else — no explanations, no preamble`;

const MODEL = "google/gemini-3.1-pro-preview";

export interface ImproveResult {
  original: string;
  improved: string;
}

async function improve(prompt: string): Promise<ImproveResult> {
  const improved = await openRouterClient.chat({
    model: MODEL,
    messages: [
      { role: "system", content: IMPROVE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  return {
    original: prompt,
    improved: improved.trim(),
  };
}

export const PromptService = {
  improve,
};
