"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { MessageSquare, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { CanvasChatMessages } from "./canvas-chat-messages";
import { CanvasChatInput } from "./canvas-chat-input";
import { type Generation } from "@/lib/db/queries";
import { type ChatMessage } from "@/lib/types/chat-message";

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
  onSendMessage?: (text: string) => void;
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

// ---------------------------------------------------------------------------
// CanvasChatPanel
// ---------------------------------------------------------------------------

export function CanvasChatPanel({
  generation,
  onSendMessage,
}: CanvasChatPanelProps) {
  const { state } = useCanvasDetail();

  // Local UI state
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildInitMessage(generation),
  ]);

  // Track the last generation id for context separator
  const lastGenerationIdRef = useRef(state.currentGenerationId);

  // Width before collapse for restoring
  const preCollapseWidthRef = useRef(DEFAULT_WIDTH);

  // -------------------------------------------------------------------------
  // AC-9: Context separator when image changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state.currentGenerationId !== lastGenerationIdRef.current) {
      lastGenerationIdRef.current = state.currentGenerationId;

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

  // -------------------------------------------------------------------------
  // AC-2 / AC-3: Collapse / Expand
  // -------------------------------------------------------------------------
  const handleCollapse = useCallback(() => {
    preCollapseWidthRef.current = width;
    setCollapsed(true);
  }, [width]);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
    setWidth(preCollapseWidthRef.current || DEFAULT_WIDTH);
  }, []);

  // -------------------------------------------------------------------------
  // AC-4: Resize handle (mousedown/mousemove/mouseup)
  // -------------------------------------------------------------------------
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
        // Cancel any pending rAF before scheduling a new one
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

  // -------------------------------------------------------------------------
  // AC-11: Send message
  // -------------------------------------------------------------------------
  const handleSend = useCallback(
    (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      if (onSendMessage) {
        onSendMessage(text);
      }
    },
    [onSendMessage]
  );

  // -------------------------------------------------------------------------
  // AC-8: Chip click
  // -------------------------------------------------------------------------
  const handleChipClick = useCallback(
    (chipText: string) => {
      const userMsg: ChatMessage = {
        id: `user-chip-${crypto.randomUUID()}`,
        role: "user",
        content: chipText,
      };
      setMessages((prev) => [...prev, userMsg]);

      if (onSendMessage) {
        onSendMessage(chipText);
      }
    },
    [onSendMessage]
  );

  // -------------------------------------------------------------------------
  // AC-12: New session
  // -------------------------------------------------------------------------
  const handleNewSession = useCallback(() => {
    setMessages([buildInitMessage(generation)]);
  }, [generation]);

  // -------------------------------------------------------------------------
  // Collapsed: 48px icon strip
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Expanded panel
  // -------------------------------------------------------------------------
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
        onChipClick={handleChipClick}
      />

      {/* Input */}
      <CanvasChatInput onSend={handleSend} disabled={false} />
    </div>
  );
}
