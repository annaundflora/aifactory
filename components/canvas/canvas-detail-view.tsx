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
import { DetailsOverlay } from "@/components/canvas/details-overlay";
import { VariationPopover } from "@/components/canvas/popovers/variation-popover";
import { Img2imgPopover } from "@/components/canvas/popovers/img2img-popover";
import { UpscalePopover } from "@/components/canvas/popovers/upscale-popover";
import { CanvasChatPanel } from "@/components/canvas/canvas-chat-panel";
import { MaskCanvas } from "@/components/canvas/mask-canvas";
import { FloatingBrushToolbar } from "@/components/canvas/floating-brush-toolbar";
import { generateImages, upscaleImage, fetchGenerations } from "@/app/actions/generations";
import { deleteGeneration } from "@/app/actions/generations";
import { getModelSlots } from "@/app/actions/model-slots";
import { getModels } from "@/app/actions/models";
import { uploadReferenceImage, addGalleryAsReference } from "@/app/actions/references";
import { Button } from "@/components/ui/button";
import { type Generation, type ModelSlot, type Model } from "@/lib/db/queries";
import type { VariationParams } from "@/components/canvas/popovers/variation-popover";
import type { Img2imgParams } from "@/components/canvas/popovers/img2img-popover";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval for in-place generation (reuses WorkspaceContent pattern) */
const GENERATION_POLL_INTERVAL_MS = 3000;

/** Maps the VariationStrength enum to the numeric prompt_strength param. */
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
  onGenerationsCreated?: (newGens: Generation[]) => void;
  toolbarSlot?: ReactNode;
  chatSlot?: ReactNode;
  undoRedoSlot?: ReactNode;
  /** Callback for the erase action button in the floating brush toolbar.
   *  Connected to generation logic in later slices. */
  onEraseAction?: () => void;
}

// ---------------------------------------------------------------------------
// CanvasDetailView
// ---------------------------------------------------------------------------

