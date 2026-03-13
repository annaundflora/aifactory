"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronDown, Library } from "lucide-react";
import { toast } from "sonner";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { getCollectionModels, checkImg2ImgSupport } from "@/app/actions/models";
import { ModelBrowserDrawer } from "@/components/models/model-browser-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CollectionModel } from "@/lib/types/collection-model";

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
function formatModelDisplayName(modelId: string): string {
  const parts = modelId.split("/");
  return parts.length > 1 ? parts[1] : modelId;
}

// ---------------------------------------------------------------------------
// CanvasModelSelector
// ---------------------------------------------------------------------------

export function CanvasModelSelector({
  initialModelId,
}: CanvasModelSelectorProps) {
  const { state, dispatch } = useCanvasDetail();

  // Initialize selectedModelId from the image's model on first render
  useEffect(() => {
    if (!state.selectedModelId && initialModelId) {
      dispatch({ type: "SET_SELECTED_MODEL", modelId: initialModelId });
    }
  }, [initialModelId, state.selectedModelId, dispatch]);

  const selectedModelId = state.selectedModelId ?? initialModelId;

  // Collection models state for the browser drawer
  const [collectionModels, setCollectionModels] = useState<CollectionModel[]>(
    []
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cache of img2img support per model (to avoid re-fetching)
  const [img2imgCache, setImg2imgCache] = useState<Map<string, boolean>>(
    new Map()
  );

  // Fetch collection models when the drawer opens
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    setModelError(undefined);
    try {
      const result = await getCollectionModels();
      if ("error" in result) {
        setModelError(result.error);
      } else {
        setCollectionModels(result);
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

  // The currently selected model as a CollectionModel (for the drawer)
  const selectedModels = useMemo(() => {
    if (!selectedModelId) return [];
    const parts = selectedModelId.split("/");
    if (parts.length !== 2) return [];
    const match = collectionModels.find(
      (m) => m.owner === parts[0] && m.name === parts[1]
    );
    return match ? [match] : [];
  }, [selectedModelId, collectionModels]);

  // Handle model selection from the drawer
  const handleConfirm = useCallback(
    async (models: CollectionModel[]) => {
      if (models.length === 0) return;
      // Only take the first model (single selection for canvas)
      const model = models[0];
      const newModelId = `${model.owner}/${model.name}`;

      // Check img2img support via server action
      let supportsImg2img = img2imgCache.get(newModelId);
      if (supportsImg2img === undefined) {
        try {
          supportsImg2img = await checkImg2ImgSupport({ modelId: newModelId });
          setImg2imgCache((prev) => new Map(prev).set(newModelId, supportsImg2img!));
        } catch {
          // If we can't determine, assume it supports img2img
          supportsImg2img = true;
        }
      }

      if (!supportsImg2img) {
        // AC-11: Auto-switch to first img2img-capable model
        toast("Dieses Modell unterstuetzt kein img2img. Es wird automatisch ein kompatibles Modell gewaehlt.");
        // Try to find first img2img-capable model from the collection
        for (const m of collectionModels) {
          const mId = `${m.owner}/${m.name}`;
          let supports = img2imgCache.get(mId);
          if (supports === undefined) {
            try {
              supports = await checkImg2ImgSupport({ modelId: mId });
              setImg2imgCache((prev) => new Map(prev).set(mId, supports!));
            } catch {
              continue;
            }
          }
          if (supports) {
            dispatch({ type: "SET_SELECTED_MODEL", modelId: mId });
            return;
          }
        }
        // If no compatible model found, keep the current one
        return;
      }

      dispatch({ type: "SET_SELECTED_MODEL", modelId: newModelId });
    },
    [dispatch, img2imgCache, collectionModels]
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
        models={collectionModels}
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
