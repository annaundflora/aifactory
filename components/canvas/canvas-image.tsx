"use client";

import { useState, useCallback, useEffect } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasImageProps {
  generation: Generation;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// CanvasImage
// ---------------------------------------------------------------------------

/**
 * Displays the current main image centered with object-contain (max-fit).
 * Shows a loading indicator while the image is loading and an error placeholder
 * when the image URL is invalid or loading fails.
 */
export function CanvasImage({ generation, isLoading = false }: CanvasImageProps) {
  const [imgState, setImgState] = useState<"loading" | "loaded" | "error">(
    generation.imageUrl ? "loading" : "error"
  );

  // Reset image state when the generation changes (e.g. sibling navigation)
  useEffect(() => {
    setImgState(generation.imageUrl ? "loading" : "error");
  }, [generation.id]);

  const handleLoad = useCallback(() => {
    setImgState("loaded");
  }, []);

  const handleError = useCallback(() => {
    setImgState("error");
  }, []);

  // No image URL at all
  if (!generation.imageUrl) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-muted-foreground"
        data-testid="canvas-image-error"
      >
        <ImageOff className="size-12 opacity-50" />
        <span className="text-sm">Kein Bild verfuegbar</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center" data-testid="canvas-image-container">
      {/* Loading indicator: shown while image is loading or external isLoading prop */}
      {(imgState === "loading" || isLoading) && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          data-testid="canvas-image-loading"
        >
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {imgState === "error" && (
        <div
          className="flex flex-col items-center justify-center gap-2 text-muted-foreground"
          data-testid="canvas-image-error"
        >
          <ImageOff className="size-12 opacity-50" />
          <span className="text-sm">Bild konnte nicht geladen werden</span>
        </div>
      )}

      {/* The actual image (hidden while loading, visible once loaded) */}
      {imgState !== "error" && (
        <img
          src={generation.imageUrl}
          alt={generation.prompt || "Generated image"}
          className={`max-h-full max-w-full object-contain transition-opacity ${
            imgState === "loaded" && !isLoading ? "opacity-100" : "opacity-0"
          }`}
          style={{ viewTransitionName: `canvas-image-${generation.id}` }}
          onLoad={handleLoad}
          onError={handleError}
          data-testid="canvas-image"
        />
      )}
    </div>
  );
}
