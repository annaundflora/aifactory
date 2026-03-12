"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
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

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  /** Whether the assistant message is still streaming */
  isStreaming?: boolean;
  imageUrl?: string;
}

export interface DraftPrompt {
  motiv: string;
  style: string;
  negativePrompt: string;
}

/** Field names for the DraftPrompt type */
export type DraftPromptField = keyof DraftPrompt;

export interface ModelRecommendation {
  id: string;
  name: string;
  reason: string;
}

export interface ToolCallResult {
  tool: string;
  data: Record<string, unknown>;
}

/** Possible views within the assistant sheet */
export type ActiveView = "chat" | "session-list" | "startscreen";

// ---------------------------------------------------------------------------
// Session Detail Response (from backend GET /api/assistant/sessions/{id})
// ---------------------------------------------------------------------------

interface SessionDetailState {
  messages: Array<{ role: string; content: string }>;
  draft_prompt: {
    motiv: string;
    style: string;
    negative_prompt: string;
  } | null;
  recommended_model: { id: string; name: string; reason: string } | null;
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
  /** Whether the canvas panel should be visible (true once a draft_prompt has been received) */
  hasCanvas: boolean;
  /** Transient flag to trigger a visual highlight on canvas fields after a refine_prompt event */
  canvasHighlight: boolean;
  recommendedModel: ModelRecommendation | null;
  selectedModel: string;
  toolCallResults: ToolCallResult[];
  /** Current view within the assistant sheet */
  activeView: ActiveView;
  /** Whether a session is currently being loaded */
  isLoadingSession: boolean;
  /** Whether the current draft has been applied to the workspace */
  isApplied: boolean;
}

const initialState: AssistantState = {
  sessionId: null,
  messages: [],
  isStreaming: false,
  draftPrompt: null,
  hasCanvas: false,
  canvasHighlight: false,
  recommendedModel: null,
  selectedModel: "anthropic/claude-sonnet-4.6",
  toolCallResults: [],
  activeView: "startscreen",
  isLoadingSession: false,
  isApplied: false,
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
  | { type: "UPDATE_DRAFT_FIELD"; field: DraftPromptField; value: string }
  | { type: "REFINE_DRAFT"; draftPrompt: DraftPrompt }
  | { type: "CLEAR_CANVAS_HIGHLIGHT" }
  | { type: "SET_RECOMMENDED_MODEL"; recommendedModel: ModelRecommendation }
  | { type: "ADD_TOOL_CALL_RESULT"; result: ToolCallResult }
  | { type: "SET_SELECTED_MODEL"; model: string }
  | { type: "SET_ACTIVE_VIEW"; view: ActiveView }
  | { type: "SET_LOADING_SESSION"; isLoading: boolean }
  | {
      type: "LOAD_SESSION";
      sessionId: string;
      messages: Message[];
      draftPrompt: DraftPrompt | null;
      recommendedModel: ModelRecommendation | null;
    }
  | { type: "RESET_SESSION" }
  | { type: "SET_IS_APPLIED"; isApplied: boolean };

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
            role: "error",
            content: action.content,
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
        hasCanvas: true,
        isApplied: false,
      };

    case "UPDATE_DRAFT_FIELD": {
      if (!state.draftPrompt) return state;
      return {
        ...state,
        draftPrompt: {
          ...state.draftPrompt,
          [action.field]: action.value,
        },
      };
    }

    case "REFINE_DRAFT":
      return {
        ...state,
        draftPrompt: action.draftPrompt,
        hasCanvas: true,
        canvasHighlight: true,
        isApplied: false,
      };

    case "CLEAR_CANVAS_HIGHLIGHT":
      return { ...state, canvasHighlight: false };

    case "SET_RECOMMENDED_MODEL":
      return { ...state, recommendedModel: action.recommendedModel };

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
        hasCanvas: action.draftPrompt !== null,
        canvasHighlight: false,
        recommendedModel: action.recommendedModel,
        toolCallResults: [],
        isStreaming: false,
        isLoadingSession: false,
        activeView: "chat",
      };

    case "RESET_SESSION":
      return {
        ...initialState,
        selectedModel: state.selectedModel,
      };

    case "SET_IS_APPLIED":
      return { ...state, isApplied: action.isApplied };

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
  /** Whether the canvas panel should be visible */
  hasCanvas: boolean;
  /** Transient flag for highlighting canvas fields after a refine_prompt event */
  canvasHighlight: boolean;
  recommendedModel: ModelRecommendation | null;
  selectedModel: string;
  /** Current view within the assistant sheet */
  activeView: ActiveView;
  /** Whether a session is currently being loaded */
  isLoadingSession: boolean;
  /** Whether the current draft has been applied to the workspace */
  isApplied: boolean;
  sendMessage: (content: string, imageUrl?: string) => void;
  cancelStream: () => void;
  setSelectedModel: (model: string) => void;
  /** Update a single field in the draft prompt (local edit, no API call) */
  updateDraftField: (field: DraftPromptField, value: string) => void;
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
    ((content: string, imageUrl?: string) => void) | null
  >;
  /** Ref for registering the cancelStream implementation from useAssistantRuntime */
  cancelStreamRef: MutableRefObject<(() => void) | null>;
}

