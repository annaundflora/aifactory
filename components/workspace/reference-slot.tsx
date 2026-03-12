"use client";

import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from "react";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  GALLERY_DRAG_MIME_TYPE,
  type GalleryDragPayload,
} from "@/lib/constants/drag-types";
import type {
  ReferenceRole,
  ReferenceStrength,
  ReferenceSlotData,
} from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Role Color Config
// ---------------------------------------------------------------------------

interface RoleColorConfig {
  border: string;
  badgeBg: string;
  text: string;
  /** Raw hex color for inline styles (dot indicator, etc.) */
  dotColor: string;
  label: string;
}

export const ROLE_COLORS: Record<ReferenceRole, RoleColorConfig> = {
  style: {
    border: "border-[#C084FC50]",
    badgeBg: "bg-[#F3E8FF]",
    text: "text-[#9333EA]",
    dotColor: "#9333EA",
    label: "Style",
  },
  content: {
    border: "border-[#3B82F650]",
    badgeBg: "bg-[#DBEAFE]",
    text: "text-[#3B82F6]",
    dotColor: "#3B82F6",
    label: "Content",
  },
  structure: {
    border: "border-[#10B98150]",
    badgeBg: "bg-[#D1FAE5]",
    text: "text-[#059669]",
    dotColor: "#059669",
    label: "Structure",
  },
  character: {
    border: "border-[#F59E0B50]",
    badgeBg: "bg-[#FEF3C7]",
    text: "text-[#D97706]",
    dotColor: "#D97706",
    label: "Character",
  },
  color: {
    border: "border-[#EC489950]",
    badgeBg: "bg-[#FCE7F3]",
    text: "text-[#DB2777]",
    dotColor: "#DB2777",
    label: "Color",
  },
};

const ROLE_OPTIONS: ReferenceRole[] = [
  "style",
  "content",
  "structure",
  "character",
  "color",
];

const STRENGTH_OPTIONS: ReferenceStrength[] = [
  "subtle",
  "moderate",
  "strong",
  "dominant",
];

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Slot visual state (internal, not the same as slotData states)
// ---------------------------------------------------------------------------

