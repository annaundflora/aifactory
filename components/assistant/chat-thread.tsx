"use client";

import { useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/assistant/assistant-context";
import { StreamingIndicator } from "./streaming-indicator";
import { ImagePreview } from "./image-preview";

// ---------------------------------------------------------------------------
// Constants for "Verbessere" Chip (Slice 19, AC-8)
// ---------------------------------------------------------------------------

/**
 * Prefix used by the "Verbessere meinen aktuellen Prompt" suggestion chip.
 * When workspace fields are included, the message contains this prefix
 * followed by a context block in brackets.
 */
const WORKSPACE_CONTEXT_PATTERN = /\n\n\[Aktueller Prompt: .+\]$/;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatThreadProps {
  messages: Message[];
  isStreaming: boolean;
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  // Slice-19 AC-8: Split workspace context from user message for styled display
  const { mainContent, workspaceContext } = useMemo(() => {
    if (isUser && WORKSPACE_CONTEXT_PATTERN.test(message.content)) {
      const match = message.content.match(WORKSPACE_CONTEXT_PATTERN);
      if (match) {
        return {
          mainContent: message.content.slice(0, match.index).trim(),
          workspaceContext: match[0].trim(),
        };
      }
    }
    return { mainContent: message.content, workspaceContext: null };
  }, [message.content, isUser]);

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
      data-testid={
        isError
          ? "error-message"
          : isUser
            ? "user-message"
            : "assistant-message"
      }
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser &&
            "bg-primary text-primary-foreground rounded-br-md",
          !isUser &&
            !isError &&
            "bg-muted text-foreground rounded-bl-md",
          isError &&
            "bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-md"
        )}
      >
        {/* AC-6: Thumbnail inline in user message bubble (120x120, rounded) */}
        {isUser && message.imageUrl && (
          <div className="mb-2">
            <ImagePreview src={message.imageUrl} size="md" />
          </div>
        )}

        {/* Message content -- text builds up character by character via text-delta (AC-3) */}
        <div className="whitespace-pre-wrap break-words">
          {mainContent}
          {message.isStreaming && message.content.length === 0 && (
            <span className="text-muted-foreground">...</span>
          )}
        </div>

        {/* Slice-19 AC-8: Display workspace context in a visually distinct style */}
        {workspaceContext && (
          <div
            className="mt-1.5 text-xs opacity-70 font-mono"
            data-testid="workspace-context"
          >
            {workspaceContext}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatThread
// ---------------------------------------------------------------------------

export function ChatThread({ messages, isStreaming }: ChatThreadProps) {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // AC-10: Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      data-testid="chat-thread"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* AC-1/AC-2: Streaming indicator below last assistant message */}
      <StreamingIndicator visible={isStreaming} />

      {/* Scroll anchor */}
      <div ref={scrollAnchorRef} aria-hidden="true" />
    </div>
  );
}
