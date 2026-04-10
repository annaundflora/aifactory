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
  /**
   * Wheel event handler for the canvas area.
   * Handles Ctrl+Scroll (zoom), plain Scroll (vertical pan), Shift+Scroll (horizontal pan).
   * Must be registered via addEventListener with { passive: false }.
   */
  handleWheel: (e: WheelEvent) => void;
  /**
   * Keydown handler for document-level keyboard shortcuts (+/-/0).
   * Includes isInputFocused guard and isCanvasHovered check.
   */
  handleKeyDown: (e: KeyboardEvent) => void;
  /**
   * Ref tracking whether the mouse is currently over the canvas area.
   * Consumed by slice-05 (Space+Drag) and used internally for keyboard guard.
   */
  isCanvasHoveredRef: React.RefObject<boolean>;
  /**
   * Ref tracking whether the Space key is currently held down (pan mode).
   * Consumed by MaskCanvas to suppress painting and by Touch gestures as a guard.
   */
  isSpaceHeldRef: React.RefObject<boolean>;
  /**
   * Whether a space+drag pan operation is currently in progress.
   * Used by canvas-detail-view for cursor styling (grab vs grabbing).
   */
  isDraggingRef: React.RefObject<boolean>;
  /**
   * Keydown handler for Space key (pan mode activation).
   * Must be registered on document. Includes isInputFocused + isCanvasHovered guards.
   */
  handleSpaceKeyDown: (e: KeyboardEvent) => void;
  /**
   * Keyup handler for Space key (pan mode deactivation).
   * Must be registered on document.
   */
  handleSpaceKeyUp: (e: KeyboardEvent) => void;
  /**
   * PointerDown handler for canvas-area during Space+Drag pan.
   * Starts the drag operation when space is held.
   */
  handlePanPointerDown: (e: PointerEvent) => void;
  /**
   * PointerMove handler for canvas-area during Space+Drag pan.
   * Updates the transform wrapper style directly via ref (no React render).
   */
  handlePanPointerMove: (e: PointerEvent) => void;
  /**
   * PointerUp handler for canvas-area during Space+Drag pan.
   * Dispatches final pan values to reducer and releases pointer capture.
   */
  handlePanPointerUp: (e: PointerEvent) => void;
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
  imageRef: React.RefObject<HTMLImageElement | null>,
  transformWrapperRef?: React.RefObject<HTMLDivElement | null>
): UseCanvasZoomReturn {
  const { state, dispatch } = useCanvasDetail();
  const [fitLevel, setFitLevel] = useState<number>(1.0);

  // Track whether we are "following" fit level (i.e., user hasn't manually zoomed)
  const isFollowingFitRef = useRef(true);

  // Track whether the mouse is hovering over the canvas area (used by keyboard guard + slice-05)
  const isCanvasHoveredRef = useRef(false);

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

  // ---------------------------------------------------------------------------
  // Refs for stable access in event handlers (avoids stale closures)
  // ---------------------------------------------------------------------------

  const stateRef = useRef(state);
  stateRef.current = state;

  const fitLevelRef = useRef(fitLevel);
  fitLevelRef.current = fitLevel;

  const zoomToPointRef = useRef(zoomToPoint);
  zoomToPointRef.current = zoomToPoint;

  const zoomToStepRef = useRef(zoomToStep);
  zoomToStepRef.current = zoomToStep;

  const resetToFitRef = useRef(resetToFit);
  resetToFitRef.current = resetToFit;

  // ---------------------------------------------------------------------------
  // Wheel Handler (Slice 4)
  // Ctrl+Scroll: continuous zoom with cursor anchor
  // Plain Scroll: vertical pan (only when zoomed beyond fit)
  // Shift+Scroll: horizontal pan (only when zoomed beyond fit)
  // ---------------------------------------------------------------------------

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const { zoomLevel, panX, panY } = stateRef.current;
      const currentFitLevel = fitLevelRef.current;

      if (e.ctrlKey || e.metaKey) {
        // Prevent browser zoom
        e.preventDefault();

        // Continuous zoom: newZoom = oldZoom * (1 - deltaY * 0.01)
        const newZoom = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, zoomLevel * (1 - e.deltaY * 0.01))
        );

        // Cursor position relative to the container
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        zoomToPointRef.current(newZoom, cursorX, cursorY);
        return;
      }

      // Pan only when zoomed beyond fit level
      if (Math.abs(zoomLevel - currentFitLevel) < 0.001) return;

      if (e.shiftKey) {
        // Horizontal pan: Shift+Scroll
        e.preventDefault();
        dispatch({
          type: "SET_ZOOM_PAN",
          zoomLevel,
          panX: panX - e.deltaY,
          panY,
        });
      } else {
        // Vertical pan: plain scroll
        dispatch({
          type: "SET_ZOOM_PAN",
          zoomLevel,
          panX,
          panY: panY - e.deltaY,
        });
      }
    },
    [containerRef, dispatch]
  );

  // ---------------------------------------------------------------------------
  // Keyboard Handler (Slice 4)
  // +/= -> zoom in, - -> zoom out, 0 -> reset to fit
  // Guards: isInputFocused() + isCanvasHovered
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Guard: don't trigger when input/textarea/contenteditable is focused
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (el instanceof HTMLElement && el.isContentEditable) return;
      }

      // Guard: only trigger when mouse is over the canvas area
      if (!isCanvasHoveredRef.current) return;

      switch (e.key) {
        case "+":
        case "=":
          e.preventDefault();
          zoomToStepRef.current("in");
          break;
        case "-":
          e.preventDefault();
          zoomToStepRef.current("out");
          break;
        case "0":
          e.preventDefault();
          resetToFitRef.current();
          break;
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Space+Drag Pan (Slice 5)
  // Space key activates pan mode (cursor: grab), pointer drag pans the image
  // via direct DOM manipulation on the transform wrapper (60fps, no React render).
  // Final pan values are dispatched to the reducer on drag end.
  // ---------------------------------------------------------------------------

  const isSpaceHeldRef = useRef(false);
  const isDraggingRef = useRef(false);

  // Track drag start pointer position and starting pan values
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  // Track the active pointer ID for pointer capture release
  const dragPointerIdRef = useRef<number | null>(null);

  // Ref for canvas area element (set externally, passed via containerRef's parent)
  // We use the containerRef's parent element as the canvas-area for pointer capture,
  // but the actual event registration happens in canvas-detail-view.tsx.

  /**
   * Helper: check if an input element is focused (reuse pattern from keyboard handler).
   */
  const isInputFocused = useCallback((): boolean => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return true;
    if (el instanceof HTMLElement && el.isContentEditable) return true;
    return false;
  }, []);

  /**
   * Dispatch ref — stable reference for use in event handlers.
   */
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  /**
   * End an active drag operation — shared between pointerup and space keyup.
   * Syncs the final pan values to the reducer and resets drag state.
   */
  const endDrag = useCallback((canvasAreaEl?: HTMLElement | null) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;

    isDraggingRef.current = false;

    // Release pointer capture if we have a target element and pointer ID
    if (canvasAreaEl && dragPointerIdRef.current !== null) {
      try {
        canvasAreaEl.releasePointerCapture(dragPointerIdRef.current);
      } catch {
        // Pointer capture may already be released
      }
    }
    dragPointerIdRef.current = null;

    // Read final pan from the transform wrapper's current style
    const wrapper = transformWrapperRef?.current;
    if (wrapper) {
      const currentState = stateRef.current;
      // Parse current transform to extract pan values
      const match = wrapper.style.transform.match(
        /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/
      );
      if (match) {
        const finalPanX = parseFloat(match[1]);
        const finalPanY = parseFloat(match[2]);
        dispatchRef.current({
          type: "SET_ZOOM_PAN",
          zoomLevel: currentState.zoomLevel,
          panX: finalPanX,
          panY: finalPanY,
        });
      }
    }

    dragStartRef.current = null;
  }, [transformWrapperRef]);

  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  // Store a reference to the canvas area element for use in endDrag
  const canvasAreaElRef = useRef<HTMLElement | null>(null);

  const handleSpaceKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Guard: ignore key repeats (held key fires repeated keydown events)
      if (e.repeat) return;

      // Guard: only respond to Space key
      if (e.code !== "Space") return;

      // Guard: don't activate when input/textarea is focused (AC-9)
      if (isInputFocused()) return;

      // Guard: only activate when mouse is over canvas area (AC-1)
      if (!isCanvasHoveredRef.current) return;

      // Guard: don't activate if already held
      if (isSpaceHeldRef.current) return;

      // Prevent default Space behavior (page scroll)
      e.preventDefault();

      isSpaceHeldRef.current = true;
    },
    [isInputFocused]
  );

  const handleSpaceKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== "Space") return;

      if (!isSpaceHeldRef.current) return;

      isSpaceHeldRef.current = false;

      // AC-6: If drag is active when Space is released, end the drag
      if (isDraggingRef.current) {
        endDragRef.current(canvasAreaElRef.current);
      }
    },
    []
  );

  const handlePanPointerDown = useCallback(
    (e: PointerEvent) => {
      // Only start pan drag when Space is held
      if (!isSpaceHeldRef.current) return;

      // Only respond to primary button (left click / touch)
      if (e.button > 0) return;

      e.preventDefault();

      const currentState = stateRef.current;
      isDraggingRef.current = true;
      dragPointerIdRef.current = e.pointerId;

      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        panX: currentState.panX,
        panY: currentState.panY,
      };

      // Set pointer capture for reliable tracking outside the element
      const target = e.currentTarget as HTMLElement;
      canvasAreaElRef.current = target;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // Some environments may throw
      }
    },
    []
  );

  const handlePanPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.pointerX;
      const deltaY = e.clientY - dragStartRef.current.pointerY;

      const newPanX = dragStartRef.current.panX + deltaX;
      const newPanY = dragStartRef.current.panY + deltaY;

      // Direct DOM manipulation for 60fps — no React render
      const wrapper = transformWrapperRef?.current;
      if (wrapper) {
        const currentZoom = stateRef.current.zoomLevel;
        wrapper.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(${currentZoom})`;
      }
    },
    [transformWrapperRef]
  );

  const handlePanPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      endDragRef.current(e.currentTarget as HTMLElement);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Cleanup: reset space/drag state on unmount (AC-10)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      isSpaceHeldRef.current = false;
      isDraggingRef.current = false;
      dragStartRef.current = null;
      dragPointerIdRef.current = null;
    };
  }, []);

  return {
    fitLevel,
    zoomToPoint,
    zoomToStep,
    resetToFit,
    handleWheel,
    handleKeyDown,
    isCanvasHoveredRef,
    isSpaceHeldRef,
    isDraggingRef,
    handleSpaceKeyDown,
    handleSpaceKeyUp,
    handlePanPointerDown,
    handlePanPointerMove,
    handlePanPointerUp,
  };
}
