"use client";

import { useState } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PROMPT_TEMPLATES, type PromptTemplate } from "@/lib/prompt-templates";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateSelectorProps {
  onApplyTemplate: (template: PromptTemplate) => void;
  hasContent: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateSelector({
  onApplyTemplate,
  hasContent,
}: TemplateSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | null>(
    null
  );

  function handleTemplateClick(template: PromptTemplate) {
    setDropdownOpen(false);
    if (hasContent) {
      setPendingTemplate(template);
      setConfirmOpen(true);
    } else {
      onApplyTemplate(template);
    }
  }

  function handleConfirmApply() {
    if (pendingTemplate) {
      onApplyTemplate(pendingTemplate);
      setPendingTemplate(null);
    }
    setConfirmOpen(false);
  }

  function handleConfirmCancel() {
    setPendingTemplate(null);
    setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenuPrimitive.Root
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="template-selector-trigger"
          >
            <ChevronDown className="mr-1 size-3" />
            Templates
          </Button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            )}
          >
            {PROMPT_TEMPLATES.map((template) => (
              <DropdownMenuPrimitive.Item
                key={template.id}
                data-testid={`template-option-${template.id}`}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "transition-colors focus:bg-accent focus:text-accent-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
                onSelect={() => handleTemplateClick(template)}
              >
                {template.label}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          size="sm"
          data-testid="template-confirm-dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current prompt fields. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApply}>
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
