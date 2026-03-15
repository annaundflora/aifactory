"use client";

import { useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types/chat-message";
import { ImagePreview } from "./image-preview";
import { StreamingIndicator } from "./streaming-indicator";

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
  messages: ChatMessage[];
  isStreaming: boolean;
  /** Callback when a clarification chip is clicked (canvas chat) */
  onChipClick?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// InitMessageBubble (system context — canvas chat)
// ---------------------------------------------------------------------------

function InitMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full justify-start" data-testid="init-message">
      <div className="max-w-[90%] rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
        <div className="whitespace-pre-wrap break-words font-mono">
          {message.content}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextSeparator (canvas chat)
// ---------------------------------------------------------------------------

function ContextSeparator({ message }: { message: ChatMessage }) {
  return (
    <div
      className="flex items-center gap-2 py-2"
      data-testid="context-separator"
    >
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-xs text-muted-foreground">
        {message.content}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  onChipClick,
}: {
  message: ChatMessage;
  onChipClick?: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const isError = message.isError === true;

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
        data-testid={isError ? "bot-message-error" : undefined}
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

        {/* Clarification chips below assistant text (canvas chat) */}
        {!isUser && message.chips && message.chips.length > 0 && (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            data-testid="chat-chips"
          >
            {message.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => onChipClick?.(chip)}
                data-testid="chat-chip-button"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatThread
// ---------------------------------------------------------------------------

export function ChatThread({ messages, isStreaming, onChipClick }: ChatThreadProps) {
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
      {messages.map((message) => {
        switch (message.role) {
          case "system":
            return <InitMessageBubble key={message.id} message={message} />;
          case "separator":
            return <ContextSeparator key={message.id} message={message} />;
          case "user":
          case "assistant":
            // Hide empty streaming assistant bubble — the StreamingIndicator handles this state
            if (message.role === "assistant" && message.isStreaming && !message.content) {
              return null;
            }
            return (
              <MessageBubble
                key={message.id}
                message={message}
                onChipClick={onChipClick}
              />
            );
          default:
            return null;
        }
      })}

      {/* Animated streaming indicator */}
      <StreamingIndicator visible={isStreaming} />

      {/* Scroll anchor */}
      <div ref={scrollAnchorRef} aria-hidden="true" />
    </div>
  );
}
