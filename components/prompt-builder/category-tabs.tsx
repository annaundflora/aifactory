"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OptionChip } from "@/components/prompt-builder/option-chip";
import { SnippetForm } from "@/components/prompt-builder/snippet-form";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { Snippet } from "@/lib/services/snippet-service";
import { BUILDER_CATEGORIES, type BuilderFragment } from "@/lib/builder-fragments";

interface CategoryTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedFragments: Set<string>;
  onToggleFragment: (fragment: BuilderFragment) => void;
  selectedSnippets?: Set<string>;
  onToggleSnippet?: (snippetId: string, snippetText: string) => void;
}

export function CategoryTabs({
  activeTab,
  onTabChange,
  selectedFragments,
  onToggleFragment,
  selectedSnippets,
  onToggleSnippet,
}: CategoryTabsProps) {
  const [snippetsByCategory, setSnippetsByCategory] = useState<
    Record<string, Snippet[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | undefined>(
    undefined
  );
  const [deletingSnippetId, setDeletingSnippetId] = useState<string | null>(
    null
  );

  const loadSnippets = useCallback(async () => {
    setLoading(true);
    try {
      const { getSnippets } = await import("@/app/actions/prompts");
      const data = await getSnippets();
      setSnippetsByCategory(data);
    } catch {
      setSnippetsByCategory({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "snippets") {
      loadSnippets();
    }
  }, [activeTab, loadSnippets]);

  const handleSnippetSaved = useCallback(() => {
    setShowForm(false);
    setEditingSnippet(undefined);
    loadSnippets();
  }, [loadSnippets]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setEditingSnippet(undefined);
  }, []);

  const handleEdit = useCallback((snippet: Snippet) => {
    setEditingSnippet(snippet);
    setShowForm(true);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (snippetId: string) => {
      try {
        const { deleteSnippet } = await import("@/app/actions/prompts");
        await deleteSnippet({ id: snippetId });
        setDeletingSnippetId(null);
        loadSnippets();
      } catch {
        setDeletingSnippetId(null);
      }
    },
    [loadSnippets]
  );

  const existingCategories = Object.keys(snippetsByCategory);
  const hasSnippets = existingCategories.length > 0;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      {/* Two-row tab layout: 3 tabs per row */}
      <TabsList className="grid grid-cols-3 !h-auto gap-1 p-1" data-testid="category-tabs-list">
        {BUILDER_CATEGORIES.map((cat) => (
          <TabsTrigger
            key={cat.id}
            value={cat.id}
            data-testid={`tab-${cat.id}`}
          >
            {cat.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="snippets" data-testid="tab-snippets">
          My Snippets
        </TabsTrigger>
      </TabsList>

      {/* Fragment tabs for each category */}
      {BUILDER_CATEGORIES.map((cat) => (
        <TabsContent key={cat.id} value={cat.id}>
          <div className="grid grid-cols-2 gap-2" data-testid={`${cat.id}-grid`}>
            {cat.fragments.map((fragment) => (
              <OptionChip
                key={fragment.id}
                label={fragment.label}
                selected={selectedFragments.has(fragment.id)}
                onToggle={() => onToggleFragment(fragment)}
              />
            ))}
          </div>
        </TabsContent>
      ))}

      {/* My Snippets tab */}
      <TabsContent value="snippets">
        <div className="space-y-4" data-testid="snippets-tab-content">
          {/* New Snippet Button */}
          {!showForm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setEditingSnippet(undefined);
                setShowForm(true);
              }}
              data-testid="new-snippet-btn"
            >
              <Plus className="mr-1 size-4" />
              New Snippet
            </Button>
          )}

          {/* Inline Form */}
          {showForm && (
            <SnippetForm
              snippet={editingSnippet}
              categories={existingCategories}
              onSave={handleSnippetSaved}
              onCancel={handleCancelForm}
            />
          )}

          {/* Loading */}
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Loading snippets...
            </p>
          )}

          {/* Empty State */}
          {!loading && !hasSnippets && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="snippets-empty"
            >
              No snippets yet. Create your first!
            </p>
          )}

          {/* Snippet Chips grouped by category */}
          {!loading &&
            hasSnippets &&
            existingCategories.map((category) => (
              <div key={category} data-testid={`snippet-category-${category}`}>
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {snippetsByCategory[category].map((snippet) => {
                    const isDeleting = deletingSnippetId === snippet.id;
                    const isSelected = selectedSnippets?.has(snippet.id) ?? false;

                    if (isDeleting) {
                      return (
                        <div
                          key={snippet.id}
                          className="flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-xs"
                          data-testid={`snippet-chip-${snippet.id}-deleting`}
                        >
                          <span className="text-destructive font-medium">
                            Delete?
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs text-destructive"
                            onClick={() => handleDeleteConfirm(snippet.id)}
                            data-testid={`snippet-delete-confirm-${snippet.id}`}
                          >
                            Yes
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs"
                            onClick={() => setDeletingSnippetId(null)}
                            data-testid={`snippet-delete-cancel-${snippet.id}`}
                          >
                            No
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={snippet.id}
                        className="group relative"
                        data-testid={`snippet-chip-${snippet.id}`}
                      >
                        <Button
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="w-full text-xs pr-12 truncate"
                          onClick={() =>
                            onToggleSnippet?.(snippet.id, snippet.text)
                          }
                        >
                          {snippet.text}
                        </Button>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(snippet);
                            }}
                            data-testid={`snippet-edit-${snippet.id}`}
                            aria-label={`Edit ${snippet.text}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-destructive/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingSnippetId(snippet.id);
                            }}
                            data-testid={`snippet-delete-${snippet.id}`}
                            aria-label={`Delete ${snippet.text}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
