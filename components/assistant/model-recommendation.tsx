"use client";

import { useCallback } from "react";
import { Cpu } from "lucide-react";
import { usePromptAssistant } from "@/lib/assistant/assistant-context";
import { useWorkspaceVariation } from "@/lib/workspace-state";

// ---------------------------------------------------------------------------
// ModelRecommendation
// ---------------------------------------------------------------------------

/**
 * Badge component that displays a model recommendation from the assistant.
 * Reads `recommendedModel` from PromptAssistantContext.
 * When the user clicks "Modell verwenden", it sets the modelId in the
 * workspace via useWorkspaceVariation().setVariation().
 *
 * AC-1: Not visible when recommendedModel is null.
 * AC-3: Shows model name, reason, and "Modell verwenden" action link.
 * AC-4: Click sets modelId via setVariation, preserving other fields.
 * AC-5: Updates when recommendedModel changes (React re-render).
 * AC-6: Action link is focusable via Tab.
 * AC-7: Appears with opacity transition animation.
 */
export function ModelRecommendation() {
  const { recommendedModel } = usePromptAssistant();
  const { variationData, setVariation } = useWorkspaceVariation();

  const handleUseModel = useCallback(() => {
    if (!recommendedModel) return;

    // AC-4: Preserve all existing workspace fields, only override modelId
    setVariation({
      ...variationData,
      modelId: recommendedModel.id,
    });
  }, [recommendedModel, variationData, setVariation]);

  // AC-1: Not visible when recommendedModel is null
  if (!recommendedModel) {
    return null;
  }

  return (
    <div
      data-testid="model-recommendation"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3 transition-opacity duration-300 animate-in fade-in"
    >
      <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            data-testid="model-recommendation-name"
            className="text-sm font-medium text-foreground"
          >
            {recommendedModel.name}
          </span>
          {/* AC-6: button with link styling, focusable via Tab */}
          <button
            data-testid="model-recommendation-action"
            type="button"
            onClick={handleUseModel}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            Modell verwenden
          </button>
        </div>
        <span
          data-testid="model-recommendation-reason"
          className="text-xs text-muted-foreground"
        >
          {recommendedModel.reason}
        </span>
      </div>
    </div>
  );
}
