"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/prompt-builder/category-tabs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_OPTIONS = [
  "Oil Painting",
  "Flat Vector",
  "Anime",
  "Watercolor",
  "3D Render",
  "Pixel Art",
  "Photography",
  "Pencil",
  "Pop Art",
] as const;

const COLOR_OPTIONS = [
  "Warm Tones",
  "Pastel",
  "Monochrome",
  "Cool Tones",
  "Earth Tones",
  "Neon",
  "Black & White",
  "Sunset",
  "Vintage",
] as const;

const ALL_OPTIONS = [
  ...STYLE_OPTIONS.map((o) => o.toLowerCase()),
  ...COLOR_OPTIONS.map((o) => o.toLowerCase()),
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BuilderDrawerProps {
  open: boolean;
  onClose: (prompt: string) => void;
  basePrompt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a prompt string to find which builder options are present.
 * Compares lowercased comma-separated segments against known options.
 */
function parseSelectionsFromPrompt(prompt: string): Set<string> {
  const segments = prompt
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const found = new Set<string>();
  for (const segment of segments) {
    if (ALL_OPTIONS.includes(segment)) {
      found.add(segment);
    }
  }
  return found;
}

/**
 * Extract the base prompt (everything that is NOT a known builder option)
 * from a full prompt string.
 */
function extractBasePrompt(prompt: string): string {
  const segments = prompt.split(",").map((s) => s.trim());
  const nonOption = segments.filter(
    (s) => s && !ALL_OPTIONS.includes(s.toLowerCase())
  );
  return nonOption.join(", ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BuilderDrawer({
  open,
  onClose,
  basePrompt,
}: BuilderDrawerProps) {
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set()
  );
  const [activeTab, setActiveTab] = useState("style");
  const [selectedSnippets, setSelectedSnippets] = useState<Set<string>>(
    new Set()
  );
  const [snippetTexts, setSnippetTexts] = useState<Map<string, string>>(
    new Map()
  );

  // AC-11: When drawer opens, parse the current prompt to restore selections
  useEffect(() => {
    if (open) {
      const restored = parseSelectionsFromPrompt(basePrompt);
      setSelectedOptions(restored);
    }
  }, [open, basePrompt]);

  const handleToggleOption = useCallback((option: string) => {
    const key = option.toLowerCase();
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleSnippet = useCallback(
    (snippetId: string, snippetText: string) => {
      setSelectedSnippets((prev) => {
        const next = new Set(prev);
        if (next.has(snippetId)) {
          next.delete(snippetId);
        } else {
          next.add(snippetId);
        }
        return next;
      });
      setSnippetTexts((prev) => {
        const next = new Map(prev);
        next.set(snippetId, snippetText);
        return next;
      });
    },
    []
  );

  // Build the composed prompt: base (without builder options) + selections + snippets
  const composedPrompt = useMemo(() => {
    const base = extractBasePrompt(basePrompt);
    const optionSelections = Array.from(selectedOptions);
    const snippetSelections = Array.from(selectedSnippets)
      .map((id) => snippetTexts.get(id))
      .filter(Boolean);
    const allSelections = [...optionSelections, ...snippetSelections];
    if (allSelections.length === 0) return base;
    if (!base) return allSelections.join(", ");
    return base + ", " + allSelections.join(", ");
  }, [basePrompt, selectedOptions, selectedSnippets, snippetTexts]);

  const handleDone = useCallback(() => {
    onClose(composedPrompt);
  }, [onClose, composedPrompt]);

  // Sheet's onOpenChange fires on overlay click or X button
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose(composedPrompt);
      }
    },
    [onClose, composedPrompt]
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" data-testid="builder-drawer">
        <SheetHeader>
          <SheetTitle>Prompt Builder</SheetTitle>
          <SheetDescription>
            Select style and color options to enhance your prompt.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <CategoryTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            styleOptions={[...STYLE_OPTIONS]}
            colorOptions={[...COLOR_OPTIONS]}
            selectedOptions={selectedOptions}
            onToggleOption={handleToggleOption}
            selectedSnippets={selectedSnippets}
            onToggleSnippet={handleToggleSnippet}
          />

          {/* Live Preview */}
          <div className="mt-4 space-y-1" data-testid="live-preview">
            <p className="text-xs font-medium text-muted-foreground">
              Preview
            </p>
            <p className="rounded-md border bg-muted/50 p-2 text-sm break-words">
              {composedPrompt || (
                <span className="text-muted-foreground italic">
                  Your prompt will appear here...
                </span>
              )}
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button
            type="button"
            onClick={handleDone}
            className="w-full"
            data-testid="builder-done-button"
          >
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { STYLE_OPTIONS, COLOR_OPTIONS };
