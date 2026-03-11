"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, AlertCircle } from "lucide-react";

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
import { useModelFilters } from "@/lib/hooks/use-model-filters";
import { ModelCard } from "@/components/models/model-card";

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

  // ---- Search & filter state ---------------------------------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);

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
    }
    prevOpenRef.current = open;
  }, [open]);

  // ---- Filtering via hook ------------------------------------------------
  const { filteredModels, owners } = useModelFilters(
    models,
    searchQuery,
    ownerFilter,
  );

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

  // ---- Owner filter chip handler -----------------------------------------
  const handleOwnerClick = useCallback((owner: string | null) => {
    setOwnerFilter(owner);
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

        {/* ---- Owner filter chips ---- */}
        {owners.length > 0 && !isLoading && !error && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-1" data-testid="owner-filter-chips">
            <button
              type="button"
              onClick={() => handleOwnerClick(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                ownerFilter === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              All
            </button>
            {owners.map((owner) => (
              <button
                key={owner}
                type="button"
                onClick={() => handleOwnerClick(owner)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  ownerFilter === owner
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent",
                )}
              >
                {owner}
              </button>
            ))}
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
            <div className="grid grid-cols-2 gap-4" data-testid="model-grid">
              {filteredModels.map((model) => {
                const selected = isSelected(model);
                const disabled = !selected && atMaxSelection;
                return (
                  <ModelCard
                    key={`${model.owner}/${model.name}`}
                    model={model}
                    selected={selected}
                    disabled={disabled}
                    onSelect={handleSelect}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Sticky footer with confirm button ---- */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          <Button
            className="w-full"
            disabled={confirmDisabled}
            onClick={handleConfirm}
            data-testid="confirm-button"
          >
            {confirmText}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
