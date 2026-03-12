"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssistantSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  /** Slot for additional header content (e.g. ModelSelector), rendered between title and close button */
  headerSlot?: ReactNode;
  /** When true, the sheet expands from 480px to 780px and shows a split-view layout */
  hasCanvas?: boolean;
  /** Slot for the canvas panel, rendered on the right side of the split-view */
  canvasSlot?: ReactNode;
  /**
   * Callback fired when the sheet transitions to open.
   * Used by Slice 19 to auto-resume active sessions.
   * AC-1: When opening with an active sessionId, the session is loaded automatically.
   */
  onOpen?: () => void;
}

// ---------------------------------------------------------------------------
// AssistantSheet
// ---------------------------------------------------------------------------

export function AssistantSheet({
  open,
  onOpenChange,
  children,
  headerSlot,
  hasCanvas = false,
  canvasSlot,
  onOpen,
}: AssistantSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);

  // AC-7: Move focus inside the sheet when opened
  useEffect(() => {
    if (open && contentRef.current) {
      // Small delay to ensure the sheet content is rendered before focusing
      const timer = setTimeout(() => {
        contentRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Slice-19 AC-1: Fire onOpen callback when sheet transitions from closed to open
  useEffect(() => {
    if (open && !prevOpenRef.current && onOpen) {
      onOpen();
    }
    prevOpenRef.current = open;
  }, [open, onOpen]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="sm:max-w-none p-0 transition-[width] duration-300 ease-in-out"
        style={{ width: hasCanvas ? 780 : 480 }}
        ref={contentRef}
        tabIndex={-1}
        data-testid="assistant-sheet"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3 space-y-0">
          <SheetTitle className="text-base">Prompt Assistent</SheetTitle>
          <div className="flex items-center gap-1">
            {headerSlot}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onOpenChange(false)}
              data-testid="assistant-sheet-close"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Body: Split-View when canvas is active, otherwise single column */}
        {hasCanvas ? (
          <div className="flex flex-1 flex-row overflow-hidden" data-testid="assistant-split-view">
            {/* Left panel: Chat Thread (~50%) */}
            <div className="flex flex-1 flex-col overflow-y-auto border-r">
              {children}
            </div>
            {/* Right panel: Canvas (~50%) */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              {canvasSlot}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
