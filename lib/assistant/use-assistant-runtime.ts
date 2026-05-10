"use client";

import { useCallback, useRef, useEffect } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  AssistantAction,
  DraftPrompt,
  FlowState,
  IntentSummaryPayload,
  ToolCallResult,
} from "./assistant-context";

// ---------------------------------------------------------------------------
// Slice 15: whitelist of FSM ``flow_state`` values accepted from SSE.
// Mirrors the ``FlowState`` union in ``assistant-context.tsx``. Values
// outside this set are dropped with a ``console.warn`` (AC-9). The
// ``"generating"`` transition is included because Slice 28 (resume hydrate)
// may legitimately emit a hydration event with that value when the user
// reloaded mid-generation; Slice 15 itself never receives ``"generating"``
// from the live stream.
// ---------------------------------------------------------------------------
const FLOW_STATE_WHITELIST: ReadonlySet<FlowState> = new Set<FlowState>([
  "idle",
  "interviewing",
  "summarizing",
  "reviewing",
  "refining",
  "generating",
]);

// ---------------------------------------------------------------------------
// ReferenceSlot Snapshot (mirrors backend ReferenceSlotDTO)
// ---------------------------------------------------------------------------

/**
 * Snapshot of a single active ReferenceBar slot, sent by the frontend on every
 * assistant turn when generation mode is "img2img". Mirrors the backend
 * Pydantic model `ReferenceSlotDTO` in `backend/app/models/dtos.py`.
 */
export interface ReferenceSlotSnapshot {
  slot_index: number;
  image_url: string;
  role?: "subject" | "style" | "composition" | null;
  strength?: number | null;
}

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

/**
 * Slice 15: payload of the SSE ``flow-state`` event.
 *
 * Wire format (per architecture.md → "Frontend State Machine Wiring"):
 * ``event: flow-state\ndata: {"flow_state": <FlowState>}``.
 */
interface SSEFlowStateEvent {
  flow_state: string;
}

/**
 * Slice 15: payload of the SSE ``intent-summary`` event.
 *
 * Mirrors :data:`IntentSummaryPayload` from ``assistant-context.tsx``.
 * Re-declared as a local interface so the SSE handler can run a structural
 * check before dispatching (AC-10) without coupling the wire-shape to the
 * reducer's typed union.
 */
interface SSEIntentSummaryEvent {
  axes?: unknown;
  prompt_preview?: unknown;
  settings_diff?: unknown;
}

// ---------------------------------------------------------------------------
// SSE Parser
// ---------------------------------------------------------------------------

/**
 * Parses a raw SSE text block into individual events.
 * SSE format: `event: {type}\ndata: {json}\n\n`
 *
 * Uses line-by-line parsing per the SSE spec: an empty line (or end of input)
 * signals the end of the current event. This correctly handles multiple events
 * in a single text block, regardless of how chunk boundaries align.
 */
export function parseSSEEvents(
  rawText: string
): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];

  // Normalize \r\n to \n, then split into individual lines
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  let eventType = "";
  let dataLines: string[] = [];

  const flush = () => {
    if (eventType && dataLines.length > 0) {
      events.push({ event: eventType, data: dataLines.join("\n") });
    }
    eventType = "";
    dataLines = [];
  };

  for (const line of lines) {
    if (line === "") {
      // Empty line = end of current event per SSE spec
      flush();
    } else if (line.startsWith("event:")) {
      // If we encounter a new event: field while we already have accumulated
      // data, flush the previous event first. This handles malformed streams
      // where double-newline separators are missing.
      if (eventType && dataLines.length > 0) {
        flush();
      }
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
    // Ignore comments (lines starting with ':') and unknown fields per spec
  }

  // Flush any trailing event that wasn't terminated by an empty line
  flush();

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
    ((content: string, imageUrls?: string[]) => void) | null
  >;
  /** Ref to register the cancelStream function on the context */
  cancelStreamRef: MutableRefObject<(() => void) | null>;
  /** Ref holding the current workspace image model ID (e.g. "black-forest-labs/flux-2-pro") */
  imageModelIdRef?: MutableRefObject<string | null>;
  /** Ref holding the current generation mode (only "txt2img" | "img2img" are sent to backend) */
  generationModeRef?: MutableRefObject<string | null>;
  /** Ref holding the current snapshot of active ReferenceBar slots (sent only when generation_mode === "img2img") */
  referenceSlotsRef?: MutableRefObject<ReferenceSlotSnapshot[] | null>;
  /** Ref holding the current project UUID (sent on every turn so backend can load project_context) */
  projectIdRef?: MutableRefObject<string | null>;
}

