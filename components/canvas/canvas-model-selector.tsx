"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { ChevronDown, Library } from "lucide-react";
import { getModels } from "@/app/actions/models";
import { ModelBrowserDrawer } from "@/components/models/model-browser-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Model } from "@/lib/services/model-catalog-service";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasModelSelectorProps {
  initialModelId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a model ID like "black-forest-labs/flux-2-max" into a shorter
 * display name like "flux-2-max" (just the model name portion).
 */
function formatModelDisplayName(modelId: string | undefined): string {
  if (!modelId) return "Select Model";
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[1] : modelId;
}

// ---------------------------------------------------------------------------
// CanvasModelSelector
// ---------------------------------------------------------------------------

/**
 * @deprecated This component is scheduled for removal in Slice 12.
 * Model selection is now handled via settings-based resolution (model_settings table).
 * The component uses local state only and no longer interacts with CanvasDetailContext.
 */
export function CanvasModelSelector({
  initialModelId,
}: CanvasModelSelectorProps) {
  // Use local state instead of context (selectedModelId removed from context in slice-08)
  const [selectedModelId, setSelectedModelId] = useState(initialModelId);
  const prevInitialModelIdRef = useRef(initialModelId);

  // Reset local model when navigating to a different image
  if (prevInitialModelIdRef.current !== initialModelId) {
    setSelectedModelId(initialModelId);
    prevInitialModelIdRef.current = initialModelId;
  }

  // Models state for the browser drawer
  const [catalogModels, setCatalogModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch models from the catalog when the drawer opens
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    setModelError(undefined);
    try {
      const result = await getModels({ capability: "img2img" });
      if ("error" in result) {
        setModelError(result.error);
      } else {
        setCatalogModels(result);
      }
    } catch {
      setModelError("Modelle konnten nicht geladen werden");
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Open the drawer and fetch models
  const handleOpenDrawer = useCallback(() => {
    setDrawerOpen(true);
    fetchModels();
  }, [fetchModels]);

  // The currently selected model as a Model (for the drawer)
  const selectedModels = useMemo(() => {
    if (!selectedModelId) return [];
    const match = catalogModels.find(
      (m) => m.replicateId === selectedModelId
    );
    return match ? [match] : [];
  }, [selectedModelId, catalogModels]);

  // Handle model selection from the drawer
  // All models returned by getModels({ capability: "img2img" }) are already
  // img2img-capable, so no additional compatibility check is needed.
  const handleConfirm = useCallback(
    async (models: Model[]) => {
      if (models.length === 0) return;
      // Only take the first model (single selection for canvas)
      const model = models[0];
      // Support both Model shape (replicateId) and legacy { owner, name }
      const newModelId =
        model.replicateId ??
        ("owner" in model && "name" in model
          ? `${(model as Record<string, string>).owner}/${(model as Record<string, string>).name}`
          : undefined);
      if (newModelId) {
        setSelectedModelId(newModelId);
      }
    },
    []
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            data-testid="canvas-model-selector"
          >
            <span className="max-w-[160px] truncate">
              {formatModelDisplayName(selectedModelId)}
            </span>
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" data-testid="canvas-model-dropdown">
          <DropdownMenuItem disabled className="text-xs opacity-70">
            Current: {formatModelDisplayName(selectedModelId)}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleOpenDrawer}
            data-testid="canvas-model-browse"
          >
            <Library className="mr-2 size-4" />
            Browse Models
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ModelBrowserDrawer
        open={drawerOpen}
        models={catalogModels}
        selectedModels={selectedModels}
        isLoading={isLoadingModels}
        error={modelError}
        onConfirm={handleConfirm}
        onClose={() => setDrawerOpen(false)}
        onRetry={fetchModels}
      />
    </>
  );
}
