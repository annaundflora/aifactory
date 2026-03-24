import { openRouterClient } from "@/lib/clients/openrouter";
import { modelIdToDisplayName } from "@/lib/utils/model-display-name";
import {
  getPromptKnowledge,
  formatKnowledgeForPrompt,
} from "@/lib/services/prompt-knowledge";
import type { GenerationMode } from "@/lib/types";

const MODEL = "google/gemini-3.1-pro-preview";

export function buildSystemPrompt(
  modelId: string,
  modelDisplayName: string,
  generationMode: GenerationMode = "txt2img",
): string {
  const knowledgeResult = getPromptKnowledge(modelId, generationMode);
  const knowledgeSection = formatKnowledgeForPrompt(knowledgeResult);

  return `You are an expert prompt engineer for AI image generation.

## Analysis Phase
First, analyze the user's prompt:
1. Identify the main subject/motif
2. Detect existing style keywords
3. Assess detail level (minimal/moderate/rich)
4. Note any composition or lighting cues

## Improvement Strategy
Based on your analysis:
- If minimal detail: Add specific visual details (lighting, composition, perspective, texture)
- If moderate detail: Refine and enhance existing details, add missing dimensions
- If already rich: Polish language, improve specificity, fix contradictions

## Model Optimization
The target model is: ${modelId} (${modelDisplayName})
Optimize the prompt for this specific model's strengths:

${knowledgeSection}

## Rules
- Keep the core intent and subject of the original prompt
- Output ONLY the improved prompt text, nothing else
- Keep the improved prompt concise but effective`;
}

export interface ImproveResult {
  original: string;
  improved: string;
}

async function improve(
  prompt: string,
  modelId: string,
  generationMode: GenerationMode = "txt2img",
): Promise<ImproveResult> {
  const modelDisplayName = modelIdToDisplayName(modelId);
  const systemPrompt = buildSystemPrompt(modelId, modelDisplayName, generationMode);

  const improved = await openRouterClient.chat({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
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
