"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type Dispatch,
  type MutableRefObject,
} from "react";
import { toast } from "sonner";
import { useWorkspaceVariation } from "@/lib/workspace-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ChatMessage as Message } from "@/lib/types/chat-message";
import type { ChatMessage as Message } from "@/lib/types/chat-message";

export interface DraftPrompt {
  prompt: string;
}

/** Field names for the DraftPrompt type */
export type DraftPromptField = keyof DraftPrompt;

export interface ToolCallResult {
  tool: string;
  data: Record<string, unknown>;
}

/** Possible views within the assistant sheet */
export type ActiveView = "chat" | "session-list" | "startscreen";

// ---------------------------------------------------------------------------
// Slice 15: FSM mirror + IntentSummaryPayload types
// ---------------------------------------------------------------------------

/**
 * Whitelisted FSM states for the Interactive Prompt Refinement flow.
 *
 * Mirrors the backend ``flow_state`` enum (architecture.md → "Data
 * Transfer Objects" → ``FlowStateEvent``). Five values are emitted by the
 * backend (``idle | interviewing | summarizing | reviewing | refining``);
 * ``generating`` is set frontend-side on the user click in the
 * IntentSummaryCard (no backend round-trip).
 */
export type FlowState =
  | "idle"
  | "interviewing"
  | "summarizing"
  | "reviewing"
  | "refining"
  | "generating";

/**
 * Typed diff payload for ``IntentSummaryPayload.settings_diff``.
 *
 * Mirrors architecture.md → "SettingsDiff Type Schema". All four
 * sub-arrays are optional; the backend omits the entire ``settings_diff``
 * field when no settings changed.
 */
export interface SettingsDiff {
  slotRoles?: Array<{
    slotIndex: number;
    from: "subject" | "style" | "composition" | null;
    to: "subject" | "style" | "composition";
  }>;
  slotStrengths?: Array<{
    slotIndex: number;
    from: number | null;
    to: number;
  }>;
  modelId?: { from: string; to: string };
  modelParams?: Array<{ key: string; from: unknown; to: unknown }>;
}

/**
 * Wire payload of the SSE ``intent-summary`` event.
 *
 * Mirrors architecture.md → "Data Transfer Objects" →
 * ``IntentSummaryPayload``. ``settings_diff`` is omitted when no settings
 * changed (per AC-3 in the Slice 15 spec).
 */
export interface IntentSummaryPayload {
  axes: {
    subject?: string;
    medium?: string;
    style?: string;
    lighting?: string;
    composition?: string;
    palette?: string;
  };
  prompt_preview: string;
  settings_diff?: SettingsDiff;
}

// ---------------------------------------------------------------------------
// Session Detail Response (from backend GET /api/assistant/sessions/{id})
// ---------------------------------------------------------------------------

interface SessionDetailState {
  messages: Array<{ role: string; content: string }>;
  draft_prompt: {
    prompt?: string;
    /** Legacy fields from old sessions (backwards-compat) */
    motiv?: string;
    style?: string;
    negative_prompt?: string;
  } | null;
  /**
   * Slice 28: persisted FSM state from the LangGraph checkpointer
   * (architecture.md → "Frontend State Machine Wiring" → "Resume on session
   * reload"). Optional because legacy checkpoints (pre-Slice-14) and the
   * defensive backend defaults may omit / default the field. The hydrate-
   * effekt in ``loadSession`` validates against ``FLOW_STATE_WHITELIST``
   * before dispatching ``SET_FLOW_STATE`` (AC-7).
   */
  flow_state?: string;
  /**
   * Slice 28: persisted intent-summary axes (subject/medium/style/lighting/
   * composition/palette). Empty object for legacy checkpoints; mapped 1:1
   * into ``IntentSummaryPayload.axes`` on resume (AC-4).
   */
  intent_axes?: {
    subject?: string;
    medium?: string;
    style?: string;
    lighting?: string;
    composition?: string;
    palette?: string;
  };
  /**
   * Slice 28: persisted ``final_intent`` payload (written by the
   * ``emit_intent_summary`` tool). ``null`` / ``undefined`` for legacy
   * checkpoints and for sessions where the tool was never invoked. The
   * hydrate-effekt rebuilds ``IntentSummaryPayload`` from this payload +
   * ``intent_axes`` when ``flow_state === "summarizing"`` (AC-4).
   * ``model_id`` is intentionally not propagated to ``IntentSummaryPayload``
   * (which has no ``model_id`` field).
   */
  final_intent?: {
    prompt: string;
    settings_diff?: SettingsDiff | null;
    model_id?: string | null;
  } | null;
}

/**
 * Slice 28 AC-7: whitelist of FSM ``flow_state`` values that the hydrate-
 * effekt accepts. Mirrors the backend whitelist in
 * ``backend/app/services/assistant_service.py:_FLOW_STATE_WHITELIST`` plus
 * the frontend-only ``"generating"`` transition (set on user click in the
 * IntentSummaryCard). Unknown values are dropped + logged via
 * ``console.warn`` (analog to Slice 15 AC-9).
 */
