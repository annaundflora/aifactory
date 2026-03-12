"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent, type ClipboardEvent } from "react";
import { uploadSourceImage } from "@/app/actions/upload";
import { Loader2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DropzoneState = "empty" | "drag-over" | "uploading" | "preview" | "error";

interface ImageInfo {
  url: string;
  filename: string;
  width: number;
  height: number;
}

interface ImageDropzoneProps {
  projectId: string;
  onUpload: (url: string | null) => void;
  initialUrl?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageDropzone({ projectId, onUpload, initialUrl }: ImageDropzoneProps) {
  const [state, setState] = useState<DropzoneState>(initialUrl ? "preview" : "empty");
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(
    initialUrl ? { url: initialUrl, filename: "", width: 0, height: 0 } : null
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Track the state before a drag enters so we can restore it on drag-leave
  const preDragState = useRef<DropzoneState>(initialUrl ? "preview" : "empty");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const readImageDimensions = useCallback((url: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setState("uploading");
      setErrorMessage("");

      // Create a local object URL for immediate preview during upload
      const objectUrl = URL.createObjectURL(file);

      const result = await uploadSourceImage({ projectId, file });

      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      if ("error" in result) {
        setErrorMessage(result.error);
        setState("error");
        return;
      }

      // Read dimensions from the R2 URL
      const { width, height } = await readImageDimensions(result.url);

      setImageInfo({
        url: result.url,
        filename: file.name,
        width,
        height,
      });
      setState("preview");
      onUpload(result.url);
    },
    [projectId, onUpload, readImageDimensions]
  );

  // ---------------------------------------------------------------------------
  // Drag & Drop handlers
  // ---------------------------------------------------------------------------

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState((current) => {
      if (current !== "drag-over") {
        preDragState.current = current;
      }
      return "drag-over";
    });
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState(preDragState.current);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) {
        setState("empty");
        return;
      }

      processFile(file);
    },
    [processFile]
  );

  // ---------------------------------------------------------------------------
  // Click-to-browse handler
  // ---------------------------------------------------------------------------

  const handleDropzoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input so same file can be re-selected after removal
      e.target.value = "";
      processFile(file);
    },
    [processFile]
  );

  // ---------------------------------------------------------------------------
  // URL paste handler
  // ---------------------------------------------------------------------------

  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (!text.startsWith("http")) return;

      e.preventDefault();
      setErrorMessage("");

      // Enter uploading state first — URL is proxied server-side through R2
      setState("uploading");

      const result = await uploadSourceImage({ projectId, url: text });

      if ("error" in result) {
        setErrorMessage(result.error);
        setState("error");
        return;
      }

      const { width, height } = await readImageDimensions(result.url);
      setImageInfo({ url: result.url, filename: "", width, height });
      setState("preview");
      onUpload(result.url);
    },
    [projectId, onUpload, readImageDimensions]
  );

  // ---------------------------------------------------------------------------
  // Remove handler
  // ---------------------------------------------------------------------------

  const handleRemove = useCallback(() => {
    setImageInfo(null);
    setErrorMessage("");
    setState("empty");
    onUpload(null);
  }, [onUpload]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Container border classes vary by state
  const containerBase =
    "relative flex flex-col items-center justify-center rounded-lg border-2 transition-colors";

  const borderClasses: Record<DropzoneState, string> = {
    empty: "border-dashed border-muted-foreground/40 cursor-pointer hover:border-muted-foreground/70",
    "drag-over": "border-solid border-primary bg-primary/5 cursor-copy",
    uploading: "border-dashed border-muted-foreground/40",
    preview: "border-solid border-border",
    error: "border-dashed border-destructive/60 cursor-pointer hover:border-destructive",
  };

  // ---------------------------------------------------------------------------
  // Preview state
  // ---------------------------------------------------------------------------

  if (state === "preview" && imageInfo) {
    return (
      <div
        className={`${containerBase} ${borderClasses.preview} p-3 gap-2`}
        data-testid="image-dropzone"
        data-state="preview"
      >
        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageInfo.url}
          alt={imageInfo.filename}
          className="max-h-40 max-w-full rounded object-contain"
          data-testid="image-thumbnail"
        />

        {/* Metadata row */}
        <div className="flex w-full items-center justify-between gap-2 text-sm">
          <div className="flex min-w-0 flex-col">
            {imageInfo.filename && (
              <span
                className="truncate text-foreground"
                data-testid="image-filename"
                title={imageInfo.filename}
              >
                {imageInfo.filename}
              </span>
            )}
            {(imageInfo.width > 0 || imageInfo.height > 0) && (
              <span
                className="text-xs text-muted-foreground"
                data-testid="image-dimensions"
              >
                {imageInfo.width}x{imageInfo.height}
              </span>
            )}
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemove}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
            aria-label="Remove image"
            data-testid="remove-image-button"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Uploading state
  // ---------------------------------------------------------------------------

  if (state === "uploading") {
    return (
      <div
        className={`${containerBase} ${borderClasses.uploading} min-h-32 gap-2 p-6`}
        data-testid="image-dropzone"
        data-state="uploading"
      >
        <Loader2 className="size-8 animate-spin text-muted-foreground" data-testid="upload-spinner" />
        <span className="text-sm text-muted-foreground">Uploading...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty, drag-over, and error states (share same dropzone container)
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`${containerBase} ${borderClasses[state]} min-h-32 gap-1 p-6`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleDropzoneClick}
      data-testid="image-dropzone"
      data-state={state}
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

      {state === "error" ? (
        <>
          <p
            className="text-center text-sm font-medium text-destructive"
            data-testid="error-message"
          >
            {errorMessage}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Drop or click to try again
          </p>
        </>
      ) : (
        <>
          <p className="text-center text-sm font-medium text-foreground">
            Drop image here
          </p>
          <p className="text-center text-xs text-muted-foreground">
            or click to upload
          </p>
          <p className="text-center text-xs text-muted-foreground">
            or paste URL
          </p>
        </>
      )}

      {/* URL paste input — visually minimal, only shown in empty/error states */}
      {(state === "empty" || state === "error") && (
        <input
          type="text"
          placeholder="https://..."
          className="mt-2 w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onPaste={handlePaste}
          onClick={(e) => e.stopPropagation()}
          data-testid="url-input"
          readOnly={false}
        />
      )}
    </div>
  );
}
