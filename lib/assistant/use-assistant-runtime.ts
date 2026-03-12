"use client";

import { useCallback, useRef, useEffect } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  AssistantAction,
  DraftPrompt,
  ModelRecommendation,
  ToolCallResult,
} from "./assistant-context";

// ---------------------------------------------------------------------------
// SSE Event Types (from Architecture)
// ---------------------------------------------------------------------------

interface SSEMetadataEvent {
  session_id: string;
  thread_id: string;
}

interface SSETextDeltaEvent {
  content: string;
}

interface SSEToolCallResultEvent {
  tool: string;
  data: Record<string, unknown>;
}

interface SSEErrorEvent {
  message: string;
}

// ---------------------------------------------------------------------------
// SSE Parser
// ---------------------------------------------------------------------------

/**
 * Parses a raw SSE text block into individual events.
 * SSE format: `event: {type}\ndata: {json}\n\n`
 * Handles multi-line data fields by joining them.
 */
export function parseSSEEvents(
  rawText: string
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = rawText.split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = "";
    const dataLines: string[] = [];

    const lines = block.split("\n");
    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (eventType && dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join("\n") });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Hook Options & Return
// ---------------------------------------------------------------------------

export interface UseAssistantRuntimeOptions {
  projectId: string;
  dispatch: Dispatch<AssistantAction>;
  sessionIdRef: MutableRefObject<string | null>;
  selectedModel: string;
  /** Ref to register the sendMessage function on the context */
  sendMessageRef: MutableRefObject<
    ((content: string, imageUrl?: string) => void) | null
  >;
  /** Ref to register the cancelStream function on the context */
  cancelStreamRef: MutableRefObject<(() => void) | null>;
}

