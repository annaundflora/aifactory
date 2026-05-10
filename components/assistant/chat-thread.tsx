"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types/chat-message";
import { ImagePreview } from "./image-preview";
import { StreamingIndicator } from "./streaming-indicator";
import { IntentSummaryCard } from "./intent-summary-card";
import {
  PromptAssistantContext,
  type IntentSummaryPayload,
} from "@/lib/assistant/assistant-context";

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
        {/* AC-6: Thumbnails inline in user message bubble (120x120, rounded) */}
        {isUser && message.imageUrls && message.imageUrls.length > 0 && (
          <div className="mb-2 flex gap-2 flex-wrap">
            {message.imageUrls.map(url => (
              <ImagePreview key={url} src={url} size="md" />
            ))}
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

  // Slice 16: subscribe to FSM + intent-summary payload for inline card.
  // Use ``useContext`` directly (not ``usePromptAssistant``) so the thread
  // remains usable in presentational tests that render it without a
  // provider — in that case ``ctx`` is ``null`` and the card branch is a
  // no-op.
  const ctx = useContext(PromptAssistantContext);
  const flowState = ctx?.flowState ?? "idle";
  const intentSummaryPayload = ctx?.intentSummaryPayload ?? null;
  const dispatch = ctx?.dispatch ?? null;
  const sendMessage = ctx?.sendMessage ?? null;

  // ---------------------------------------------------------------------
  // Slice 16: IntentSummaryCard mount + freeze state
  // ---------------------------------------------------------------------
  //
  // **Mount strategy (AC-1, AC-7, AC-8):** the card is inserted at the
  // position in the messages list at which the LLM emitted the intent
  // summary (i.e. ``messages.length`` at the moment ``flowState`` first
  // becomes ``"summarizing"`` with a payload present). The card stays
  // anchored at that position even when subsequent messages are appended
  // (AC-7) and persists after either button is clicked (AC-6 / AC-7).
  //
  // **Freeze (AC-6):** clicking either button captures the current
  // payload as ``frozenPayload`` and flips ``frozen=true``; both buttons
  // become ``disabled`` and the visual treatment is dimmed (in the card
  // component itself).
  //
  // **No-card states (AC-8):** if no intent summary has ever been
  // received in this session, ``mountIndex`` stays ``null`` and no card
  // is rendered.
  const [mountIndex, setMountIndex] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [frozenPayload, setFrozenPayload] =
    useState<IntentSummaryPayload | null>(null);

  // First-mount: when the FSM enters "summarizing" with a payload, anchor
  // the card at the current end of the messages list. Subsequent
  // payload-replays do NOT change the mount index (the card already
  // exists in history; idempotent re-renders go to the same instance).
  useEffect(() => {
    if (
      flowState === "summarizing" &&
      intentSummaryPayload !== null &&
      mountIndex === null
    ) {
      setMountIndex(messages.length);
    }
  }, [flowState, intentSummaryPayload, mountIndex, messages.length]);

  // Discuss-click handler (AC-6, AC-9):
  //   - capture current payload as frozen snapshot
  //   - dispatch SET_FLOW_STATE("interviewing")
  //   - sendMessage("Was soll anders sein?")
  //   - flip ``frozen=true`` so both buttons become disabled
  const handleDiscuss = useCallback(() => {
    if (frozen) return;
    const snapshot = intentSummaryPayload ?? frozenPayload;
    if (snapshot) {
      setFrozenPayload(snapshot);
    }
    setFrozen(true);
    if (dispatch) {
      dispatch({ type: "SET_FLOW_STATE", flowState: "interviewing" });
    }
    if (sendMessage) {
      sendMessage("Was soll anders sein?");
    }
  }, [frozen, intentSummaryPayload, frozenPayload, dispatch, sendMessage]);

  // Generate-click handler is an EMPTY slot for Slice 17 to wire
  // (Auto-Apply + Auto-Generate + ``useIsGenerationPending`` precondition).
  // Slice 16 deliberately does NOT freeze the card here; freezing on
  // generate is a generation-pipeline concern (pending vs. settled) and
  // belongs to Slice 17 along with the actual generate call.
  const handleGenerate = useCallback(() => {
    // Intentionally empty — Slice 17 attaches the real handler.
  }, []);

  // Effective payload for rendering: when frozen, use the snapshot
  // (so a later RENDER_INTENT_SUMMARY for a different turn cannot mutate
  // the historic card). Otherwise read live from the reducer.
  const cardPayload = frozen ? frozenPayload : intentSummaryPayload;

  // AC-10: Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Render-decision: whether to show the card at all this pass.
  // AC-8: if the card was never mounted in this session and the FSM is
  // not in ``summarizing``, render nothing.
  const shouldRenderCard = mountIndex !== null && cardPayload !== null;

  if (messages.length === 0 && !shouldRenderCard) {
    return null;
  }

  // Clamp the insertion index so it never points past the current
  // messages list (defensive — RESET_SESSION wipes the messages array).
  const insertionIndex =
    mountIndex !== null ? Math.min(mountIndex, messages.length) : null;

  const renderedMessages: React.ReactNode[] = [];
  messages.forEach((message, idx) => {
    if (insertionIndex !== null && idx === insertionIndex && shouldRenderCard) {
      renderedMessages.push(
        <IntentSummaryCard
          key="intent-summary-card"
          payload={cardPayload!}
          frozen={frozen}
          onGenerate={handleGenerate}
          onDiscuss={handleDiscuss}
        />
      );
    }

    switch (message.role) {
      case "system":
        renderedMessages.push(
          <InitMessageBubble key={message.id} message={message} />
        );
        break;
      case "separator":
        renderedMessages.push(
          <ContextSeparator key={message.id} message={message} />
        );
        break;
      case "user":
      case "assistant":
        // Hide empty streaming assistant bubble — the StreamingIndicator handles this state
        if (
          message.role === "assistant" &&
          message.isStreaming &&
          !message.content
        ) {
          break;
        }
        renderedMessages.push(
          <MessageBubble
            key={message.id}
            message={message}
            onChipClick={onChipClick}
          />
        );
        break;
      default:
        break;
    }
  });

  // Card was anchored at-or-past the end of the list — render after all
  // existing messages (the very first mount lands here).
  if (
    insertionIndex !== null &&
    insertionIndex >= messages.length &&
    shouldRenderCard
  ) {
    renderedMessages.push(
      <IntentSummaryCard
        key="intent-summary-card"
        payload={cardPayload!}
        frozen={frozen}
        onGenerate={handleGenerate}
        onDiscuss={handleDiscuss}
      />
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      data-testid="chat-thread"
    >
      {renderedMessages}

      {/* Animated streaming indicator */}
      <StreamingIndicator visible={isStreaming} />

      {/* Scroll anchor */}
      <div ref={scrollAnchorRef} aria-hidden="true" />
    </div>
  );
}
