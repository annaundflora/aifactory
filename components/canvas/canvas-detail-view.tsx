"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { CanvasHeader } from "@/components/canvas/canvas-header";
import { CanvasImage } from "@/components/canvas/canvas-image";
import { CanvasNavigation } from "@/components/canvas/canvas-navigation";
import { SiblingThumbnails } from "@/components/canvas/sibling-thumbnails";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { VariationPopover } from "@/components/canvas/popovers/variation-popover";
import { Img2imgPopover } from "@/components/canvas/popovers/img2img-popover";
import { UpscalePopover } from "@/components/canvas/popovers/upscale-popover";
import { CanvasModelSelector } from "@/components/canvas/canvas-model-selector";
import { generateImages, upscaleImage, fetchGenerations } from "@/app/actions/generations";
import { deleteGeneration } from "@/app/actions/generations";
import { Button } from "@/components/ui/button";
import { type Generation } from "@/lib/db/queries";
import type { VariationParams } from "@/components/canvas/popovers/variation-popover";
import type { Img2imgParams } from "@/components/canvas/popovers/img2img-popover";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval for in-place generation (reuses WorkspaceContent pattern) */
const GENERATION_POLL_INTERVAL_MS = 3000;

/**
 * Maps variation strength labels to prompt_strength values for img2img.
 * Lower prompt_strength = closer to original (subtle),
 * Higher prompt_strength = more creative deviation.
 */
