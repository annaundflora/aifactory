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
import { PasteDetectConfirmCard } from "./paste-detect-confirm-card";
import {
  PromptAssistantContext,
  type IntentSummaryPayload,
} from "@/lib/assistant/assistant-context";
import { detectPastedPrompt } from "@/lib/assistant/paste-detect";
import { useDetailViewOpener } from "@/lib/workspace/detail-view-opener-context";

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
// ResultMessageBubble (Slice 18 — `result_message` variant)
// ---------------------------------------------------------------------------

/**
 * Renders an assistant message that carries a ``resultImageUrl`` marker
 * (set on the first proactive starter after a successful generate cycle —
 * see ``use-assistant-runtime.ts`` auto-apply-settle path).
 *
 * Layout per wireframes.md → "Screen: Reviewing Turn" → Annotation ①:
 *   - Thumbnail (left, ~120px square, rounded) of the just-generated image.
 *   - Assistant text (right, multiline) with the proactive comment.
 *
 * Click on the thumbnail (or Enter/Space when focused) opens the existing
 * detail-view (``components/canvas/canvas-detail-view.tsx`` via the
 * ``DetailViewOpenerProvider`` registered in ``WorkspaceContent``).
 * ``data-testid="result_message.thumbnail"`` matches AC-5.
 *
 * **Reuse-Pflicht (AC-6):** the click handler delegates to the
 * ``openDetailView`` callback — no new modal, no new wrapper. When the
 * opener is unavailable (presentational tests / sheet outside the
 * workspace tree) the click is a no-op, but the marker still renders so
 * snapshot-tests of the layout stay deterministic.
 *
 * **Default-bubble fallback (AC-7):** when the message lacks a
 * ``resultImageUrl`` marker, the parent does NOT mount this component —
 * the regular ``MessageBubble`` handles those messages unchanged.
 */