export interface UseAssistantRuntimeReturn {
  sendMessage: (content: string, imageUrls?: string[]) => void;
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
  imageModelIdRef,
  generationModeRef,
  referenceSlotsRef,
  projectIdRef,
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
              const rawData = result.data as { prompt: string };
              dispatch({
                type: "SET_DRAFT_PROMPT",
                draftPrompt: {
                  prompt: rawData.prompt,
                },
              });
            } else if (result.tool === "refine_prompt") {
              const rawData = result.data as { prompt: string };
              dispatch({
                type: "REFINE_DRAFT",
                draftPrompt: {
                  prompt: rawData.prompt,
                },
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

          case "flow-state": {
            // Slice 15 AC-5 / AC-9: parse the wire payload, validate
            // against the whitelist, and dispatch SET_FLOW_STATE on hit.
            // Unknown values are dropped with a console.warn so the
            // backend is forced to stay within the architectural enum.
            const fs = data as SSEFlowStateEvent;
            const value = fs?.flow_state;
            if (
              typeof value === "string" &&
              FLOW_STATE_WHITELIST.has(value as FlowState)
            ) {
              dispatch({
                type: "SET_FLOW_STATE",
                flowState: value as FlowState,
              });
            } else {
              console.warn(
                "[useAssistantRuntime] Ignoring flow-state event with " +
                  "unknown flow_state value:",
                value
              );
            }
            break;
          }

          case "intent-summary": {
            // Slice 15 AC-6 / AC-10: structural validation on
            // ``axes`` (object) and ``prompt_preview`` (string). Missing
            // / wrong-typed fields trigger a defensive console.warn — the
            // stream consumer keeps running, no throw.
            const summary = data as SSEIntentSummaryEvent;
            const axesOk =
              summary &&
              typeof summary.axes === "object" &&
              summary.axes !== null &&
              !Array.isArray(summary.axes);
            const promptOk = typeof summary?.prompt_preview === "string";
            if (!axesOk || !promptOk) {
              console.warn(
                "[useAssistantRuntime] Ignoring malformed intent-summary " +
                  "event (missing prompt_preview or non-object axes):",
                rawData
              );
              break;
            }
            // settings_diff is optional; pass through verbatim when it is
            // an object, drop it otherwise (defensive — schema mismatch
            // here would corrupt the IntentSummaryCard render but should
            // never happen in production).
            const settingsDiff =
              summary.settings_diff &&
              typeof summary.settings_diff === "object" &&
              !Array.isArray(summary.settings_diff)
                ? (summary.settings_diff as IntentSummaryPayload["settings_diff"])
                : undefined;

            const payload: IntentSummaryPayload = {
              axes: summary.axes as IntentSummaryPayload["axes"],
              prompt_preview: summary.prompt_preview as string,
              ...(settingsDiff !== undefined
                ? { settings_diff: settingsDiff }
                : {}),
            };
            dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
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

          // Find the last double-newline boundary. Everything before it
          // contains complete SSE events; everything after may be incomplete.
          const normalised = buffer.replace(/\r\n/g, "\n");
          const lastBoundary = normalised.lastIndexOf("\n\n");

          if (lastBoundary === -1) continue; // no complete event yet

          const complete = normalised.slice(0, lastBoundary + 2);
          buffer = normalised.slice(lastBoundary + 2);

          const events = parseSSEEvents(complete);
          for (const { event, data } of events) {
            handleSSEEvent(event, data);
          }
        }

        // Process any remaining buffer (may lack trailing \n\n)
        if (buffer.trim()) {
          const events = parseSSEEvents(buffer);
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

        // Session creation returns JSON (not SSE), parse the session ID
        const sessionData = await response.json();
        const newSessionId = sessionData.id;

        if (!newSessionId) {
          dispatch({
            type: "ADD_ERROR_MESSAGE",
            content: "Session-ID fehlt in der Antwort.",
          });
          return null;
        }

        sessionIdRef.current = newSessionId;
        dispatch({ type: "SET_SESSION_ID", sessionId: newSessionId });

        return newSessionId;
      } catch (err) {
        if (signal.aborted) return null;
        dispatch({
          type: "ADD_ERROR_MESSAGE",
          content: "Assistent ist nicht erreichbar.",
        });
        return null;
      }
    },
    [projectId, dispatch, sessionIdRef]
  );

  /**
   * Send a message to an existing session via POST /api/assistant/sessions/{id}/messages.
   */
  const sendMessageToSession = useCallback(
    async (
      sessionId: string,
      content: string,
      imageUrls: string[] | undefined,
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
        if (imageUrls && imageUrls.length > 0) {
          body.image_urls = imageUrls;
        }

        // Include workspace image model ID if available (Slice 08)
        const currentImageModelId = imageModelIdRef?.current;
        if (currentImageModelId) {
          body.image_model_id = currentImageModelId;
        }

        // Include generation mode only if it is "txt2img" or "img2img" (Slice 08)
        // Backend Literal only accepts these two values; other modes (upscale, inpaint, outpaint) are omitted
        const currentGenerationMode = generationModeRef?.current;
        if (currentGenerationMode === "txt2img" || currentGenerationMode === "img2img") {
          body.generation_mode = currentGenerationMode;
        }

        // Slice 19: include project_id whenever it is set (modus-independent;
        // backend uses it for ProjectRepository.get_context).
        const currentProjectId = projectIdRef?.current;
        if (currentProjectId) {
          body.project_id = currentProjectId;
        }

        // Slice 19: snapshot the active reference slots at send-time, but ONLY
        // when generation_mode is "img2img". The field is omitted (not null) for
        // any other mode or when the snapshot is empty.
        if (currentGenerationMode === "img2img") {
          const slotsSnapshot = referenceSlotsRef?.current;
          if (slotsSnapshot && slotsSnapshot.length > 0) {
            body.reference_slots = slotsSnapshot.map((slot) => ({
              slot_index: slot.slot_index,
              image_url: slot.image_url,
              role: slot.role ?? null,
              strength: slot.strength ?? null,
            }));
          }
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
    async (content: string, imageUrls?: string[]) => {
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
          imageUrls,
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
        imageUrls,
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
