"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePromptAssistant } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// ApplyButton
// ---------------------------------------------------------------------------

/**
 * Apply-Button for the Canvas panel.
 * Reads draftPrompt from PromptAssistantContext and triggers applyToWorkspace.
 * Shows "Applied!" with a Checkmark for 2 seconds after click (AC-2).
 * Disabled when no draft is available (AC-6) or during feedback state (AC-7).
 */
export function ApplyButton() {
  const { draftPrompt, applyToWorkspace } = usePromptAssistant();
  const [isAppliedFeedback, setIsAppliedFeedback] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AC-2: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    // AC-6: Do nothing if no draft
    if (!draftPrompt) return;
    // AC-7: Do nothing during feedback state
    if (isAppliedFeedback) return;

    applyToWorkspace();

    // AC-2: Show "Applied!" feedback for 2 seconds
    setIsAppliedFeedback(true);
    feedbackTimeoutRef.current = setTimeout(() => {
      setIsAppliedFeedback(false);
      feedbackTimeoutRef.current = null;
    }, 2000);
  }, [draftPrompt, isAppliedFeedback, applyToWorkspace]);

  // AC-6: Disabled when no draft, AC-7: Disabled during feedback
  const isDisabled = !draftPrompt || isAppliedFeedback;

  return (
    <Button
      data-testid="apply-button"
      onClick={handleClick}
      disabled={isDisabled}
      className="w-full"
    >
      {isAppliedFeedback ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Applied!
        </>
      ) : (
        "Apply"
      )}
    </Button>
  );
}
