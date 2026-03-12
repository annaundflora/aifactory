"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { ArrowUp, Image, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatInputProps {
  onSend: (text: string) => void;
  /** Whether the assistant is currently streaming a response */
  isStreaming?: boolean;
  /** Callback to stop the current stream (required when isStreaming is true) */
  onStop?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
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
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled && !isStreaming;

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

  const handleSend = useCallback(() => {
    if (!canSend) return;
    console.log("[ChatInput] Sending:", trimmed);
    onSend(trimmed);
    setValue("");
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, trimmed, onSend]);

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

  return (
    <div
      className="flex items-end gap-2 border-t px-4 py-3"
      data-testid="chat-input"
    >
      {/* Image Upload Button (Placeholder) */}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground"
        data-testid="image-upload-btn"
        aria-label="Upload image"
        tabIndex={-1}
      >
        <Image className="size-4" />
      </Button>

      {/* Textarea -- stays enabled during streaming (AC-7) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Nachricht eingeben..."
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
  );
}
