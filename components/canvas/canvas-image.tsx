"use client";

import { useState, useCallback, useEffect, forwardRef } from "react";
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
 * Displays the current main image at its natural dimensions.
 * The parent transform wrapper handles scaling via CSS transform.
 * Shows a loading indicator while the image is loading and an error placeholder
 * when the image URL is invalid or loading fails.
 *
 * Uses forwardRef so parent components (useCanvasZoom) can access
 * naturalWidth/naturalHeight on the <img> element.
 */
export const CanvasImage = forwardRef<HTMLImageElement, CanvasImageProps>(
  function CanvasImage({ generation, isLoading = false }, ref) {
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
      <div className="relative" data-testid="canvas-image-container">
        {/* Generation overlay: semi-transparent with "Generating" text + spinner (AC-4) */}
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm"
            data-testid="canvas-image-generating-overlay"
          >
            <Loader2 className="size-8 animate-spin text-foreground" />
            <span className="text-sm font-medium text-foreground">
              Generating
            </span>
          </div>
        )}

        {/* Loading indicator: shown while image is initially loading (not generation) */}
        {imgState === "loading" && (
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

        {/* The actual image — uses natural dimensions; transform wrapper handles scaling */}
        {imgState !== "error" && (
          <img
            ref={ref}
            src={generation.imageUrl}
            alt={generation.prompt || "Generated image"}
            crossOrigin="anonymous"
            className={`block transition-opacity ${
              imgState === "loaded" ? "opacity-100" : "opacity-0"
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
);
