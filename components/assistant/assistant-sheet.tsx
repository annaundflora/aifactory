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
}

// ---------------------------------------------------------------------------
// AssistantSheet
// ---------------------------------------------------------------------------

export function AssistantSheet({
  open,
  onOpenChange,
  children,
  headerSlot,
}: AssistantSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[480px] sm:max-w-none p-0"
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

        {/* Body: children slot for future content (Slice 09+) */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
