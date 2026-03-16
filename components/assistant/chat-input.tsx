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
  onSend: (text: string, imageUrl?: string) => void;
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
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  // AC-10: Send is enabled when there's text OR a pending image
  const canSend =
    (trimmed.length > 0 || !!pendingImageUrl) && !disabled && !isStreaming;

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

  // AC-5: Send message with content and optional imageUrl, then reset
  const handleSend = useCallback(() => {
    if (!canSend) return;
    // When only an image is attached without text, send a default content
    // to satisfy the backend's min_length=1 validation on the content field.
    const messageContent =
      pendingImageUrl && !trimmed ? "Analysiere dieses Bild" : trimmed;
    if (pendingImageUrl) {
      onSend(messageContent, pendingImageUrl);
    } else {
      onSend(messageContent);
    }
    setValue("");
    setPendingImageUrl(null);
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, trimmed, pendingImageUrl, onSend]);

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

  // AC-3: Store uploaded image URL
  const handleUploadComplete = useCallback((url: string) => {
    setPendingImageUrl(url);
  }, []);

  // AC-4: Remove pending image
  const handleRemoveImage = useCallback(() => {
    setPendingImageUrl(null);
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
      setPendingImageUrl(parsed.imageUrl);
    }
  }, []);

  // Touch drag drop target
  const handleTouchDrop = useCallback(
    (payload: GalleryDragPayload) => {
      setPendingImageUrl(payload.imageUrl);
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
      {/* AC-3: Image preview area above textarea when pendingImageUrl is set */}
      {pendingImageUrl && (
        <div
          className="border-t px-4 pt-3"
          data-testid="image-preview-area"
        >
          <ImagePreview
            src={pendingImageUrl}
            onRemove={handleRemoveImage}
            size="sm"
          />
        </div>
      )}

      <div className="flex items-end gap-2 border-t px-4 py-3">
        {/* AC-1: Image Upload Button with file picker */}
        {!hideImageUpload && (
          <ImageUploadButton
            onUploadComplete={handleUploadComplete}
            projectId={projectId ?? ""}
            disabled={disabled || isStreaming || !!pendingImageUrl}
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