function ResultMessageBubble({ message }: { message: ChatMessage }) {
  const opener = useDetailViewOpener();

  const handleOpen = useCallback(() => {
    if (!opener) return;
    const generationId = message.resultGenerationId;
    if (!generationId) return;
    opener.openDetailView(generationId);
  }, [opener, message.resultGenerationId]);

  // Keyboard activation per AC-5: Enter AND Space trigger the same click
  // handler. ``preventDefault`` on Space stops the page from scrolling
  // (default browser behaviour for Space on focusable elements).
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  return (
    <div
      className="flex w-full justify-start"
      data-testid="result-message"
    >
      <div className="flex max-w-[90%] gap-3 rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed text-foreground rounded-bl-md">
        {/* AC-5: thumbnail (left, ~120px square, rounded). role=button +
            tabindex=0 so it is reachable via keyboard; the keyboard
            handler covers Enter AND Space (AC-5 + AC-6). */}
        {message.resultImageUrl && (
          <div
            data-testid="result_message.thumbnail"
            role="button"
            tabIndex={0}
            aria-label="Open generated image in detail view"
            onClick={handleOpen}
            onKeyDown={handleKeyDown}
            className="size-[120px] shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {/* Plain <img> — no Next/Image because the URL may be a
                Replicate / S3 presigned host that is not configured in
                ``next.config.ts`` image-domains. The chat ImagePreview
                component (used for user uploads) uses the same approach.
            */}
            <img
              src={message.resultImageUrl}
              alt=""
              className="size-full object-cover"
              draggable={false}
            />
          </div>
        )}
        {/* Assistant text (right, multiline) — same whitespace handling
            as the default bubble so streamed text-deltas render the same
            way (AC-3 streaming continues to work). */}
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
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
  const pasteConfirmPayload = ctx?.pasteConfirmPayload ?? null;
  const sessionId = ctx?.sessionId ?? null;
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

  // ---------------------------------------------------------------------
  // Slice 27 — Paste-Detect-Confirm trigger-layer
  // ---------------------------------------------------------------------
  //
  // **Trigger contract (AC-1, AC-2, AC-3):**
  //  - Fires exactly once per session, on the FIRST user message only.
  //  - Dispatches ``RENDER_PASTE_CONFIRM`` with ``{ seedText }`` when
  //    ``detectPastedPrompt`` returns ``true``.
  //  - Subsequent user messages do NOT re-trigger, even if they would
  //    match the heuristic (single-fire is enforced via the ref flag).
  //  - When the heuristic returns ``false`` on the first user message
  //    no action is dispatched and the ref flag is still latched so a
  //    later message in the same session cannot retro-trigger.
  //
  // **Session boundary:** the ref flag is keyed on ``sessionId`` so a
  // new session (RESET_SESSION → new id, or LOAD_SESSION → different
  // id) re-arms the trigger. ``pasteTriggerSessionRef`` stores the
  // session-key for which the single-fire latch is currently armed.
  // When the key changes the effect compares against the stored value
  // and re-arms the trigger.
  const pasteTriggerSessionRef = useRef<string | null>(null);
  // ``pasteTriggerLatchedRef`` is the actual one-shot latch. ``true``
  // means the effect has already evaluated the first user message for
  // the current session — even a heuristic miss latches (AC-3 implies
  // the trigger evaluates exactly once on the FIRST user message).
  const pasteTriggerLatchedRef = useRef(false);
  useEffect(() => {
    if (!dispatch) return;

    // Re-arm on session change. ``sessionId`` may be ``null`` before
    // the runtime allocates one; treat ``null`` as a distinct
    // "not-yet-bound" session so the trigger can still fire pre-bind
    // (the runtime sends the message, then writes the id back).
    //
    // IMPORTANT: The ``__unbound__`` → real-id transition must NOT
    // re-arm the latch. On a fresh session the runtime allocates the
    // sessionId AFTER the first user message dispatch, so the effect
    // first runs with ``sessionKey='__unbound__'`` (latch armed →
    // dispatch fires), then re-runs after SET_SESSION_ID flips the
    // key to a real id. If we re-armed on that transition the latch
    // would reset and dispatch a SECOND time, violating AC-1
    // ("genau einmal"). Reducer is idempotent but contract demands
    // a single dispatch.
    //
    // Re-arm therefore only on transitions between two REAL session
    // ids (e.g. RESET_SESSION → new id, LOAD_SESSION → different id).
    const sessionKey = sessionId ?? "__unbound__";
    const previousKey = pasteTriggerSessionRef.current;
    if (previousKey !== sessionKey) {
      const isUnboundToRealTransition =
        previousKey === "__unbound__" && sessionKey !== "__unbound__";
      pasteTriggerSessionRef.current = sessionKey;
      if (!isUnboundToRealTransition) {
        // Either initial mount (previousKey === null), or a transition
        // between two real ids — re-arm the single-fire latch.
        pasteTriggerLatchedRef.current = false;
      }
    }

    // Single-fire guard: if we've already evaluated for this session,
    // bail out regardless of the heuristic outcome. This is what
    // ensures AC-2 holds even when later messages would match.
    if (pasteTriggerLatchedRef.current) {
      return;
    }

    // Find the first user message in the current messages list. We
    // iterate (rather than checking ``messages[0]``) because the
    // chat-thread also renders system / separator entries; the spec
    // is explicit that the trigger keys on the first USER message.
    const firstUserMessage = messages.find((m) => m.role === "user");
    if (!firstUserMessage) {
      // No user message yet — nothing to evaluate. Stay un-latched so
      // the next render with a user message can fire.
      return;
    }

    // Latch BEFORE dispatching so a synchronous re-render (from the
    // dispatch itself) cannot double-fire. AC-3: even a non-match
    // latches the session — the heuristic fires on the FIRST user
    // message only, regardless of outcome.
    pasteTriggerLatchedRef.current = true;

    if (detectPastedPrompt(firstUserMessage.content)) {
      dispatch({
        type: "RENDER_PASTE_CONFIRM",
        payload: { seedText: firstUserMessage.content },
      });
    }
  }, [messages, sessionId, dispatch]);

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

  // Slice 27: render-decision for the Paste-Detect-Confirm card. The
  // card is mounted at the END of the messages list (after the first
  // user-message bubble) and is fully transient — DISMISS_PASTE_CONFIRM
  // un-mounts it without leaving a history element.
  const shouldRenderPasteCard = pasteConfirmPayload !== null;

  if (messages.length === 0 && !shouldRenderCard && !shouldRenderPasteCard) {
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
        {
          // Slice 18 AC-5: assistant messages carrying a ``resultImageUrl``
          // marker render the ``result_message`` variant (thumbnail +
          // text). The thumbnail must appear immediately on placeholder
          // mount (before the proactive comment streams in) so the user
          // sees what the assistant is referencing — therefore the
          // empty-streaming-bubble suppression below is bypassed for
          // result_message variants. Messages without the marker fall
          // through to the default bubble (AC-7 — bestehende
          // Bubble-Rendering aus Slice 16/17 unverändert).
          const hasResultMarker =
            message.role === "assistant" &&
            typeof message.resultImageUrl === "string" &&
            message.resultImageUrl.length > 0 &&
            !message.isError;

          // Hide empty streaming assistant bubble — the StreamingIndicator
          // handles this state. Skipped for result_message variants (see
          // above) so the thumbnail mounts at placeholder creation time.
          if (
            message.role === "assistant" &&
            message.isStreaming &&
            !message.content &&
            !hasResultMarker
          ) {
            break;
          }

          if (hasResultMarker) {
            renderedMessages.push(
              <ResultMessageBubble key={message.id} message={message} />
            );
            break;
          }
          renderedMessages.push(
            <MessageBubble
              key={message.id}
              message={message}
              onChipClick={onChipClick}
            />
          );
        }
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

  // Slice 27: render the Paste-Detect-Confirm card at the END of the
  // thread — it always lands directly after the first user-message
  // bubble (which is the most recent rendered element when the trigger
  // fires). The card has no positional anchor (unlike the
  // IntentSummaryCard) because it is transient: once dismissed it
  // unmounts and never re-renders, so re-anchoring on subsequent turns
  // is moot.
  if (shouldRenderPasteCard) {
    renderedMessages.push(<PasteDetectConfirmCard key="paste-confirm-card" />);
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
