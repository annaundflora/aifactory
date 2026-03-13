"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { MessageSquare, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { CanvasChatMessages } from "./canvas-chat-messages";
import { CanvasChatInput } from "./canvas-chat-input";
import { type Generation } from "@/lib/db/queries";
import { type ChatMessage } from "@/lib/types/chat-message";
import {
  createSession,
  sendMessage as sendCanvasMessage,
  type CanvasImageContext,
  type SSECanvasGenerateEvent,
} from "@/lib/canvas-chat-service";
import { generateImages } from "@/app/actions/generations";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WIDTH = 320;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 360;
const COLLAPSED_WIDTH = 48;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasChatPanelProps {
  generation: Generation;
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitMessage(generation: Generation): ChatMessage {
  const params = generation.modelParams as Record<string, unknown> | null;
  const steps = params?.num_inference_steps ?? params?.steps ?? "—";
  const cfg = params?.guidance_scale ?? params?.cfg_scale ?? params?.cfg ?? "—";
  const promptDisplay =
    generation.prompt && generation.prompt.length > 120
      ? generation.prompt.slice(0, 120) + "..."
      : generation.prompt ?? "";

  return {
    id: `init-${generation.id}`,
    role: "system",
    content: `Model: ${generation.modelId}\nPrompt: "${promptDisplay}"\nSteps: ${steps}, CFG: ${cfg}`,
  };
}

function buildSeparatorMessage(identifier: string): ChatMessage {
  return {
    id: `sep-${identifier}-${crypto.randomUUID()}`,
    role: "separator",
    content: `Kontext: ${identifier}`,
  };
}

function buildImageContext(generation: Generation): CanvasImageContext {
  return {
    image_url: generation.imageUrl ?? "",
    prompt: generation.prompt ?? "",
    model_id: generation.modelId ?? "",
    model_params: (generation.modelParams as Record<string, unknown>) ?? {},
    generation_id: generation.id,
  };
}

// ---------------------------------------------------------------------------
// CanvasChatPanel
// ---------------------------------------------------------------------------

export function CanvasChatPanel({ generation, projectId }: CanvasChatPanelProps) {
  const { state, dispatch } = useCanvasDetail();

  // Local UI state
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildInitMessage(generation),
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Session state — local to the chat panel (not in Context per spec constraint)
  const sessionIdRef = useRef<string | null>(null);

  // Track the last generation id for context separator
  const lastGenerationIdRef = useRef(state.currentGenerationId);

  // Keep image context in a ref — updated on generation change
  const imageContextRef = useRef<CanvasImageContext>(buildImageContext(generation));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, projectId]);

  // ---------------------------------------------------------------------------
  // HIGH-2: Keep imageContextRef fresh whenever the generation prop changes
  // (e.g. Prev/Next navigation), independently of currentGenerationId context
  // ---------------------------------------------------------------------------
  useEffect(() => {
    imageContextRef.current = buildImageContext(generation);
  }, [generation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // AC-10: Update image_context when currentGenerationId changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.currentGenerationId !== lastGenerationIdRef.current) {
      lastGenerationIdRef.current = state.currentGenerationId;

      // Update the image context ref for subsequent messages
      imageContextRef.current = buildImageContext(generation);

      // Build identifier from whatever info we have
      const identifier = generation.prompt
        ? generation.prompt.slice(0, 40) + (generation.prompt.length > 40 ? "..." : "")
        : state.currentGenerationId.slice(0, 8);

      setMessages((prev) => [
        ...prev,
        buildSeparatorMessage(identifier),
        buildInitMessage(generation),
      ]);
    }
  }, [state.currentGenerationId, generation]);

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
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const mouseUpRef = useRef<(() => void) | null>(null);

  const cleanupResizeListeners = useCallback(() => {
    if (rAfRef.current !== null) {
      cancelAnimationFrame(rAfRef.current);
      rAfRef.current = null;
    }
    if (mouseMoveRef.current) {
      document.removeEventListener("mousemove", mouseMoveRef.current);
      mouseMoveRef.current = null;
    }
    if (mouseUpRef.current) {
      document.removeEventListener("mouseup", mouseUpRef.current);
      mouseUpRef.current = null;
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
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      isResizing.current = true;

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
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

      const handleMouseUp = () => {
        cleanupResizeListeners();
      };

      mouseMoveRef.current = handleMouseMove;
      mouseUpRef.current = handleMouseUp;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [collapsed, width, cleanupResizeListeners]
  );

  // ---------------------------------------------------------------------------
  // AC-6: Handle canvas-generate event -> call generateImages()
  // ---------------------------------------------------------------------------
  const handleCanvasGenerate = useCallback(
    async (event: SSECanvasGenerateEvent) => {
      dispatch({ type: "SET_GENERATING", isGenerating: true });

      try {
        await generateImages({
          projectId,
          promptMotiv: event.prompt,
          modelIds: [event.model_id],
          params: event.params ?? {},
          count: 1,
          generationMode: event.action === "img2img" ? "img2img" : "txt2img",
        });
        // Polling in WorkspaceContent will detect completion and replace image
      } catch (error) {
        console.error("[CanvasChatPanel] generateImages failed:", error);
        toast.error("Generierung fehlgeschlagen.");
      } finally {
        dispatch({ type: "SET_GENERATING", isGenerating: false });
      }
    },
    [dispatch, projectId]
  );

  // ---------------------------------------------------------------------------
  // Core send logic — used by handleSend and handleChipClick
  // ---------------------------------------------------------------------------
  const sendMessageToBackend = useCallback(
    async (text: string) => {
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
        const stream = sendCanvasMessage(
          sessionIdRef.current,
          text,
          imageContextRef.current,
          abortControllerRef.current.signal
        );

        for await (const event of stream) {
          switch (event.type) {
            case "text-delta": {
              // AC-3: Append delta to the bot message.
              // Insert the bubble on the first non-empty delta (MEDIUM-1).
              if (!botBubbleInserted && event.content) {
                botBubbleInserted = true;
                setMessages((prev) => [
                  ...prev,
                  { id: botMsgId, role: "bot", content: event.content },
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
              // AC-6: Trigger generation via server action
              setIsStreaming(false);
              await handleCanvasGenerate(event);
              break;
            }

            case "error": {
              // AC-8 / AC-9: Show error in the bot bubble and re-enable input.
              // If the bubble was not inserted yet, add it now.
              if (!botBubbleInserted) {
                botBubbleInserted = true;
                setMessages((prev) => [
                  ...prev,
                  { id: botMsgId, role: "bot", content: event.message, isError: true },
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
        }
      } catch (error) {
        console.error("[CanvasChatPanel] SSE stream error:", error);
        toast.error("Verbindungsfehler");
        // Replace placeholder with error message (or insert bubble if not yet shown)
        if (!botBubbleInserted) {
          setMessages((prev) => [
            ...prev,
            {
              id: botMsgId,
              role: "bot",
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
    [projectId, dispatch, handleCanvasGenerate]
  );

  // ---------------------------------------------------------------------------
  // AC-2: Send message
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      sendMessageToBackend(text).catch((err) =>
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
        className="flex shrink-0 flex-col items-center border-l border-border/80 bg-card py-3 cursor-pointer"
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
      className="relative flex shrink-0 flex-col border-l border-border/80 bg-card"
      style={{ width }}
      data-testid="canvas-chat-panel"
    >
      {/* Resize handle on the left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30"
        onMouseDown={handleResizeStart}
        data-testid="chat-resize-handle"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chat</span>
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
            <Minus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <CanvasChatMessages
        messages={messages}
        isStreaming={isStreaming}
        onChipClick={handleChipClick}
      />

      {/* Input — disabled while generating or streaming */}
      <CanvasChatInput onSend={handleSend} disabled={inputDisabled} />
    </div>
  );
}
