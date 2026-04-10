"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode, type RefCallback } from "react";
import { PanelRightClose, PanelRightOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
import { OutpaintControls } from "@/components/canvas/outpaint-controls";
import { useCanvasZoom } from "@/lib/hooks/use-canvas-zoom";
import { generateImages, upscaleImage, fetchGenerations } from "@/app/actions/generations";
import { deleteGeneration } from "@/app/actions/generations";
import { getModelSlots } from "@/app/actions/model-slots";
import { getModels } from "@/app/actions/models";
import { uploadReferenceImage, addGalleryAsReference } from "@/app/actions/references";
import { uploadMask } from "@/app/actions/upload";
import {
  validateMinSize,
  applyFeathering,
  scaleToOriginal,
  toGrayscalePng,
} from "@/lib/services/mask-service";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
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
  // Image ref for MaskCanvas overlay + Zoom hook
  // ---------------------------------------------------------------------------
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const transformWrapperRef = useRef<HTMLDivElement | null>(null);

  // Callback ref for CanvasImage forwardRef — keeps imageRef in sync
  const canvasImageRefCallback: RefCallback<HTMLImageElement> = useCallback((el) => {
    imageRef.current = el;
  }, []);

  // ---------------------------------------------------------------------------
  // Zoom Hook — integrates with container + image refs
  // ---------------------------------------------------------------------------
  // Result stored for later slices (03–08) to destructure as needed.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const canvasZoom = useCanvasZoom(imageContainerRef, imageRef);

  // ---------------------------------------------------------------------------
  // Click-to-Edit (SAM) state — local component state per spec constraints
  // ---------------------------------------------------------------------------
  const [isSamLoading, setIsSamLoading] = useState(false);
  const [showMaskConfirmDialog, setShowMaskConfirmDialog] = useState(false);
  const pendingClickCoordsRef = useRef<{ click_x: number; click_y: number } | null>(null);

  /** Whether the click-edit tool is currently active in the toolbar */
  const isClickEditActive = state.activeToolId === "click-edit";

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
      // Block swipe navigation when a mask exists (same lock as button navigation)
      if (state.maskData !== null) {
        touchStartXRef.current = null;
        return;
      }
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
    [currentIndex, localGenerations, handleNavigate, state.maskData]
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
  // Erase action: mask pipeline + direct generateImages() call (no SSE/Agent)
  // AC-1: Mask export pipeline -> R2 upload -> generateImages(mode: "erase")
  // AC-2: PUSH_UNDO + SET_CURRENT_IMAGE handled by existing polling logic
  // AC-3: Toast on mask too small
  // AC-6: Toast on R2 upload failure
  // ---------------------------------------------------------------------------

  const handleEraseAction = useCallback(async () => {
    // AC-4: No mask -> button should be disabled, but guard anyway
    if (!state.maskData) return;
    if (state.isGenerating) return;

    dispatch({ type: "SET_GENERATING", isGenerating: true });

    try {
      // Step 1: Validate minimum size (10px bounding box) -- AC-3
      const validation = validateMinSize(state.maskData, 10);
      if (!validation.valid) {
        toast.error("Markiere einen groesseren Bereich");
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        return;
      }

      // Step 2: Apply feathering (10px Gaussian blur)
      const feathered = applyFeathering(state.maskData, 10);

      // Step 3: Scale to original image dimensions
      const originalWidth = currentGeneration.width ?? state.maskData.width;
      const originalHeight = currentGeneration.height ?? state.maskData.height;
      const scaled = scaleToOriginal(feathered, originalWidth, originalHeight);

      // Step 4: Convert to grayscale PNG
      const pngBlob = await toGrayscalePng(scaled);

      // Step 5: Upload to R2 via FormData -- AC-6
      const formData = new FormData();
      formData.append("mask", new File([pngBlob], "mask.png", { type: "image/png" }));
      const uploadResult = await uploadMask(formData);
      if ("error" in uploadResult) {
        toast.error("Mask-Upload fehlgeschlagen");
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        return;
      }

      const maskUrl = uploadResult.url;
      const sourceImageUrl = currentGeneration.imageUrl ?? undefined;

      // Resolve model from active erase slots.
      // Fallback to bria/eraser — NOT the original generation model,
      // which likely doesn't support mask-based erasing.
      const ERASE_FALLBACK_MODEL = "bria/eraser";
      const activeSlots = resolveActiveSlots(modelSlots, "erase");
      const modelIds = activeSlots.length > 0
        ? activeSlots.map((s) => s.modelId)
        : [ERASE_FALLBACK_MODEL];

      // Step 6: Call generateImages() directly -- AC-1 (no SSE/Agent)
      const result = await generateImages({
        projectId: currentGeneration.projectId,
        promptMotiv: "erase",
        modelIds,
        params: activeSlots.length > 0 ? { ...activeSlots[0].modelParams } : {},
        count: 1,
        generationMode: "erase",
        sourceImageUrl,
        maskUrl,
        sourceGenerationId: currentGeneration.id,
      });

      if ("error" in result) {
        toast.error(result.error);
        dispatch({ type: "SET_GENERATING", isGenerating: false });
        return;
      }

      // Notify parent so gallery state stays in sync
      onGenerationsCreated?.(result);

      // Start polling for pending generations -- AC-2 handled by poll logic
      const pendingIds = result
        .filter((g) => g.status === "pending")
        .map((g) => g.id);
      if (pendingIds.length > 0) {
        setPendingGenerationIds(pendingIds);
      } else {
        dispatch({ type: "SET_GENERATING", isGenerating: false });
      }
    } catch (error) {
      console.error("Erase action error:", error);
      dispatch({ type: "SET_GENERATING", isGenerating: false });
      toast.error("Erase fehlgeschlagen.");
    }
  }, [state.maskData, state.isGenerating, currentGeneration, modelSlots, dispatch, setPendingGenerationIds, onGenerationsCreated]);

  // ---------------------------------------------------------------------------
  // Click-to-Edit: SAM API call + mask loading
  // ---------------------------------------------------------------------------

  /**
   * Loads a mask PNG from a URL into ImageData by drawing it onto an
   * offscreen canvas, then returns the pixel data.
   */
  const loadMaskImageData = useCallback(async (maskUrl: string): Promise<ImageData> => {
    return new Promise<ImageData>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas 2d context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Convert grayscale SAM mask to red semi-transparent overlay (AC-4).
        // SAM mask: white (255) = masked area, black (0) = unmasked.
        // Target: masked pixels -> rgba(255, 0, 0, 128), unmasked -> rgba(0, 0, 0, 0).
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
          // Use the red channel as luminance proxy (grayscale R==G==B)
          const luminance = pixels[i];
          if (luminance > 127) {
            pixels[i] = 255;     // R
            pixels[i + 1] = 0;   // G
            pixels[i + 2] = 0;   // B
            pixels[i + 3] = 128; // A (50% opacity)
          } else {
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
            pixels[i + 3] = 0;   // fully transparent
          }
        }

        resolve(imageData);
      };
      img.onerror = () => reject(new Error("Failed to load mask image"));
      img.src = maskUrl;
    });
  }, []);

  /**
   * Calls POST /api/sam/segment with the given normalized coordinates,
   * loads the returned mask, and transitions to inpaint painting mode.
   */
  const executeSamSegment = useCallback(async (click_x: number, click_y: number) => {
    const currentImageUrl = currentGeneration.imageUrl;
    if (!currentImageUrl) return;

    setIsSamLoading(true);

    try {
      const response = await fetch("/api/sam/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: currentImageUrl,
          click_x,
          click_y,
        }),
      });

      if (response.status === 422) {
        toast.error("Kein Objekt erkannt. Versuche einen anderen Punkt.");
        setIsSamLoading(false);
        return;
      }

      if (!response.ok) {
        toast.error("SAM-Fehler. Versuche manuelles Maskieren.");
        setIsSamLoading(false);
        return;
      }

      const data = await response.json();
      const maskUrl: string = data.mask_url;

      // Load mask PNG into ImageData
      const maskImageData = await loadMaskImageData(maskUrl);

      // Dispatch mask data and transition to inpaint painting mode
      dispatch({ type: "SET_MASK_DATA", maskData: maskImageData });
      dispatch({ type: "SET_EDIT_MODE", editMode: "inpaint" });
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: "brush-edit" });
    } catch {
      toast.error("SAM-Fehler. Versuche manuelles Maskieren.");
    } finally {
      setIsSamLoading(false);
    }
  }, [currentGeneration.imageUrl, dispatch, loadMaskImageData]);

  /**
   * Click handler on the image area when click-edit tool is active.
   * Computes normalized coordinates and triggers the SAM flow.
   */
  const handleClickEditImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only active when click-edit tool is selected
      if (!isClickEditActive) return;

      // Ignore clicks while SAM is loading
      if (isSamLoading) return;

      // Find the actual image element to compute coordinates relative to it
      const container = imageContainerRef.current;
      if (!container) return;

      const imgElement = container.querySelector<HTMLImageElement>('[data-testid="canvas-image"]');
      if (!imgElement) return;

      const rect = imgElement.getBoundingClientRect();
      const zoom = state.zoomLevel;

      // When the image sits inside a CSS transform: scale(zoomLevel)
      // wrapper, getBoundingClientRect() returns the *visually scaled*
      // bounding box. Dividing by zoomLevel converts the pixel offset
      // back to the un-transformed image coordinate space.
      const offsetX = (e.clientX - rect.left) / zoom;
      const offsetY = (e.clientY - rect.top) / zoom;

      // Bounds check uses the un-transformed image dimensions
      // (naturalWidth/naturalHeight) so that clicks outside the actual
      // image area are correctly rejected at any zoom level.
      const naturalW = imgElement.naturalWidth;
      const naturalH = imgElement.naturalHeight;
      if (offsetX < 0 || offsetY < 0 || offsetX > naturalW || offsetY > naturalH) return;

      // Normalize to 0..1 range using natural (un-scaled) dimensions
      const click_x = offsetX / naturalW;
      const click_y = offsetY / naturalH;

      // If there's existing mask data, show confirmation dialog
      if (state.maskData !== null) {
        pendingClickCoordsRef.current = { click_x, click_y };
        setShowMaskConfirmDialog(true);
        return;
      }

      executeSamSegment(click_x, click_y);
    },
    [isClickEditActive, isSamLoading, state.maskData, state.zoomLevel, executeSamSegment]
  );

  /** Confirmation dialog: user chose to replace existing mask */
  const handleMaskReplaceConfirm = useCallback(() => {
    setShowMaskConfirmDialog(false);
    dispatch({ type: "SET_MASK_DATA", maskData: null });
    const coords = pendingClickCoordsRef.current;
    if (coords) {
      pendingClickCoordsRef.current = null;
      executeSamSegment(coords.click_x, coords.click_y);
    }
  }, [dispatch, executeSamSegment]);

  /** Confirmation dialog: user chose to keep existing mask */
  const handleMaskReplaceCancel = useCallback(() => {
    setShowMaskConfirmDialog(false);
    pendingClickCoordsRef.current = null;
  }, []);

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
          {/* Navigation disabled when a mask exists to prevent losing unsaved mask work */}
          <CanvasNavigation
            allGenerations={localGenerations}
            currentGenerationId={state.currentGenerationId}
            onNavigate={handleNavigate}
            disabled={state.maskData !== null}
          />

          {/* Floating Brush Toolbar — positioned absolute top-center inside main */}
          {/* Hidden during click-edit mode (before SAM response) per AC-1 */}
          {/* Hidden during outpaint mode — outpaint has its own controls (Slice 13 AC-1) */}
          {!isClickEditActive && state.editMode !== "outpaint" && (
            <FloatingBrushToolbar onEraseAction={handleEraseAction} />
          )}

          {/* Image + Mask overlay */}
          <div
            ref={imageContainerRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
            style={isClickEditActive ? { cursor: "crosshair" } : undefined}
            onClick={handleClickEditImageClick}
            data-testid="canvas-image-area"
          >
            {/* Zoom Transform Wrapper — scales CanvasImage + MaskCanvas + OutpaintControls together */}
            <div
              ref={transformWrapperRef}
              style={{
                transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomLevel})`,
                transformOrigin: "0 0",
                willChange: "transform",
              }}
              data-testid="zoom-transform-wrapper"
            >
              <CanvasImage
                ref={canvasImageRefCallback}
                generation={currentGeneration}
                isLoading={state.isGenerating}
              />
              {/* MaskCanvas hidden during outpaint mode (Slice 13 AC-1) */}
              {state.editMode !== "outpaint" && (
                <MaskCanvas imageRef={imageRef} />
              )}

              {/* OutpaintControls visible only in outpaint mode (Slice 13 AC-1, AC-2) */}
              {state.editMode === "outpaint" && (
                <OutpaintControls />
              )}
            </div>

            {/* SAM loading spinner overlay — AC-3 */}
            {isSamLoading && (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
                data-testid="sam-loading-overlay"
              >
                <Loader2 className="size-8 animate-spin text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Objekt wird erkannt...
                </span>
              </div>
            )}
          </div>

          {/* Confirmation dialog: replace existing mask — AC-5/6/7 */}
          <ConfirmDialog
            open={showMaskConfirmDialog}
            title="Maske ersetzen"
            description="Diese Aktion ersetzt deine aktuelle Maske. Fortfahren?"
            confirmLabel="Ersetzen"
            cancelLabel="Abbrechen"
            onConfirm={handleMaskReplaceConfirm}
            onCancel={handleMaskReplaceCancel}
          />

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
