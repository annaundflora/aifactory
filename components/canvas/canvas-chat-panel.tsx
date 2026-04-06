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
import { ModelSlots } from "@/components/ui/model-slots";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import { ChatThread } from "@/components/assistant/chat-thread";
import { ChatInput } from "@/components/assistant/chat-input";
import { ModelSelector, DEFAULT_MODEL_SLUG } from "@/components/assistant/model-selector";
import { type Generation, type ModelSlot, type Model } from "@/lib/db/queries";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import { type ChatMessage } from "@/lib/types/chat-message";
import {
  createSession,
  sendMessage as sendCanvasMessage,
  type CanvasImageContext,
  type CanvasSSEEvent,
  type SSECanvasGenerateEvent,
} from "@/lib/canvas-chat-service";
import { generateImages } from "@/app/actions/generations";
import { uploadMask } from "@/app/actions/upload";
import {
  validateMinSize,
  applyFeathering,
  scaleToOriginal,
  toGrayscalePng,
} from "@/lib/services/mask-service";

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
  /** Model slots for slot-based model resolution. */
  modelSlots: ModelSlot[];
  /** Available models for the ModelSlots dropdown. */
  models: Model[];
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

/** Extended image context that includes active model IDs from slots. */
type SlotImageContext = CanvasImageContext & {
  active_model_ids?: string[];
};

function buildImageContext(generation: Generation, modelSlots: ModelSlot[]): SlotImageContext {
  // Build active_model_ids from img2img model slots with an assigned model
  const activeModelIds = modelSlots
    .filter((s) => s.mode === "img2img" && s.modelId != null)
    .map((s) => s.modelId as string);

  return {
    image_url: generation.imageUrl ?? "",
    prompt: generation.prompt ?? "",
    model_id: generation.modelId ?? "",
    model_params: (generation.modelParams as Record<string, unknown>) ?? {},
    generation_id: generation.id,
    ...(activeModelIds.length > 0 ? { active_model_ids: activeModelIds } : {}),
  };
}

// ---------------------------------------------------------------------------
// CanvasChatPanel
// ---------------------------------------------------------------------------

