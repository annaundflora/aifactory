"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// CanvasChatInput
// ---------------------------------------------------------------------------

export function CanvasChatInput({
  onSend,
  disabled = false,
}: CanvasChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !disabled;

  // AC-11: Send message and clear input
  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [canSend, trimmed, onSend]);

  // AC-11: Enter to send (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    },
    []
  );

  return (
    <div
      className="flex items-end gap-2 border-t border-border/60 px-3 py-2"
      data-testid="canvas-chat-input"
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Describe changes..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="canvas-chat-input-textarea"
      />
      <Button
        type="button"
        size="icon-xs"
        disabled={!canSend}
        onClick={handleSend}
        data-testid="canvas-chat-send-button"
        aria-label="Send message"
        className="shrink-0"
      >
        <ArrowUp className="size-3" />
      </Button>
    </div>
  );
}
