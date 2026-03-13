"use client";

import { useCallback, useState } from "react";
import {
  Copy,
  ArrowRightLeft,
  ZoomIn,
  Download,
  Trash2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
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

type ToolId = "variation" | "img2img" | "upscale" | "download" | "delete" | "details";

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

      // Toggle tools dispatch SET_ACTIVE_TOOL (reducer handles toggle logic)
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: tool.id });
    },
    [isDisabled, dispatch, handleDownload]
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
        className="flex flex-col items-center py-2 w-12"
        aria-label="Canvas tools"
        data-testid="canvas-toolbar"
      >
        {TOOLS.map((tool) => (
          <ToolbarButton
            key={tool.id}
            icon={tool.icon}
            tooltip={tool.tooltip}
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
