"use client";

import { useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  usePromptAssistant,
  type DraftPromptField,
} from "@/lib/assistant/assistant-context";
import { ApplyButton } from "@/components/assistant/apply-button";

// ---------------------------------------------------------------------------
// Canvas Field
// ---------------------------------------------------------------------------

interface CanvasFieldProps {
  label: string;
  field: DraftPromptField;
  value: string;
  onChange: (field: DraftPromptField, value: string) => void;
  highlight: boolean;
  tabIndex?: number;
}

function CanvasField({
  label,
  field,
  value,
  onChange,
  highlight,
  tabIndex,
}: CanvasFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(field, e.target.value);
    },
    [field, onChange]
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`canvas-${field}`}
        className="text-sm font-medium text-muted-foreground"
      >
        {label}
      </label>
      <Textarea
        id={`canvas-${field}`}
        data-testid={`canvas-${field}`}
        value={value}
        onChange={handleChange}
        tabIndex={tabIndex}
        rows={3}
        className={cn(
          "resize-none transition-colors duration-200",
          highlight && "animate-canvas-highlight"
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptCanvas
// ---------------------------------------------------------------------------

export function PromptCanvas() {
  const {
    draftPrompt,
    hasCanvas,
    canvasHighlight,
    updateDraftField,
    dispatch,
  } = usePromptAssistant();

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // AC-7: Clear the canvas highlight after a short duration
  useEffect(() => {
    if (canvasHighlight) {
      highlightTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "CLEAR_CANVAS_HIGHLIGHT" });
      }, 600);
    }
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [canvasHighlight, dispatch]);

  // AC-1: Canvas not visible without draft
  if (!hasCanvas || !draftPrompt) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-4 p-4 overflow-y-auto"
      data-testid="prompt-canvas"
    >
      <h3 className="text-sm font-semibold text-foreground">Prompt Canvas</h3>

      {/* AC-8: Tab order: Motiv -> Style -> Negative Prompt */}
      <CanvasField
        label="Motiv"
        field="motiv"
        value={draftPrompt.motiv}
        onChange={updateDraftField}
        highlight={canvasHighlight}
        tabIndex={1}
      />

      <CanvasField
        label="Style"
        field="style"
        value={draftPrompt.style}
        onChange={updateDraftField}
        highlight={canvasHighlight}
        tabIndex={2}
      />

      <CanvasField
        label="Negative Prompt"
        field="negativePrompt"
        value={draftPrompt.negativePrompt}
        onChange={updateDraftField}
        highlight={canvasHighlight}
        tabIndex={3}
      />

      {/* Slice-15: Apply button at the bottom of the canvas */}
      <ApplyButton />
    </div>
  );
}