const PromptAssistantContext =
  createContext<PromptAssistantContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider Props
// ---------------------------------------------------------------------------

export interface PromptAssistantProviderProps {
  children: ReactNode;
  projectId: string;
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
    promptStyle: string;
    negativePrompt: string;
  } | null>(null);
  const sendMessageRef = useRef<
    ((content: string, imageUrl?: string) => void) | null
  >(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  // Track whether auto-title has already been triggered for this session
  const autoTitleSentRef = useRef<string | null>(null);

  // Keep sessionIdRef in sync with reducer state
  sessionIdRef.current = state.sessionId;

  const sendMessage = useCallback(
    (content: string, imageUrl?: string) => {
      if (sendMessageRef.current) {
        sendMessageRef.current(content, imageUrl);

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

  const updateDraftField = useCallback(
    (field: DraftPromptField, value: string) => {
      dispatch({ type: "UPDATE_DRAFT_FIELD", field, value });
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
   * AC-6: Sets recommendedModel from session state.
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

        // Convert backend draft_prompt (snake_case) to frontend DraftPrompt (camelCase)
        const draftPrompt: DraftPrompt | null = data.state.draft_prompt
          ? {
              motiv: data.state.draft_prompt.motiv,
              style: data.state.draft_prompt.style,
              negativePrompt: data.state.draft_prompt.negative_prompt,
            }
          : null;

        // Convert backend recommended_model to frontend ModelRecommendation
        const recommendedModel: ModelRecommendation | null =
          data.state.recommended_model
            ? {
                id: data.state.recommended_model.id,
                name: data.state.recommended_model.name,
                reason: data.state.recommended_model.reason,
              }
            : null;

        // AC-10: Replace current session state entirely
        dispatch({
          type: "LOAD_SESSION",
          sessionId,
          messages,
          draftPrompt,
          recommendedModel,
        });

        // Update the sessionIdRef for the runtime
        sessionIdRef.current = sessionId;
        // Reset auto-title tracking for this session (it already has a title)
        autoTitleSentRef.current = sessionId;
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
      promptStyle: variationData?.promptStyle ?? "",
      negativePrompt: variationData?.negativePrompt ?? "",
    };

    // AC-1: Map canvas fields to workspace fields, preserving modelId and modelParams
    setVariation({
      promptMotiv: state.draftPrompt.motiv,
      promptStyle: state.draftPrompt.style,
      negativePrompt: state.draftPrompt.negativePrompt,
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
              promptStyle: snapshot.promptStyle,
              negativePrompt: snapshot.negativePrompt,
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
      promptStyle: snapshot.promptStyle,
      negativePrompt: snapshot.negativePrompt,
      modelId: variationData?.modelId ?? "",
      modelParams: variationData?.modelParams ?? {},
    });

    dispatch({ type: "SET_IS_APPLIED", isApplied: false });
    undoSnapshotRef.current = null;
  }, [variationData, setVariation, dispatch]);

  const value = useMemo<PromptAssistantContextValue>(
    () => ({
      sessionId: state.sessionId,
      messages: state.messages,
      isStreaming: state.isStreaming,
      draftPrompt: state.draftPrompt,
      hasCanvas: state.hasCanvas,
      canvasHighlight: state.canvasHighlight,
      recommendedModel: state.recommendedModel,
      selectedModel: state.selectedModel,
      activeView: state.activeView,
      isLoadingSession: state.isLoadingSession,
      isApplied: state.isApplied,
      sendMessage,
      cancelStream,
      setSelectedModel,
      updateDraftField,
      setActiveView,
      loadSession,
      applyToWorkspace,
      undoApply,
      dispatch,
      sessionIdRef,
      sendMessageRef,
      cancelStreamRef,
    }),
    [
      state,
      sendMessage,
      cancelStream,
      setSelectedModel,
      updateDraftField,
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