export interface UseAssistantRuntimeReturn {
  sendMessage: (content: string, imageUrl?: string) => void;
  isStreaming: boolean;
  cancelStream: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssistantRuntime({
  projectId,
  dispatch,
  sessionIdRef,
  selectedModel,
  sendMessageRef,
  cancelStreamRef,
}: UseAssistantRuntimeOptions): UseAssistantRuntimeReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  // Keep latest selectedModel in a ref so async functions always read the current value
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    streamingRef.current = false;
    // AC-9: Mark the current assistant message as done (non-streaming)
    // MARK_ASSISTANT_DONE sets both message-level isStreaming=false and top-level isStreaming=false
    dispatch({ type: "MARK_ASSISTANT_DONE" });
  }, [dispatch]);

  /**
   * Handle a single parsed SSE event.
   */
  const handleSSEEvent = useCallback(
    (eventType: string, rawData: string) => {
      try {
        const data = JSON.parse(rawData);

        switch (eventType) {
          case "metadata": {
            const meta = data as SSEMetadataEvent;
            sessionIdRef.current = meta.session_id;
            dispatch({ type: "SET_SESSION_ID", sessionId: meta.session_id });
            break;
          }

          case "text-delta": {
            const delta = data as SSETextDeltaEvent;
            dispatch({
              type: "APPEND_ASSISTANT_DELTA",
              content: delta.content,
            });
            break;
          }

          case "text-done": {
            dispatch({ type: "MARK_ASSISTANT_DONE" });
            break;
          }

          case "tool-call-result": {
            const result = data as SSEToolCallResultEvent;
            const toolCallResult: ToolCallResult = {
              tool: result.tool,
              data: result.data,
            };
            dispatch({ type: "ADD_TOOL_CALL_RESULT", result: toolCallResult });

            // Dispatch specific actions based on tool type
            if (result.tool === "draft_prompt") {
              const rawData = result.data as { motiv: string; style: string; negative_prompt: string };
              dispatch({
                type: "SET_DRAFT_PROMPT",
                draftPrompt: {
                  motiv: rawData.motiv,
                  style: rawData.style,
                  negativePrompt: rawData.negative_prompt,
                },
              });
            } else if (result.tool === "refine_prompt") {
              const rawData = result.data as { motiv: string; style: string; negative_prompt: string };
              dispatch({
                type: "REFINE_DRAFT",
                draftPrompt: {
                  motiv: rawData.motiv,
                  style: rawData.style,
                  negativePrompt: rawData.negative_prompt,
                },
              });
            } else if (result.tool === "recommend_model") {
              dispatch({
                type: "SET_RECOMMENDED_MODEL",
                recommendedModel:
                  result.data as unknown as ModelRecommendation,
              });
            }
            break;
          }

          case "error": {
            const error = data as SSEErrorEvent;
            dispatch({
              type: "ADD_ERROR_MESSAGE",
              content: error.message || "Ein Fehler ist aufgetreten.",
            });
            break;
          }

          default:
            break;
        }
      } catch {
        console.warn(
          "[useAssistantRuntime] Failed to parse SSE data:",
          rawData
        );
      }
    },
    [dispatch, sessionIdRef]
  );

  /**
   * Consume an SSE stream from a fetch Response, dispatching actions as events arrive.
   */
  const consumeSSEStream = useCallback(
    async (response: Response, signal: AbortSignal) => {
      const reader = response.body?.getReader();
      if (!reader) {
        dispatch({
          type: "ADD_ERROR_MESSAGE",
          content: "Stream konnte nicht gelesen werden.",
        });
        return;
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      try {
        while (true) {
          if (signal.aborted) break;

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newline)
          const parts = buffer.split("\n\n");
          // Keep the last part as buffer (may be incomplete)
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;

            const events = parseSSEEvents(part + "\n\n");
            for (const { event, data } of events) {
              handleSSEEvent(event, data);
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const events = parseSSEEvents(buffer + "\n\n");
          for (const { event, data } of events) {
            handleSSEEvent(event, data);
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        dispatch({
          type: "ADD_ERROR_MESSAGE",
          content: "Verbindung zum Assistenten unterbrochen.",
        });
      } finally {
        reader.releaseLock();
      }
    },
    [dispatch, handleSSEEvent]
  );

  /**
   * Create a new session via POST /api/assistant/sessions and consume the SSE response.
   */
  const createSession = useCallback(
    async (signal: AbortSignal): Promise<string | null> => {
      try {
        const response = await fetch("/api/assistant/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId }),
          signal,
        });

        if (!response.ok) {
          dispatch({
            type: "ADD_ERROR_MESSAGE",
            content: `Session konnte nicht erstellt werden (${response.status}).`,
          });
          return null;
        }

        // Add an empty assistant message for the greeting stream
        dispatch({
          type: "ADD_ASSISTANT_MESSAGE",
          message: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "",
            isStreaming: true,
          },
        });

        // Consume SSE stream from session creation (metadata + greeting)
        await consumeSSEStream(response, signal);

        return sessionIdRef.current;
      } catch (err) {
        if (signal.aborted) return null;
        dispatch({
          type: "ADD_ERROR_MESSAGE",
          content: "Assistent ist nicht erreichbar.",
        });
        return null;
      }
    },
    [projectId, dispatch, consumeSSEStream, sessionIdRef]
  );

  /**
   * Send a message to an existing session via POST /api/assistant/sessions/{id}/messages.
   */
  const sendMessageToSession = useCallback(
    async (
      sessionId: string,
      content: string,
      imageUrl: string | undefined,
      signal: AbortSignal
    ) => {
      try {
        // Re-assert streaming state: on first message, createSession consumed the
        // greeting SSE stream which ended with MARK_ASSISTANT_DONE, setting
        // isStreaming back to false. We must re-enable it before fetching.
        dispatch({ type: "SET_STREAMING", isStreaming: true });

        const body: Record<string, unknown> = {
          content,
          model: selectedModelRef.current,
        };
        if (imageUrl) {
          body.image_url = imageUrl;
        }

        const response = await fetch(
          `/api/assistant/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal,
          }
        );

        if (!response.ok) {
          dispatch({
            type: "ADD_ERROR_MESSAGE",
            content: `Nachricht konnte nicht gesendet werden (${response.status}).`,
          });
          return;
        }

        // Add an empty assistant message placeholder for streaming
        dispatch({
          type: "ADD_ASSISTANT_MESSAGE",
          message: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "",
            isStreaming: true,
          },
        });

        // Consume SSE stream
        await consumeSSEStream(response, signal);
      } catch (err) {
        if (signal.aborted) return;
        dispatch({
          type: "ADD_ERROR_MESSAGE",
          content: "Verbindung zum Assistenten unterbrochen.",
        });
      }
    },
    [dispatch, consumeSSEStream]
  );

  /**
   * Main sendMessage function: creates session if needed, then sends message.
   */
  const sendMessage = useCallback(
    async (content: string, imageUrl?: string) => {
      // Cancel any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      streamingRef.current = true;

      dispatch({ type: "SET_STREAMING", isStreaming: true });

      // Add user message immediately (AC-2)
      dispatch({
        type: "ADD_USER_MESSAGE",
        message: {
          id: `user-${Date.now()}`,
          role: "user",
          content,
          imageUrl,
        },
      });

      let currentSessionId = sessionIdRef.current;

      // AC-1: If no session exists, create one first
      if (!currentSessionId) {
        currentSessionId = await createSession(abortController.signal);
        if (!currentSessionId) {
          streamingRef.current = false;
          dispatch({ type: "SET_STREAMING", isStreaming: false });
          return;
        }
      }

      // AC-11: Send message to existing session (reuses session ID)
      await sendMessageToSession(
        currentSessionId,
        content,
        imageUrl,
        abortController.signal
      );

      streamingRef.current = false;
      abortControllerRef.current = null;
    },
    [dispatch, sessionIdRef, createSession, sendMessageToSession]
  );

  // Register the sendMessage on the context's ref so the context can delegate to it
  useEffect(() => {
    if (sendMessageRef) {
      sendMessageRef.current = sendMessage;
    }
    return () => {
      if (sendMessageRef) {
        sendMessageRef.current = null;
      }
    };
  }, [sendMessage, sendMessageRef]);

  // Register the cancelStream on the context's ref so the context can delegate to it
  useEffect(() => {
    if (cancelStreamRef) {
      cancelStreamRef.current = cancelStream;
    }
    return () => {
      if (cancelStreamRef) {
        cancelStreamRef.current = null;
      }
    };
  }, [cancelStream, cancelStreamRef]);

  return {
    sendMessage,
    isStreaming: streamingRef.current,
    cancelStream,
  };
}
