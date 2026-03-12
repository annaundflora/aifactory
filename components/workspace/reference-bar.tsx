"use client";

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ReferenceSlot } from "@/components/workspace/reference-slot";
import { cn } from "@/lib/utils";
import type {
  ReferenceRole,
  ReferenceStrength,
  ReferenceSlotData,
} from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SLOTS = 5;
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

// ---------------------------------------------------------------------------
// Sparse Label Algorithm (exported for consumers)
// ---------------------------------------------------------------------------

/**
 * Returns the lowest free position (1-5) given the currently occupied positions.
 * If all 5 are occupied, returns -1.
 */
export function getLowestFreePosition(occupiedPositions: number[]): number {
  const occupied = new Set(occupiedPositions);
  for (let i = 1; i <= MAX_SLOTS; i++) {
    if (!occupied.has(i)) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceBarProps {
  /** Currently active reference slots (controlled) */
  slots: ReferenceSlotData[];
  /** Called when a new file is selected for upload */
  onAdd?: (file: File, position: number) => void;
  /** Called when a slot is removed */
  onRemove?: (slotPosition: number) => void;
  /** Called when a slot's role changes */
  onRoleChange?: (slotPosition: number, role: ReferenceRole) => void;
  /** Called when a slot's strength changes */
  onStrengthChange?: (slotPosition: number, strength: ReferenceStrength) => void;
  /** Called when a file is uploaded to a specific slot (e.g. trailing dropzone or slot upload) */
  onUpload?: (file: File, slotPosition: number) => void;
  /** Called when a URL is pasted for upload */
  onUploadUrl?: (url: string, slotPosition: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferenceBar({
  slots,
  onAdd,
  onRemove,
  onRoleChange,
  onStrengthChange,
  onUpload,
  onUploadUrl,
}: ReferenceBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slotCount = slots.length;
  const isFull = slotCount >= MAX_SLOTS;
  const isEmpty = slotCount === 0;

  // Sort slots by position for consistent rendering
  const sortedSlots = [...slots].sort(
    (a, b) => a.slotPosition - b.slotPosition
  );

  // ---------------------------------------------------------------------------
  // Add button handler
  // ---------------------------------------------------------------------------

  const handleAddClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isFull) return;
      fileInputRef.current?.click();
    },
    [isFull]
  );

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      const occupiedPositions = slots.map((s) => s.slotPosition);
      const position = getLowestFreePosition(occupiedPositions);
      if (position === -1) return;

      // Auto-expand when first image is added
      if (isEmpty) {
        setIsOpen(true);
      }

      onAdd?.(file, position);
    },
    [slots, isEmpty, onAdd]
  );

  // ---------------------------------------------------------------------------
  // Collapsible state change
  // ---------------------------------------------------------------------------

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  // ---------------------------------------------------------------------------
  // Trailing empty dropzone handlers
  // ---------------------------------------------------------------------------

  const trailingPosition = getLowestFreePosition(
    slots.map((s) => s.slotPosition)
  );

  const handleTrailingUpload = useCallback(
    (file: File) => {
      if (trailingPosition === -1) return;
      onUpload?.(file, trailingPosition);
    },
    [trailingPosition, onUpload]
  );

  const handleTrailingUploadUrl = useCallback(
    (url: string) => {
      if (trailingPosition === -1) return;
      onUploadUrl?.(url, trailingPosition);
    },
    [trailingPosition, onUploadUrl]
  );

  // ---------------------------------------------------------------------------
  // Render: Header Content
  // ---------------------------------------------------------------------------

  const renderHeaderContent = () => {
    if (isEmpty) {
      return (
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-90"
            )}
            data-testid="chevron-icon"
          />
          <span className="text-sm font-medium text-foreground">
            References (0)
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-90"
          )}
          data-testid="chevron-icon"
        />
        <Badge variant="secondary" data-testid="counter-badge">
          [{slotCount}/{MAX_SLOTS}]
        </Badge>

        {/* Mini-thumbnails in collapsed state */}
        {!isOpen && (
          <div
            className="flex items-center gap-1.5"
            data-testid="mini-thumbnails"
          >
            {sortedSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-0.5"
                data-testid={`mini-thumb-${slot.slotPosition}`}
              >
                <img
                  src={slot.imageUrl}
                  alt={`Reference @${slot.slotPosition}`}
                  className="size-6 rounded-sm object-cover"
                />
                <span
                  className="text-[10px] font-medium text-muted-foreground"
                  data-testid={`mini-label-${slot.slotPosition}`}
                >
                  @{slot.slotPosition}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      data-testid="reference-bar"
    >
      {/* Hidden file input for Add button */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={handleFileInputChange}
        data-testid="add-file-input"
        tabIndex={-1}
      />

      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 bg-transparent border-none p-0 cursor-pointer text-left"
            data-testid="reference-bar-header"
          >
            {renderHeaderContent()}
          </button>
        </CollapsibleTrigger>

        {/* Add button */}
        <Button
          variant="ghost"
          size="xs"
          onClick={handleAddClick}
          disabled={isFull}
          data-testid="add-reference-button"
          aria-label="Add reference"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {/* Expanded content */}
      <CollapsibleContent>
        <div
          className="flex flex-col gap-2 pt-2"
          data-testid="reference-slots-container"
        >
          {/* Filled slots */}
          {sortedSlots.map((slot) => (
            <ReferenceSlot
              key={slot.id}
              slotData={slot}
              slotPosition={slot.slotPosition}
              onRoleChange={(role) =>
                onRoleChange?.(slot.slotPosition, role)
              }
              onStrengthChange={(strength) =>
                onStrengthChange?.(slot.slotPosition, strength)
              }
              onRemove={() => onRemove?.(slot.slotPosition)}
              onUpload={(file) => onUpload?.(file, slot.slotPosition)}
              onUploadUrl={(url) => onUploadUrl?.(url, slot.slotPosition)}
            />
          ))}

          {/* Trailing empty dropzone (only when not full) */}
          {!isFull && (
            <ReferenceSlot
              slotData={null}
              slotPosition={trailingPosition}
              onUpload={handleTrailingUpload}
              onUploadUrl={handleTrailingUploadUrl}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