const FLOW_STATE_WHITELIST: ReadonlySet<FlowState> = new Set<FlowState>([
  "idle",
  "interviewing",
  "summarizing",
  "reviewing",
  "refining",
  "generating",
]);

function isWhitelistedFlowState(value: unknown): value is FlowState {
  return typeof value === "string"
    && (FLOW_STATE_WHITELIST as ReadonlySet<string>).has(value);
}

interface SessionDetailResponse {
  session: {
    id: string;
    title: string | null;
    status: string;
    message_count: number;
    has_draft: boolean;
  };
  state: SessionDetailState;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AssistantState {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  draftPrompt: DraftPrompt | null;
  /** Counter that increments on SET_DRAFT_PROMPT / REFINE_DRAFT to trigger auto-apply */
  draftVersion: number;
  selectedModel: string;
  toolCallResults: ToolCallResult[];
  /** Current view within the assistant sheet */
  activeView: ActiveView;
  /** Whether a session is currently being loaded */
  isLoadingSession: boolean;
  /** Whether the current draft has been applied to the workspace */
  isApplied: boolean;
  /**
   * Tab-session-scoped flag for the No-Context-Hint-Banner dismissal.
   * Slice 10: defaults to `false` on provider-mount, set to `true` via
   * DISMISS_NO_CONTEXT_BANNER, NOT reset on RESET_SESSION (project switch).
   * Resets only on tab reload (provider re-mount). No persistence.
   */
  noContextBannerDismissed: boolean;
  /**
   * Slice 15: mirror of the backend FSM ``flow_state`` field. Updated by
   * the SSE ``flow-state`` event handler in ``use-assistant-runtime.ts``
   * via the ``SET_FLOW_STATE`` action. Defaults to ``"idle"``; the
   * ``"generating"`` transition is set frontend-side on user click in the
   * IntentSummaryCard (no backend round-trip).
   */
  flowState: FlowState;
  /**
   * Slice 15: payload of the most-recently-received ``intent-summary`` SSE
   * event. ``null`` until the LLM calls ``emit_intent_summary``; replaced
   * (idempotent) on each subsequent event so the IntentSummaryCard can
   * re-render with the latest payload.
   */
  intentSummaryPayload: IntentSummaryPayload | null;
  /**
   * Slice 24: pending slot-role patch coming from the LangGraph
   * ``set_slot_role`` tool result. The PromptArea subscribes via
   * ``useEffect`` keyed on ``version`` and applies the change to its
   * local slot state through the existing ``handleReferenceRoleChange``
   * helper. ``null`` until the first tool call; replaced (NOT merged) on
   * each subsequent ``SET_SLOT_ROLE`` action. The ``version`` counter
   * (analogous to ``draftVersion``) ensures that two consecutive
   * identical payloads still trigger two distinct subscriber runs.
   * Transient — NOT persisted across LangGraph resume (Slice 28).
   */
  pendingSlotRolePatch: {
    slotIndex: number;
    role: "subject" | "style" | "composition";
    version: number;
  } | null;
  /**
   * Slice 24: pending slot-strength patch coming from the LangGraph
   * ``set_slot_strength`` tool result. Same subscriber pattern as
   * ``pendingSlotRolePatch``; ``strength`` is a float in [0.0, 1.0].
   * Transient — NOT persisted across LangGraph resume.
   */
  pendingSlotStrengthPatch: {
    slotIndex: number;
    strength: number;
    version: number;
  } | null;
  /**
   * Slice 24: pending workspace ``modelParams`` patch coming from the
   * LangGraph ``set_model_params`` tool result. Consumed by the existing
   * auto-apply ``useEffect`` in the AssistantProvider, which forwards
   * ``modelParams`` to ``setVariation`` WITHOUT touching ``promptMotiv``,
   * ``promptStyle`` or ``negativePrompt`` (slice-boundary discipline,
   * see ``assistant-context-apply.test.tsx`` AC-2). Transient — NOT
   * persisted across LangGraph resume.
   */
  pendingModelParamsPatch: {
    modelParams: Record<string, unknown>;
    version: number;
  } | null;
  /**
   * Slice 27: payload of the most-recent ``RENDER_PASTE_CONFIRM`` action
   * dispatched by the trigger-layer in ``chat-thread.tsx`` when the
   * paste-detect heuristic (Slice 26) matches the FIRST user message of a
   * session. ``null`` until the trigger fires; reset to ``null`` by
   * ``DISMISS_PASTE_CONFIRM`` after either button click.
   *
   * **Transient — NOT persisted across LangGraph resume (Slice 28).**
   * The card is a one-shot routing decision, not a durable artefact (see
   * wireframes.md → "Screen: Paste Detect Confirm Card" → State
   * Variations → ``dismissed``). The trigger-layer also enforces a
   * single-fire guarantee at the call-site level (AC-2): even if a later
   * user message would match the heuristic, no second
   * ``RENDER_PASTE_CONFIRM`` is dispatched in the same session.
   */
  pasteConfirmPayload: { seedText: string } | null;
}

const initialState: AssistantState = {
  sessionId: null,
  messages: [],
  isStreaming: false,
  draftPrompt: null,
  draftVersion: 0,
  selectedModel: "anthropic/claude-sonnet-4.6",
  toolCallResults: [],
  activeView: "startscreen",
  isLoadingSession: false,
  isApplied: false,
  noContextBannerDismissed: false,
  flowState: "idle",
  intentSummaryPayload: null,
  pendingSlotRolePatch: null,
  pendingSlotStrengthPatch: null,
  pendingModelParamsPatch: null,
  pasteConfirmPayload: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AssistantAction =
  | { type: "SET_SESSION_ID"; sessionId: string }
  | { type: "ADD_USER_MESSAGE"; message: Message }
  | { type: "ADD_ASSISTANT_MESSAGE"; message: Message }
  | { type: "APPEND_ASSISTANT_DELTA"; content: string }
  | { type: "MARK_ASSISTANT_DONE" }
  | { type: "ADD_ERROR_MESSAGE"; content: string }
  | { type: "SET_STREAMING"; isStreaming: boolean }
  | { type: "SET_DRAFT_PROMPT"; draftPrompt: DraftPrompt }
  | { type: "REFINE_DRAFT"; draftPrompt: DraftPrompt }
  | { type: "ADD_TOOL_CALL_RESULT"; result: ToolCallResult }
  | { type: "SET_SELECTED_MODEL"; model: string }
  | { type: "SET_ACTIVE_VIEW"; view: ActiveView }
  | { type: "SET_LOADING_SESSION"; isLoading: boolean }
  | {
      type: "LOAD_SESSION";
      sessionId: string;
      messages: Message[];
      draftPrompt: DraftPrompt | null;
      /** Whether the draft was previously applied to the workspace (AC-6) */
      isApplied?: boolean;
    }
  | { type: "RESET_SESSION" }
  | { type: "SET_IS_APPLIED"; isApplied: boolean }
  | { type: "DISMISS_NO_CONTEXT_BANNER" }
  | { type: "SET_FLOW_STATE"; flowState: FlowState }
  | { type: "RENDER_INTENT_SUMMARY"; payload: IntentSummaryPayload }
  | {
      /**
       * Slice 21 AC-7: append an inline System-Message to the chat
       * history when the backend reports a failed reference-slot load
       * (SSE ``slot-load-failed``). The reducer is a pure state mutation
       * — toast suppression is explicit per the AC; the SSE handler
       * dispatches this action without any toast side-effect.
       */
      type: "RENDER_SYSTEM_MESSAGE";
      payload: {
        slot_index: number;
        reason: string;
      };
    }
  | {
      /**
       * Slice 24: dispatched by the SSE handler when a ``set_slot_role``
       * tool-call-result event is received. Reducer increments the
       * ``pendingSlotRolePatch.version`` counter so the PromptArea
       * subscriber picks the change up even when the payload is
       * unchanged.
       */
      type: "SET_SLOT_ROLE";
      slotIndex: number;
      role: "subject" | "style" | "composition";
    }
  | {
      /**
       * Slice 24: dispatched by the SSE handler when a
       * ``set_slot_strength`` tool-call-result event is received.
       */
      type: "SET_SLOT_STRENGTH";
      slotIndex: number;
      strength: number;
    }
  | {
      /**
       * Slice 24: dispatched by the SSE handler when a
       * ``set_model_params`` tool-call-result event is received. The
       * auto-apply ``useEffect`` in the AssistantProvider forwards the
       * ``modelParams`` to ``setVariation`` (without touching prompt
       * fields) when the version counter increments.
       */
      type: "SET_MODEL_PARAMS_PATCH";
      modelParams: Record<string, unknown>;
    }
  | {
      /**
       * Slice 27: dispatched by the trigger-layer in ``chat-thread.tsx``
       * when the paste-detect heuristic matches the FIRST user message
       * of a session. Sets ``state.pasteConfirmPayload`` to
       * ``{ seedText }`` so the chat-thread render-branch mounts the
       * ``<PasteDetectConfirmCard />``. Idempotent at the reducer
       * boundary — successive dispatches simply replace the payload;
       * single-fire is enforced one level up by the trigger-layer
       * (AC-2).
       */
      type: "RENDER_PASTE_CONFIRM";
      payload: { seedText: string };
    }
  | {
      /**
       * Slice 27: dispatched by the card component itself on either
       * button click ("Direkt verfeinern" / "Interview starten"). Sets
       * ``state.pasteConfirmPayload`` back to ``null`` so the
       * chat-thread render-branch un-mounts the card. The card is
       * **transient** — unlike the IntentSummaryCard it does NOT
       * persist in chat history.
       */
      type: "DISMISS_PASTE_CONFIRM";
    };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function assistantReducer(
  state: AssistantState,
  action: AssistantAction
): AssistantState {
  switch (action.type) {
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId };

    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message],
        activeView: "chat",
      };

    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message],
        activeView: "chat",
      };

    case "APPEND_ASSISTANT_DELTA": {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
        msgs[lastIdx] = {
          ...msgs[lastIdx],
          content: msgs[lastIdx].content + action.content,
        };
      }
      return { ...state, messages: msgs };
    }

    case "MARK_ASSISTANT_DONE": {
      const msgs = [...state.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx >= 0 && msgs[lastIdx].role === "assistant") {
        msgs[lastIdx] = { ...msgs[lastIdx], isStreaming: false };
      }
      return { ...state, messages: msgs, isStreaming: false };
    }

    case "ADD_ERROR_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: action.content,
            isError: true,
          },
        ],
        isStreaming: false,
      };

    case "SET_STREAMING":
      return { ...state, isStreaming: action.isStreaming };

    case "SET_DRAFT_PROMPT":
      return {
        ...state,
        draftPrompt: action.draftPrompt,
        draftVersion: state.draftVersion + 1,
        isApplied: false,
      };

    case "REFINE_DRAFT":
      return {
        ...state,
        draftPrompt: action.draftPrompt,
        draftVersion: state.draftVersion + 1,
        isApplied: false,
      };

    case "ADD_TOOL_CALL_RESULT":
      return {
        ...state,
        toolCallResults: [...state.toolCallResults, action.result],
      };

    case "SET_SELECTED_MODEL":
      return { ...state, selectedModel: action.model };

    case "SET_ACTIVE_VIEW":
      return { ...state, activeView: action.view };

    case "SET_LOADING_SESSION":
      return { ...state, isLoadingSession: action.isLoading };

    case "LOAD_SESSION":
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
        draftPrompt: action.draftPrompt,
        // Do NOT increment draftVersion on session restore — prevents auto-apply
        toolCallResults: [],
        isStreaming: false,
        isLoadingSession: false,
        activeView: "chat",
        // AC-6: Restore isApplied flag (defaults to false when not provided)
        isApplied: action.isApplied ?? false,
      };

    case "RESET_SESSION":
      // Slice 10: noContextBannerDismissed has tab-session scope and MUST NOT
      // be reset on project/session switch. It only resets on tab reload
      // (provider re-mount) per architecture.md "Frontend State Machine Wiring".
      // Slice 24 AC-10: pendingSlotRolePatch / pendingSlotStrengthPatch /
      // pendingModelParamsPatch are transient and reset to ``null`` here
      // (handled implicitly via spreading ``initialState``).
      return {
        ...initialState,
        selectedModel: state.selectedModel,
        noContextBannerDismissed: state.noContextBannerDismissed,
      };

    case "SET_IS_APPLIED":
      return { ...state, isApplied: action.isApplied };

    case "DISMISS_NO_CONTEXT_BANNER":
      return { ...state, noContextBannerDismissed: true };

    case "SET_FLOW_STATE":
      // Slice 15 AC-7: only ``flowState`` is mutated; all other fields
      // (messages, draftPrompt, sessionId, …) are preserved verbatim.
      //
      // Slice 17 AC-6 (idempotency check): the reducer-branch accepts
      // every member of the ``FlowState`` union, including
      // ``"generating"`` (set frontend-side on the user click in the
      // IntentSummaryCard, no backend round-trip). No additional
      // whitelist enforcement needed — the type union is the contract.
      return { ...state, flowState: action.flowState };

    case "RENDER_INTENT_SUMMARY":
      // Slice 15 AC-8: replace the previous payload (idempotent re-render).
      // The card mount/un-mount is driven separately by ``flowState``; here
      // we only carry the data so the card can read it on render.
      return { ...state, intentSummaryPayload: action.payload };

    case "RENDER_SYSTEM_MESSAGE": {
      // Slice 21 AC-7: append a system-typed message to the chat history
      // describing the failed reference-slot load. The text is fixed by
      // architecture.md → "Error Handling" ("Slot N konnte nicht geladen
      // werden — bitte neu hochladen"). Insertion is at the END of the
      // messages list which is the chronological position of the SSE
      // event in the live stream.
      //
      // The reducer is a PURE state mutation: it MUST NOT trigger a
      // toast. Any UX surfaces (banner, indicator) react to this state
      // change via subscription, not from inside the reducer.
      const { slot_index, reason } = action.payload;
      const systemMessage: Message = {
        id: `system-slot-load-failed-${slot_index}-${Date.now()}`,
        role: "system",
        content: `Slot ${slot_index + 1} konnte nicht geladen werden — bitte neu hochladen.`,
      };
      // ``reason`` is intentionally not surfaced in the user-visible text
      // (architecture mandates a single human-readable message) but is
      // available in the action payload for telemetry / debug callers
      // that subscribe to dispatched actions.
      void reason;
      return {
        ...state,
        messages: [...state.messages, systemMessage],
      };
    }

    case "SET_SLOT_ROLE": {
      // Slice 24 AC-4: replace ``pendingSlotRolePatch`` and bump the
      // version counter. The PromptArea subscriber observes ``version``
      // (not the payload itself) so identical successive payloads still
      // trigger two distinct subscriber runs — analogous to the
      // ``draftVersion`` pattern.
      const previousVersion = state.pendingSlotRolePatch?.version ?? 0;
      return {
        ...state,
        pendingSlotRolePatch: {
          slotIndex: action.slotIndex,
          role: action.role,
          version: previousVersion + 1,
        },
      };
    }

    case "SET_SLOT_STRENGTH": {
      // Slice 24 AC-5: same version-bump pattern as SET_SLOT_ROLE.
      const previousVersion = state.pendingSlotStrengthPatch?.version ?? 0;
      return {
        ...state,
        pendingSlotStrengthPatch: {
          slotIndex: action.slotIndex,
          strength: action.strength,
          version: previousVersion + 1,
        },
      };
    }

    case "SET_MODEL_PARAMS_PATCH": {
      // Slice 24 AC-6: bump version so the auto-apply effect picks up
      // the new modelParams payload. The reducer is pure — the actual
      // ``setVariation({modelParams})`` call lives in the
      // AssistantProvider's auto-apply ``useEffect``.
      const previousVersion = state.pendingModelParamsPatch?.version ?? 0;
      return {
        ...state,
        pendingModelParamsPatch: {
          modelParams: action.modelParams,
          version: previousVersion + 1,
        },
      };
    }

    case "RENDER_PASTE_CONFIRM":
      // Slice 27 AC-8: replace ``pasteConfirmPayload`` with the seed
      // text from the first user message. The reducer mutation is
      // idempotent — a second dispatch in the same session would simply
      // overwrite the payload. The trigger-layer in ``chat-thread.tsx``
      // is responsible for the single-fire guarantee (AC-2): even if a
      // later user message would match the heuristic, no second
      // RENDER_PASTE_CONFIRM is dispatched.
      return { ...state, pasteConfirmPayload: action.payload };

    case "DISMISS_PASTE_CONFIRM":
      // Slice 27 AC-9: clear the payload so the chat-thread render-
      // branch un-mounts the card. The card is transient — unlike the
      // IntentSummaryCard it does NOT persist in history (wireframes.md
      // → "Screen: Paste Detect Confirm Card" → State Variations →
      // ``dismissed``).
      return { ...state, pasteConfirmPayload: null };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context Value
