"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModelModeSection } from "@/components/settings/model-mode-section";
import {
  getModelSettings,
  updateModelSetting,
} from "@/app/actions/model-settings";
import { getModels } from "@/app/actions/models";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import type { GenerationMode, Tier } from "@/lib/types";
import type { ModelSetting } from "@/lib/db/queries";
import type { Model } from "@/lib/services/model-catalog-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SyncButtonState = "idle" | "syncing" | "sync_partial";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODES: GenerationMode[] = ["txt2img", "img2img", "upscale", "inpaint", "outpaint"];

const SYNC_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<ModelSetting[]>([]);
  const [modelsByMode, setModelsByMode] = useState<Record<GenerationMode, Model[]>>({
    txt2img: [],
    img2img: [],
    upscale: [],
    inpaint: [],
    outpaint: [],
  });

  const [, setLoadError] = useState<string | null>(null);

  // Sync state
  const [syncState, setSyncState] = useState<SyncButtonState>("idle");
  const [failedCount, setFailedCount] = useState<number>(0);
  const [hasEverSynced, setHasEverSynced] = useState<boolean>(false);
  const [syncFailed, setSyncFailed] = useState<boolean>(false);
  const syncStateBeforeRef = useRef<SyncButtonState>("idle");

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    const result = await getModelSettings();
    if ("error" in result) return;
    setSettings(result);
  }, []);

  const loadModels = useCallback(async () => {
    const results = await Promise.all(
      MODES.map(async (mode) => {
        const result = await getModels({ capability: mode });
        return { mode, result };
      })
    );

    const newModelsByMode: Record<GenerationMode, Model[]> = {
      txt2img: [],
      img2img: [],
      upscale: [],
      inpaint: [],
      outpaint: [],
    };

    let hasError = false;

    for (const { mode, result } of results) {
      if ("error" in result) {
        hasError = true;
      } else {
        newModelsByMode[mode] = result;
      }
    }

    setModelsByMode(newModelsByMode);
    setLoadError(hasError ? "Could not load models" : null);

    // If any mode has models, a sync has occurred at some point
    const anyModels = Object.values(newModelsByMode).some((m) => m.length > 0);
    if (anyModels) {
      setHasEverSynced(true);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadSettings();
      loadModels();
    }
  }, [open, loadSettings, loadModels]);

  // -------------------------------------------------------------------------
  // Event-based refresh: listen to "model-settings-changed"
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleModelSettingsChanged = () => {
      loadModels();
    };

    window.addEventListener("model-settings-changed", handleModelSettingsChanged);

    return () => {
      window.removeEventListener("model-settings-changed", handleModelSettingsChanged);
    };
  }, [loadModels]);

  // -------------------------------------------------------------------------
  // Sync handler (streaming fetch)
  // -------------------------------------------------------------------------

  const handleSync = useCallback(async () => {
    if (syncState === "syncing") return;

    // Remember previous state for error recovery
    syncStateBeforeRef.current = syncState;
    setSyncState("syncing");
    setSyncFailed(false);

    const toastId = toast.loading("Syncing Models...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SYNC_TIMEOUT_MS);

    try {
      const response = await fetch("/api/models/sync", {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        toast.dismiss(toastId);
        toast.error(`Sync failed: HTTP ${response.status}`, { duration: Infinity });
        setSyncState(syncStateBeforeRef.current);
        setSyncFailed(true);
        return;
      }

      if (!response.body) {
        toast.dismiss(toastId);
        toast.error("Sync failed: No response body", { duration: Infinity });
        setSyncState(syncStateBeforeRef.current);
        setSyncFailed(true);
        return;
      }

      // Read NDJSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            if (event.type === "progress") {
              toast.loading(
                `Syncing Models... ${event.completed}/${event.total}`,
                { id: toastId }
              );
            } else if (event.type === "complete") {
              toast.dismiss(toastId);
              setHasEverSynced(true);
              setSyncFailed(false);

              if (event.failed === 0) {
                // Full success
                toast.success(`${event.synced} Models synced`, {
                  duration: 3000,
                });
                setSyncState("idle");
                setFailedCount(0);
              } else {
                // Partial success
                toast.warning(`${event.synced} synced, ${event.failed} failed`, {
                  duration: Infinity,
                });
                setSyncState("sync_partial");
                setFailedCount(event.failed);
              }

              // Reload models and notify other components
              await loadModels();
              window.dispatchEvent(new Event("model-settings-changed"));
            } else if (event.type === "error") {
              toast.dismiss(toastId);
              toast.error(`Sync failed: ${event.message}`, {
                duration: Infinity,
              });
              setSyncState(syncStateBeforeRef.current);
              setSyncFailed(true);
            }
          } catch {
            // Malformed JSON line, skip
          }
        }
      }
    } catch (err: unknown) {
      toast.dismiss(toastId);
      setSyncFailed(true);

      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Sync timed out", { duration: Infinity });
        setSyncState("idle");
      } else {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        toast.error(`Sync failed: ${message}`, { duration: Infinity });
        setSyncState(syncStateBeforeRef.current);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [syncState, loadModels]);

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
  // Sync button rendering
  // -------------------------------------------------------------------------

  const renderSyncButton = () => {
    const isDisabled = syncState === "syncing";

    const buttonContent = (
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={handleSync}
        className="relative"
        data-testid="sync-button"
        data-sync-state={syncState}
      >
        {syncState === "syncing" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {syncState === "syncing" ? "Syncing..." : "Sync Models"}
        {syncState === "sync_partial" && (
          <span
            className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white"
            data-testid="sync-warning-badge"
          >
            <AlertTriangle className="size-3" />
          </span>
        )}
      </Button>
    );

    if (syncState === "sync_partial") {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent>
              <p>Last sync: {failedCount} models failed. Click to retry.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return buttonContent;
  };

  // -------------------------------------------------------------------------
  // Derived state: whether any mode has models (for empty:partial detection)
  // -------------------------------------------------------------------------

  const anyModeHasModels = Object.values(modelsByMode).some((m) => m.length > 0);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Model Settings</DialogTitle>
              <DialogDescription>
                Assign models to each generation mode and quality tier.
              </DialogDescription>
            </div>
            {renderSyncButton()}
          </div>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {MODES.map((mode) => (
            <ModelModeSection
              key={mode}
              mode={mode}
              settings={settings}
              models={modelsByMode[mode]}
              onModelChange={handleModelChange}
              syncState={syncState}
              hasEverSynced={hasEverSynced}
              syncFailed={syncFailed}
              otherModesHaveModels={
                anyModeHasModels && modelsByMode[mode].length === 0
              }
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