export function CanvasDetailView({
  generation,
  allGenerations,
  onBack,
  onGenerationsCreated,
  toolbarSlot,
  chatSlot,
  undoRedoSlot,
  onEraseAction,
}: CanvasDetailViewProps) {
  const { state, dispatch } = useCanvasDetail();
  const [chatOpen, setChatOpen] = useState(true);

  // Local copy of allGenerations — updated by polling so new generations
  // are immediately visible without waiting for a parent re-render.
  const [localGenerations, setLocalGenerations] = useState<Generation[]>(allGenerations);

  // Keep localGenerations in sync when parent prop changes (e.g. new gallery data)
  useEffect(() => {
    setLocalGenerations(allGenerations);
  }, [allGenerations]);

  // ---------------------------------------------------------------------------
  // Model Slots: fetch once on mount, cache in local state (AC-1, AC-2)
  // ---------------------------------------------------------------------------
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>([]);

  const loadModelSlots = useCallback(() => {
    getModelSlots()
      .then((result) => {
        if ("error" in result) return;
        setModelSlots(result);
      })
      .catch((err) => {
        console.error("Failed to fetch model slots:", err);
      });
  }, []);

  useEffect(() => {
    loadModelSlots();
    window.addEventListener("model-slots-changed", loadModelSlots);
    return () => {
      window.removeEventListener("model-slots-changed", loadModelSlots);
    };
  }, [loadModelSlots]);

  // ---------------------------------------------------------------------------
  // Models: fetch once on mount for popover dropdowns (AC-11)
  // ---------------------------------------------------------------------------
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    getModels({})
      .then((result) => {
        if ("error" in result) return;
        setModels(result);
      })
      .catch((err) => {
        console.error("Failed to fetch models:", err);
      });
  }, []);

  // ---------------------------------------------------------------------------
  // Image ref for MaskCanvas overlay — resolved from DOM after CanvasImage mount
  // ---------------------------------------------------------------------------
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;
    const img = container.querySelector<HTMLImageElement>('[data-testid="canvas-image"]');
    imageRef.current = img;
  });

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
      localGenerations.find((g) => g.id === state.currentGenerationId) ??
      generation
    );
  }, [localGenerations, state.currentGenerationId, generation]);

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handleNavigate = useCallback(
    (id: string) => {
      dispatch({ type: "SET_CURRENT_IMAGE", generationId: id, source: "navigation" });
    },
    [dispatch]
  );

  const handleSiblingSelect = useCallback(
    (id: string) => {
      dispatch({ type: "SET_CURRENT_IMAGE", generationId: id, source: "sibling" });
    },
    [dispatch]
  );

  // ---------------------------------------------------------------------------
  // Swipe navigation: detect horizontal swipe on canvas area
  // ---------------------------------------------------------------------------

  const touchStartXRef = useRef<number | null>(null);

  const currentIndex = useMemo(
    () => localGenerations.findIndex((g) => g.id === state.currentGenerationId),
    [localGenerations, state.currentGenerationId]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartXRef.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartXRef.current;
      touchStartXRef.current = null;

      const SWIPE_THRESHOLD = 50;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;

      if (delta > 0 && currentIndex > 0) {
        // Swipe right → prev (newer)
        handleNavigate(localGenerations[currentIndex - 1].id);
      } else if (delta < 0 && currentIndex >= 0 && currentIndex < localGenerations.length - 1) {
        // Swipe left → next (older)
        handleNavigate(localGenerations[currentIndex + 1].id);
      }
    },
    [currentIndex, localGenerations, handleNavigate]
  );

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    const result = await deleteGeneration({ id: state.currentGenerationId });
    if ("error" in result) {
      toast.error(result.error);
    } else if (result.success) {
      onBack();
    } else {
      toast.error("Loeschen fehlgeschlagen");
    }
  }, [state.currentGenerationId, onBack]);

  // ---------------------------------------------------------------------------
  // Erase action: forwarded to FloatingBrushToolbar, connected in later slices
  // ---------------------------------------------------------------------------

  const handleEraseAction = useCallback(() => {
    onEraseAction?.();
  }, [onEraseAction]);

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
        const fetchResult = await fetchGenerations(projectId);

        if (cancelled) return;
        if (!Array.isArray(fetchResult)) return;

        const results = fetchResult;

        // Read current pending IDs from ref (not stale closure state)
        const currentPending = [...pendingGenerationIdsRef.current];
        const resolvedIds: string[] = [];

        // Process ALL completed/failed generations in a single poll cycle
        for (const pendingId of currentPending) {
          const gen = results.find((g) => g.id === pendingId);
          if (!gen) continue;

          if (gen.status === "completed") {
            // Add newly completed generation to local state so
            // currentGeneration memo can find it immediately
            setLocalGenerations(prev => {
              if (prev.some(g => g.id === gen.id)) return prev;
              return [gen, ...prev];
            });
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

      // AC-4: Use modelIds from params directly (no tier-based lookup)
      const modelIds = params.modelIds.length > 0
        ? params.modelIds
        : [currentGeneration.modelId];
      const promptStrength =
        VARIATION_STRENGTH_MAP[params.strength ?? "balanced"] ?? 0.6;

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        const result = await generateImages({
          projectId: currentGeneration.projectId,
          promptMotiv: params.prompt,
          modelIds,
          params: { prompt_strength: promptStrength, ...(params.imageParams ?? {}) },
          count: params.count,
          generationMode: "img2img",
          sourceImageUrl: currentGeneration.imageUrl ?? undefined,
          sourceGenerationId: currentGeneration.id,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        // Notify parent so gallery state stays in sync
        onGenerationsCreated?.(result);

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
    [state.isGenerating, currentGeneration, dispatch, setPendingGenerationIds, onGenerationsCreated]
  );

  // ---------------------------------------------------------------------------
  // AC-2: img2img popover -> generateImages()
  // ---------------------------------------------------------------------------

  const handleImg2imgGenerate = useCallback(
    async (params: Img2imgParams) => {
      if (state.isGenerating) return;

      // AC-6: Use modelIds from params directly (no tier-based lookup)
      const modelIds = params.modelIds.length > 0
        ? params.modelIds
        : [currentGeneration.modelId];

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        // Upload blob: URLs to R2 before sending to Replicate.
        // The img2img popover creates blob: URLs for local file uploads,
        // but Replicate requires publicly accessible https: URLs.
        const resolvedRefs = await Promise.all(
          params.references.map(async (ref) => {
            if (ref.imageUrl.startsWith("blob:")) {
              const response = await fetch(ref.imageUrl);
              const blob = await response.blob();
              const file = new File([blob], "reference.png", { type: blob.type || "image/png" });
              const uploadResult = await uploadReferenceImage({
                projectId: currentGeneration.projectId,
                file,
              });
              if ("error" in uploadResult) {
                throw new Error(uploadResult.error);
              }
              return { ...ref, imageUrl: uploadResult.imageUrl, uploadedId: uploadResult.id };
            }
            return ref;
          })
        );

        // Map references to the server action format, using real IDs from upload.
        // Auto-include the current canvas image as the first reference (slot 0),
        // so img2img in the canvas always uses the displayed image as context.
        const manualRefs = resolvedRefs.map((ref, index) => ({
          referenceImageId: ("uploadedId" in ref && ref.uploadedId) ? ref.uploadedId : `ref-${index + 1}`,
          imageUrl: ref.imageUrl,
          role: ref.role,
          strength: ref.strength,
          slotPosition: index + 1,
        }));

        // Create a reference_images DB record for the current canvas image
        // so the FK constraint on generation_references is satisfied.
        let canvasRef: typeof manualRefs | undefined;
        if (currentGeneration.imageUrl) {
          const galleryResult = await addGalleryAsReference({
            projectId: currentGeneration.projectId,
            generationId: currentGeneration.id,
            imageUrl: currentGeneration.imageUrl,
          });
          if (!("error" in galleryResult)) {
            canvasRef = [{
              referenceImageId: galleryResult.id,
              imageUrl: currentGeneration.imageUrl,
              role: "content",
              strength: "strong",
              slotPosition: 0,
            }];
          }
        }

        const references = [
          ...(canvasRef ?? []),
          ...manualRefs,
        ];

        const result = await generateImages({
          projectId: currentGeneration.projectId,
          promptMotiv: params.motiv,
          modelIds,
          params: { ...(params.imageParams ?? {}) },
          count: params.variants,
          generationMode: "img2img",
          sourceGenerationId: currentGeneration.id,
          references:
            references.length > 0 ? references : undefined,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        // Notify parent so gallery state stays in sync
        onGenerationsCreated?.(result);

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
    [state.isGenerating, currentGeneration, dispatch, setPendingGenerationIds, onGenerationsCreated]
  );

  // ---------------------------------------------------------------------------
  // AC-3: Upscale popover -> upscaleImage()
  // ---------------------------------------------------------------------------

  const handleUpscale = useCallback(
    async (params: { scale: 2 | 4; modelIds?: string[]; tier?: string }) => {
      if (state.isGenerating) return;
      if (!currentGeneration.imageUrl) {
        toast.error("Kein Bild zum Hochskalieren vorhanden.");
        return;
      }

      // AC-8: Use first modelId from params; resolve modelParams from modelSlots
      const resolvedModelId = params.modelIds?.[0] ?? currentGeneration.modelId;
      const matchingSlot = modelSlots.find(
        (s) => s.mode === "upscale" && s.modelId === resolvedModelId
      );
      const resolvedModelParams = (matchingSlot?.modelParams ?? {}) as Record<string, unknown>;

      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        const result = await upscaleImage({
          projectId: currentGeneration.projectId,
          sourceImageUrl: currentGeneration.imageUrl,
          scale: params.scale,
          sourceGenerationId: currentGeneration.id,
          modelId: resolvedModelId,
          modelParams: resolvedModelParams,
        });

        if ("error" in result) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          toast.error(result.error);
          return;
        }

        // Notify parent so gallery state stays in sync
        onGenerationsCreated?.([result]);

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
    [state.isGenerating, modelSlots, currentGeneration, dispatch, setPendingGenerationIds, onGenerationsCreated]
  );

  // ---------------------------------------------------------------------------
  // Determine if upscale should be disabled (simple size heuristic)
  // ---------------------------------------------------------------------------

  const isUpscaleDisabled = false; // Basic: always allow upscale; real check could use image dimensions

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex h-full w-full flex-col"
      data-testid="canvas-detail-view"
    >
      {/* Header */}
      <CanvasHeader
        onBack={onBack}
        undoRedoSlot={undoRedoSlot}
      >
        {chatSlot && (
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
        )}
      </CanvasHeader>

      {/* Body: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbar slot */}
        <aside
          className="relative flex h-full shrink-0 flex-col border-r border-border/80 bg-card"
          data-testid="toolbar-slot"
        >
          {toolbarSlot ?? (
            <CanvasToolbar
              generation={currentGeneration}
              onDelete={handleDelete}
            />
          )}
        </aside>

        {/* Center: Canvas area (flex: 1) */}
        <main
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40"
          data-testid="canvas-area"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Popovers anchored to left edge of canvas (next to toolbar) */}
          <VariationPopover
            generation={currentGeneration}
            onGenerate={handleVariationGenerate}
            modelSlots={modelSlots}
            models={models}
          />
          <Img2imgPopover
            onGenerate={handleImg2imgGenerate}
            modelSlots={modelSlots}
            models={models}
          />
          <UpscalePopover
            onUpscale={handleUpscale}
            isUpscaleDisabled={isUpscaleDisabled}
            modelSlots={modelSlots}
            models={models}
          />
          {/* Details overlay (push-down layout) */}
          <DetailsOverlay generation={currentGeneration} />

          {/* Prev/Next navigation — positioned relative to <main> for stable centering */}
          <CanvasNavigation
            allGenerations={localGenerations}
            currentGenerationId={state.currentGenerationId}
            onNavigate={handleNavigate}
          />

          {/* Floating Brush Toolbar — positioned absolute top-center inside main */}
          <FloatingBrushToolbar onEraseAction={handleEraseAction} />

          {/* Image + Mask overlay */}
          <div
            ref={imageContainerRef}
            className="relative flex min-h-0 flex-1 items-center justify-center p-4"
          >
            <CanvasImage
              generation={currentGeneration}
              isLoading={state.isGenerating}
            />
            <MaskCanvas imageRef={imageRef} />
          </div>

          {/* Sibling thumbnails below the image */}
          <SiblingThumbnails
            batchId={currentGeneration.batchId}
            sourceGenerationId={currentGeneration.sourceGenerationId}
            currentGenerationId={state.currentGenerationId}
            onSelect={handleSiblingSelect}
          />
        </main>

        {/* Right: Chat panel — uses currentGeneration so context updates on Prev/Next */}
        {chatOpen && (
          <aside className="flex shrink-0 overflow-hidden p-3 pl-0" data-testid="chat-slot">
            <div className="flex h-full overflow-hidden rounded-xl border border-border/80 shadow-sm">
              {chatSlot ?? (
                <CanvasChatPanel
                  generation={currentGeneration}
                  projectId={currentGeneration.projectId}
                  onPendingGenerations={setPendingGenerationIds}
                  onGenerationsCreated={onGenerationsCreated}
                  modelSlots={modelSlots}
                  models={models}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
