"use client";

import { useRef, useEffect, useCallback, type RefObject } from "react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRUSH_SIZE_STEP = 5;
const BRUSH_SIZE_MIN = 1;
const BRUSH_SIZE_MAX = 100;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MaskCanvasProps {
  imageRef: RefObject<HTMLImageElement | null>;
}

// ---------------------------------------------------------------------------
// MaskCanvas
// ---------------------------------------------------------------------------

/**
 * HTML5 Canvas overlay for mask painting. Sits absolutely positioned over the
 * image element and supports brush painting, eraser, clear, cursor indicator,
 * ResizeObserver-based resizing, keyboard shortcuts, and mask undo.
 *
 * Mask color: rgba(255, 0, 0, 0.5) for visualization.
 * Eraser: globalCompositeOperation "destination-out".
 * Cursor: custom circle matching brushSize, native cursor hidden.
 *
 * Keyboard shortcuts (active only in inpaint/erase modes):
 * - `]` : increase brush size by 5 (max 100)
 * - `[` : decrease brush size by 5 (min 1)
 * - `E` : toggle brush/eraser tool
 * - `Ctrl+Z` / `Cmd+Z` : undo last mask stroke
 */
export function MaskCanvas({ imageRef }: MaskCanvasProps) {
  const { state, dispatch } = useCanvasDetail();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Mask undo stack — component-local, stores ImageData snapshots before each stroke
  const maskUndoStackRef = useRef<ImageData[]>([]);

  // Store state values in refs for use in event handlers without re-renders
  const brushSizeRef = useRef(state.brushSize);
  const brushToolRef = useRef(state.brushTool);
  const editModeRef = useRef(state.editMode);

  useEffect(() => {
    brushSizeRef.current = state.brushSize;
  }, [state.brushSize]);

  useEffect(() => {
    brushToolRef.current = state.brushTool;
  }, [state.brushTool]);

  useEffect(() => {
    editModeRef.current = state.editMode;
  }, [state.editMode]);

  // -------------------------------------------------------------------------
  // Mask undo stack reset on CLEAR_MASK (AC-9)
  // When maskData becomes null (e.g. via CLEAR_MASK), reset the undo stack.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (state.maskData === null) {
      maskUndoStackRef.current = [];
    }
  }, [state.maskData]);

  // -------------------------------------------------------------------------
  // Keyboard shortcuts (AC-1 through AC-8)
  // Registered on document in capture phase so mask Ctrl+Z can intercept
  // before the global image undo handler in CanvasDetailProvider.
  // -------------------------------------------------------------------------

  useEffect(() => {
    function isInputFocused(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      if (el instanceof HTMLElement && el.isContentEditable) return true;
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // AC-8: Don't trigger shortcuts when input elements have focus
      if (isInputFocused()) return;

      // AC-4: Shortcuts only active in painting modes
      const mode = editModeRef.current;
      if (mode !== "inpaint" && mode !== "erase") return;

      const key = e.key;

      // --- Ctrl+Z / Cmd+Z: Mask undo (AC-5, AC-6, AC-7) ---
      if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "Z") && !e.shiftKey) {
        // Prevent browser undo and global image undo handler
        e.preventDefault();
        e.stopPropagation();

        const stack = maskUndoStackRef.current;
        if (stack.length === 0) {
          // AC-6: Empty stack — do nothing
          return;
        }

        const previousState = stack.pop()!;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Restore canvas to the previous state
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (previousState.width === canvas.width && previousState.height === canvas.height) {
          ctx.putImageData(previousState, 0, 0);
        } else {
          // Dimensions changed — scale the snapshot
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = previousState.width;
          tempCanvas.height = previousState.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            tempCtx.putImageData(previousState, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
          }
        }

        // AC-7: Dispatch SET_MASK_DATA with restored data (or null if stack empty)
        if (canvas.width > 0 && canvas.height > 0) {
          // Check if canvas is completely empty (all transparent)
          const restoredData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hasContent = restoredData.data.some((v, i) => i % 4 === 3 && v > 0);
          dispatch({ type: "SET_MASK_DATA", maskData: hasContent ? restoredData : null });
        } else {
          dispatch({ type: "SET_MASK_DATA", maskData: null });
        }

        return;
      }

      // Skip shortcuts that use modifier keys (avoid conflicts with browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // --- ] : Increase brush size (AC-1) ---
      if (key === "]") {
        e.preventDefault();
        const newSize = Math.min(brushSizeRef.current + BRUSH_SIZE_STEP, BRUSH_SIZE_MAX);
        dispatch({ type: "SET_BRUSH_SIZE", brushSize: newSize });
        return;
      }

      // --- [ : Decrease brush size (AC-2) ---
      if (key === "[") {
        e.preventDefault();
        const newSize = Math.max(brushSizeRef.current - BRUSH_SIZE_STEP, BRUSH_SIZE_MIN);
        dispatch({ type: "SET_BRUSH_SIZE", brushSize: newSize });
        return;
      }

      // --- E : Toggle brush/eraser (AC-3) ---
      if (key === "e" || key === "E") {
        e.preventDefault();
        const newTool = brushToolRef.current === "brush" ? "eraser" : "brush";
        dispatch({ type: "SET_BRUSH_TOOL", brushTool: newTool });
        return;
      }
    }

    // Use capture phase to intercept Ctrl+Z before global handler in CanvasDetailProvider
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Canvas sizing — match the rendered image element dimensions
  // -------------------------------------------------------------------------

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const rect = img.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (canvas.width === width && canvas.height === height) return;

    // Preserve existing mask data before resizing
    const ctx = canvas.getContext("2d");
    let existingData: ImageData | null = null;
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      existingData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    canvas.width = width;
    canvas.height = height;

    // Restore mask data scaled to new dimensions
    if (existingData && ctx) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = existingData.width;
      tempCanvas.height = existingData.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(existingData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, width, height);
      }
    }

    // Sync cursor canvas
    if (cursorCanvas) {
      cursorCanvas.width = width;
      cursorCanvas.height = height;
    }
  }, [imageRef]);

  // -------------------------------------------------------------------------
  // Position sync — match absolute position to image element
  // -------------------------------------------------------------------------

  const syncCanvasPosition = useCallback(() => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const imgRect = img.getBoundingClientRect();
    const parent = canvas.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const top = imgRect.top - parentRect.top;
    const left = imgRect.left - parentRect.left;

    canvas.style.top = `${top}px`;
    canvas.style.left = `${left}px`;

    if (cursorCanvas) {
      cursorCanvas.style.top = `${top}px`;
      cursorCanvas.style.left = `${left}px`;
    }
  }, [imageRef]);

  // -------------------------------------------------------------------------
  // ResizeObserver — watch for image dimension changes (AC-9)
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Only set up observer in painting modes — avoids rAF polling when
    // the component is mounted but returns null (editMode is inactive)
    if (state.editMode !== "inpaint" && state.editMode !== "erase") return;

    let observer: ResizeObserver | null = null;
    let rafId: number | null = null;
    let disposed = false;

    function setup() {
      if (disposed) return;
      const img = imageRef.current;
      if (!img) {
        // Image ref not yet available — retry next frame (React timing:
        // child effects may run before parent ref is assigned)
        rafId = requestAnimationFrame(setup);
        return;
      }

      observer = new ResizeObserver(() => {
        syncCanvasSize();
        syncCanvasPosition();
      });

      observer.observe(img);

      // Initial sync
      syncCanvasSize();
      syncCanvasPosition();
    }

    setup();

    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
  }, [state.editMode, imageRef, syncCanvasSize, syncCanvasPosition]);

  // Also sync on window resize for layout shifts
  useEffect(() => {
    const handleResize = () => {
      syncCanvasSize();
      syncCanvasPosition();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [syncCanvasSize, syncCanvasPosition]);

  // -------------------------------------------------------------------------
  // CLEAR_MASK support (AC-5) + restore mask on remount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (state.maskData === null) {
      // Clear the canvas when mask data is reset
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else if (canvas.width > 0 && canvas.height > 0) {
      // Restore non-null maskData onto the canvas (e.g. after remount from
      // an editMode round-trip like inpaint -> null -> inpaint). When the
      // component unmounts the canvas DOM element is destroyed, but
      // state.maskData survives in context. On remount we need to put the
      // saved ImageData back onto the fresh canvas.
      if (
        state.maskData.width === canvas.width &&
        state.maskData.height === canvas.height
      ) {
        ctx.putImageData(state.maskData, 0, 0);
      } else {
        // Dimensions differ (e.g. resize happened while unmounted) — scale
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = state.maskData.width;
        tempCanvas.height = state.maskData.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.putImageData(state.maskData, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [state.maskData]);

  // -------------------------------------------------------------------------
  // Drawing helpers — direct Canvas 2D API for performance (< 16ms)
  // -------------------------------------------------------------------------

  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  const drawStroke = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = brushSizeRef.current;
      const tool = brushToolRef.current;

      ctx.save();

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      }

      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      ctx.restore();
    },
    []
  );

  const drawDot = useCallback(
    (pos: { x: number; y: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = brushSizeRef.current;
      const tool = brushToolRef.current;

      ctx.save();

      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },
    []
  );

  // -------------------------------------------------------------------------
  // Cursor indicator (AC-7) — separate canvas layer for cursor
  // -------------------------------------------------------------------------

  const drawCursor = useCallback((pos: { x: number; y: number }) => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    const size = brushSizeRef.current;

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dark ring for contrast
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }, []);

  const clearCursor = useCallback(() => {
    const cursorCanvas = cursorCanvasRef.current;
    if (!cursorCanvas) return;
    const ctx = cursorCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  }, []);

  // -------------------------------------------------------------------------
  // Pointer event handlers — unified mouse/touch/pen input
  //
  // Uses Pointer Events (instead of Mouse Events) so touch input and the
  // Apple Pencil on iPad work the same as a desktop mouse. Combined with
  // `touch-action: none` on the canvas element, this prevents Safari from
  // hijacking the drag as a scroll/pinch gesture.
  // -------------------------------------------------------------------------

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Ignore secondary mouse buttons (right-click, middle-click) so they
      // don't start a stroke. Touch and pen tip report button === 0.
      if (e.button > 0) return;

      e.preventDefault();

      // Capture the pointer so pointermove/pointerup continue to target the
      // canvas even if the finger/pen drifts outside its bounds mid-stroke.
      const canvas = canvasRef.current;
      if (canvas && typeof canvas.setPointerCapture === "function") {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Some environments (jsdom) may throw — safe to ignore.
        }
      }

      // Snapshot current canvas state BEFORE painting for undo stack
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
          maskUndoStackRef.current.push(snapshot);
        }
      }

      isDrawingRef.current = true;
      const pos = getCanvasCoords(e);
      lastPosRef.current = pos;
      drawDot(pos);
    },
    [getCanvasCoords, drawDot]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pos = getCanvasCoords(e);

      // Always update cursor indicator
      drawCursor(pos);

      if (!isDrawingRef.current || !lastPosRef.current) return;

      drawStroke(lastPosRef.current, pos);
      lastPosRef.current = pos;
    },
    [getCanvasCoords, drawStroke, drawCursor]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (canvas && typeof canvas.releasePointerCapture === "function") {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore — capture may already be released.
        }
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPosRef.current = null;

      // AC-3: Dispatch SET_MASK_DATA with current canvas ImageData
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (canvas.width > 0 && canvas.height > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        dispatch({ type: "SET_MASK_DATA", maskData: imageData });
      }
    },
    [dispatch]
  );

  const handlePointerLeave = useCallback(() => {
    clearCursor();
    // Note: while pointer-captured (active stroke) the pointer still targets
    // this canvas, so pointerleave fires only for the unpressed cursor
    // indicator — no need to finalize the mask here.
  }, [clearCursor]);

  // -------------------------------------------------------------------------
  // AC-8: Don't render when editMode is null
  // -------------------------------------------------------------------------

  if (!state.editMode) {
    return null;
  }

  // Only show mask canvas for modes that use mask painting
  if (state.editMode !== "inpaint" && state.editMode !== "erase") {
    return null;
  }

  return (
    <>
      {/* Mask painting canvas */}
      <canvas
        ref={canvasRef}
        data-testid="mask-canvas"
        className="pointer-events-auto absolute z-10 touch-none"
        style={{ cursor: "none", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
      {/* Cursor indicator canvas — above mask canvas, passes through clicks */}
      <canvas
        ref={cursorCanvasRef}
        data-testid="mask-canvas-cursor"
        className="pointer-events-none absolute z-20"
      />
    </>
  );
}
