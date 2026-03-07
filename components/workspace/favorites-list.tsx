"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { getFavoritePrompts, toggleFavorite } from "@/app/actions/prompts";
import type { PromptHistoryEntry } from "@/lib/services/prompt-history-service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;
const PREVIEW_MAX_LEN = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncatePreview(text: string): string {
  if (text.length <= PREVIEW_MAX_LEN) return text;
  return text.slice(0, PREVIEW_MAX_LEN) + "...";
}

function relativeTimestamp(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`;
  if (diffHours < 24) return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  // Older: format as DD.MM.YYYY
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FavoritesListProps {
  onLoadEntry: (entry: PromptHistoryEntry) => void;
  /** Current prompt field values to decide if confirmation dialog is needed */
  promptMotiv?: string;
  promptStyle?: string;
  negativePrompt?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FavoritesList({
  onLoadEntry,
  promptMotiv = "",
  promptStyle = "",
  negativePrompt = "",
}: FavoritesListProps) {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Confirmation dialog state
  const [pendingEntry, setPendingEntry] = useState<PromptHistoryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Load on mount (lazy: triggered when Favorites tab is rendered)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    startTransition(async () => {
      const result = await getFavoritePrompts({ offset: 0, limit: BATCH_SIZE });
      setEntries(result);
      setHasMore(result.length === BATCH_SIZE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Load more
  // ---------------------------------------------------------------------------

  const handleLoadMore = useCallback(() => {
    if (isPending || !hasMore) return;
    startTransition(async () => {
      const result = await getFavoritePrompts({ offset: entries.length, limit: BATCH_SIZE });
      setEntries((prev) => [...prev, ...result]);
      setHasMore(result.length === BATCH_SIZE);
    });
  }, [isPending, hasMore, entries.length]);

  // ---------------------------------------------------------------------------
  // Favorite toggle: optimistically remove from list (isFavorite -> false)
  // ---------------------------------------------------------------------------

  const handleStarToggle = useCallback(
    async (e: React.MouseEvent, entry: PromptHistoryEntry) => {
      e.stopPropagation();
      // Optimistically remove from favorites list
      setEntries((prev) => prev.filter((en) => en.generationId !== entry.generationId));
      try {
        await toggleFavorite({ generationId: entry.generationId });
      } catch {
        // Restore on failure
        setEntries((prev) => {
          const exists = prev.some((en) => en.generationId === entry.generationId);
          if (exists) return prev;
          return [entry, ...prev].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Entry click: load or confirm
  // ---------------------------------------------------------------------------

  const hasAnyPromptContent = useCallback(() => {
    return promptMotiv.trim() !== "" || promptStyle.trim() !== "" || negativePrompt.trim() !== "";
  }, [promptMotiv, promptStyle, negativePrompt]);

  const handleEntryClick = useCallback(
    (entry: PromptHistoryEntry) => {
      if (hasAnyPromptContent()) {
        setPendingEntry(entry);
        setDialogOpen(true);
      } else {
        onLoadEntry(entry);
      }
    },
    [hasAnyPromptContent, onLoadEntry]
  );

  const handleDialogApply = useCallback(() => {
    if (pendingEntry) {
      onLoadEntry(pendingEntry);
    }
    setPendingEntry(null);
    setDialogOpen(false);
  }, [pendingEntry, onLoadEntry]);

  const handleDialogCancel = useCallback(() => {
    setPendingEntry(null);
    setDialogOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!initialized || (isPending && entries.length === 0)) {
    return (
      <div data-testid="favorites-list" className="py-6 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div data-testid="favorites-list">
        <div
          data-testid="favorites-empty"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          No favorites yet. Star prompts in History to save them here.
        </div>
      </div>
    );
  }

  return (
    <>
      <div data-testid="favorites-list" className="divide-y divide-border">
        {entries.map((entry) => {
          const preview = truncatePreview(entry.promptMotiv || entry.promptStyle || "");
          const timestamp = relativeTimestamp(new Date(entry.createdAt));

          return (
            <div
              key={entry.generationId}
              data-testid="favorites-entry"
              className="flex cursor-pointer items-start gap-2 px-1 py-3 hover:bg-muted/50 transition-colors"
              onClick={() => handleEntryClick(entry)}
            >
              {/* Star toggle -- always filled since these are favorites */}
              <button
                type="button"
                data-testid="star-toggle"
                aria-label="Remove from favorites"
                className="mt-0.5 shrink-0 text-yellow-500 hover:text-muted-foreground transition-colors"
                onClick={(e) => handleStarToggle(e, entry)}
              >
                <Star
                  className="size-4"
                  fill="currentColor"
                  stroke="currentColor"
                />
              </button>

              {/* Entry content */}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm leading-snug break-words">
                  {preview}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {entry.modelId.split("/").pop() ?? entry.modelId}
                  </span>
                  <span>{timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Load more */}
        {hasMore && (
          <div className="py-3 text-center">
            <button
              type="button"
              data-testid="load-more"
              disabled={isPending}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              onClick={handleLoadMore}
            >
              {isPending ? "Loading..." : "Load more..."}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current prompt fields. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDialogCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDialogApply}>
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
