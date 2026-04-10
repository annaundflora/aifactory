"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import type { EditMode } from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options passed into the useTouchGestures hook */
export interface UseTouchGesturesOptions {
  /** Current fit-level — used to decide single-finger-pan vs swipe */
  fitLevel: number;
}

/** Internal gesture state machine */
type GestureMode = "idle" | "pinch" | "pan";

/** Pinch/pan tracking data captured at gesture start */
interface GestureState {
  mode: GestureMode;
  /** Initial distance between two fingers at gesture start */
  initialDistance: number;
  /** Zoom level when gesture started */
  startZoom: number;
  /** Pan offsets when gesture started */
  startPanX: number;
  startPanY: number;
  /** Previous midpoint (for incremental delta tracking) */
  prevMidX: number;
  prevMidY: number;
  /** Running zoom level during gesture (for ref-based DOM updates) */
  currentZoom: number;
  /** Running pan offsets during gesture */
  currentPanX: number;
  currentPanY: number;
}

/** Single-finger pan tracking data */
interface SingleFingerState {
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  currentPanX: number;
  currentPanY: number;
  currentZoom: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Euclidean distance between two touch points */
function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Midpoint between two touch points */
function getTouchMidpoint(t1: Touch, t2: Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Touch gesture recognizer for Pinch-to-Zoom, Zwei-Finger-Pan, and
 * Ein-Finger-Pan. During gestures, transform updates happen directly on
 * the DOM via transformRef (no React renders). At gesture end, the final
 * state is dispatched to the reducer.
 *
 * Must be called from a component that has access to:
 * - containerRef: the <main> canvas-area element
 * - transformRef: the zoom-transform-wrapper <div>
 */
export function useTouchGestures(
  containerRef: React.RefObject<HTMLElement | null>,
  transformRef: React.RefObject<HTMLDivElement | null>,
  options: UseTouchGesturesOptions
): void {
  const { state, dispatch } = useCanvasDetail();

  // Stable refs for values accessed inside event handlers to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Gesture tracking refs
  const gestureRef = useRef<GestureState | null>(null);
  const singleFingerRef = useRef<SingleFingerState | null>(null);

  // ---------------------------------------------------------------------------
  // DOM mutation helper — updates transform on the wrapper div directly
  // ---------------------------------------------------------------------------

  const applyTransform = useCallback(
    (zoom: number, panX: number, panY: number) => {
      const wrapper = transformRef.current;
      if (!wrapper) return;
      wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    },
    [transformRef]
  );

  // ---------------------------------------------------------------------------
  // Guard: Should single-finger-pan be active?
  // Conditions: zoomLevel > fitLevel AND editMode is not inpaint/erase
  // ---------------------------------------------------------------------------

  const shouldSingleFingerPan = useCallback(
    (zoomLevel: number, editMode: EditMode | null, fitLevel: number): boolean => {
      // Must be zoomed beyond fit level
      if (zoomLevel <= fitLevel + 0.001) return false;
      // Must NOT be in mask-drawing modes
      if (editMode === "inpaint" || editMode === "erase") return false;
      return true;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- touchstart ---
    const handleTouchStart = (e: TouchEvent) => {
      const touches = e.touches;

      if (touches.length === 2) {
        // Start pinch/pan gesture
        e.preventDefault();

        const dist = getTouchDistance(touches[0], touches[1]);
        const mid = getTouchMidpoint(touches[0], touches[1]);
        const { zoomLevel, panX, panY } = stateRef.current;

        gestureRef.current = {
          mode: "pinch",
          initialDistance: dist,
          startZoom: zoomLevel,
          startPanX: panX,
          startPanY: panY,
          prevMidX: mid.x,
          prevMidY: mid.y,
          currentZoom: zoomLevel,
          currentPanX: panX,
          currentPanY: panY,
        };

        // Cancel any active single-finger pan
        singleFingerRef.current = null;
        return;
      }

      if (touches.length === 1) {
        const { zoomLevel, panX, panY, editMode } = stateRef.current;
        const { fitLevel } = optionsRef.current;

        if (shouldSingleFingerPan(zoomLevel, editMode, fitLevel)) {
          // Start single-finger pan
          singleFingerRef.current = {
            startX: touches[0].clientX,
            startY: touches[0].clientY,
            startPanX: panX,
            startPanY: panY,
            currentPanX: panX,
            currentPanY: panY,
            currentZoom: zoomLevel,
            active: true,
          };
        }
      }
    };

    // --- touchmove ---
    const handleTouchMove = (e: TouchEvent) => {
      const touches = e.touches;

      // Two-finger: pinch + pan
      if (touches.length === 2 && gestureRef.current) {
        e.preventDefault();

        const gesture = gestureRef.current;
        const newDist = getTouchDistance(touches[0], touches[1]);
        const newMid = getTouchMidpoint(touches[0], touches[1]);

        // Pinch ratio: new zoom = startZoom * (currentDistance / initialDistance)
        const ratio = newDist / gesture.initialDistance;
        const rawZoom = gesture.startZoom * ratio;
        const newZoom = clamp(rawZoom, ZOOM_MIN, ZOOM_MAX);

        // Anchor-point zoom compensation (AC-1): keep the image point under
        // the finger midpoint stationary when zoom changes, while also
        // tracking two-finger pan movement.
        //
        // The image point under the *previous* midpoint is:
        //   imageX = (prevMidX - currentPanX) / oldZoom
        // To keep that point under the *new* midpoint at newZoom:
        //   newPanX = newMidX - imageX * newZoom
        // This naturally combines anchor-point zoom + two-finger pan since
        // newMid already reflects where the fingers have moved.
        const oldZoom = gesture.currentZoom;
        const imageX = (gesture.prevMidX - gesture.currentPanX) / oldZoom;
        const imageY = (gesture.prevMidY - gesture.currentPanY) / oldZoom;
        const newPanX = newMid.x - imageX * newZoom;
        const newPanY = newMid.y - imageY * newZoom;

        // Update running state
        gesture.currentZoom = newZoom;
        gesture.currentPanX = newPanX;
        gesture.currentPanY = newPanY;
        gesture.prevMidX = newMid.x;
        gesture.prevMidY = newMid.y;

        // Ref-based DOM update (AC-5: no React render, no dispatch)
        applyTransform(newZoom, newPanX, newPanY);
        return;
      }

      // Single-finger pan
      if (touches.length === 1 && singleFingerRef.current?.active) {
        e.preventDefault();

        const sf = singleFingerRef.current;
        const deltaX = touches[0].clientX - sf.startX;
        const deltaY = touches[0].clientY - sf.startY;

        const newPanX = sf.startPanX + deltaX;
        const newPanY = sf.startPanY + deltaY;

        sf.currentPanX = newPanX;
        sf.currentPanY = newPanY;

        // Ref-based DOM update
        applyTransform(sf.currentZoom, newPanX, newPanY);
      }
    };

    // --- touchend / touchcancel ---
    const handleTouchEnd = (e: TouchEvent) => {
      // Pinch/pan gesture end: dispatch final values
      if (gestureRef.current) {
        const gesture = gestureRef.current;

        // If all fingers lifted or back to 1 finger, finalize
        if (e.touches.length < 2) {
          const finalZoom = clamp(gesture.currentZoom, ZOOM_MIN, ZOOM_MAX);
          dispatch({
            type: "SET_ZOOM_PAN",
            zoomLevel: finalZoom,
            panX: gesture.currentPanX,
            panY: gesture.currentPanY,
          });
          gestureRef.current = null;

          // If 1 finger remains after pinch, don't start single-finger-pan
          // (user was just finishing a pinch, not starting a new drag)
          singleFingerRef.current = null;
        }
        return;
      }

      // Single-finger pan end: dispatch final values
      if (singleFingerRef.current?.active) {
        const sf = singleFingerRef.current;
        dispatch({
          type: "SET_ZOOM_PAN",
          zoomLevel: sf.currentZoom,
          panX: sf.currentPanX,
          panY: sf.currentPanY,
        });
        singleFingerRef.current = null;
      }
    };

    // Register with { passive: false } so preventDefault() works (AC-10 constraint)
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [containerRef, transformRef, dispatch, applyTransform, shouldSingleFingerPan]);
}
