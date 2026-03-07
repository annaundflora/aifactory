import { openRouterClient } from "@/lib/clients/openrouter";
import { getModelById } from "@/lib/models";

const MODEL = "google/gemini-3.1-pro-preview";

function buildSystemPrompt(modelId: string, modelDisplayName: string): string {
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
- FLUX models: Detailed scene descriptions, specific art styles, lighting keywords
- Recraft V4: Design-focused language, clean compositions, professional aesthetics
- Seedream: Dreamlike qualities, atmospheric descriptions, cinematic framing
- Imagen: Natural language descriptions, photorealistic detail cues
- GPT Image: Balanced descriptions, creative concepts
- Ideogram: Text rendering support, graphic design terminology
- Gemini Flash: Quick, efficient prompts with clear subject and style

## Rules
- Keep the core intent and subject of the original prompt
- Output ONLY the improved prompt text, nothing else
- Keep the improved prompt concise but effective`;
}

export interface ImproveResult {
  original: string;
  improved: string;
}

async function improve(prompt: string, modelId: string): Promise<ImproveResult> {
  const modelDisplayName = getModelById(modelId)?.displayName ?? modelId;
  const systemPrompt = buildSystemPrompt(modelId, modelDisplayName);

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