const VARIATION_STRENGTH_MAP: Record<string, number> = {
  subtle: 0.3,
  balanced: 0.6,
  creative: 0.85,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasDetailViewProps {
  generation: Generation;
  allGenerations: Generation[];
  onBack: () => void;
  toolbarSlot?: ReactNode;
  chatSlot?: ReactNode;
  modelSelectorSlot?: ReactNode;
  undoRedoSlot?: ReactNode;
}

// ---------------------------------------------------------------------------
// CanvasDetailView
// ---------------------------------------------------------------------------

export function CanvasDetailView({
  generation,
  allGenerations,
  onBack,
  toolbarSlot,
  chatSlot,
  modelSelectorSlot,
  undoRedoSlot,
}: CanvasDetailViewProps) {
  const { state, dispatch } = useCanvasDetail();
  const [chatOpen, setChatOpen] = useState(true);

  // Track pending generation IDs for polling via ref to avoid effect churn.
  // A counter state triggers re-renders when pending list changes.
  const pendingGenerationIdsRef = useRef<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Helper to update pendingGenerationIds ref and trigger re-render */
  const setPendingGenerationIds = useCallback((updater: string[] | ((prev: string[]) => string[])) => {
    const next = typeof updater === "function"
      ? updater(pendingGenerationIdsRef.current)
      : updater;
    pendingGenerationIdsRef.current = next;
    setPendingCount(next.length);
  }, []);

  // Find the current generation from context to display the correct image
  const currentGeneration = useMemo(() => {
    return (
      allGenerations.find((g) => g.id === state.currentGenerationId) ??
      generation
    );
  }, [allGenerations, state.currentGenerationId, generation]);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handleNavigate = useCallback(
    (id: string) => {
      dispatch({ type: "SET_CURRENT_IMAGE", generationId: id });
    },
    [dispatch]
  );

  const handleSiblingSelect = useCallback(
    (id: string) => {
      dispatch({ type: "SET_CURRENT_IMAGE", generationId: id });
    },
    [dispatch]
  );

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    const result = await deleteGeneration({ id: state.currentGenerationId });
    if (result.success) {
      onBack();
    } else {
      toast.error("Loeschen fehlgeschlagen");
    }
  }, [state.currentGenerationId, onBack]);

  // ---------------------------------------------------------------------------
  // Polling: check for generation completion / failure
  // ---------------------------------------------------------------------------

  // Stable projectId extracted from generation prop to avoid depending on
  // mutable currentGeneration inside the polling effect.
  const projectIdRef = useRef(generation.projectId);
  projectIdRef.current = generation.projectId;

  useEffect(() => {
    if (pendingCount === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const projectId = projectIdRef.current;
        const results = await fetchGenerations(projectId);

        if (cancelled) return;

        // Read current pending IDs from ref (not stale closure state)
        const currentPending = [...pendingGenerationIdsRef.current];
        const resolvedIds: string[] = [];

        // Process ALL completed/failed generations in a single poll cycle
        for (const pendingId of currentPending) {
          const gen = results.find((g) => g.id === pendingId);
          if (!gen) continue;

          if (gen.status === "completed") {
            // AC-6 + AC-7: Replace image, push old to undo stack
            dispatch({
              type: "PUSH_UNDO",
              generationId: gen.id,
            });
            resolvedIds.push(pendingId);
          } else if (gen.status === "failed") {
            // AC-8: Show error toast, keep current image
            toast.error(gen.errorMessage || "Generation fehlgeschlagen.");
            resolvedIds.push(pendingId);
          }
        }

        if (cancelled) return;

        // Remove all resolved IDs at once
        if (resolvedIds.length > 0) {
          setPendingGenerationIds((prev) =>
            prev.filter((id) => !resolvedIds.includes(id))
          );

          // Turn off generating if no more pending IDs remain
          // (ref is already updated by setPendingGenerationIds)
          if (pendingGenerationIdsRef.current.length === 0) {
            dispatch({ type: "SET_GENERATING", isGenerating: false });
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Generation polling error:", error);
        }
      }
    };

    poll(); // Immediate first poll
    pollIntervalRef.current = setInterval(poll, GENERATION_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pendingCount, dispatch, setPendingGenerationIds]);

  // ---------------------------------------------------------------------------
  // AC-1: Variation popover -> generateImages()
  // ---------------------------------------------------------------------------

  const handleVariationGenerate = useCallback(
    async (params: VariationParams) => {
      if (state.isGenerating) return;

      const selectedModel = state.selectedModelId ?? currentGeneration.modelId;
      const promptStrength =
        VARIATION_STRENGTH_MAP[params.strength] ?? 0.6;

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        const result = await generateImages({
          projectId: currentGeneration.projectId,
          promptMotiv: params.prompt,
          modelIds: [selectedModel],
          params: { prompt_strength: promptStrength },
          count: params.count,
          generationMode: "img2img",
          sourceImageUrl: currentGeneration.imageUrl ?? undefined,
          strength: promptStrength,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        // Start polling for the first pending generation
        const pendingIds = result
          .filter((g) => g.status === "pending")
          .map((g) => g.id);
        if (pendingIds.length > 0) {
          setPendingGenerationIds(pendingIds);
        } else {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
      } catch (error) {
        console.error("Variation generation error:", error);
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        toast.error("Generation fehlgeschlagen.");
      }
    },
    [state.isGenerating, state.selectedModelId, currentGeneration, dispatch, setPendingGenerationIds]
  );

  // ---------------------------------------------------------------------------
  // AC-2: img2img popover -> generateImages()
  // ---------------------------------------------------------------------------

  const handleImg2imgGenerate = useCallback(
    async (params: Img2imgParams) => {
      if (state.isGenerating) return;

      const selectedModel = state.selectedModelId ?? currentGeneration.modelId;

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        // Map references to the server action format
        const references = params.references.map((ref, index) => ({
          referenceImageId: `ref-${index}`,
          imageUrl: ref.imageUrl,
          role: ref.role,
          strength: ref.strength,
          slotPosition: index,
        }));

        const result = await generateImages({
          projectId: currentGeneration.projectId,
          promptMotiv: params.motiv,
          promptStyle: params.style,
          modelIds: [selectedModel],
          params: {},
          count: params.variants,
          generationMode: "img2img",
          references:
            references.length > 0 ? references : undefined,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        const pendingIds = result
          .filter((g) => g.status === "pending")
          .map((g) => g.id);
        if (pendingIds.length > 0) {
          setPendingGenerationIds(pendingIds);
        } else {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
      } catch (error) {
        console.error("img2img generation error:", error);
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        toast.error("Generation fehlgeschlagen.");
      }
    },
    [state.isGenerating, state.selectedModelId, currentGeneration, dispatch, setPendingGenerationIds]
  );

  // ---------------------------------------------------------------------------
  // AC-3: Upscale popover -> upscaleImage()
  // ---------------------------------------------------------------------------

  const handleUpscale = useCallback(
    async (params: { scale: 2 | 4 }) => {
      if (state.isGenerating) return;
      if (!currentGeneration.imageUrl) {
        toast.error("Kein Bild zum Hochskalieren vorhanden.");
        return;
      }

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        // AC-3: Hardcoded model nightmareai/real-esrgan, ignores header selector
        const result = await upscaleImage({
          projectId: currentGeneration.projectId,
          sourceImageUrl: currentGeneration.imageUrl,
          scale: params.scale,
          sourceGenerationId: currentGeneration.id,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        if (result.status === "pending") {
          setPendingGenerationIds([result.id]);
        } else {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
      } catch (error) {
        console.error("Upscale error:", error);
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        toast.error("Upscale fehlgeschlagen.");
      }
    },
    [state.isGenerating, currentGeneration, dispatch, setPendingGenerationIds]
  );

  // ---------------------------------------------------------------------------
  // Determine if upscale should be disabled (simple size heuristic)
  // ---------------------------------------------------------------------------

  const isUpscaleDisabled = false; // Basic: always allow upscale; real check could use image dimensions

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Compose the model selector slot: use provided slot or default to CanvasModelSelector
  const effectiveModelSelectorSlot = modelSelectorSlot ?? (
    <CanvasModelSelector initialModelId={currentGeneration.modelId} />
  );

  return (
    <div
      className="flex h-full flex-col"
      data-testid="canvas-detail-view"
    >
      {/* Header */}
      <CanvasHeader
        onBack={onBack}
        modelSelectorSlot={effectiveModelSelectorSlot}
        undoRedoSlot={undoRedoSlot}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setChatOpen((prev) => !prev)}
          aria-label={chatOpen ? "Close chat panel" : "Open chat panel"}
          data-testid="chat-toggle-button"
          disabled={state.isGenerating}
        >
          {chatOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </CanvasHeader>

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbar slot (48px wide) */}
        <aside
          className="relative flex w-12 shrink-0 flex-col border-r border-border/80 bg-card"
          data-testid="toolbar-slot"
        >
          {toolbarSlot ?? (
            <CanvasToolbar
              generation={currentGeneration}
              onDelete={handleDelete}
            />
          )}

          {/* Popovers anchored to the toolbar area */}
          <VariationPopover
            generation={currentGeneration}
            onGenerate={handleVariationGenerate}
          />
          <Img2imgPopover
            generation={currentGeneration}
            onGenerate={handleImg2imgGenerate}
          />
          <UpscalePopover
            onUpscale={handleUpscale}
            isUpscaleDisabled={isUpscaleDisabled}
          />
        </aside>

        {/* Center: Canvas area (flex: 1) */}
        <main
          className="relative flex flex-1 flex-col overflow-hidden bg-muted/40"
          data-testid="canvas-area"
        >
          {/* Image + Navigation overlay */}
          <div className="relative flex flex-1 items-center justify-center p-4">
            <CanvasNavigation
              allGenerations={allGenerations}
              currentGenerationId={state.currentGenerationId}
              onNavigate={handleNavigate}
            />
            <CanvasImage
              generation={currentGeneration}
              isLoading={state.isGenerating}
            />
          </div>

          {/* Sibling thumbnails below the image */}
          <SiblingThumbnails
            batchId={currentGeneration.batchId}
            currentGenerationId={state.currentGenerationId}
            onSelect={handleSiblingSelect}
          />
        </main>

        {/* Right: Chat slot (panel manages its own collapse/expand + width) */}
        {chatOpen && (
          <aside data-testid="chat-slot">
            {chatSlot}
          </aside>
        )}
      </div>
    </div>
  );
}
