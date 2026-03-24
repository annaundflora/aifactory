// ---------------------------------------------------------------------------
// Prompt Knowledge Lookup Service
// ---------------------------------------------------------------------------
//
// Pure lookup service for prompt-knowledge.json.
// Provides prefix-based model matching, mode filtering, and fallback.
// Module-level cache: JSON is read once from disk, then served from memory.
// ---------------------------------------------------------------------------

import { readFileSync } from "fs";
import { join } from "path";

import type { GenerationMode } from "@/lib/types";
import type {
  PromptKnowledgeFile,
  ModelKnowledge,
  ModeKnowledge,
  FallbackKnowledge,
} from "@/lib/types/prompt-knowledge";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface PromptKnowledgeModelResult {
  kind: "model";
  displayName: string;
  model: ModelKnowledge;
  mode?: ModeKnowledge;
}

export interface PromptKnowledgeFallbackResult {
  kind: "fallback";
  displayName: string;
  fallback: FallbackKnowledge;
}

export type PromptKnowledgeLookupResult =
  | PromptKnowledgeModelResult
  | PromptKnowledgeFallbackResult;

// ---------------------------------------------------------------------------
// Embedded fallback (used when prompt-knowledge.json is missing or unreadable)
// ---------------------------------------------------------------------------

const EMBEDDED_FALLBACK: PromptKnowledgeFile = {
  models: {},
  fallback: {
    displayName: "Generic",
    tips: [
      "Be specific and descriptive about what you want to see in the image",
      "Include details about style, lighting, composition, and mood",
      "Mention the medium or art style (e.g., oil painting, digital art, photograph)",
    ],
    avoid: [
      "Vague or overly short prompts with no visual detail",
      "Contradictory instructions in the same prompt",
    ],
  },
};

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let cachedData: PromptKnowledgeFile | null = null;

function loadKnowledgeFile(): PromptKnowledgeFile {
  if (cachedData !== null) {
    return cachedData;
  }

  try {
    const filePath = join(process.cwd(), "data", "prompt-knowledge.json");
    const raw = readFileSync(filePath, "utf-8");
    cachedData = JSON.parse(raw) as PromptKnowledgeFile;
    return cachedData;
  } catch (error) {
    console.warn(
      "[prompt-knowledge] Failed to load prompt-knowledge.json, using embedded fallback:",
      error instanceof Error ? error.message : error,
    );
    cachedData = EMBEDDED_FALLBACK;
    return cachedData;
  }
}

// ---------------------------------------------------------------------------
// Prefix matching helpers
// ---------------------------------------------------------------------------

/**
 * Strips the owner/organization prefix from a model ID.
 * "black-forest-labs/flux-2-pro" -> "flux-2-pro"
 * "flux-2-pro" -> "flux-2-pro" (unchanged if no slash)
 */
function stripOwnerPrefix(modelId: string): string {
  const lastSlash = modelId.lastIndexOf("/");
  if (lastSlash === -1) {
    return modelId;
  }
  return modelId.substring(lastSlash + 1);
}

/**
 * Finds the longest matching prefix from the knowledge file.
 * Prefixes are sorted by length descending so the first match is the longest.
 */
function findLongestPrefixMatch(
  name: string,
  models: Record<string, ModelKnowledge>,
): { prefix: string; knowledge: ModelKnowledge } | null {
  const prefixes = Object.keys(models).sort((a, b) => b.length - a.length);

  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return { prefix, knowledge: models[prefix] };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up prompt knowledge for a given model ID and optional generation mode.
 *
 * 1. Strips owner prefix (e.g. "black-forest-labs/flux-2-pro" -> "flux-2-pro")
 * 2. Finds the longest matching prefix in prompt-knowledge.json
 * 3. Optionally filters mode-specific tips (txt2img / img2img)
 * 4. Falls back to the generic fallback entry if no prefix matches
 *
 * @param modelId - The full model identifier (may include owner prefix)
 * @param mode - Optional generation mode for mode-specific tips
 * @returns Lookup result with model/fallback knowledge and optional mode tips
 */
export function getPromptKnowledge(
  modelId: string,
  mode?: GenerationMode,
): PromptKnowledgeLookupResult {
  const data = loadKnowledgeFile();
  const name = stripOwnerPrefix(modelId);
  const match = findLongestPrefixMatch(name, data.models);

  if (match === null) {
    return {
      kind: "fallback",
      displayName: data.fallback.displayName,
      fallback: data.fallback,
    };
  }

  const result: PromptKnowledgeModelResult = {
    kind: "model",
    displayName: match.knowledge.displayName,
    model: match.knowledge,
  };

  // Attach mode-specific knowledge if requested and available
  if (mode && match.knowledge.modes) {
    const modeKey = mode as "txt2img" | "img2img";
    const modeKnowledge = match.knowledge.modes[modeKey];
    if (modeKnowledge) {
      result.mode = modeKnowledge;
    }
  }

  return result;
}

/**
 * Format a knowledge lookup result into a human-readable string
 * suitable for injection into an LLM system prompt.
 *
 * @param result - The lookup result from getPromptKnowledge
 * @returns Formatted string with prompting tips
 */
export function formatKnowledgeForPrompt(
  result: PromptKnowledgeLookupResult,
): string {
  const lines: string[] = [];

  if (result.kind === "model") {
    const { model, mode } = result;

    lines.push(`## Prompting Tips for ${result.displayName}`);
    lines.push("");
    lines.push(`Prompt style: ${model.promptStyle === "natural" ? "Natural language descriptions" : "Keyword-based prompts"}`);

    if (model.negativePrompts) {
      lines.push(`Negative prompts: ${model.negativePrompts.supported ? "Supported" : "Not supported"}. ${model.negativePrompts.note}`);
    }

    if (model.strengths.length > 0) {
      lines.push("");
      lines.push("**Strengths:**");
      for (const s of model.strengths) {
        lines.push(`- ${s}`);
      }
    }

    if (model.tips.length > 0) {
      lines.push("");
      lines.push("**Tips:**");
      for (const t of model.tips) {
        lines.push(`- ${t}`);
      }
    }

    if (model.avoid.length > 0) {
      lines.push("");
      lines.push("**Avoid:**");
      for (const a of model.avoid) {
        lines.push(`- ${a}`);
      }
    }

    if (mode && mode.tips.length > 0) {
      lines.push("");
      lines.push("**Mode-specific tips:**");
      for (const t of mode.tips) {
        lines.push(`- ${t}`);
      }
    }
  } else {
    // Fallback
    const { fallback } = result;

    lines.push("## General Prompting Tips");
    lines.push("");

    if (fallback.tips.length > 0) {
      lines.push("**Tips:**");
      for (const t of fallback.tips) {
        lines.push(`- ${t}`);
      }
    }

    if (fallback.avoid.length > 0) {
      lines.push("");
      lines.push("**Avoid:**");
      for (const a of fallback.avoid) {
        lines.push(`- ${a}`);
      }
    }
  }

  return lines.join("\n");
}
