"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { StreamingIndicator } from "@/components/assistant/streaming-indicator";
import { type ChatMessage } from "@/lib/types/chat-message";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasChatMessagesProps {
  messages: ChatMessage[];
  /** True while a bot response is being streamed (shows streaming indicator) */
  isStreaming?: boolean;
  onChipClick?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// InitMessageBubble (system context)
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
// ContextSeparator
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
// MessageBubble (user / bot)
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

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      data-testid={isUser ? "user-message" : "bot-message"}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser && "bg-primary text-primary-foreground rounded-br-md",
          !isUser && !isError && "bg-muted text-foreground rounded-bl-md",
          // AC-9: Error bubbles visually marked
          !isUser && isError && "bg-destructive/10 text-destructive border border-destructive/30 rounded-bl-md"
        )}
        data-testid={isError ? "bot-message-error" : undefined}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>

        {/* AC-5: Clarification chips below bot text */}
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
// CanvasChatMessages
// ---------------------------------------------------------------------------

export function CanvasChatMessages({
  messages,
  isStreaming = false,
  onChipClick,
}: CanvasChatMessagesProps) {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming state changes
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
      data-testid="canvas-chat-messages"
    >
      {messages.map((message) => {
        switch (message.role) {
          case "system":
            return <InitMessageBubble key={message.id} message={message} />;
          case "separator":
            return <ContextSeparator key={message.id} message={message} />;
          case "user":
          case "bot":
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

      {/* AC-3: Streaming indicator while text-delta events are being received */}
      <StreamingIndicator visible={isStreaming} />

      {/* Scroll anchor */}
      <div ref={scrollAnchorRef} aria-hidden="true" />
    </div>
  );
}
