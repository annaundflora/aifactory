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
import type { Generation } from "@/lib/db/queries";

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
// Slice 24: Slot-Tool Payload Types + Role Whitelist
// ---------------------------------------------------------------------------

/**
 * Slot role enum mirroring the backend Pydantic enum used by the
 * ``set_slot_role`` LangGraph tool. Architecture.md → API → "LangGraph
 * Tool Schemas" pins the values to ``"subject" | "style" | "composition"``.
 */
type SlotRole = "subject" | "style" | "composition";

const SLOT_ROLE_WHITELIST: ReadonlySet<SlotRole> = new Set<SlotRole>([
  "subject",
  "style",
  "composition",
]);

/**
 * Wire-shape of the ``set_slot_role`` tool-call-result ``data`` field.
 * Snake_case is preserved here (matches backend); the SSE handler maps
 * ``slot_index`` → ``slotIndex`` before dispatching to the reducer.
 */
interface SetSlotRoleData {
  slot_index: number;
  role: string;
}

/** Wire-shape of the ``set_slot_strength`` tool-call-result ``data`` field. */
interface SetSlotStrengthData {
  slot_index: number;
  strength: number;
}

/** Wire-shape of the ``set_model_params`` tool-call-result ``data`` field. */
interface SetModelParamsData {
  params: Record<string, unknown>;
}

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
  /**
   * Slice 18: ref holding the latest succeeded result-image URL. Read at
   * request-build time and (when set) emitted on the outgoing body as
   * ``last_result_image_url``. Mirror of ``state.lastResultImageUrl`` —
   * kept in sync by ``PromptAssistantProvider``.
   */
  lastResultImageUrlRef?: MutableRefObject<string | null>;
  /**
   * Slice 18: live generations array for the active project. Used by the
   * auto-apply-settle effect to detect the ``status: pending → completed``
   * transition with a populated ``imageUrl`` and dispatch
   * ``SET_LAST_RESULT_IMAGE_URL``. Pass ``null`` (or omit) when no
   * generations source is available (e.g. presentational tests, sheet
   * mounts outside ``WorkspaceContent``); the settle effect short-circuits
   * to a no-op in that case.
   */
  generations?: Generation[] | null;
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
  lastResultImageUrlRef,
  generations,
}: UseAssistantRuntimeOptions): UseAssistantRuntimeReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  // Keep latest selectedModel in a ref so async functions always read the current value
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  // ---------------------------------------------------------------------------
  // Slice 18: Auto-Apply-Settle Path
  // ---------------------------------------------------------------------------
  //
  // Tracks generation ids that have already been "consumed" by a
  // ``SET_LAST_RESULT_IMAGE_URL`` dispatch. When the polling pipeline in
  // ``WorkspaceContent`` flips a generation's ``status`` from ``"pending"``
  // to ``"completed"`` (the on-the-wire status name for "succeeded" per
  // ``lib/db/schema.ts:66``) AND the row carries a non-empty ``imageUrl``,
  // the settle effect dispatches the action with the URL of the NEWEST
  // such generation (sorted by ``createdAt`` descending) and adds the id
  // to the consumed-set so the dispatch fires EXACTLY ONCE per generation
  // (AC-1).
  //
  // The consumed-set is a ``Set<string>`` ref so that re-renders never
  // double-dispatch even when React StrictMode runs the effect twice in
  // dev. The set is intentionally never trimmed — the per-session
  // generation count is bounded by user behaviour (a single project
  // rarely accumulates >100 generations in one tab session) and the
  // memory footprint is negligible.
  const consumedGenerationIdsRef = useRef<Set<string>>(new Set());
  // Slice 18: marker holding the URL+id of a freshly-settled generation
  // that has NOT yet been attached to an outgoing assistant message
  // placeholder. Set by the settle effect, consumed (and cleared) by the
  // next ``ADD_ASSISTANT_MESSAGE`` dispatch in ``sendMessageToSession``.
  // This implements Pattern (a) — explicit per-message marker on
  // ``ChatMessage.resultImageUrl`` (single-attach semantics: only the
  // FIRST proactive starter after a successful generate carries the
  // thumbnail, AC-8).
  const pendingResultAttachmentRef = useRef<{
    url: string;
    generationId: string;
  } | null>(null);

  useEffect(() => {
    // No generations source mounted (presentational tests / sheet outside
    // ``WorkspaceContent``) — the settle path cannot run. Bail without
    // touching the consumed-set so a later remount with a real source
    // still picks up freshly-completed rows.
    if (!generations || generations.length === 0) return;

    // Find generations that just settled to "completed" with a real
    // image URL AND have not yet been consumed by a previous dispatch.
    // ``imageUrl`` is the column populated by the Replicate webhook on
    // success (``lib/db/schema.ts:67`` — ``image_url text``); a successful
    // generation without a URL is treated as not-yet-settled.
    const freshlyCompleted = generations.filter(
      (g) =>
        g.status === "completed" &&
        typeof g.imageUrl === "string" &&
        g.imageUrl.length > 0 &&
        !consumedGenerationIdsRef.current.has(g.id)
    );
    if (freshlyCompleted.length === 0) return;

    // Pick the NEWEST freshly-completed row by ``createdAt``. Polling
    // batches may surface multiple settles at once (a 4-variant batch all
    // resolving in the same poll-window); the spec is unambiguous —
    // dispatch carries only the URL of the newest generation (Discovery
    // business rule line 286: only the latest result is held).
    let newest = freshlyCompleted[0];
    for (let i = 1; i < freshlyCompleted.length; i += 1) {
      const candidate = freshlyCompleted[i];
      if (
        new Date(candidate.createdAt).getTime() >
        new Date(newest.createdAt).getTime()
      ) {
        newest = candidate;
      }
    }

    // Mark every freshly-completed row as consumed (not just ``newest``)
    // so the next poll-tick that surfaces them again doesn't re-dispatch
    // for the older siblings (e.g. variants 1-3 of a 4-variant batch).
    // The dispatch itself only carries ``newest`` per AC-1.
    for (const g of freshlyCompleted) {
      consumedGenerationIdsRef.current.add(g.id);
    }

    // Defensive: ``imageUrl`` is non-null per the filter above, but
    // TypeScript's narrowing through ``filter`` is not flow-precise.
    const url = newest.imageUrl as string;

    dispatch({
      type: "SET_LAST_RESULT_IMAGE_URL",
      url,
      generationId: newest.id,
    });

    // Arm the per-message attachment marker for the NEXT
    // ``ADD_ASSISTANT_MESSAGE`` placeholder. Single-attach semantics
    // (AC-8: only the FIRST proactive starter after settle carries the
    // thumbnail) are enforced by the ref being cleared in
    // ``sendMessageToSession`` once consumed.
    pendingResultAttachmentRef.current = {
      url,
      generationId: newest.id,
    };
  }, [generations, dispatch]);

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
            } else if (result.tool === "set_slot_role") {
              // Slice 24 AC-1 + AC-8: snake_case → camelCase mapping plus
              // defense-in-depth payload validation. Backend Pydantic
              // already enforces these in Slice 23, but the frontend
              // never trusts the wire — malformed payloads get
              // logged + skipped.
              const payload = result.data as Partial<SetSlotRoleData>;
              const slotIndex = payload?.slot_index;
              const role = payload?.role;
              if (
                typeof slotIndex !== "number" ||
                !Number.isInteger(slotIndex) ||
                typeof role !== "string" ||
                !SLOT_ROLE_WHITELIST.has(role as SlotRole)
              ) {
                console.warn(
                  "[useAssistantRuntime] Ignoring malformed " +
                    "set_slot_role tool-call-result payload:",
                  result.data
                );
                break;
              }
              dispatch({
                type: "SET_SLOT_ROLE",
                slotIndex,
                role: role as SlotRole,
              });
            } else if (result.tool === "set_slot_strength") {
              // Slice 24 AC-2 + AC-8: same defensive pattern as
              // set_slot_role. ``strength`` must be a finite number in
              // the inclusive range [0.0, 1.0] (architecture.md →
              // Validation Rules → set_slot_strength).
              const payload = result.data as Partial<SetSlotStrengthData>;
              const slotIndex = payload?.slot_index;
              const strength = payload?.strength;
              if (
                typeof slotIndex !== "number" ||
                !Number.isInteger(slotIndex) ||
                typeof strength !== "number" ||
                !Number.isFinite(strength) ||
                strength < 0 ||
                strength > 1
              ) {
                console.warn(
                  "[useAssistantRuntime] Ignoring malformed " +
                    "set_slot_strength tool-call-result payload:",
                  result.data
                );
                break;
              }
              dispatch({
                type: "SET_SLOT_STRENGTH",
                slotIndex,
                strength,
              });
            } else if (result.tool === "set_model_params") {
              // Slice 24 AC-3 + AC-8: ``params`` is mapped onto the
              // frontend convention ``modelParams``. Validation against
              // the active-model JSON-schema runs backend-side (Slice
              // 23); the frontend only checks shape (object, non-null,
              // non-array).
              const payload = result.data as Partial<SetModelParamsData>;
              const params = payload?.params;
              if (
                params === null ||
                typeof params !== "object" ||
                Array.isArray(params)
              ) {
                console.warn(
                  "[useAssistantRuntime] Ignoring malformed " +
                    "set_model_params tool-call-result payload:",
                  result.data
                );
                break;
              }
              dispatch({
                type: "SET_MODEL_PARAMS_PATCH",
                modelParams: params as Record<string, unknown>,
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

        // Slice 18: include ``last_result_image_url`` whenever the
        // reducer ref carries a URL. The field is OMITTED entirely when
        // the ref is null/empty (chosen pattern — matches the existing
        // optionality of ``project_id``, ``image_urls``, ``image_model_id``
        // and the Pydantic-side ``Optional`` declared in
        // ``backend/app/models/dtos.py:21-59``). The choice is recorded in
        // architecture.md → "Migration Map" Zeile
        // ``lib/assistant/use-assistant-runtime.ts:354-373`` and matches
        // the explicit AC-2 wording: "wird das Feld entweder weggelassen
        // oder explizit `null` gesendet (Implementer wählt 1 Pattern,
        // gemäss bestehender DTO-Optionalität)".
        const currentLastResultImageUrl = lastResultImageUrlRef?.current;
        if (
          typeof currentLastResultImageUrl === "string" &&
          currentLastResultImageUrl.length > 0
        ) {
          body.last_result_image_url = currentLastResultImageUrl;
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

        // Slice 18: consume the per-message attachment marker armed by
        // the auto-apply-settle effect. Only the FIRST assistant message
        // placeholder created AFTER a fresh result settles carries the
        // ``resultImageUrl`` / ``resultGenerationId`` marker (AC-8 single-
        // attach semantics — the chat-thread renders the result_message
        // variant for that one message; subsequent assistant messages in
        // the same review-loop fall back to the default bubble).
        const pendingAttachment = pendingResultAttachmentRef.current;
        pendingResultAttachmentRef.current = null;

        // Add an empty assistant message placeholder for streaming
        dispatch({
          type: "ADD_ASSISTANT_MESSAGE",
          message: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: "",
            isStreaming: true,
            ...(pendingAttachment
              ? {
                  resultImageUrl: pendingAttachment.url,
                  resultGenerationId: pendingAttachment.generationId,
                }
              : {}),
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
