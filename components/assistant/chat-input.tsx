"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageUploadButton } from "./image-upload-button";
import { ImagePreview } from "./image-preview";
import { GALLERY_DRAG_MIME_TYPE, GALLERY_DROP_TARGET_ATTR, type GalleryDragPayload } from "@/lib/constants/drag-types";
import { useTouchDropTarget } from "@/hooks/use-touch-drop-target";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatInputProps {
  onSend: (text: string, imageUrls?: string[]) => void;
  /** Whether the assistant is currently streaming a response */
  isStreaming?: boolean;
  /** Callback to stop the current stream (required when isStreaming is true) */
  onStop?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Project ID for image upload to R2 */
  projectId?: string;
  /** Hide the image upload button (e.g. for canvas chat) */
  hideImageUpload?: boolean;
  /** Custom placeholder text (default: "Nachricht eingeben...") */
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

export function ChatInput({
  onSend,
  isStreaming = false,
  onStop,
  disabled = false,
  autoFocus = false,
  projectId,
  hideImageUpload = false,
  placeholder = "Nachricht eingeben...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  // AC-10: Send is enabled when there's text OR pending images
  const canSend =
    (trimmed.length > 0 || pendingImageUrls.length > 0) && !disabled && !isStreaming;

  // Auto-focus on mount when requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize the textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      autoResize();
    },
    [autoResize]
  );

  // AC-5: Send message with content and optional imageUrls, then reset
  const handleSend = useCallback(() => {
    if (!canSend) return;
    // When only images are attached without text, send a default content
    // to satisfy the backend's min_length=1 validation on the content field.
    const messageContent =
      pendingImageUrls.length > 0 && !trimmed ? "Analysiere diese Bilder" : trimmed;
    if (pendingImageUrls.length > 0) {
      onSend(messageContent, pendingImageUrls);
    } else {
      onSend(messageContent);
    }
    setValue("");
    setPendingImageUrls([]);
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, trimmed, pendingImageUrls, onSend]);

  const handleStop = useCallback(() => {
    if (onStop) {
      onStop();
    }
  }, [onStop]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // AC-3: Append uploaded image URL (multi-image support)
  const handleUploadComplete = useCallback((url: string) => {
    setPendingImageUrls(prev => [...prev, url]);
  }, []);

  // AC-4: Remove pending image by index
  const handleRemoveImage = useCallback((index: number) => {
    setPendingImageUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Gallery drag-to-chat handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(GALLERY_DRAG_MIME_TYPE)) {
        e.preventDefault();
        setIsDragOver(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const data = e.dataTransfer.getData(GALLERY_DRAG_MIME_TYPE);
    if (data) {
      const parsed = JSON.parse(data) as GalleryDragPayload;
      setPendingImageUrls(prev => [...prev, parsed.imageUrl]);
    }
  }, []);

  // Touch drag drop target
  const handleTouchDrop = useCallback(
    (payload: GalleryDragPayload) => {
      setPendingImageUrls(prev => [...prev, payload.imageUrl]);
    },
    []
  );
  const { isOver: touchIsOver } = useTouchDropTarget("chat-input", handleTouchDrop);

  const showDropHighlight = isDragOver || touchIsOver;

  return (
    <div
      data-testid="chat-input"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      {...{ [GALLERY_DROP_TARGET_ATTR]: "chat-input" }}
      className={cn(showDropHighlight && "ring-2 ring-primary/50 bg-primary/5 rounded-lg")}
    >
      {/* AC-3: Image preview strip above textarea when pending images exist */}
      {pendingImageUrls.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto border-t px-4 pt-3"
          data-testid="image-preview-area"
        >
          {pendingImageUrls.map((url, i) => (
            <ImagePreview
              key={url}
              src={url}
              onRemove={() => handleRemoveImage(i)}
              size="sm"
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t px-4 py-3">
        {/* AC-1: Image Upload Button with file picker */}
        {!hideImageUpload && (
          <ImageUploadButton
            onUploadComplete={handleUploadComplete}
            projectId={projectId ?? ""}
            disabled={disabled || isStreaming || pendingImageUrls.length >= 5}
          />
        )}

        {/* Textarea -- stays enabled during streaming (AC-7) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="chat-input-textarea"
        />

        {/* AC-4/AC-5: Stop button during streaming, Send button otherwise */}
        {isStreaming ? (
          <Button
            type="button"
            size="icon-xs"
            variant="destructive"
            onClick={handleStop}
            data-testid="stop-btn"
            aria-label="Stop response"
            className="shrink-0"
          >
            <Square className="size-3" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-xs"
            disabled={!canSend}
            onClick={handleSend}
            data-testid="send-btn"
            aria-label="Send message"
            className="shrink-0"
          >
            <ArrowUp className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
