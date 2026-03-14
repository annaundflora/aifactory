"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Search, AlertCircle, X, Star } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type CollectionModel } from "@/lib/types/collection-model";
import { useModelFilters, type SortOption } from "@/lib/hooks/use-model-filters";
import { ModelCard } from "@/components/models/model-card";
// @deprecated - This component is no longer used in production.
// Favorite model functions were removed in slice-13.
const getFavoriteModels = async (): Promise<string[]> => [];
const toggleFavoriteModel = async (): Promise<{ isFavorite: boolean }> => ({ isFavorite: false });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SELECTED = 3;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ModelBrowserDrawerProps {
  open: boolean;
  models: CollectionModel[];
  selectedModels: CollectionModel[];
  isLoading: boolean;
  error?: string;
  onConfirm: (models: CollectionModel[]) => void;
  onClose: () => void;
  onRetry: () => void;
}

// ---------------------------------------------------------------------------
// ModelBrowserDrawer
// ---------------------------------------------------------------------------

export function ModelBrowserDrawer({
  open,
  models,
  selectedModels,
  isLoading,
  error,
  onConfirm,
  onClose,
  onRetry,
}: ModelBrowserDrawerProps) {
  // ---- Temp selection state (discarded on close without confirm) ----------
  const [tempSelectedModels, setTempSelectedModels] = useState<
    CollectionModel[]
  >([]);

  // ---- Search, filter & sort state ----------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // ---- Track previous open value and latest selectedModels via refs ------
  const prevOpenRef = useRef(false);
  const selectedModelsRef = useRef(selectedModels);
  selectedModelsRef.current = selectedModels;

  // ---- Initialize temp state only on open transition (false -> true) -----
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTempSelectedModels(selectedModelsRef.current);
      setSearchQuery("");
      setOwnerFilter(null);
      setSortBy("newest");
      setShowSelectedOnly(false);
      setShowFavoritesOnly(false);
      getFavoriteModels().then((ids) => setFavoriteIds(new Set(ids)));
    }
    prevOpenRef.current = open;
  }, [open]);

  // ---- Filtering via hook ------------------------------------------------
  const { filteredModels, owners } = useModelFilters(
    models,
    searchQuery,
    ownerFilter,
    sortBy,
  );

  // ---- Post-filter for "Selected" and "Favorites" views ------------------
  const displayModels = useMemo(() => {
    let result = filteredModels;
    if (showSelectedOnly) {
      result = result.filter((model) =>
        tempSelectedModels.some(
          (m) => m.owner === model.owner && m.name === model.name,
        ),
      );
    }
    if (showFavoritesOnly) {
      result = result.filter((model) =>
        favoriteIds.has(`${model.owner}/${model.name}`),
      );
    }
    return result;
  }, [filteredModels, showSelectedOnly, showFavoritesOnly, tempSelectedModels, favoriteIds]);

  // ---- Auto-disable "Selected" filter when nothing is selected -----------
  useEffect(() => {
    if (tempSelectedModels.length === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [tempSelectedModels.length, showSelectedOnly]);

  // ---- Selection helpers -------------------------------------------------
  const isSelected = useCallback(
    (model: CollectionModel) =>
      tempSelectedModels.some(
        (m) => m.owner === model.owner && m.name === model.name,
      ),
    [tempSelectedModels],
  );

  const atMaxSelection = tempSelectedModels.length >= MAX_SELECTED;

  const handleSelect = useCallback(
    (model: CollectionModel) => {
      setTempSelectedModels((prev) => {
        const idx = prev.findIndex(
          (m) => m.owner === model.owner && m.name === model.name,
        );
        // Deselect
        if (idx !== -1) {
          return prev.filter((_, i) => i !== idx);
        }
        // Enforce max
        if (prev.length >= MAX_SELECTED) {
          return prev;
        }
        // Select
        return [...prev, model];
      });
    },
    [],
  );

  // ---- Confirm & close handlers ------------------------------------------
  const handleConfirm = useCallback(() => {
    onConfirm(tempSelectedModels);
    onClose();
  }, [onConfirm, onClose, tempSelectedModels]);

  // Sheet's onOpenChange fires on overlay click or X button
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
      }
    },
    [onClose],
  );

  // ---- Owner filter select handler ----------------------------------------
  const handleOwnerChange = useCallback((value: string) => {
    setOwnerFilter(value === "all" ? null : value);
  }, []);

  // ---- Deselect all handler ---------------------------------------------
  const handleDeselectAll = useCallback(() => {
    setTempSelectedModels([]);
  }, []);

  // ---- Favorite toggle handler (optimistic) ----------------------------
  const handleFavoriteToggle = useCallback((model: CollectionModel) => {
    const key = `${model.owner}/${model.name}`;
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    toggleFavoriteModel().catch(() => {
      // Revert on error
      setFavoriteIds((prev) => {
        const reverted = new Set(prev);
        if (reverted.has(key)) {
          reverted.delete(key);
        } else {
          reverted.add(key);
        }
        return reverted;
      });
    });
  }, []);

  // ---- Confirm button text -----------------------------------------------
  const confirmCount = tempSelectedModels.length;
  const confirmDisabled = confirmCount === 0;
  const confirmText =
    confirmCount === 0
      ? "Select at least 1 model"
      : `Confirm (${confirmCount} ${confirmCount === 1 ? "Model" : "Models"})`;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex flex-col sm:max-w-lg"
        data-testid="model-browser-drawer"
      >
        {/* ---- Header ---- */}
        <SheetHeader>
          <SheetTitle>Browse Models</SheetTitle>
          <SheetDescription>
            Select up to {MAX_SELECTED} models for generation.
          </SheetDescription>
        </SheetHeader>

        {/* ---- Search input ---- */}
        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="model-search-input"
            />
          </div>
        </div>

        {/* ---- Sort chips + owner dropdown ---- */}
        {!isLoading && !error && models.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-1" data-testid="sort-and-filter-chips">
            {/* Sort chips */}
            <button
              type="button"
              onClick={() => setSortBy("popular")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                sortBy === "popular"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
              data-testid="sort-popular"
            >
              Popular
            </button>
            <button
              type="button"
              onClick={() => setSortBy("newest")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                sortBy === "newest"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
              data-testid="sort-newest"
            >
              Newest
            </button>

            {/* Selected filter chip */}
            {tempSelectedModels.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSelectedOnly((prev) => !prev)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  showSelectedOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
                data-testid="filter-selected"
              >
                Selected ({tempSelectedModels.length})
              </button>
            )}

            {/* Favorites filter chip */}
            {favoriteIds.size > 0 && (
              <button
                type="button"
                onClick={() => setShowFavoritesOnly((prev) => !prev)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1",
                  showFavoritesOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
                data-testid="filter-favorites"
              >
                <Star className="h-3 w-3" />
                Favorites ({favoriteIds.size})
              </button>
            )}

            {/* Owner dropdown */}
            {owners.length > 0 && (
              <select
                value={ownerFilter ?? "all"}
                onChange={(e) => handleOwnerChange(e.target.value)}
                className="h-7 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="owner-filter-select"
              >
                <option value="all">All providers</option>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* ---- Content area ---- */}
        <div className="flex-1 overflow-y-auto px-4">
          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-2 gap-4" data-testid="model-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-video w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div
              className="flex flex-col items-center justify-center gap-3 py-12 text-center"
              data-testid="model-error"
            >
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && models.length === 0 && (
            <div
              className="flex items-center justify-center py-12"
              data-testid="model-empty"
            >
              <p className="text-sm text-muted-foreground">
                No models available.
              </p>
            </div>
          )}

          {/* Max selection hint */}
          {atMaxSelection && (
            <p
              className="mb-2 text-xs text-muted-foreground"
              data-testid="max-selection-hint"
            >
              Select up to {MAX_SELECTED} models
            </p>
          )}

          {/* Model card grid */}
          {!isLoading && !error && models.length > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-1" data-testid="model-grid">
              {displayModels.map((model) => {
                const selected = isSelected(model);
                const disabled = !selected && atMaxSelection;
                return (
                  <ModelCard
                    key={`${model.owner}/${model.name}`}
                    model={model}
                    selected={selected}
                    disabled={disabled}
                    onSelect={handleSelect}
                    isFavorite={favoriteIds.has(`${model.owner}/${model.name}`)}
                    onFavoriteToggle={handleFavoriteToggle}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Sticky footer with confirm button ---- */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex gap-2">
            {tempSelectedModels.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleDeselectAll}
                data-testid="deselect-all-button"
                title="Deselect all"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={confirmDisabled}
              onClick={handleConfirm}
              data-testid="confirm-button"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
