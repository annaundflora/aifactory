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
  negative_prompt: string;
}

export interface ModelRecommendation {
  id: string;
  name: string;
  reason: string;
}

export interface ToolCallResult {
  tool: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface AssistantState {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  draftPrompt: DraftPrompt | null;
  recommendedModel: ModelRecommendation | null;
  selectedModel: string;
  toolCallResults: ToolCallResult[];
}

const initialState: AssistantState = {
  sessionId: null,
  messages: [],
  isStreaming: false,
  draftPrompt: null,
  recommendedModel: null,
  selectedModel: "anthropic/claude-sonnet-4.6",
  toolCallResults: [],
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
  | { type: "SET_RECOMMENDED_MODEL"; recommendedModel: ModelRecommendation }
  | { type: "ADD_TOOL_CALL_RESULT"; result: ToolCallResult }
  | { type: "SET_SELECTED_MODEL"; model: string }
  | { type: "RESET_SESSION" };

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
      return { ...state, messages: [...state.messages, action.message] };

    case "ADD_ASSISTANT_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };

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
      return { ...state, draftPrompt: action.draftPrompt };

    case "SET_RECOMMENDED_MODEL":
      return { ...state, recommendedModel: action.recommendedModel };

    case "ADD_TOOL_CALL_RESULT":
      return {
        ...state,
        toolCallResults: [...state.toolCallResults, action.result],
      };

    case "SET_SELECTED_MODEL":
      return { ...state, selectedModel: action.model };

    case "RESET_SESSION":
      return { ...initialState, selectedModel: state.selectedModel };

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
  recommendedModel: ModelRecommendation | null;
  selectedModel: string;
  sendMessage: (content: string, imageUrl?: string) => void;
  setSelectedModel: (model: string) => void;
  dispatch: Dispatch<AssistantAction>;
  /** Ref to the current session ID (for use by useAssistantRuntime) */
  sessionIdRef: MutableRefObject<string | null>;
  /** Ref for registering the sendMessage implementation from useAssistantRuntime */
  sendMessageRef: MutableRefObject<
    ((content: string, imageUrl?: string) => void) | null
  >;
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
// Provider
// ---------------------------------------------------------------------------

export function PromptAssistantProvider({
  children,
}: PromptAssistantProviderProps) {
  const [state, dispatch] = useReducer(assistantReducer, initialState);

  // Refs that bridge the context and the runtime hook
  const sessionIdRef = useRef<string | null>(null);
  const sendMessageRef = useRef<
    ((content: string, imageUrl?: string) => void) | null
  >(null);

  // Keep sessionIdRef in sync with reducer state
  sessionIdRef.current = state.sessionId;

  const sendMessage = useCallback(
    (content: string, imageUrl?: string) => {
      if (sendMessageRef.current) {
        sendMessageRef.current(content, imageUrl);
      } else {
        console.warn(
          "[PromptAssistantContext] sendMessage called but no runtime registered."
        );
      }
    },
    [] // sendMessageRef is stable (ref), no need as dependency
  );

  const setSelectedModel = useCallback(
    (model: string) => {
      dispatch({ type: "SET_SELECTED_MODEL", model });
    },
    [dispatch]
  );

  const value = useMemo<PromptAssistantContextValue>(
    () => ({
      sessionId: state.sessionId,
      messages: state.messages,
      isStreaming: state.isStreaming,
      draftPrompt: state.draftPrompt,
      recommendedModel: state.recommendedModel,
      selectedModel: state.selectedModel,
      sendMessage,
      setSelectedModel,
      dispatch,
      sessionIdRef,
      sendMessageRef,
    }),
    [state, sendMessage, setSelectedModel, dispatch]
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
