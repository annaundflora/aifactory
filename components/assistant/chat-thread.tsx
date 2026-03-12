"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/assistant/assistant-context";
import { StreamingIndicator } from "./streaming-indicator";
import { ImagePreview } from "./image-preview";

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
          {message.content}
          {message.isStreaming && message.content.length === 0 && (
            <span className="text-muted-foreground">...</span>
          )}
        </div>
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