// ---------------------------------------------------------------------------

export interface PromptAssistantContextValue {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  draftPrompt: DraftPrompt | null;
  selectedModel: string;
  /** Current view within the assistant sheet */
  activeView: ActiveView;
  /** Whether a session is currently being loaded */
  isLoadingSession: boolean;
  /** Whether the current draft has been applied to the workspace */
  isApplied: boolean;
  /**
   * Slice 10: tab-session-scoped flag indicating whether the user dismissed
   * the No-Context-Hint-Banner. Reset only on tab reload (provider re-mount).
   */
  noContextBannerDismissed: boolean;
  /**
   * Slice 24: most-recent slot-role patch from the LangGraph
   * ``set_slot_role`` tool. PromptArea subscribes via ``useEffect`` keyed
   * on ``version``. ``null`` until the first tool call.
   */
  pendingSlotRolePatch: AssistantState["pendingSlotRolePatch"];
  /**
   * Slice 24: most-recent slot-strength patch from the LangGraph
   * ``set_slot_strength`` tool.
   */
  pendingSlotStrengthPatch: AssistantState["pendingSlotStrengthPatch"];
  /**
   * Slice 15 / 16: mirror of the backend FSM ``flow_state`` field.
   * Consumed by ``chat-thread.tsx`` + ``intent-summary-card.tsx`` to gate
   * the card mount.
   */
  flowState: FlowState;
  /**
   * Slice 15 / 16: payload of the most-recent ``intent-summary`` SSE
   * event. Read by ``IntentSummaryCard`` for rendering. ``null`` until
   * the LLM emits an intent summary.
   */
  intentSummaryPayload: IntentSummaryPayload | null;
  /**
   * Slice 27: payload of the most-recent ``RENDER_PASTE_CONFIRM`` action.
   * Read by ``PasteDetectConfirmCard`` for rendering and to access the
   * original seed text on button click. ``null`` until the trigger-layer
   * fires; reset to ``null`` by ``DISMISS_PASTE_CONFIRM``.
   */
  pasteConfirmPayload: { seedText: string } | null;
  sendMessage: (content: string, imageUrls?: string[]) => void;
  cancelStream: () => void;
  setSelectedModel: (model: string) => void;
  /** Navigate to a specific view */
  setActiveView: (view: ActiveView) => void;
  /** Load a session from the backend by ID (AC-4, AC-5, AC-6, AC-10, AC-11) */
  loadSession: (sessionId: string) => Promise<void>;
  /** Apply the current draftPrompt to the workspace via setVariation */
  applyToWorkspace: () => void;
  /** Undo the last apply, restoring previous workspace values */
  undoApply: () => void;
  dispatch: Dispatch<AssistantAction>;
  /** Ref to the current session ID (for use by useAssistantRuntime) */
  sessionIdRef: MutableRefObject<string | null>;
  /** Ref for registering the sendMessage implementation from useAssistantRuntime */
  sendMessageRef: MutableRefObject<
    ((content: string, imageUrls?: string[]) => void) | null
  >;
  /** Ref for registering the cancelStream implementation from useAssistantRuntime */
  cancelStreamRef: MutableRefObject<(() => void) | null>;
  /** Ref holding the current workspace image model ID — written by PromptArea */
  imageModelIdRef: MutableRefObject<string | null>;
  /** Ref holding the current generation mode — written by PromptArea */
  generationModeRef: MutableRefObject<string | null>;
}

