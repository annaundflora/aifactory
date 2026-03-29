"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { MessageSquare, PanelRightClose, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TierToggle } from "@/components/ui/tier-toggle";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { ChatThread } from "@/components/assistant/chat-thread";
import { ChatInput } from "@/components/assistant/chat-input";
import { ModelSelector, DEFAULT_MODEL_SLUG } from "@/components/assistant/model-selector";
import { type Generation } from "@/lib/db/queries";

/** @deprecated Legacy type kept for backward compat until consumers migrate to ModelSlot. */
type ModelSetting = {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
  createdAt: Date;
  updatedAt: Date;
};
import { type ChatMessage } from "@/lib/types/chat-message";
import type { Tier } from "@/lib/types";
import {
  createSession,
  sendMessage as sendCanvasMessage,
  type CanvasImageContext,
  type CanvasSSEEvent,
  type SSECanvasGenerateEvent,
} from "@/lib/canvas-chat-service";
import { generateImages } from "@/app/actions/generations";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;
const COLLAPSED_WIDTH = 48;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasChatPanelProps {
  generation: Generation;
  projectId: string;
  /** Called with pending generation IDs so the parent can start polling. */
  onPendingGenerations?: (pendingIds: string[]) => void;
  /** Called with newly created generations so the gallery state stays in sync. */
  onGenerationsCreated?: (newGens: Generation[]) => void;
  /** Model settings for tier-based model resolution. Falls back to generation.modelId if empty. */
  modelSettings?: ModelSetting[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitMessage(generation: Generation): ChatMessage {
  return {
    id: `init-${generation.id}-${crypto.randomUUID()}`,
    role: "system",
    content: "Beschreibe, was du an diesem Bild verändern möchtest — ich helfe dir mit Prompt-Optimierung, Variationen oder Upscaling.",
  };
}

function buildImageContext(generation: Generation, modelSettings: ModelSetting[] = []): CanvasImageContext {
  // Build tier_models from img2img model settings
  const tierModels: Record<string, string> = {};
  for (const s of modelSettings) {
    if (s.mode === "img2img" && s.modelId) {
      tierModels[s.tier] = s.modelId;
    }
  }

  return {
    image_url: generation.imageUrl ?? "",
    prompt: generation.prompt ?? "",
    model_id: generation.modelId ?? "",
    model_params: (generation.modelParams as Record<string, unknown>) ?? {},
    generation_id: generation.id,
    ...(Object.keys(tierModels).length > 0 ? { tier_models: tierModels } : {}),
  };
}

// ---------------------------------------------------------------------------
// CanvasChatPanel
// ---------------------------------------------------------------------------

export function CanvasChatPanel({ generation, projectId, onPendingGenerations, onGenerationsCreated, modelSettings = [] }: CanvasChatPanelProps) {
  const { state, dispatch } = useCanvasDetail();

  // Local UI state
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [chatModelSlug, setChatModelSlug] = useState(DEFAULT_MODEL_SLUG);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildInitMessage(generation),
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Tier state for chat panel model resolution (independent from popovers)
  const [tier, setTier] = useState<Tier>("draft");

  // Session state — local to the chat panel (not in Context per spec constraint)
  const sessionIdRef = useRef<string | null>(null);

  // Track the last generation id for context separator
  const lastGenerationIdRef = useRef(state.currentGenerationId);

  // Keep image context in a ref — updated on generation change
  const imageContextRef = useRef<CanvasImageContext>(buildImageContext(generation, modelSettings));

  // Width before collapse for restoring
  const preCollapseWidthRef = useRef(DEFAULT_WIDTH);

  // Abort controller for ongoing SSE streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // AC-1: Auto-create canvas session when the panel mounts (expanded)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (collapsed) return;
    if (sessionIdRef.current) return; // session already exists

    let cancelled = false;

    const initSession = async () => {
      try {
        const sessionId = await createSession(projectId, imageContextRef.current);
        if (!cancelled) {
          sessionIdRef.current = sessionId;
          dispatch({ type: "SET_CHAT_SESSION", chatSessionId: sessionId });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[CanvasChatPanel] Failed to create canvas session:", error);
          toast.error("Verbindungsfehler: Chat-Session konnte nicht erstellt werden.");
        }
      }
    };

    initSession();

    return () => {
      cancelled = true;
    };
  // Run on mount and whenever collapsed state becomes false (first expansion)
  }, [collapsed, projectId]);

  // ---------------------------------------------------------------------------
  // HIGH-2: Keep imageContextRef fresh whenever generation or modelSettings change
  // (e.g. Prev/Next navigation or async settings load)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    imageContextRef.current = buildImageContext(generation, modelSettings);
  }, [generation.id, modelSettings]);

  // ---------------------------------------------------------------------------
  // AC-10: Update context when currentGenerationId changes.
  // Replace (not append) the init message at position 0 so the chat doesn't
  // fill up with context blocks during Prev/Next navigation.
  // Sibling clicks only update image context silently (no visual change).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.currentGenerationId !== lastGenerationIdRef.current) {
      lastGenerationIdRef.current = state.currentGenerationId;

      // Always update image context for subsequent messages
      imageContextRef.current = buildImageContext(generation, modelSettings);

      // Replace the first init message with updated context (Prev/Next + Sibling)
      setMessages((prev) => {
        const newInit = buildInitMessage(generation);
        // Find and replace the first system (init) message
        const firstInitIndex = prev.findIndex((m) => m.role === "system");
        if (firstInitIndex >= 0) {
          const updated = [...prev];
          updated[firstInitIndex] = newInit;
          return updated;
        }
        // Fallback: prepend if no init found
        return [newInit, ...prev];
      });
    }
  }, [state.currentGenerationId]);

  // ---------------------------------------------------------------------------
  // AC-2 / AC-3: Collapse / Expand
  // ---------------------------------------------------------------------------
  const handleCollapse = useCallback(() => {
    preCollapseWidthRef.current = width;
    setCollapsed(true);
  }, [width]);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
    setWidth(preCollapseWidthRef.current || DEFAULT_WIDTH);
  }, []);

  // ---------------------------------------------------------------------------
  // AC-4: Resize handle (mousedown/mousemove/mouseup)
  // ---------------------------------------------------------------------------
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const rAfRef = useRef<number | null>(null);
  const pointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const pointerUpRef = useRef<(() => void) | null>(null);

  const cleanupResizeListeners = useCallback(() => {
    if (rAfRef.current !== null) {
      cancelAnimationFrame(rAfRef.current);
      rAfRef.current = null;
    }
    if (pointerMoveRef.current) {
      document.removeEventListener("pointermove", pointerMoveRef.current);
      pointerMoveRef.current = null;
    }
    if (pointerUpRef.current) {
      document.removeEventListener("pointerup", pointerUpRef.current);
      pointerUpRef.current = null;
    }
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResizeListeners();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanupResizeListeners]);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed) return;
      e.preventDefault();
      isResizing.current = true;

      const startX = e.clientX;
      const startWidth = width;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isResizing.current) return;
        if (rAfRef.current !== null) {
          cancelAnimationFrame(rAfRef.current);
        }
        // Resize handle is on the left edge, so moving left = wider
        const delta = startX - moveEvent.clientX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        rAfRef.current = requestAnimationFrame(() => {
          rAfRef.current = null;
          setWidth(newWidth);
        });
      };

      const handlePointerUp = () => {
        cleanupResizeListeners();
      };

      pointerMoveRef.current = handlePointerMove;
      pointerUpRef.current = handlePointerUp;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [collapsed, width, cleanupResizeListeners]
  );

  // ---------------------------------------------------------------------------
  // AC-6: Handle canvas-generate event -> call generateImages()
  // Model resolution: ignore event.model_id, resolve from settings + tier.
  // Fallback: generation.modelId if settings are empty (AC-10).
  // ---------------------------------------------------------------------------
  const handleCanvasGenerate = useCallback(
    async (event: SSECanvasGenerateEvent) => {
      dispatch({ type: "SET_GENERATING", isGenerating: true });

      // Resolve model from settings (img2img mode for chat panel)
      const setting = modelSettings.find(
        (s) => s.mode === "img2img" && s.tier === tier
      );
      // Use setting model + params, or fall back to generation.modelId (AC-10)
      const resolvedModelId = setting?.modelId ?? generation.modelId;
      const resolvedParams = setting?.modelParams
        ? { ...(setting.modelParams as Record<string, unknown>), ...(event.params ?? {}) }
        : (event.params ?? {});

      try {
        const result = await generateImages({
          projectId,
          promptMotiv: event.prompt,
          modelIds: [resolvedModelId],
          params: resolvedParams,
          count: 1,
          generationMode: event.action === "img2img" ? "img2img" : "txt2img",
          sourceImageUrl:
            event.action === "img2img"
              ? imageContextRef.current.image_url
              : undefined,
        });

        // Check for validation/server errors returned as { error: string }
        if (result && "error" in result) {
          console.error("[CanvasChatPanel] generateImages returned error:", result.error);
          toast.error(result.error);
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          return;
        }

        // Notify gallery state about new generations
        onGenerationsCreated?.(result as Generation[]);

        // Notify parent (CanvasDetailView) about pending IDs so it can
        // start polling and replace the image once completed.
        const pendingIds = (result as Generation[])
          .filter((g) => g.status === "pending")
          .map((g) => g.id);

        if (pendingIds.length > 0 && onPendingGenerations) {
          onPendingGenerations(pendingIds);
          // Don't clear SET_GENERATING — polling in CanvasDetailView handles that
        } else {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
      } catch (error) {
        console.error("[CanvasChatPanel] generateImages failed:", error);
        toast.error("Generierung fehlgeschlagen.");
        dispatch({ type: "SET_GENERATING", isGenerating: false });
      }
    },
    [dispatch, projectId, onPendingGenerations, onGenerationsCreated, tier, modelSettings, generation.modelId]
  );

  // ---------------------------------------------------------------------------
  // Core send logic — used by handleSend and handleChipClick
  // ---------------------------------------------------------------------------
  const sendMessageToBackend = useCallback(
    async (text: string, imageUrl?: string) => {
      // Ensure we have a session
      if (!sessionIdRef.current) {
        try {
          const sessionId = await createSession(projectId, imageContextRef.current);
          sessionIdRef.current = sessionId;
          dispatch({ type: "SET_CHAT_SESSION", chatSessionId: sessionId });
        } catch (error) {
          console.error("[CanvasChatPanel] Failed to create session:", error);
          toast.error("Verbindungsfehler: Chat-Session konnte nicht erstellt werden.");
          return;
        }
      }

      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);

      // Placeholder message id for the in-progress bot response
      const botMsgId = `bot-${crypto.randomUUID()}`;
      // Track whether the bot bubble has been inserted yet (MEDIUM-1: avoid empty bubble)
      let botBubbleInserted = false;

      try {
        // Inject current tier so the backend knows which model is selected
        const contextWithTier = { ...imageContextRef.current, selected_tier: tier };
        await sendCanvasMessage(
          sessionIdRef.current,
          text,
          contextWithTier,
          (event: CanvasSSEEvent) => {
            switch (event.type) {
              case "text-delta": {
                // AC-3: Append delta to the bot message.
                // Insert the bubble on the first non-empty delta (MEDIUM-1).
                if (!botBubbleInserted && event.content) {
                  botBubbleInserted = true;
                  setMessages((prev) => [
                    ...prev,
                    { id: botMsgId, role: "assistant", content: event.content },
                  ]);
                } else if (botBubbleInserted) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMsgId
                        ? { ...msg, content: msg.content + event.content }
                        : msg
                    )
                  );
                }
                break;
              }

              case "text-done": {
                // AC-4: Mark message as done (streaming indicator will hide)
                setIsStreaming(false);
                break;
              }

              case "canvas-generate": {
                // AC-6: Trigger generation via server action (fire-and-forget)
                setIsStreaming(false);
                handleCanvasGenerate(event).catch((err) =>
                  console.error("[CanvasChatPanel] generate failed:", err)
                );
                break;
              }

              case "error": {
                // AC-8 / AC-9: Show error in the bot bubble and re-enable input.
                if (!botBubbleInserted) {
                  botBubbleInserted = true;
                  setMessages((prev) => [
                    ...prev,
                    { id: botMsgId, role: "assistant", content: event.message, isError: true },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMsgId
                        ? {
                            ...msg,
                            content: event.message,
                            isError: true,
                          }
                        : msg
                    )
                  );
                }
                setIsStreaming(false);
                break;
              }
            }
          },
          abortControllerRef.current.signal,
          chatModelSlug,
          imageUrl
        );
      } catch (error) {
        console.error("[CanvasChatPanel] SSE stream error:", error);
        toast.error("Verbindungsfehler");
        // Replace placeholder with error message (or insert bubble if not yet shown)
        if (!botBubbleInserted) {
          setMessages((prev) => [
            ...prev,
            {
              id: botMsgId,
              role: "assistant",
              content: "Verbindung unterbrochen. Bitte erneut versuchen.",
              isError: true,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMsgId
                ? {
                    ...msg,
                    content: "Verbindung unterbrochen. Bitte erneut versuchen.",
                    isError: true,
                  }
                : msg
            )
          );
        }
        setIsStreaming(false);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [projectId, dispatch, handleCanvasGenerate, chatModelSlug]
  );

  // ---------------------------------------------------------------------------
  // AC-2: Send message
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(
    (text: string, imageUrls?: string[]) => {
      const userMsg: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content: text,
        ...(imageUrls && imageUrls.length > 0 ? { imageUrls } : {}),
      };
      setMessages((prev) => [...prev, userMsg]);
      sendMessageToBackend(text, imageUrls?.[0]).catch((err) =>
        console.error("[CanvasChatPanel] send failed:", err)
      );
    },
    [sendMessageToBackend]
  );

  // ---------------------------------------------------------------------------
  // AC-5: Chip click -> send chip text as new message
  // ---------------------------------------------------------------------------
  const handleChipClick = useCallback(
    (chipText: string) => {
      const userMsg: ChatMessage = {
        id: `user-chip-${crypto.randomUUID()}`,
        role: "user",
        content: chipText,
      };
      setMessages((prev) => [...prev, userMsg]);
      sendMessageToBackend(chipText).catch((err) =>
        console.error("[CanvasChatPanel] send failed:", err)
      );
    },
    [sendMessageToBackend]
  );

  // ---------------------------------------------------------------------------
  // AC-11: New session — reset session + chat history
  // ---------------------------------------------------------------------------
  const handleNewSession = useCallback(async () => {
    // Abort any ongoing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);

    // Discard old session
    sessionIdRef.current = null;
    dispatch({ type: "SET_CHAT_SESSION", chatSessionId: null });

    // Reset history to just the init message
    setMessages([buildInitMessage(generation)]);

    // Create a new session
    try {
      const sessionId = await createSession(projectId, imageContextRef.current);
      sessionIdRef.current = sessionId;
      dispatch({ type: "SET_CHAT_SESSION", chatSessionId: sessionId });
    } catch (error) {
      console.error("[CanvasChatPanel] Failed to create new session:", error);
      toast.error("Verbindungsfehler: Neue Session konnte nicht erstellt werden.");
    }
  }, [generation, projectId, dispatch]);

  // AC-7: Chat input disabled while isGenerating
  const inputDisabled = state.isGenerating || isStreaming;

  // ---------------------------------------------------------------------------
  // Collapsed: 48px icon strip
  // ---------------------------------------------------------------------------
  if (collapsed) {
    return (
      <div
        ref={panelRef}
        className="flex shrink-0 flex-col items-center bg-card py-3 cursor-pointer"
        style={{ width: COLLAPSED_WIDTH }}
        onClick={handleExpand}
        data-testid="canvas-chat-panel-collapsed"
        role="button"
        aria-label="Expand chat panel"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleExpand();
          }
        }}
      >
        <MessageSquare className="size-5 text-muted-foreground" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Expanded panel
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={panelRef}
      className="relative flex h-full shrink-0 flex-col overflow-hidden bg-card"
      style={{ width }}
      data-testid="canvas-chat-panel"
    >
      {/* Resize handle on the left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30"
        onPointerDown={handleResizeStart}
        style={{ touchAction: "none" }}
        data-testid="chat-resize-handle"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chat</span>
          <ModelSelector value={chatModelSlug} onChange={setChatModelSlug} />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleNewSession}
            aria-label="New session"
            data-testid="chat-new-session-button"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCollapse}
            aria-label="Collapse chat panel"
            data-testid="chat-collapse-button"
          >
            <PanelRightClose className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <ChatThread
        messages={messages}
        isStreaming={isStreaming}
        onChipClick={handleChipClick}
      />

      {/* Tier toggle bar between ChatThread and ChatInput */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-1.5"
        data-testid="chat-tier-bar"
      >
        <TierToggle
          tier={tier}
          onTierChange={setTier}
          disabled={state.isGenerating}
        />
      </div>

      {/* Input — disabled while generating or streaming */}
      <ChatInput
        onSend={handleSend}
        disabled={inputDisabled}
        isStreaming={isStreaming}
        projectId={projectId}
        placeholder="Describe changes..."
      />
    </div>
  );
}
