"use client";

import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/assistant/chat-input";
import { ChatThread } from "@/components/assistant/chat-thread";
import { SessionList } from "@/components/assistant/session-list";
import { SessionSwitcher } from "@/components/assistant/session-switcher";
import { ModelSelector } from "@/components/assistant/model-selector";
import { Startscreen } from "@/components/assistant/startscreen";
import {
  usePromptAssistant,
  getWorkspaceFieldsForChip,
} from "@/lib/assistant/assistant-context";
import { useAssistantRuntime } from "@/lib/assistant/use-assistant-runtime";
import { useWorkspaceVariation } from "@/lib/workspace-state";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssistantPanelContentProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

// ---------------------------------------------------------------------------
// AssistantPanelContent (uses PromptAssistantContext — must be wrapped in Provider)
// ---------------------------------------------------------------------------

export function AssistantPanelContent({
  open,
  onClose,
  projectId,
}: AssistantPanelContentProps) {
  const {
    messages,
    isStreaming,
    selectedModel,
    setSelectedModel,
    cancelStream,
    activeView,
    setActiveView,
    loadSession,
    sessionId,
    dispatch,
    sessionIdRef,
    sendMessageRef,
    cancelStreamRef,
  } = usePromptAssistant();

  const { variationData } = useWorkspaceVariation();

  const { sendMessage } = useAssistantRuntime({
    projectId,
    dispatch,
    sessionIdRef,
    selectedModel,
    sendMessageRef,
    cancelStreamRef,
  });

  const handleSend = useCallback(
    (text: string, imageUrls?: string[]) => {
      sendMessage(text, imageUrls);
    },
    [sendMessage]
  );

  // Chip handler with workspace context enrichment
  const handleChipClick = useCallback(
    (text: string) => {
      const IMPROVE_CHIP_TEXT = "Verbessere meinen aktuellen Prompt";
      if (text === IMPROVE_CHIP_TEXT) {
        const context = getWorkspaceFieldsForChip(variationData);
        if (context) {
          sendMessage(`${text}\n\n${context}`);
        } else {
          sendMessage(text);
        }
      } else {
        sendMessage(text);
      }
    },
    [sendMessage, variationData]
  );

  // Auto-resume session when panel opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (sessionId && messages.length === 0) {
        loadSession(sessionId);
      } else if (sessionId && messages.length > 0) {
        if (activeView === "startscreen") {
          setActiveView("chat");
        }
      }
    }
    prevOpenRef.current = open;
  }, [open, sessionId, messages.length, loadSession, activeView, setActiveView]);

  const handleSwitcherClick = useCallback(() => {
    setActiveView("session-list");
  }, [setActiveView]);

  const handleSelectSession = useCallback(
    (id: string) => {
      loadSession(id);
    },
    [loadSession]
  );

  const handleSessionListBack = useCallback(() => {
    if (messages.length > 0) {
      setActiveView("chat");
    } else {
      setActiveView("startscreen");
    }
  }, [messages.length, setActiveView]);

  const handleNewSession = useCallback(() => {
    dispatch({ type: "RESET_SESSION" });
    setActiveView("startscreen");
  }, [dispatch, setActiveView]);

  const handleSessionHistoryClick = useCallback(() => {
    setActiveView("session-list");
  }, [setActiveView]);

  const renderContent = () => {
    if (activeView === "session-list") {
      return (
        <SessionList
          projectId={projectId}
          onSelectSession={handleSelectSession}
          onBack={handleSessionListBack}
          onNewSession={handleNewSession}
        />
      );
    }

    return (
      <div className="flex flex-1 flex-col h-full">
        {activeView === "chat" && messages.length > 0 ? (
          <ChatThread messages={messages} isStreaming={isStreaming} />
        ) : (
          <Startscreen
            hasSessions={false}
            onChipClick={handleChipClick}
            onSessionHistoryClick={handleSessionHistoryClick}
          />
        )}
        <ChatInput
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={cancelStream}
          autoFocus={open}
          projectId={projectId}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-base font-semibold">Prompt Assistent</span>
        <div className="flex items-center gap-1">
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          <SessionSwitcher onClick={handleSwitcherClick} />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            data-testid="assistant-panel-close"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body — single column, no split view */}
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
