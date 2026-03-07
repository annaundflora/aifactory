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
import { type BuilderFragment } from "@/lib/builder-fragments";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BuilderDrawerProps {
  open: boolean;
  onClose: (prompt: string) => void;
  basePrompt?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BuilderDrawer({ open, onClose }: BuilderDrawerProps) {
  // selectedFragments: Set of fragment IDs
  const [selectedFragments, setSelectedFragments] = useState<Set<string>>(
    new Set()
  );
  // fragmentTexts: Map from fragment ID to full fragment text
  const [fragmentTexts, setFragmentTexts] = useState<Map<string, string>>(
    new Map()
  );
  const [activeTab, setActiveTab] = useState("style");
  const [selectedSnippets, setSelectedSnippets] = useState<Set<string>>(
    new Set()
  );
  const [snippetTexts, setSnippetTexts] = useState<Map<string, string>>(
    new Map()
  );

  // AC-10: Reset all selections when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedFragments(new Set());
      setFragmentTexts(new Map());
      setSelectedSnippets(new Set());
      setSnippetTexts(new Map());
      setActiveTab("style");
    }
  }, [open]);

  const handleToggleFragment = useCallback((fragment: BuilderFragment) => {
    setSelectedFragments((prev) => {
      const next = new Set(prev);
      if (next.has(fragment.id)) {
        next.delete(fragment.id);
      } else {
        next.add(fragment.id);
      }
      return next;
    });
    setFragmentTexts((prev) => {
      const next = new Map(prev);
      // Always keep fragment text in map for compose (removal tracked by selectedFragments)
      next.set(fragment.id, fragment.fragment);
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

  // Build the composed text: fragment texts + snippet texts, joined by ", "
  const composedText = useMemo(() => {
    const fragmentParts = Array.from(selectedFragments)
      .map((id) => fragmentTexts.get(id))
      .filter((t): t is string => Boolean(t));

    const snippetParts = Array.from(selectedSnippets)
      .map((id) => snippetTexts.get(id))
      .filter((t): t is string => Boolean(t));

    const all = [...fragmentParts, ...snippetParts];
    return all.join(", ");
  }, [selectedFragments, fragmentTexts, selectedSnippets, snippetTexts]);

  const handleDone = useCallback(() => {
    onClose(composedText);
  }, [onClose, composedText]);

  // Sheet's onOpenChange fires on overlay click or X button
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose(composedText);
      }
    },
    [onClose, composedText]
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" data-testid="builder-drawer">
        <SheetHeader>
          <SheetTitle>Prompt Builder</SheetTitle>
          <SheetDescription>
            Select style options to build your prompt modifier.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <CategoryTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedFragments={selectedFragments}
            onToggleFragment={handleToggleFragment}
            selectedSnippets={selectedSnippets}
            onToggleSnippet={handleToggleSnippet}
          />

          {/* Live Preview */}
          <div className="mt-4 space-y-1" data-testid="live-preview">
            <p className="text-xs font-medium text-muted-foreground">
              Preview
            </p>
            <p className="rounded-md border bg-muted/50 p-2 text-sm break-words">
              {composedText ? (
                composedText
              ) : (
                <span className="text-muted-foreground italic">
                  Select options to build your style
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
