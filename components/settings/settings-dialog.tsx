"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ModelModeSection } from "@/components/settings/model-mode-section";
import {
  getModelSettings,
  updateModelSetting,
} from "@/app/actions/model-settings";
import {
  getCollectionModels,
  checkImg2ImgSupport,
} from "@/app/actions/models";
import type { GenerationMode, Tier } from "@/lib/types";
import type { ModelSetting } from "@/lib/db/queries";
import type { CollectionModel } from "@/lib/types/collection-model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODES: GenerationMode[] = ["txt2img", "img2img", "upscale"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<ModelSetting[]>([]);
  const [collectionModels, setCollectionModels] = useState<CollectionModel[]>(
    []
  );
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [compatibilityMap, setCompatibilityMap] = useState<
    Record<string, boolean>
  >({});

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    const result = await getModelSettings();
    setSettings(result);
  }, []);

  const loadCollectionModels = useCallback(async () => {
    const result = await getCollectionModels();
    if ("error" in result) {
      setCollectionError(result.error);
      setCollectionModels([]);
    } else {
      setCollectionError(null);
      setCollectionModels(result);

      // Build compatibility map for img2img mode
      const map: Record<string, boolean> = {};
      await Promise.all(
        result.map(async (model) => {
          const modelId = `${model.owner}/${model.name}`;
          try {
            const compatible = await checkImg2ImgSupport({ modelId });
            map[modelId] = compatible;
          } catch {
            // If schema fetch fails, allow selection (fallback)
            map[modelId] = true;
          }
        })
      );
      setCompatibilityMap(map);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
      loadCollectionModels();
    }
  }, [open, loadSettings, loadCollectionModels]);

  // -------------------------------------------------------------------------
  // Model change handler (auto-save)
  // -------------------------------------------------------------------------

  const handleModelChange = useCallback(
    async (mode: GenerationMode, tier: Tier, modelId: string) => {
      const result = await updateModelSetting({ mode, tier, modelId });

      if ("error" in result) {
        // Error from server action -- could show a toast, but for now we
        // simply reload to keep UI in sync
        await loadSettings();
        return;
      }

      // Optimistic update: replace the matching setting in state
      setSettings((prev) => {
        const updated = prev.map((s) =>
          s.mode === mode && s.tier === tier ? result : s
        );
        // If the setting didn't exist before, add it
        if (!prev.some((s) => s.mode === mode && s.tier === tier)) {
          updated.push(result);
        }
        return updated;
      });

      // Notify other components (e.g. PromptArea) that settings changed
      window.dispatchEvent(new Event("model-settings-changed"));
    },
    [loadSettings]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Model Settings</DialogTitle>
          <DialogDescription>
            Assign models to each generation mode and quality tier.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {MODES.map((mode) => (
            <ModelModeSection
              key={mode}
              mode={mode}
              settings={settings}
              collectionModels={collectionModels}
              collectionError={collectionError}
              compatibilityMap={compatibilityMap}
              onModelChange={handleModelChange}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
