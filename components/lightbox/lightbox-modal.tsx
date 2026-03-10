"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ArrowRightLeft, Copy, Download, Loader2, Maximize2, Minimize2, Trash2, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { type Generation } from "@/lib/db/queries";
import { getModelById } from "@/lib/models";
import { downloadImage, generateDownloadFilename } from "@/lib/utils";
import { useWorkspaceVariation } from "@/lib/workspace-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteGeneration, upscaleImage } from "@/app/actions/generations";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LightboxModalProps {
  generation: Generation;
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatModelParams(params: unknown): string | null {
  if (!params || typeof params !== "object") return null;
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined
  );
  if (entries.length === 0) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

// ---------------------------------------------------------------------------
// LightboxModal
// ---------------------------------------------------------------------------

export function LightboxModal({
  generation,
  isOpen,
  onClose,
  onDeleted,
}: LightboxModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscalePopoverOpen, setUpscalePopoverOpen] = useState(false);
  const { setVariation } = useWorkspaceVariation();

  const isUpscaleMode = generation.generationMode === "upscale";
  const isImg2ImgMode = generation.generationMode === "img2img";

  const handleVariation = useCallback(() => {
    setVariation({
      promptMotiv: generation.prompt,
      negativePrompt: generation.negativePrompt ?? undefined,
      modelId: generation.modelId,
      modelParams: (generation.modelParams ?? {}) as Record<string, unknown>,
      // AC-9: For img2img, use the generation's sourceImageUrl (the original source), not imageUrl
      ...(isImg2ImgMode
        ? { targetMode: "img2img", sourceImageUrl: generation.sourceImageUrl ?? undefined }
        : {}),
    });
    onClose();
  }, [generation, setVariation, onClose, isImg2ImgMode]);

  // AC-4: img2img button handler — sets variation with targetMode img2img and closes lightbox
  const handleImg2Img = useCallback(() => {
    setVariation({
      promptMotiv: generation.prompt,
      negativePrompt: generation.negativePrompt ?? undefined,
      modelId: generation.modelId,
      modelParams: (generation.modelParams ?? {}) as Record<string, unknown>,
      targetMode: "img2img",
      sourceImageUrl: generation.imageUrl ?? undefined,
    });
    onClose();
  }, [generation, setVariation, onClose]);

  // AC-6, AC-7: Upscale handler — calls upscaleImage action with selected scale
  const handleUpscale = useCallback(
    async (scale: 2 | 4) => {
      if (!generation.imageUrl || isUpscaling) return;
      setUpscalePopoverOpen(false);
      setIsUpscaling(true);
      try {
        toast("Upscaling...");
        const result = await upscaleImage({
          projectId: generation.projectId,
          sourceImageUrl: generation.imageUrl,
          scale,
          sourceGenerationId: generation.id,
        });
        // AC-8: Show error toast if upscaleImage returns error
        if ("error" in result) {
          toast.error(result.error);
        }
      } catch {
        toast.error("Upscale fehlgeschlagen");
      } finally {
        setIsUpscaling(false);
      }
    },
    [generation, isUpscaling]
  );

  const handleDownload = useCallback(async () => {
    if (!generation.imageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = generateDownloadFilename(
        generation.prompt,
        generation.createdAt,
      );
      await downloadImage(generation.imageUrl, filename);
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setIsDownloading(false);
    }
  }, [generation.imageUrl, generation.prompt, generation.createdAt, isDownloading]);

  const handleDeleteConfirm = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteGeneration({ id: generation.id });
      if (result.success) {
        setShowDeleteConfirm(false);
        onDeleted?.();
      } else {
        toast.error("Löschen fehlgeschlagen");
        setShowDeleteConfirm(false);
      }
    } catch {
      toast.error("Löschen fehlgeschlagen");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [generation.id, isDeleting, onDeleted]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const model = getModelById(generation.modelId);
  const modelName = model?.displayName ?? generation.modelId;
  const formattedParams = formatModelParams(generation.modelParams);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      data-testid="lightbox-overlay"
      onClick={isFullscreen ? undefined : onClose}
    >
      {/* Modal Content */}
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 flex items-center justify-center bg-black"
            : "relative flex max-h-[90vh] max-w-[90vw] flex-col gap-6 rounded-lg bg-background p-6 shadow-2xl md:flex-row"
        }
        data-testid="lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fullscreen Toggle Button */}
        <button
          className={
            isFullscreen
              ? "absolute right-12 top-3 z-10 rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              : "absolute right-12 top-3 z-10 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          }
          onClick={() => setIsFullscreen((prev) => !prev)}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          data-testid="fullscreen-toggle"
        >
          {isFullscreen ? (
            <Minimize2 className="size-5" />
          ) : (
            <Maximize2 className="size-5" />
          )}
        </button>

        {/* Close Button */}
        <button
          className={
            isFullscreen
              ? "absolute right-3 top-3 z-10 rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              : "absolute right-3 top-3 z-10 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          }
          onClick={onClose}
          aria-label="Close"
          data-testid="lightbox-close"
        >
          <X className="size-5" />
        </button>

        {/* Large Image */}
        <div className={isFullscreen ? "flex w-full h-full items-center justify-center" : "flex flex-1 items-center justify-center overflow-hidden"}>
          {generation.imageUrl ? (
            <Image
              src={generation.imageUrl}
              alt={generation.prompt}
              width={generation.width ?? 512}
              height={generation.height ?? 512}
              className={isFullscreen ? "w-full h-full object-contain" : "max-h-[70vh] w-auto rounded object-contain"}
              data-testid="lightbox-image"
              priority
            />
          ) : (
            <div className="flex size-64 items-center justify-center rounded bg-muted text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Detail Panel — hidden in fullscreen */}
        {!isFullscreen && (
          <div
            className="flex w-full flex-col gap-4 overflow-y-auto md:w-80"
            data-testid="lightbox-details"
          >
            {/* Prompt */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Prompt
              </h3>
              <p className="mt-1 text-sm" data-testid="lightbox-prompt">
                {generation.prompt}
              </p>
            </div>

            {/* Negative Prompt (only if present) */}
            {generation.negativePrompt != null && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Negative Prompt
                </h3>
                <p
                  className="mt-1 text-sm"
                  data-testid="lightbox-negative-prompt"
                >
                  {generation.negativePrompt}
                </p>
              </div>
            )}

            {/* Model */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Model
              </h3>
              <p className="mt-1 text-sm" data-testid="lightbox-model">
                {modelName}
              </p>
            </div>

            {/* Parameters */}
            {formattedParams && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Parameters
                </h3>
                <p className="mt-1 text-sm" data-testid="lightbox-params">
                  {formattedParams}
                </p>
              </div>
            )}

            {/* Dimensions */}
            {generation.width != null && generation.height != null && (
              <div>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  Dimensions
                </h3>
                <p className="mt-1 text-sm" data-testid="lightbox-dimensions">
                  {generation.width} x {generation.height}
                </p>
              </div>
            )}

            {/* Created Date */}
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Created
              </h3>
              <p className="mt-1 text-sm" data-testid="lightbox-created">
                {formatDate(generation.createdAt)}
              </p>
            </div>

            {/* Actions */}
            {generation.imageUrl && (
              <div className="flex flex-col gap-2 pt-2">
                {/* AC-1/2/3: Variation — hidden for upscale mode */}
                {!isUpscaleMode && (
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    onClick={handleVariation}
                    data-testid="variation-btn"
                  >
                    <Copy className="size-4" />
                    Variation
                  </button>
                )}
                {/* AC-1/2/3/4: img2img button — visible for all modes */}
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                  onClick={handleImg2Img}
                  data-testid="img2img-btn"
                >
                  <ArrowRightLeft className="size-4" />
                  img2img
                </button>
                {/* AC-1/2/3/5/6/7: Upscale popover — hidden for upscale mode */}
                {!isUpscaleMode && (
                  <Popover open={upscalePopoverOpen} onOpenChange={setUpscalePopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-50"
                        disabled={isUpscaling}
                        data-testid="upscale-btn"
                      >
                        {isUpscaling ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ZoomIn className="size-4" />
                        )}
                        Upscale
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-2" align="start">
                      <div className="flex flex-col gap-1">
                        <button
                          className="w-full rounded-md px-3 py-2 text-sm font-medium text-left transition-colors hover:bg-muted"
                          onClick={() => handleUpscale(2)}
                          data-testid="upscale-2x-btn"
                        >
                          2x
                        </button>
                        <button
                          className="w-full rounded-md px-3 py-2 text-sm font-medium text-left transition-colors hover:bg-muted"
                          onClick={() => handleUpscale(4)}
                          data-testid="upscale-4x-btn"
                        >
                          4x
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  data-testid="download-btn"
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Download PNG
                </button>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="lightbox-delete-btn"
                >
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Generation"
        description="Are you sure you want to delete this generation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
