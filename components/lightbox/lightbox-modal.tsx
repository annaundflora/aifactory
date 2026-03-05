"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { type Generation } from "@/lib/db/queries";
import { getModelById } from "@/lib/models";
import { downloadImage, generateDownloadFilename } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LightboxModalProps {
  generation: Generation;
  isOpen: boolean;
  onClose: () => void;
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
}: LightboxModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col gap-6 rounded-lg bg-background p-6 shadow-2xl md:flex-row"
        data-testid="lightbox-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="absolute right-3 top-3 z-10 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
          data-testid="lightbox-close"
        >
          <X className="size-5" />
        </button>

        {/* Large Image */}
        <div className="flex flex-1 items-center justify-center overflow-hidden">
          {generation.imageUrl ? (
            <Image
              src={generation.imageUrl}
              alt={generation.prompt}
              width={generation.width ?? 512}
              height={generation.height ?? 512}
              className="max-h-[70vh] w-auto rounded object-contain"
              data-testid="lightbox-image"
              priority
            />
          ) : (
            <div className="flex size-64 items-center justify-center rounded bg-muted text-muted-foreground">
              No image
            </div>
          )}
        </div>

        {/* Detail Panel */}
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
            <div className="pt-2">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
