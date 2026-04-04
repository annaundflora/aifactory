"use client";

import { useRef, useEffect, useCallback, type RefObject } from "react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";

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
 * and ResizeObserver-based resizing.
 *
 * Mask color: rgba(255, 0, 0, 0.5) for visualization.
 * Eraser: globalCompositeOperation "destination-out".
 * Cursor: custom circle matching brushSize, native cursor hidden.
 */
export function MaskCanvas({ imageRef }: MaskCanvasProps) {
  const { state, dispatch } = useCanvasDetail();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

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
    const img = imageRef.current;
    if (!img) return;

    const observer = new ResizeObserver(() => {
      syncCanvasSize();
      syncCanvasPosition();
    });

    observer.observe(img);

    // Initial sync
    syncCanvasSize();
    syncCanvasPosition();

    return () => {
      observer.disconnect();
    };
  }, [imageRef, syncCanvasSize, syncCanvasPosition]);

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
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
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
  // Mouse event handlers
  // -------------------------------------------------------------------------

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getCanvasCoords(e);
      lastPosRef.current = pos;
      drawDot(pos);
    },
    [getCanvasCoords, drawDot]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getCanvasCoords(e);

      // Always update cursor indicator
      drawCursor(pos);

      if (!isDrawingRef.current || !lastPosRef.current) return;

      drawStroke(lastPosRef.current, pos);
      lastPosRef.current = pos;
    },
    [getCanvasCoords, drawStroke, drawCursor]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;

    // AC-3: Dispatch SET_MASK_DATA with current canvas ImageData
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width > 0 && canvas.height > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      dispatch({ type: "SET_MASK_DATA", maskData: imageData });
    }
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    clearCursor();
    if (isDrawingRef.current) {
      handleMouseUp();
    }
  }, [clearCursor, handleMouseUp]);

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
        className="pointer-events-auto absolute z-10"
        style={{ cursor: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
