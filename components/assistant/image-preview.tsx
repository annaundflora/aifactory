"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImagePreviewProps {
  /** The image URL to display */
  src: string;
  /** Callback to remove the image (shows X button when provided) */
  onRemove?: () => void;
  /** Size variant: "sm" for pending preview (80x80), "md" for message inline (120x120) */
  size?: "sm" | "md";
}

// ---------------------------------------------------------------------------
// Size config
// ---------------------------------------------------------------------------

const sizeClasses = {
  sm: "h-20 w-20", // 80x80 - pending preview above textarea
  md: "h-[120px] w-[120px]", // 120x120 - inline in user message bubble
} as const;

// ---------------------------------------------------------------------------
// ImagePreview
// ---------------------------------------------------------------------------

export function ImagePreview({
  src,
  onRemove,
  size = "sm",
}: ImagePreviewProps) {
  return (
    <div
      className={cn("relative inline-block", sizeClasses[size])}
      data-testid="image-preview"
    >
      <img
        src={src}
        alt="Uploaded reference"
        className={cn(
          "h-full w-full rounded-lg object-cover",
          size === "md" && "rounded-xl"
        )}
      />
      {onRemove && (
        <Button
          type="button"
          variant="secondary"
          size="icon-xs"
          className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full shadow-sm"
          onClick={onRemove}
          data-testid="image-preview-remove"
          aria-label="Remove image"
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