export function CanvasChatPanel({ generation, projectId, onPendingGenerations, onGenerationsCreated, modelSlots, models }: CanvasChatPanelProps) {
  const { state, dispatch } = useCanvasDetail();

  // Local UI state
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [chatModelSlug, setChatModelSlug] = useState(DEFAULT_MODEL_SLUG);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    buildInitMessage(generation),
  ]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Session state — local to the chat panel (not in Context per spec constraint)
  const sessionIdRef = useRef<string | null>(null);

  // Track the last generation id for context separator
  const lastGenerationIdRef = useRef(state.currentGenerationId);

  // Keep image context in a ref — updated on generation change
  const imageContextRef = useRef<SlotImageContext>(buildImageContext(generation, modelSlots));

  // Width before collapse for restoring
  const preCollapseWidthRef = useRef(DEFAULT_WIDTH);

  // Abort controller for ongoing SSE streams
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mask URL uploaded in sendMessageToBackend, consumed by handleCanvasGenerate
  // to avoid double-uploading the same mask
  const pendingMaskUrlRef = useRef<string | null>(null);

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
  // HIGH-2: Keep imageContextRef fresh whenever generation or modelSlots change
  // (e.g. Prev/Next navigation or async slots load)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    imageContextRef.current = buildImageContext(generation, modelSlots);
  }, [generation.id, modelSlots]);

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
      imageContextRef.current = buildImageContext(generation, modelSlots);

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
  // Mask export pipeline: validate -> feather -> scale -> grayscale -> upload
  // Used by inpaint and erase action branches.
  // Returns the R2 mask URL, or null if validation fails.
  // ---------------------------------------------------------------------------
  const exportMaskToR2 = useCallback(
    async (maskData: ImageData): Promise<string | null> => {
      // 1. Validate minimum size (10px bounding box)
      const validation = validateMinSize(maskData, 10);
      if (!validation.valid) {
        toast.error("Markiere einen groesseren Bereich");
        return null;
      }

      // 2. Apply feathering (10px Gaussian blur)
      const feathered = applyFeathering(maskData, 10);

      // 3. Scale to original image dimensions
      const originalWidth = generation.width ?? maskData.width;
      const originalHeight = generation.height ?? maskData.height;
      const scaled = scaleToOriginal(feathered, originalWidth, originalHeight);

      // 4. Convert to grayscale PNG
      const pngBlob = await toGrayscalePng(scaled);

      // 5. Upload to R2 via FormData (server action serialization)
      const formData = new FormData();
      formData.append("mask", new File([pngBlob], "mask.png", { type: "image/png" }));
      const uploadResult = await uploadMask(formData);
      if ("error" in uploadResult) {
        toast.error("Mask-Upload fehlgeschlagen");
        return null;
      }

      return uploadResult.url;
    },
    [generation.width, generation.height]
  );

  // ---------------------------------------------------------------------------
  // AC-6: Handle canvas-generate event -> call generateImages()
  // Model resolution: resolve from active mode-specific slots.
  // Fallback: generation.modelId if no active slots (AC-10).
  // Action mapping: inpaint/erase/instruction/outpaint -> same generationMode.
  // ---------------------------------------------------------------------------
  const handleCanvasGenerate = useCallback(
    async (event: SSECanvasGenerateEvent) => {
      dispatch({ type: "SET_GENERATING", isGenerating: true });

      // Map SSE action to generationMode (1:1 mapping per spec)
      const ACTION_MODE_MAP: Record<string, string> = {
        variation: "txt2img",
        img2img: "img2img",
        inpaint: "inpaint",
        erase: "erase",
        instruction: "instruction",
        outpaint: "outpaint",
      };

      // --- Safety net: override agent routing when user has mask in edit mode ---
      // The LLM agent may return ANY action even when mask_url was sent.
      // Trust the user's UI state (edit mode + painted mask) over the LLM decision.
      let resolvedAction = event.action;
      if (
        state.maskData &&
        (state.editMode === "inpaint" || state.editMode === "erase") &&
        event.action !== "inpaint" &&
        event.action !== "erase"
      ) {
        resolvedAction = state.editMode;
      }

      // --- Instruction branch: text instruction editing (no mask) ---
      // Fallback to flux-kontext-pro — NOT the original generation model,
      // which likely doesn't support text instruction editing.
      const INSTRUCTION_FALLBACK_MODEL = "black-forest-labs/flux-kontext-pro";
      if (resolvedAction === "instruction") {
        const activeSlots = resolveActiveSlots(modelSlots, "instruction");
        const modelIds = activeSlots.length > 0
          ? activeSlots.map((s) => s.modelId)
          : [INSTRUCTION_FALLBACK_MODEL];
        const baseParams = activeSlots.length > 0
          ? { ...activeSlots[0].modelParams, ...(event.params ?? {}) }
          : (event.params ?? {});

        try {
          const result = await generateImages({
            projectId,
            promptMotiv: event.prompt,
            modelIds,
            params: baseParams,
            count: 1,
            generationMode: "instruction",
            sourceImageUrl: imageContextRef.current.image_url,
          });

          if (result && "error" in result) {
            console.error("[CanvasChatPanel] generateImages returned error:", result.error);
            toast.error(result.error);
            dispatch({ type: "SET_GENERATING", isGenerating: false });
            return;
          }

          onGenerationsCreated?.(result as Generation[]);
          const pendingIds = (result as Generation[])
            .filter((g) => g.status === "pending")
            .map((g) => g.id);

          if (pendingIds.length > 0 && onPendingGenerations) {
            onPendingGenerations(pendingIds);
          } else {
            dispatch({ type: "SET_GENERATING", isGenerating: false });
          }
        } catch (error) {
          console.error("[CanvasChatPanel] generateImages failed:", error);
          toast.error("Generierung fehlgeschlagen.");
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
        return;
      }

      // --- Outpaint branch: canvas extension via sharp (Slice 13 AC-4, AC-8) ---
      if (resolvedAction === "outpaint") {
        // Use directions/size from context state (primary) or SSE event (fallback)
        const directions = state.outpaintDirections.length > 0
          ? state.outpaintDirections
          : (event.outpaint_directions ?? []);
        const size = state.outpaintSize ?? event.outpaint_size ?? 50;

        // Pre-validate: no directions selected
        if (directions.length === 0) {
          toast.error("Waehle mindestens eine Richtung zum Erweitern");
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          return;
        }

        // Pre-validate: resulting dimensions must not exceed 2048px (AC-8)
        const imgWidth = generation.width ?? 1024;
        const imgHeight = generation.height ?? 1024;
        let extWidth = imgWidth;
        let extHeight = imgHeight;

        if (directions.includes("left")) {
          extWidth += Math.round(imgWidth * (size / 100));
        }
        if (directions.includes("right")) {
          extWidth += Math.round(imgWidth * (size / 100));
        }
        if (directions.includes("top")) {
          extHeight += Math.round(imgHeight * (size / 100));
        }
        if (directions.includes("bottom")) {
          extHeight += Math.round(imgHeight * (size / 100));
        }

        if (extWidth > 2048 || extHeight > 2048) {
          toast.error("Bild wuerde API-Limit ueberschreiten");
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          return;
        }

        // Resolve outpaint model slots (same as inpaint: FLUX Fill Pro)
        const activeSlots = resolveActiveSlots(modelSlots, "outpaint");
        const modelIds = activeSlots.length > 0
          ? activeSlots.map((s) => s.modelId)
          : [generation.modelId];
        const baseParams = activeSlots.length > 0
          ? { ...activeSlots[0].modelParams, ...(event.params ?? {}) }
          : (event.params ?? {});

        try {
          const result = await generateImages({
            projectId,
            promptMotiv: event.prompt,
            modelIds,
            params: baseParams,
            count: 1,
            generationMode: "outpaint",
            sourceImageUrl: imageContextRef.current.image_url,
            outpaintDirections: directions as string[],
            outpaintSize: size,
          });

          if (result && "error" in result) {
            console.error("[CanvasChatPanel] generateImages returned error:", result.error);
            toast.error(result.error);
            dispatch({ type: "SET_GENERATING", isGenerating: false });
            return;
          }

          onGenerationsCreated?.(result as Generation[]);
          const pendingIds = (result as Generation[])
            .filter((g) => g.status === "pending")
            .map((g) => g.id);

          if (pendingIds.length > 0 && onPendingGenerations) {
            onPendingGenerations(pendingIds);
          } else {
            dispatch({ type: "SET_GENERATING", isGenerating: false });
          }
        } catch (error) {
          console.error("[CanvasChatPanel] generateImages failed:", error);
          toast.error("Generierung fehlgeschlagen.");
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
        return;
      }

      const isEditAction = resolvedAction === "inpaint" || resolvedAction === "erase";

      // --- AC-5 (Slice 09): Erase-to-Inpaint upgrade ---
      // When the user is in erase mode with a mask and sends a chat prompt,
      // upgrade from erase to inpaint so the prompt is used for generation.
      let effectiveAction = resolvedAction;
      if (state.editMode === "erase" && state.maskData && event.prompt) {
        effectiveAction = "inpaint";
      }

      // --- Inpaint/Erase branch: mask processing pipeline ---
      if (isEditAction) {
        // Fallback: no mask -> instruction mode
        if (!state.maskData) {
          const activeSlots = resolveActiveSlots(modelSlots, "instruction");
          const modelIds = activeSlots.length > 0
            ? activeSlots.map((s) => s.modelId)
            : [INSTRUCTION_FALLBACK_MODEL];
          const baseParams = activeSlots.length > 0
            ? { ...activeSlots[0].modelParams, ...(event.params ?? {}) }
            : (event.params ?? {});

          try {
            const result = await generateImages({
              projectId,
              promptMotiv: event.prompt,
              modelIds,
              params: baseParams,
              count: 1,
              generationMode: "instruction",
              sourceImageUrl: imageContextRef.current.image_url,
            });

            if (result && "error" in result) {
              console.error("[CanvasChatPanel] generateImages returned error:", result.error);
              toast.error(result.error);
              dispatch({ type: "SET_GENERATING", isGenerating: false });
              return;
            }

            onGenerationsCreated?.(result as Generation[]);
            const pendingIds = (result as Generation[])
              .filter((g) => g.status === "pending")
              .map((g) => g.id);

            if (pendingIds.length > 0 && onPendingGenerations) {
              onPendingGenerations(pendingIds);
            } else {
              dispatch({ type: "SET_GENERATING", isGenerating: false });
            }
          } catch (error) {
            console.error("[CanvasChatPanel] generateImages failed:", error);
            toast.error("Generierung fehlgeschlagen.");
            dispatch({ type: "SET_GENERATING", isGenerating: false });
          }
          return;
        }

        // Use mask_url already uploaded in sendMessageToBackend (via ref),
        // or from backend event, with fallback to full export pipeline
        const maskUrl = pendingMaskUrlRef.current ?? event.mask_url ?? await exportMaskToR2(state.maskData);
        pendingMaskUrlRef.current = null;

        // Validation failure (mask too small or upload failed) -> abort
        if (!maskUrl) {
          dispatch({ type: "SET_GENERATING", isGenerating: false });
          return;
        }

        // Use effectiveAction for mode resolution (supports erase-to-inpaint upgrade)
        const generationMode = ACTION_MODE_MAP[effectiveAction] ?? effectiveAction;
        const resolvedMode = generationMode as import("@/lib/types").GenerationMode;
        const activeSlots = resolveActiveSlots(modelSlots, resolvedMode);
        // Inpaint/erase require a model that supports image+mask input (e.g. FLUX Fill Pro).
        // If no slot is configured for this mode, fall back to flux-fill-pro — NOT the
        // original generation model, which likely doesn't support mask-based editing.
        const INPAINT_FALLBACK_MODEL = "black-forest-labs/flux-fill-pro";
        const modelIds = activeSlots.length > 0
          ? activeSlots.map((s) => s.modelId)
          : [INPAINT_FALLBACK_MODEL];
        const baseParams = activeSlots.length > 0
          ? { ...activeSlots[0].modelParams, ...(event.params ?? {}) }
          : (event.params ?? {});

        try {
          const result = await generateImages({
            projectId,
            promptMotiv: event.prompt,
            modelIds,
            params: baseParams,
            count: 1,
            generationMode,
            sourceImageUrl: imageContextRef.current.image_url,
            maskUrl,
          });

          if (result && "error" in result) {
            console.error("[CanvasChatPanel] generateImages returned error:", result.error);
            toast.error(result.error);
            dispatch({ type: "SET_GENERATING", isGenerating: false });
            return;
          }

          onGenerationsCreated?.(result as Generation[]);
          const pendingIds = (result as Generation[])
            .filter((g) => g.status === "pending")
            .map((g) => g.id);

          if (pendingIds.length > 0 && onPendingGenerations) {
            onPendingGenerations(pendingIds);
          } else {
            dispatch({ type: "SET_GENERATING", isGenerating: false });
          }
        } catch (error) {
          console.error("[CanvasChatPanel] generateImages failed:", error);
          toast.error("Generierung fehlgeschlagen.");
          dispatch({ type: "SET_GENERATING", isGenerating: false });
        }
        return;
      }

      // --- Default branch: variation / img2img / other actions ---
      const generationMode = ACTION_MODE_MAP[event.action] ?? "txt2img";

      // Resolve models from active mode-specific slots
      const resolvedMode = generationMode as import("@/lib/types").GenerationMode;
      const activeSlots = resolveActiveSlots(modelSlots, resolvedMode);

      // Use active slot modelIds, or fall back to generation.modelId (AC-10)
      const modelIds = activeSlots.length > 0
        ? activeSlots.map((s) => s.modelId)
        : [generation.modelId];

      // Use the first active slot's modelParams as base params, merged with event params
      const baseParams = activeSlots.length > 0
        ? { ...activeSlots[0].modelParams, ...(event.params ?? {}) }
        : (event.params ?? {});

      try {
        const result = await generateImages({
          projectId,
          promptMotiv: event.prompt,
          modelIds,
          params: baseParams,
          count: 1,
          generationMode,
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
    [dispatch, projectId, onPendingGenerations, onGenerationsCreated, modelSlots, generation.modelId, generation.width, generation.height, state.maskData, state.editMode, state.outpaintDirections, state.outpaintSize, exportMaskToR2]
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
        // Inject active model IDs so the backend knows which models are selected
        const activeModelIds = resolveActiveSlots(modelSlots, "img2img").map((s) => s.modelId);
        const contextWithModels = {
          ...imageContextRef.current,
          ...(activeModelIds.length > 0 ? { active_model_ids: activeModelIds } : {}),
        };

        // Export mask to R2 before sending so the agent can detect
        // inpaint/erase intent and route correctly (BUG-2 fix)
        pendingMaskUrlRef.current = null;
        if (state.maskData) {
          const maskUrl = await exportMaskToR2(state.maskData);
          if (maskUrl) {
            contextWithModels.mask_url = maskUrl;
            pendingMaskUrlRef.current = maskUrl;
          }
        }

        await sendCanvasMessage(
          sessionIdRef.current,
          text,
          contextWithModels,
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
    [projectId, dispatch, handleCanvasGenerate, chatModelSlug, modelSlots, state.maskData, exportMaskToR2]
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
  // Slice 13 AC-3: Disable send when in outpaint mode with no directions selected
  const isOutpaintNoDirections = state.editMode === "outpaint" && state.outpaintDirections.length === 0;
  const inputDisabled = state.isGenerating || isStreaming || isOutpaintNoDirections;

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

      {/* Model slots bar between ChatThread and ChatInput */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-1.5"
        data-testid="chat-model-slots-bar"
      >
        <ModelSlots
          variant="compact"
          mode="img2img"
          slots={modelSlots}
          models={models}
          disabled={state.isGenerating}
        />
      </div>

      {/* Slice 13 AC-3: Inline hint when outpaint mode but no directions selected */}
      {isOutpaintNoDirections && (
        <div
          className="px-3 py-1 text-xs text-muted-foreground"
          data-testid="outpaint-no-directions-hint"
        >
          Waehle mindestens eine Richtung zum Erweitern
        </div>
      )}

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
