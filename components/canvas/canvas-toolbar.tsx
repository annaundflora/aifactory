"use client";

import { useCallback, useState } from "react";
import {
  Copy,
  ArrowRightLeft,
  ZoomIn,
  Download,
  Trash2,
  Info,
  PanelLeftIcon,
  Paintbrush,
  Eraser,
  MousePointerClick,
  Expand,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCanvasDetail, type EditMode } from "@/lib/canvas-detail-context";
import { ToolbarButton } from "@/components/canvas/toolbar-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { downloadImage, generateDownloadFilename } from "@/lib/utils";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

type ToolId = "variation" | "img2img" | "upscale" | "download" | "delete" | "details" | "brush-edit" | "erase" | "click-edit" | "expand";

interface ToolDef {
  id: ToolId;
  icon: typeof Copy;
  tooltip: string;
  /** If true, clicking toggles activeToolId in context */
  toggle: boolean;
}

const TOOLS: ToolDef[] = [
  { id: "variation", icon: Copy, tooltip: "Variation", toggle: true },
  { id: "img2img", icon: ArrowRightLeft, tooltip: "img2img", toggle: true },
  { id: "upscale", icon: ZoomIn, tooltip: "Upscale", toggle: true },
  { id: "brush-edit", icon: Paintbrush, tooltip: "Brush Edit", toggle: true },
  { id: "erase", icon: Eraser, tooltip: "Erase", toggle: true },
  { id: "click-edit", icon: MousePointerClick, tooltip: "Click Edit", toggle: true },
  { id: "expand", icon: Expand, tooltip: "Expand", toggle: true },
  { id: "download", icon: Download, tooltip: "Download", toggle: false },
  { id: "delete", icon: Trash2, tooltip: "Delete", toggle: false },
  { id: "details", icon: Info, tooltip: "Details", toggle: true },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasToolbarProps {
  generation: Generation;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// CanvasToolbar
// ---------------------------------------------------------------------------

export function CanvasToolbar({ generation, onDelete }: CanvasToolbarProps) {
  const { state, dispatch } = useCanvasDetail();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isDisabled = state.isGenerating;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleDownload = useCallback(async () => {
    if (isDisabled || !generation.imageUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      const filename = generateDownloadFilename(
        generation.prompt || "image",
        generation.createdAt
      );
      await downloadImage(generation.imageUrl, filename);
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setIsDownloading(false);
    }
  }, [isDisabled, generation.imageUrl, generation.prompt, generation.createdAt, isDownloading]);

  // Map edit tool IDs to EditMode values for SET_EDIT_MODE dispatch
  const EDIT_TOOL_MODE_MAP: Record<string, EditMode> = {
    "brush-edit": "inpaint",
    "erase": "erase",
    "click-edit": "inpaint",
    "expand": "outpaint",
  };

  const handleToolClick = useCallback(
    (tool: ToolDef) => {
      if (isDisabled) return;

      if (tool.id === "download") {
        handleDownload();
        return;
      }

      if (tool.id === "delete") {
        setDeleteDialogOpen(true);
        return;
      }

      // Edit tools dispatch SET_EDIT_MODE (toggle behavior)
      const editMode = EDIT_TOOL_MODE_MAP[tool.id];
      if (editMode) {
        // Toggle: if already active, deactivate; otherwise activate
        const isCurrentlyActive = state.activeToolId === tool.id;
        dispatch({ type: "SET_EDIT_MODE", editMode: isCurrentlyActive ? null : editMode });
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: tool.id });
        return;
      }

      // Toggle tools dispatch SET_ACTIVE_TOOL (reducer handles toggle logic)
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: tool.id });
    },
    [isDisabled, dispatch, handleDownload, state.activeToolId]
  );

  const handleDeleteConfirm = useCallback(() => {
    setDeleteDialogOpen(false);
    onDelete();
  }, [onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className={cn(
          "flex flex-1 flex-col py-2 transition-all duration-200",
          expanded ? "w-40 items-stretch" : "w-14 items-center"
        )}
        aria-label="Canvas tools"
        data-testid="canvas-toolbar"
      >
        {/* Expand / Collapse toggle (top, same pattern as workspace sidebar) */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex h-10 shrink-0 items-center rounded-md text-muted-foreground hover:text-foreground transition-colors duration-150",
            expanded ? "justify-start gap-2 px-3" : "justify-center"
          )}
          aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
          data-testid="toolbar-toggle"
        >
          <PanelLeftIcon className="size-5 shrink-0" />
          {expanded && (
            <span className="text-sm whitespace-nowrap">Collapse</span>
          )}
        </button>

        {/* Separator below toggle */}
        <div className="mx-2 border-t border-border/60 mb-1" />

        {/* Generation tools: Variation, img2img, Upscale */}
        {TOOLS.slice(0, 3).map((tool) => (
          <ToolbarButton
            key={tool.id}
            icon={tool.icon}
            tooltip={tool.tooltip}
            label={tool.tooltip}
            expanded={expanded}
            isActive={tool.toggle && state.activeToolId === tool.id}
            disabled={isDisabled}
            onClick={() => handleToolClick(tool)}
            data-testid={`toolbar-${tool.id}`}
          />
        ))}

        {/* Separator between generation and edit tools */}
        <div className="mx-2 my-1 border-t border-border/60" />

        {/* Edit tools: Brush Edit, Erase, Click Edit, Expand */}
        {TOOLS.slice(3, 7).map((tool) => (
          <ToolbarButton
            key={tool.id}
            icon={tool.icon}
            tooltip={tool.tooltip}
            label={tool.tooltip}
            expanded={expanded}
            isActive={tool.toggle && state.activeToolId === tool.id}
            disabled={isDisabled}
            onClick={() => handleToolClick(tool)}
            data-testid={`toolbar-${tool.id}`}
          />
        ))}

        {/* Separator between edit and action tools */}
        <div className="mx-2 my-1 border-t border-border/60" />

        {/* Action tools: Download, Delete */}
        {TOOLS.slice(7, 9).map((tool) => (
          <ToolbarButton
            key={tool.id}
            icon={tool.icon}
            tooltip={tool.tooltip}
            label={tool.tooltip}
            expanded={expanded}
            isActive={tool.toggle && state.activeToolId === tool.id}
            disabled={isDisabled}
            onClick={() => handleToolClick(tool)}
            data-testid={`toolbar-${tool.id}`}
          />
        ))}

        {/* Separator between Delete and Details */}
        <div className="mx-2 my-1 border-t border-border/60" />

        {/* Info tools: Details */}
        {TOOLS.slice(9).map((tool) => (
          <ToolbarButton
            key={tool.id}
            icon={tool.icon}
            tooltip={tool.tooltip}
            label={tool.tooltip}
            expanded={expanded}
            isActive={tool.toggle && state.activeToolId === tool.id}
            disabled={isDisabled}
            onClick={() => handleToolClick(tool)}
            data-testid={`toolbar-${tool.id}`}
          />
        ))}
      </nav>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
