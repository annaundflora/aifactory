"use client";

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadSourceImage } from "@/app/actions/upload";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ImageUploadButtonProps {
  /** Called with the R2 URL after a successful upload */
  onUploadComplete: (url: string) => void;
  /** Called when an error occurs (validation or upload) */
  onError?: (msg: string) => void;
  /** Project ID for R2 upload path */
  projectId: string;
  /** Whether the button should be disabled */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// ImageUploadButton
// ---------------------------------------------------------------------------

export function ImageUploadButton({
  onUploadComplete,
  onError,
  projectId,
  disabled = false,
}: ImageUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (isUploading || disabled) return;
    fileInputRef.current?.click();
  }, [isUploading, disabled]);

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      if (!file) return;

      // AC-8: Validate file type client-side
      if (!ACCEPTED_TYPES.includes(file.type)) {
        const msg = "Nur JPEG, PNG und WebP Bilder werden unterstuetzt";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      // AC-7: Validate file size client-side
      if (file.size > MAX_FILE_SIZE) {
        const msg = "Bild darf maximal 10 MB gross sein";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      // AC-2: Start upload with progress indicator
      setIsUploading(true);

      try {
        const result = await uploadSourceImage({ projectId, file });

        if ("error" in result) {
          // AC-9: Upload error toast
          const msg = result.error || "Bild konnte nicht hochgeladen werden";
          toast.error(msg);
          onError?.(msg);
          return;
        }

        // AC-3: Upload complete - pass URL to parent
        onUploadComplete(result.url);
      } catch {
        // AC-9: Network/unexpected error toast
        const msg = "Bild konnte nicht hochgeladen werden";
        toast.error(msg);
        onError?.(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, onUploadComplete, onError]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        data-testid="image-upload-input"
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground"
        onClick={handleClick}
        disabled={disabled || isUploading}
        data-testid="image-upload-btn"
        aria-label={isUploading ? "Uploading image" : "Upload image"}
        tabIndex={-1}
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Image className="size-4" />
        )}
      </Button>
    </>
  );
}
