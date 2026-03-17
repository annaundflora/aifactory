import type { ModelSetting } from "@/lib/db/queries";
import type { GenerationMode, Tier } from "@/lib/types";

/**
 * Resolve model ID and params from cached model settings based on mode, tier,
 * and maxQuality flag.
 *
 * effectiveTier = maxQuality ? "max" : tier
 *
 * Returns { modelId, modelParams } or undefined if no matching setting found.
 */
export function resolveModel(
  settings: ModelSetting[],
  mode: GenerationMode,
  tier: Tier,
): { modelId: string; modelParams: Record<string, unknown> } | undefined {
  const setting = settings.find(
    (s) => s.mode === mode && s.tier === tier
  );
  if (!setting) return undefined;
  return {
    modelId: setting.modelId,
    modelParams: (setting.modelParams ?? {}) as Record<string, unknown>,
  };
}
