"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Predefined zoom steps for button/keyboard zoom navigation */
const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0] as const;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

/** Maximum fit level — image is never upscaled beyond 100% at fit */
const FIT_LEVEL_MAX = 1.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCanvasZoomReturn {
  /** The computed fit level (how big the image should be to fit the container) */
  fitLevel: number;
  /**
   * Zoom to a specific level with anchor point at the given container coordinates.
   * Uses the anchor-point formula: newPan = cursor - imageCoord * newZoom
   */
  zoomToPoint: (newZoom: number, cursorX: number, cursorY: number) => void;
  /**
   * Step zoom in or out using predefined zoom steps.
   * Anchor is always the container center.
   */
  zoomToStep: (direction: "in" | "out") => void;
  /**
   * Reset zoom to fit level and pan to (0, 0).
   */
  resetToFit: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook that manages zoom calculations for the canvas.
 *
 * Responsibilities:
 * - Dynamically calculate fit level using ResizeObserver on the container
 * - Anchor-point zoom math (zoom towards cursor position)
 * - Zoom step navigation (predefined steps)
 * - Reset to fit
 *
 * Does NOT handle event listeners (those come in Slice 4/5/7).
 */
export function useCanvasZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  imageRef: React.RefObject<HTMLImageElement | null>
): UseCanvasZoomReturn {
  const { state, dispatch } = useCanvasDetail();
  const [fitLevel, setFitLevel] = useState<number>(1.0);

  // Track whether we are "following" fit level (i.e., user hasn't manually zoomed)
  const isFollowingFitRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Fit-Level Calculation with ResizeObserver
  // ---------------------------------------------------------------------------

  const calculateFitLevel = useCallback(() => {
    const container = containerRef.current;
    const img = imageRef.current;
    if (!container || !img) return null;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    if (imageWidth === 0 || imageHeight === 0) return null;

    const rawFit = Math.min(
      containerWidth / imageWidth,
      containerHeight / imageHeight
    );

    // Clamp: fit level never exceeds 1.0 (don't upscale small images)
    return Math.min(rawFit, FIT_LEVEL_MAX);
  }, [containerRef, imageRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const newFit = calculateFitLevel();
      if (newFit === null) return;

      setFitLevel((prevFit) => {
        // If the user's current zoom matches the old fit level, follow the new fit
        if (isFollowingFitRef.current || state.zoomLevel === prevFit) {
          isFollowingFitRef.current = true;
          dispatch({
            type: "SET_ZOOM_PAN",
            zoomLevel: newFit,
            panX: 0,
            panY: 0,
          });
        }
        return newFit;
      });
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    // Initial calculation
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, [containerRef, calculateFitLevel, dispatch, state.zoomLevel]);

  // Recalculate fit level when image loads (naturalWidth/Height become available)
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const handleImageLoad = () => {
      const newFit = calculateFitLevel();
      if (newFit === null) return;
      setFitLevel(newFit);
      // When image changes, reset to fit
      isFollowingFitRef.current = true;
      dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: newFit,
        panX: 0,
        panY: 0,
      });
    };

    img.addEventListener("load", handleImageLoad);

    // If image is already loaded, calculate immediately
    if (img.complete && img.naturalWidth > 0) {
      handleImageLoad();
    }

    return () => {
      img.removeEventListener("load", handleImageLoad);
    };
  }, [imageRef, calculateFitLevel, dispatch]);

  // ---------------------------------------------------------------------------
  // Anchor-Point Zoom
  // ---------------------------------------------------------------------------

  const zoomToPoint = useCallback(
    (newZoom: number, cursorX: number, cursorY: number) => {
      const clampedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
      const { zoomLevel: oldZoom, panX, panY } = state;

      // Point under cursor in image coordinates (before zoom)
      const imageX = (cursorX - panX) / oldZoom;
      const imageY = (cursorY - panY) / oldZoom;

      // After zoom: same image point under cursor
      const newPanX = cursorX - imageX * clampedZoom;
      const newPanY = cursorY - imageY * clampedZoom;

      isFollowingFitRef.current = clampedZoom === fitLevel;

      dispatch({
        type: "SET_ZOOM_PAN",
        zoomLevel: clampedZoom,
        panX: newPanX,
        panY: newPanY,
      });
    },
    [state, fitLevel, dispatch]
  );

  // ---------------------------------------------------------------------------
  // Step Zoom (Button/Keyboard)
  // ---------------------------------------------------------------------------

  const zoomToStep = useCallback(
    (direction: "in" | "out") => {
      const currentZoom = state.zoomLevel;
      let targetZoom: number;

      if (direction === "in") {
        // Find next step above current
        const nextStep = ZOOM_STEPS.find((s) => s > currentZoom + 0.001);
        if (nextStep === undefined) return; // Already at max
        targetZoom = nextStep;
      } else {
        // Find next step below current
        const steps = [...ZOOM_STEPS];
        steps.reverse();
        const prevStep = steps.find((s) => s < currentZoom - 0.001);
        if (prevStep === undefined) return; // Already at min
        targetZoom = prevStep;
      }

      // Use container center as anchor
      const container = containerRef.current;
      if (!container) {
        // Fallback: just set zoom without pan adjustment
        isFollowingFitRef.current = targetZoom === fitLevel;
        dispatch({
          type: "SET_ZOOM_PAN",
          zoomLevel: targetZoom,
          panX: state.panX,
          panY: state.panY,
        });
        return;
      }

      const centerX = container.clientWidth / 2;
      const centerY = container.clientHeight / 2;

      zoomToPoint(targetZoom, centerX, centerY);
    },
    [state, containerRef, fitLevel, dispatch, zoomToPoint]
  );

  // ---------------------------------------------------------------------------
  // Reset to Fit
  // ---------------------------------------------------------------------------

  const resetToFit = useCallback(() => {
    isFollowingFitRef.current = true;
    dispatch({
      type: "SET_ZOOM_PAN",
      zoomLevel: fitLevel,
      panX: 0,
      panY: 0,
    });
  }, [fitLevel, dispatch]);

  return {
    fitLevel,
    zoomToPoint,
    zoomToStep,
    resetToFit,
  };
}
