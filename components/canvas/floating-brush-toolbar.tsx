"use client";

import { useCallback } from "react";
import { Paintbrush, Eraser, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FloatingBrushToolbarProps {
  onEraseAction: () => void;
}

// ---------------------------------------------------------------------------
// FloatingBrushToolbar
// ---------------------------------------------------------------------------

/**
 * Horizontal floating toolbar positioned above the canvas image area.
 * Visible only when editMode is "inpaint" or "erase".
 *
 * Contains:
 * - Brush size slider (1-100) with numeric display
 * - Brush / Eraser toggle
 * - Clear mask button
 * - Erase action button (only in "erase" mode)
 *
 * All state is read/written via useCanvasDetail() context.
 */
export function FloatingBrushToolbar({ onEraseAction }: FloatingBrushToolbarProps) {
  const { state, dispatch } = useCanvasDetail();

  const { editMode, brushSize, brushTool, maskData } = state;

  // -------------------------------------------------------------------------
  // Visibility: only show for inpaint/erase modes
  // -------------------------------------------------------------------------

  const isVisible = editMode === "inpaint" || editMode === "erase";

  if (!isVisible) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const hasMask = maskData !== null;
  const isEraseMode = editMode === "erase";

  return (
    <FloatingBrushToolbarInner
      brushSize={brushSize}
      brushTool={brushTool}
      hasMask={hasMask}
      isEraseMode={isEraseMode}
      dispatch={dispatch}
      onEraseAction={onEraseAction}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner component (always rendered when visible, avoids hook rules issues)
// ---------------------------------------------------------------------------

interface FloatingBrushToolbarInnerProps {
  brushSize: number;
  brushTool: "brush" | "eraser";
  hasMask: boolean;
  isEraseMode: boolean;
  dispatch: ReturnType<typeof useCanvasDetail>["dispatch"];
  onEraseAction: () => void;
}

function FloatingBrushToolbarInner({
  brushSize,
  brushTool,
  hasMask,
  isEraseMode,
  dispatch,
  onEraseAction,
}: FloatingBrushToolbarInnerProps) {
  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleBrushSizeChange = useCallback(
    (value: number[]) => {
      dispatch({ type: "SET_BRUSH_SIZE", brushSize: value[0] });
    },
    [dispatch]
  );

  const handleToggleBrushTool = useCallback(() => {
    dispatch({
      type: "SET_BRUSH_TOOL",
      brushTool: brushTool === "brush" ? "eraser" : "brush",
    });
  }, [dispatch, brushTool]);

  const handleClearMask = useCallback(() => {
    dispatch({ type: "CLEAR_MASK" });
  }, [dispatch]);

  const handleEraseAction = useCallback(() => {
    if (hasMask) {
      onEraseAction();
    }
  }, [hasMask, onEraseAction]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "absolute top-2 left-1/2 z-30 -translate-x-1/2",
          "flex items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-2 shadow-md"
        )}
        data-testid="floating-brush-toolbar"
      >
        {/* Brush Size Slider */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Pinsel
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pinselgroesse</TooltipContent>
          </Tooltip>
          <Slider
            min={1}
            max={100}
            step={1}
            value={[brushSize]}
            onValueChange={handleBrushSizeChange}
            className="w-28"
            data-testid="brush-size-slider"
          />
          <span
            className="min-w-[2rem] text-center text-xs font-mono text-muted-foreground"
            data-testid="brush-size-value"
          >
            {brushSize}
          </span>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border/60" />

        {/* Brush / Eraser Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={brushTool === "brush" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={handleToggleBrushTool}
              aria-label={brushTool === "brush" ? "Wechsel zu Radierer" : "Wechsel zu Pinsel"}
              aria-pressed={brushTool === "brush"}
              data-testid="brush-tool-toggle"
            >
              {brushTool === "brush" ? (
                <Paintbrush className="size-4" />
              ) : (
                <Eraser className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {brushTool === "brush" ? "Pinsel (aktiv)" : "Radierer (aktiv)"}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="h-6 w-px bg-border/60" />

        {/* Clear Mask Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClearMask}
              disabled={!hasMask}
              aria-label="Maske loeschen"
              data-testid="clear-mask-btn"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Maske loeschen</TooltipContent>
        </Tooltip>

        {/* Erase Action Button (only in erase mode) */}
        {isEraseMode && (
          <>
            {/* Separator */}
            <div className="h-6 w-px bg-border/60" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleEraseAction}
                  disabled={!hasMask}
                  data-testid="erase-action-btn"
                >
                  <Sparkles className="size-4 mr-1" />
                  Entfernen
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Markierte Bereiche entfernen
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