type SlotVisualState = "empty" | "drag-over" | "uploading" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReferenceSlotProps {
  /** Slot data when an image is assigned; null for empty slot */
  slotData: ReferenceSlotData | null;
  /** Slot position for the label (e.g. 1 for "@1") -- used when slotData is null too */
  slotPosition?: number;
  /** Whether the slot is dimmed (model incompatibility) */
  dimmed?: boolean;
  /** Error message to show in error state */
  errorMessage?: string;
  /** Whether the slot is currently uploading (controlled from parent) */
  uploading?: boolean;
  /** Called when a file is dropped or selected via file dialog */
  onUpload?: (file: File) => void;
  /** Called when a URL is pasted */
  onUploadUrl?: (url: string) => void;
  /** Called when the role is changed */
  onRoleChange?: (role: ReferenceRole) => void;
  /** Called when the strength is changed */
  onStrengthChange?: (strength: ReferenceStrength) => void;
  /** Called when the remove button is clicked */
  onRemove?: () => void;
  /** Called when retry is clicked in error state */
  onRetry?: () => void;
  /** Called when a gallery generation is dropped (drag from GenerationCard) */
  onGalleryDrop?: (data: GalleryDragPayload) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferenceSlot({
  slotData,
  dimmed = false,
  errorMessage,
  uploading = false,
  onUpload,
  onUploadUrl,
  onRoleChange,
  onStrengthChange,
  onRemove,
  onRetry,
  onGalleryDrop,
}: ReferenceSlotProps) {
  // Internal visual state for drag-over (only relevant when empty)
  const [visualState, setVisualState] = useState<SlotVisualState>("empty");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine effective state
  const isReady = slotData !== null && !dimmed && !errorMessage && !uploading;
  const isDimmed = slotData !== null && dimmed;
  const isError = errorMessage != null && errorMessage.length > 0;
  const isUploading = uploading;

  // ---------------------------------------------------------------------------
  // Helpers: detect gallery drag via custom MIME type
  // ---------------------------------------------------------------------------

  const isGalleryDrag = useCallback((e: DragEvent<HTMLDivElement>): boolean => {
    return Array.from(e.dataTransfer.types).includes(GALLERY_DRAG_MIME_TYPE);
  }, []);

  // ---------------------------------------------------------------------------
  // Drag & Drop handlers (empty/error state)
  // ---------------------------------------------------------------------------

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // AC-7: Reject drops on filled (ready) slots
      if (isReady) return;

      const galleryDrag = isGalleryDrag(e);
      const hasFiles = e.dataTransfer.types.includes("Files");

      if (galleryDrag || hasFiles) {
        e.preventDefault();
        e.stopPropagation();
        setVisualState("drag-over");
      }
    },
    [isReady, isGalleryDrag]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setVisualState("empty");
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // AC-7: Reject drops on filled (ready) slots
      if (isReady) return;

      e.preventDefault();
      e.stopPropagation();

      // AC-6: Gallery drag takes precedence
      const galleryData = e.dataTransfer.getData(GALLERY_DRAG_MIME_TYPE);
      if (galleryData) {
        setVisualState("empty");
        try {
          const parsed: GalleryDragPayload = JSON.parse(galleryData);
          onGalleryDrop?.(parsed);
        } catch {
          // Invalid payload, ignore
        }
        return;
      }

      // AC-5: Native file drop (existing behavior)
      const file = e.dataTransfer.files?.[0];
      if (!file) {
        setVisualState("empty");
        return;
      }

      setVisualState("empty");
      onUpload?.(file);
    },
    [isReady, onUpload, onGalleryDrop]
  );

  // ---------------------------------------------------------------------------
  // Click-to-browse
  // ---------------------------------------------------------------------------

  const handleDropzoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      onUpload?.(file);
    },
    [onUpload]
  );

  // ---------------------------------------------------------------------------
  // URL paste handler
  // ---------------------------------------------------------------------------

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (!text.startsWith("http")) return;

      e.preventDefault();
      onUploadUrl?.(text);
    },
    [onUploadUrl]
  );

  // ---------------------------------------------------------------------------
  // Render: Uploading State
  // ---------------------------------------------------------------------------

  if (isUploading) {
    return (
      <div
        className="relative flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/40 p-4 gap-2 min-h-[80px]"
        data-testid="reference-slot"
        data-state="uploading"
      >
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          data-testid="upload-spinner"
        />
        <span className="text-sm text-muted-foreground">Uploading...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error State
  // ---------------------------------------------------------------------------

  if (isError) {
    return (
      <div
        className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-destructive/60 p-4 gap-1 min-h-[80px]"
        data-testid="reference-slot"
        data-state="error"
      >
        <p
          className="text-center text-sm font-medium text-destructive"
          data-testid="error-message"
        >
          {errorMessage}
        </p>
        <button
          type="button"
          className="text-sm text-primary underline hover:text-primary/80"
          onClick={onRetry}
          data-testid="retry-link"
        >
          Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Dimmed State
  // ---------------------------------------------------------------------------

  if (isDimmed && slotData) {
    const roleColors = ROLE_COLORS[slotData.role];
    return (
      <div
        className={cn(
          "relative flex items-start gap-3 rounded-lg border-2 p-3 opacity-50",
          roleColors.border
        )}
        data-testid="reference-slot"
        data-state="dimmed"
      >
        {/* Thumbnail */}
        <img
          src={slotData.imageUrl}
          alt={slotData.originalFilename ?? `Reference @${slotData.slotPosition}`}
          className="size-[80px] shrink-0 rounded object-cover"
          data-testid="reference-thumbnail"
        />

        {/* Info area */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          {/* Label row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge variant="default" data-testid="slot-label">
                @{slotData.slotPosition}
              </Badge>
              <Badge
                className={cn(roleColors.badgeBg, roleColors.text, "border-transparent")}
                variant="secondary"
                data-testid="role-badge"
              >
                {roleColors.label}
              </Badge>
            </div>

            {/* Remove button remains active when dimmed */}
            <button
              type="button"
              onClick={onRemove}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
              aria-label="Remove reference"
              data-testid="remove-button"
            >
              <X className="size-3" />
            </button>
          </div>

          {/* Warning text */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span data-testid="dimmed-warning">Will be ignored</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Ready State
  // ---------------------------------------------------------------------------

  if (isReady && slotData) {
    const roleColors = ROLE_COLORS[slotData.role];
    return (
      <div
        className={cn(
          "relative flex items-start gap-3 rounded-lg border-2 p-3",
          roleColors.border
        )}
        data-testid="reference-slot"
        data-state="ready"
        data-role={slotData.role}
      >
        {/* Thumbnail */}
        <img
          src={slotData.imageUrl}
          alt={slotData.originalFilename ?? `Reference @${slotData.slotPosition}`}
          className="size-[80px] shrink-0 rounded object-cover"
          data-testid="reference-thumbnail"
        />

        {/* Controls area */}
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          {/* Label + Badge + Remove row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge variant="default" data-testid="slot-label">
                @{slotData.slotPosition}
              </Badge>
              <Badge
                className={cn(roleColors.badgeBg, roleColors.text, "border-transparent")}
                variant="secondary"
                data-testid="role-badge"
              >
                {roleColors.label}
              </Badge>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
              aria-label="Remove reference"
              data-testid="remove-button"
            >
              <X className="size-3" />
            </button>
          </div>

          {/* Role Dropdown */}
          <Select
            value={slotData.role}
            onValueChange={(value) =>
              onRoleChange?.(value as ReferenceRole)
            }
          >
            <SelectTrigger
              className="h-7 text-xs w-full"
              data-testid="role-dropdown"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{
                    backgroundColor: ROLE_COLORS[slotData.role].dotColor,
                  }}
                  data-testid="role-dot"
                />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{
                        backgroundColor: ROLE_COLORS[role].dotColor,
                      }}
                    />
                    {ROLE_COLORS[role].label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Strength Dropdown */}
          <Select
            value={slotData.strength}
            onValueChange={(value) =>
              onStrengthChange?.(value as ReferenceStrength)
            }
          >
            <SelectTrigger
              className="h-7 text-xs w-full"
              data-testid="strength-dropdown"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRENGTH_OPTIONS.map((strength) => (
                <SelectItem key={strength} value={strength}>
                  {capitalizeFirst(strength)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Empty / Drag-Over State
  // ---------------------------------------------------------------------------

  const isDragOver = visualState === "drag-over";

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 transition-colors min-h-[80px] gap-1 p-4 cursor-pointer",
        isDragOver
          ? "border-solid border-primary bg-primary/5"
          : "border-dashed border-muted-foreground/40 hover:border-muted-foreground/70"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleDropzoneClick}
      data-testid="reference-slot"
      data-state={isDragOver ? "drag-over" : "empty"}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleDropzoneClick();
        }
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileInputChange}
        data-testid="file-input"
        tabIndex={-1}
      />

      {isDragOver ? (
        <p className="text-center text-sm font-medium text-primary">
          Drop to add
        </p>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground">
            Drop image here, click to browse, or paste a URL
          </p>
          {/* URL paste input */}
          <input
            type="text"
            placeholder="https://..."
            className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onPaste={handlePaste}
            onClick={(e) => e.stopPropagation()}
            data-testid="url-input"
            readOnly={false}
          />
        </>
      )}
    </div>
  );
}