/**
 * Slice 16: exported (was previously module-private) so consumers like
 * ``chat-thread.tsx`` can use ``useContext(PromptAssistantContext)``
 * directly to read FSM + intent-payload state in a way that gracefully
 * tolerates the no-provider case (existing presentational tests render
 * the thread without a provider).
 */
export const PromptAssistantContext =
  createContext<PromptAssistantContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider Props
// ---------------------------------------------------------------------------

export interface PromptAssistantProviderProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Auto-Title Helper
// ---------------------------------------------------------------------------

/**
 * Sends a PATCH request to the backend to set the session title.
 * Truncates the first user message to max 80 characters as the title.
 * AC-9: Auto-title from first user message.
 */
async function updateSessionTitle(
  sessionId: string,
  firstUserMessage: string
): Promise<void> {
  const title =
    firstUserMessage.length > 80
      ? firstUserMessage.slice(0, 80)
      : firstUserMessage;

  try {
    await fetch(`/api/assistant/sessions/${sessionId}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  } catch {
    // Auto-title is best-effort, don't block the user
    console.warn("[PromptAssistantContext] Failed to set auto-title");
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PromptAssistantProvider({
  children,
}: PromptAssistantProviderProps) {
  const [state, dispatch] = useReducer(assistantReducer, initialState);
  const { variationData, setVariation } = useWorkspaceVariation();

  // Refs that bridge the context and the runtime hook
  const sessionIdRef = useRef<string | null>(null);
  // Snapshot of workspace values before apply, for undo
  const undoSnapshotRef = useRef<{
    promptMotiv: string;
  } | null>(null);
  const sendMessageRef = useRef<
    ((content: string, imageUrls?: string[]) => void) | null
  >(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  // Track whether auto-title has already been triggered for this session
  const autoTitleSentRef = useRef<string | null>(null);

  // Slice 08: Refs for workspace image model and generation mode.
  // Written externally by PromptArea (which knows the resolved model and mode).
  const imageModelIdRef = useRef<string | null>(null);
  const generationModeRef = useRef<string | null>(null);

  // Keep sessionIdRef in sync with reducer state
  sessionIdRef.current = state.sessionId;

  const sendMessage = useCallback(
    (content: string, imageUrls?: string[]) => {
      if (sendMessageRef.current) {
        sendMessageRef.current(content, imageUrls);

        // AC-9: Auto-title after first user message is sent.
        // Trigger the title update asynchronously after the send.
        const sid = sessionIdRef.current;
        if (sid && autoTitleSentRef.current !== sid) {
          autoTitleSentRef.current = sid;
          updateSessionTitle(sid, content);
        } else if (!sid) {
          // Session will be created by the runtime. Schedule a delayed check.
          setTimeout(() => {
            const newSid = sessionIdRef.current;
            if (newSid && autoTitleSentRef.current !== newSid) {
              autoTitleSentRef.current = newSid;
              updateSessionTitle(newSid, content);
            }
          }, 2000);
        }
      } else {
        console.warn(
          "[PromptAssistantContext] sendMessage called but no runtime registered."
        );
      }
    },
    [] // sendMessageRef and sessionIdRef are stable (refs)
  );

  const cancelStream = useCallback(() => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
    }
  }, []);

  const setSelectedModel = useCallback(
    (model: string) => {
      dispatch({ type: "SET_SELECTED_MODEL", model });
    },
    [dispatch]
  );

  const setActiveView = useCallback(
    (view: ActiveView) => {
      dispatch({ type: "SET_ACTIVE_VIEW", view });
    },
    [dispatch]
  );

  /**
   * Load a session from the backend by ID.
   * AC-4: Restores messages from session state.
   * AC-5: Sets draftPrompt from session state.
   * AC-10: Replaces current session state when switching.
   * AC-11: Shows error toast on failure.
   */
  const loadSession = useCallback(
    async (sessionId: string) => {
      dispatch({ type: "SET_LOADING_SESSION", isLoading: true });

      try {
        const response = await fetch(
          `/api/assistant/sessions/${sessionId}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: SessionDetailResponse = await response.json();

        // Convert backend messages to frontend Message format
        const messages: Message[] = data.state.messages.map(
          (msg, index) => ({
            id: `restored-${sessionId}-${index}`,
            role: msg.role === "human" ? "user" : "assistant",
            content: msg.content,
          })
        );

        // Convert backend draft_prompt to frontend DraftPrompt.
        // Backwards-compat: old sessions may have { motiv, style, negative_prompt },
        // new sessions have { prompt }. Map old format to { prompt: motiv }.
        let draftPrompt: DraftPrompt | null = null;
        if (data.state.draft_prompt) {
          const draft = data.state.draft_prompt;
          draftPrompt = {
            prompt: draft.prompt ?? draft.motiv ?? "",
          };
        }

        // AC-10: Replace current session state entirely
        dispatch({
          type: "LOAD_SESSION",
          sessionId,
          messages,
          draftPrompt,
        });

        // Update the sessionIdRef for the runtime
        sessionIdRef.current = sessionId;
        // Reset auto-title tracking for this session (it already has a title)
        autoTitleSentRef.current = sessionId;

        // -------------------------------------------------------------
        // Slice 28: FSM-Hydrate
        // -------------------------------------------------------------
        // Re-dispatches the FSM mirror (``SET_FLOW_STATE``) and — if the
        // backend persisted a ``final_intent`` payload — also the
        // ``RENDER_INTENT_SUMMARY`` action so that the IntentSummaryCard
        // re-mounts with identical content after a page reload
        // (architecture.md → "Frontend State Machine Wiring" → "Resume on
        // session reload"). Defensive fallbacks per AC-6 / AC-7:
        //   * unknown flow_state → no dispatch + console.warn
        //   * flow_state="summarizing" without final_intent → only
        //     SET_FLOW_STATE, no RENDER_INTENT_SUMMARY (defensive; the
        //     IntentSummaryCard refuses to mount without a payload, see
        //     Slice 16 AC-8)
        const rawFlowState = data.state.flow_state;
        if (rawFlowState !== undefined) {
          if (isWhitelistedFlowState(rawFlowState)) {
            dispatch({ type: "SET_FLOW_STATE", flowState: rawFlowState });

            // AC-4: when resuming into ``summarizing`` AND the backend
            // surfaces a ``final_intent`` payload, rebuild the
            // ``IntentSummaryPayload`` and dispatch ``RENDER_INTENT_SUMMARY``.
            // Field mapping (architecture.md → ``IntentSummaryPayload``):
            //   final_intent.prompt        → prompt_preview
            //   data.state.intent_axes     → axes (1:1 dict copy)
            //   final_intent.settings_diff → settings_diff (optional)
            //   final_intent.model_id      → DROPPED (no model_id field
            //                                  on IntentSummaryPayload)
            if (rawFlowState === "summarizing") {
              const finalIntent = data.state.final_intent;
              const intentAxes = data.state.intent_axes ?? {};
              if (
                finalIntent
                && typeof finalIntent.prompt === "string"
                && finalIntent.prompt.length > 0
              ) {
                const payload: IntentSummaryPayload = {
                  axes: { ...intentAxes },
                  prompt_preview: finalIntent.prompt,
                };
                if (finalIntent.settings_diff) {
                  payload.settings_diff = finalIntent.settings_diff;
                }
                dispatch({ type: "RENDER_INTENT_SUMMARY", payload });
              } else {
                // AC-6: defensive fallback — flow_state is summarizing but
                // there is no payload to render. The card MUST NOT mount
                // (Slice 16 AC-8). Log so the inconsistency is visible.
                console.warn(
                  "[PromptAssistantContext] flow_state=summarizing but "
                  + "final_intent is missing/invalid; skipping "
                  + "RENDER_INTENT_SUMMARY",
                );
              }
            }
          } else {
            // AC-7: unknown flow_state value — drop + warn (analog to
            // Slice 15 AC-9). Reducer state ``flowState`` stays at its
            // pre-hydrate value (initial ``"idle"``).
            console.warn(
              `[PromptAssistantContext] Unknown flow_state value `
              + `${JSON.stringify(rawFlowState)} from session detail `
              + `response; ignoring`,
            );
          }
        }
      } catch {
        // AC-11: Show error toast and stay on session list
        dispatch({ type: "SET_LOADING_SESSION", isLoading: false });
        toast.error("Session konnte nicht geladen werden");
      }
    },
    [dispatch]
  );

  /**
   * Apply the current draftPrompt to the workspace.
   * AC-1: Maps canvas fields to workspace fields.
   * AC-3: Shows sonner toast with undo action.
   * AC-4: Snapshots previous workspace values for undo.
   */
  const applyToWorkspace = useCallback(() => {
    if (!state.draftPrompt) return;

    // AC-4: Snapshot current workspace values before applying
    undoSnapshotRef.current = {
      promptMotiv: variationData?.promptMotiv ?? "",
    };

    // AC-1: Map draftPrompt.prompt to workspace promptMotiv, preserving modelId and modelParams
    setVariation({
      promptMotiv: state.draftPrompt.prompt,
      modelId: variationData?.modelId ?? "",
      modelParams: variationData?.modelParams ?? {},
    });

    dispatch({ type: "SET_IS_APPLIED", isApplied: true });

    // AC-3: Show sonner toast with undo action
    const snapshot = undoSnapshotRef.current;
    toast("Prompt uebernommen.", {
      duration: 5000,
      action: {
        label: "Rueckgaengig",
        onClick: () => {
          if (snapshot) {
            setVariation({
              promptMotiv: snapshot.promptMotiv,
              modelId: variationData?.modelId ?? "",
              modelParams: variationData?.modelParams ?? {},
            });
            dispatch({ type: "SET_IS_APPLIED", isApplied: false });
          }
        },
      },
    });
  }, [state.draftPrompt, variationData, setVariation, dispatch]);

  /**
   * Undo the last apply, restoring previous workspace values.
   * AC-4: Restores snapshot values.
   */
  const undoApply = useCallback(() => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) return;

    setVariation({
      promptMotiv: snapshot.promptMotiv,
      modelId: variationData?.modelId ?? "",
      modelParams: variationData?.modelParams ?? {},
    });

    dispatch({ type: "SET_IS_APPLIED", isApplied: false });
    undoSnapshotRef.current = null;
  }, [variationData, setVariation, dispatch]);

  // Auto-apply: when draftVersion increments (from SET_DRAFT_PROMPT or REFINE_DRAFT),
  // automatically apply the draft to the workspace. draftVersion=0 on init and
  // is NOT incremented by LOAD_SESSION, so session restore won't trigger auto-apply.
  const draftVersionRef = useRef(0);
  useEffect(() => {
    if (state.draftVersion > 0 && state.draftVersion !== draftVersionRef.current) {
      draftVersionRef.current = state.draftVersion;
      applyToWorkspace();
    }
  }, [state.draftVersion, applyToWorkspace]);

  // Slice 24 AC-6: Auto-apply for ``pendingModelParamsPatch``. Mirrors the
  // ``draftVersion`` trigger pattern — fires only when the version counter
  // advances, never on initial mount (initial value === null) and never on
  // LOAD_SESSION (LOAD_SESSION does not touch this field). Only the
  // ``modelParams`` slot is replaced; ``promptMotiv`` / ``promptStyle`` /
  // ``negativePrompt`` come straight from the current ``variationData`` so
  // the assistant never accidentally clears the user's prompt (slice-
  // boundary discipline; see ``assistant-context-apply.test.tsx`` AC-2).
  // ``modelId`` is preserved verbatim — there is intentionally no
  // ``set_model_id`` tool (architecture.md → Open Decisions).
  const pendingModelParamsVersionRef = useRef(0);
  useEffect(() => {
    const patch = state.pendingModelParamsPatch;
    if (patch && patch.version > 0 && patch.version !== pendingModelParamsVersionRef.current) {
      pendingModelParamsVersionRef.current = patch.version;
      setVariation({
        promptMotiv: variationData?.promptMotiv ?? "",
        modelId: variationData?.modelId ?? "",
        modelParams: patch.modelParams,
      });
    }
  }, [state.pendingModelParamsPatch, setVariation, variationData]);

  const value = useMemo<PromptAssistantContextValue>(
    () => ({
      sessionId: state.sessionId,
      messages: state.messages,
      isStreaming: state.isStreaming,
      draftPrompt: state.draftPrompt,
      selectedModel: state.selectedModel,
      activeView: state.activeView,
      isLoadingSession: state.isLoadingSession,
      isApplied: state.isApplied,
      noContextBannerDismissed: state.noContextBannerDismissed,
      pendingSlotRolePatch: state.pendingSlotRolePatch,
      pendingSlotStrengthPatch: state.pendingSlotStrengthPatch,
      flowState: state.flowState,
      intentSummaryPayload: state.intentSummaryPayload,
      pasteConfirmPayload: state.pasteConfirmPayload,
      sendMessage,
      cancelStream,
      setSelectedModel,
      setActiveView,
      loadSession,
      applyToWorkspace,
      undoApply,
      dispatch,
      sessionIdRef,
      sendMessageRef,
      cancelStreamRef,
      imageModelIdRef,
      generationModeRef,
    }),
    [
      state,
      sendMessage,
      cancelStream,
      setSelectedModel,
      setActiveView,
      loadSession,
      applyToWorkspace,
      undoApply,
      dispatch,
    ]
  );

  return (
    <PromptAssistantContext.Provider value={value}>
      {children}
    </PromptAssistantContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helper: Workspace Fields for "Verbessere" Chip (AC-8, AC-9)
// ---------------------------------------------------------------------------

/**
 * Formats current workspace prompt fields as a context string to be prepended
 * to the "Verbessere meinen aktuellen Prompt" chip message.
 *
 * AC-8: When workspace fields have content, they are included as context.
 * AC-9: When all fields are empty, returns null (chip text sent as-is).
 */
export function getWorkspaceFieldsForChip(variationData: {
  promptMotiv?: string;
} | null): string | null {
  const motiv = variationData?.promptMotiv ?? "";

  // AC-9: Empty promptMotiv -> return null
  if (!motiv) {
    return null;
  }

  // AC-8: Format promptMotiv as context string
  return `[Aktueller Prompt: promptMotiv=${motiv}]`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePromptAssistant(): PromptAssistantContextValue {
  const context = useContext(PromptAssistantContext);
  if (!context) {
    throw new Error(
      "usePromptAssistant must be used within a PromptAssistantProvider"
    );
  }
  return context;
}
