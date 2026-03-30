"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { PromptTabs, type PromptTab } from "@/components/workspace/prompt-tabs";
import { generateImages, upscaleImage } from "@/app/actions/generations";
import { getModelSlots } from "@/app/actions/model-slots";
import { getModels } from "@/app/actions/models";
import { useWorkspaceVariation } from "@/lib/workspace-state";
import { ModeSelector, type GenerationMode } from "@/components/workspace/mode-selector";
import { ImageDropzone } from "@/components/workspace/image-dropzone";
import { ReferenceBar, getLowestFreePosition } from "@/components/workspace/reference-bar";
import { uploadReferenceImage, deleteReferenceImage, addGalleryAsReference } from "@/app/actions/references";
import type { GalleryDragPayload } from "@/lib/constants/drag-types";
import type {
  ReferenceSlotData,
  ReferenceRole,
  ReferenceStrength,
} from "@/lib/types/reference";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ModelSlots } from "@/components/ui/model-slots";
import type { ModelSlot, Model } from "@/lib/db/queries";
import { Loader2, Sparkles, Minus, Plus, Eraser, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LLMComparison } from "@/components/prompt-improve/llm-comparison";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";
import { SectionLabel } from "@/components/shared/section-label";
import { modelIdToDisplayName } from "@/lib/utils/model-display-name";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import { usePromptAssistant } from "@/lib/assistant/assistant-context";
import { toast } from "sonner";

// Re-export Generation type for callback
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptAreaProps {
  projectId: string;
  onGenerationsCreated?: (generations: Generation[]) => void;
  assistantOpen?: boolean;
  onAssistantToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Per-Mode State Types (State Persistence Matrix)
// ---------------------------------------------------------------------------

interface Txt2ImgState {
  promptMotiv: string;
  promptStyle: string;
  negativePrompt: string;
  variantCount: number;
}

interface Img2ImgState {
  promptMotiv: string;
  promptStyle: string;
  negativePrompt: string;
  variantCount: number;
  referenceSlots: ReferenceSlotData[];
}

interface UpscaleState {
  sourceImageUrl: string | null;
  scale: 2 | 4;
}

interface ModeStates {
  txt2img: Txt2ImgState;
  img2img: Img2ImgState;
  upscale: UpscaleState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SCALE: 2 | 4 = 2;

/** Auto-resize a textarea to fit its content. */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function createInitialModeStates(): ModeStates {
  return {
    txt2img: {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      variantCount: 1,
    },
    img2img: {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      variantCount: 1,
      referenceSlots: [],
    },
    upscale: {
      sourceImageUrl: null,
      scale: DEFAULT_SCALE,
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptArea({ projectId, onGenerationsCreated, assistantOpen: assistantOpenProp, onAssistantToggle }: PromptAreaProps) {
  // ----- Mode state -----
  const [currentMode, setCurrentMode] = useState<GenerationMode>("txt2img");

  // ----- Per-mode state (State Persistence Matrix) -----
  const [modeStates, setModeStates] = useState<ModeStates>(() =>
    createInitialModeStates()
  );

  // ----- Model slots (replaces tier + model settings) -----
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>([]);

  // ----- Models list for ModelSlots component -----
  const [models, setModels] = useState<Model[]>([]);

  // Fetch model slots on mount and when slots change
  const loadModelSlots = useCallback(() => {
    getModelSlots().then((result) => {
      if ("error" in result) return;
      setModelSlots(result);
    }).catch((err) => {
      console.error("Failed to load model slots:", err);
    });
  }, []);

  // Fetch models list on mount
  useEffect(() => {
    getModels({}).then((result) => {
      if ("error" in result) return;
      setModels(result);
    }).catch((err) => {
      console.error("Failed to load models:", err);
    });
  }, []);

  useEffect(() => {
    loadModelSlots();
    window.addEventListener("model-slots-changed", loadModelSlots);
    return () => {
      window.removeEventListener("model-slots-changed", loadModelSlots);
    };
  }, [loadModelSlots]);

  // ----- Structured prompt state -----
  const [promptMotiv, setPromptMotiv] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const motivRef = useRef<HTMLTextAreaElement>(null);
  const styleRef = useRef<HTMLTextAreaElement>(null);
  const negativeRef = useRef<HTMLTextAreaElement>(null);

  // ----- Variant count -----
  const [variantCount, setVariantCount] = useState(1);

  // ----- img2img-specific state: reference slots (replaces sourceImageUrl + strength) -----
  const [referenceSlots, setReferenceSlots] = useState<ReferenceSlotData[]>([]);

  // ----- upscale-specific state -----
  const [upscaleSourceImageUrl, setUpscaleSourceImageUrl] = useState<string | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(DEFAULT_SCALE);

  // ----- Sync current model + mode to Assistant context refs -----
  const { imageModelIdRef, generationModeRef } = usePromptAssistant();
  const firstActiveSlot = modelSlots.find(
    (s) => s.mode === currentMode && s.active && s.modelId != null,
  );
  imageModelIdRef.current = firstActiveSlot?.modelId ?? null;
  generationModeRef.current = currentMode;

  // ----- Generation state -----
  const [isGenerating, startGeneration] = useTransition();

  // ----- Tab state -----
  const [activeTab, setActiveTab] = useState<PromptTab>("prompt");

  // ----- LLM comparison -----
  const [showImprove, setShowImprove] = useState(false);

  // ----- Collapsible prompt fields -----
  const [styleOpen, setStyleOpen] = useState(false);
  const [negativeOpen, setNegativeOpen] = useState(false);

  // ----- Assistant Panel state (lifted to workspace-content) -----
  const assistantOpen = assistantOpenProp ?? false;

  const handleAssistantToggle = useCallback(() => {
    onAssistantToggle?.();
  }, [onAssistantToggle]);

  const handleClearAll = useCallback(() => {
    setPromptMotiv("");
    setPromptStyle("");
    setNegativePrompt("");
    setVariantCount(1);
    setReferenceSlots([]);
    setUpscaleSourceImageUrl(null);
    setUpscaleScale(DEFAULT_SCALE);
    setShowImprove(false);
  }, []);

  // Session history navigation is now handled inside AssistantSheetContent via context.setActiveView

  // ----- Variation state consumption -----
  const { variationData, clearVariation } = useWorkspaceVariation();

  // ---------------------------------------------------------------------------
  // Save current state into modeStates
  // ---------------------------------------------------------------------------

  const saveCurrentModeState = useCallback(() => {
    setModeStates((prev) => {
      const updated = { ...prev };
      if (currentMode === "txt2img") {
        updated.txt2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          variantCount,
        };
      } else if (currentMode === "img2img") {
        updated.img2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          variantCount,
          referenceSlots,
        };
      } else if (currentMode === "upscale") {
        updated.upscale = {
          sourceImageUrl: upscaleSourceImageUrl,
          scale: upscaleScale,
        };
      }
      return updated;
    });
  }, [
    currentMode,
    promptMotiv,
    promptStyle,
    negativePrompt,
    variantCount,
    referenceSlots,
    upscaleSourceImageUrl,
    upscaleScale,
  ]);

  // ---------------------------------------------------------------------------
  // Mode change handler
  // ---------------------------------------------------------------------------

  const handleModeChange = useCallback(
    (targetMode: GenerationMode) => {
      if (targetMode === currentMode) return;

      // 1. Compute a local snapshot of the saved state BEFORE calling setModeStates.
      const snapshot: ModeStates = { ...modeStates };
      if (currentMode === "txt2img") {
        snapshot.txt2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          variantCount,
        };
      } else if (currentMode === "img2img") {
        snapshot.img2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          variantCount,
          referenceSlots,
        };
      } else if (currentMode === "upscale") {
        snapshot.upscale = {
          sourceImageUrl: upscaleSourceImageUrl,
          scale: upscaleScale,
        };
      }

      // Persist the snapshot into React state
      setModeStates(snapshot);

      // 2. Determine which fields to restore vs carry over
      const fromHasPrompt = currentMode !== "upscale";

      if (targetMode === "upscale") {
        setUpscaleSourceImageUrl(snapshot.upscale.sourceImageUrl);
        setUpscaleScale(snapshot.upscale.scale);
      } else if (targetMode === "img2img") {
        if (fromHasPrompt) {
          setReferenceSlots(snapshot.img2img.referenceSlots);
        } else {
          const s = snapshot.img2img;
          setPromptMotiv(s.promptMotiv);
          setPromptStyle(s.promptStyle);
          setNegativePrompt(s.negativePrompt);
          setVariantCount(s.variantCount);
          setReferenceSlots(s.referenceSlots);
        }
      } else if (targetMode === "txt2img") {
        if (!fromHasPrompt) {
          const s = snapshot.txt2img;
          setPromptMotiv(s.promptMotiv);
          setPromptStyle(s.promptStyle);
          setNegativePrompt(s.negativePrompt);
          setVariantCount(s.variantCount);
        }
      }

      // 3. Transfer source image if moving between img2img and upscale
      if (currentMode === "img2img" && targetMode === "upscale") {
        if (!snapshot.upscale.sourceImageUrl && referenceSlots.length > 0) {
          setUpscaleSourceImageUrl(referenceSlots[0].imageUrl);
        }
      }

      // 4. Set the mode
      setCurrentMode(targetMode);
    },
    [
      currentMode,
      promptMotiv,
      promptStyle,
      negativePrompt,
      variantCount,
      referenceSlots,
      upscaleSourceImageUrl,
      upscaleScale,
      modeStates,
    ]
  );

  // ---------------------------------------------------------------------------
  // Variation state consumption (Cross-Mode from Lightbox) — AC-7
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!variationData) return;

    // Skip addReference-only payloads — they are handled by the dedicated
    // addReference useEffect below.
    if (variationData.addReference && !variationData.targetMode && !variationData.promptMotiv) return;

    // If variationData has a targetMode, switch to it
    if (variationData.targetMode) {
      const targetMode = variationData.targetMode as GenerationMode;

      // Save current state first
      saveCurrentModeState();

      // Override target mode state with incoming data
      if (targetMode === "img2img") {
        setPromptMotiv(variationData.promptMotiv);
        setPromptStyle(variationData.promptStyle ?? "");
        setNegativePrompt(variationData.negativePrompt ?? "");
        // If variation provides a sourceImageUrl, add it as a reference slot
        if (variationData.sourceImageUrl) {
          const occupiedPositions = referenceSlots.map((s) => s.slotPosition);
          const pos = getLowestFreePosition(occupiedPositions);
          if (pos !== -1) {
            setReferenceSlots((prev) => [
              ...prev,
              {
                id: `var-${Date.now()}`,
                imageUrl: variationData.sourceImageUrl!,
                slotPosition: pos,
                role: "general" as ReferenceRole,
                strength: "moderate" as ReferenceStrength,
              },
            ]);
          }
        }
      } else if (targetMode === "upscale") {
        setUpscaleSourceImageUrl(variationData.sourceImageUrl ?? null);
      }

      setCurrentMode(targetMode);
    } else {
      // Standard variation (no mode change) — set prompt fields
      setPromptMotiv(variationData.promptMotiv);
      setPromptStyle(variationData.promptStyle ?? "");
      setNegativePrompt(variationData.negativePrompt ?? "");
    }

    clearVariation();
  }, [variationData, clearVariation, saveCurrentModeState, referenceSlots]);

  // ---------------------------------------------------------------------------
  // addReference consumption (AC-7, AC-8): auto-switch to img2img, add ref, clear
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!variationData?.addReference) return;

    const { imageUrl, generationId } = variationData.addReference;

    // Auto-switch to img2img mode
    if (currentMode !== "img2img") {
      saveCurrentModeState();
      setCurrentMode("img2img");
    }

    // Add image as new reference to next free slot
    setReferenceSlots((prev) => {
      const occupiedPositions = prev.map((s) => s.slotPosition);
      const pos = getLowestFreePosition(occupiedPositions);
      if (pos === -1) return prev; // All 5 slots full
      return [
        ...prev,
        {
          id: generationId ?? `ref-${Date.now()}`,
          imageUrl,
          slotPosition: pos,
          role: "general" as ReferenceRole,
          strength: "moderate" as ReferenceStrength,
        },
      ];
    });

    clearVariation();
  }, [variationData?.addReference, clearVariation, currentMode, saveCurrentModeState]);

  // ----- Auto-resize handlers -----
  const handleMotivChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setPromptMotiv(e.target.value);
      autoResize(e.target);
    },
    []
  );

  const handleStyleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setPromptStyle(e.target.value);
      autoResize(e.target);
    },
    []
  );

  const handleNegativePromptChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setNegativePrompt(e.target.value);
      autoResize(e.target);
    },
    []
  );

  // ----- Auto-resize on programmatic value changes -----
  useEffect(() => {
    if (motivRef.current) autoResize(motivRef.current);
  }, [promptMotiv]);

  useEffect(() => {
    if (styleRef.current) autoResize(styleRef.current);
  }, [promptStyle]);

  useEffect(() => {
    if (negativeRef.current) autoResize(negativeRef.current);
  }, [negativePrompt]);

  // ---------------------------------------------------------------------------
  // Image upload handlers
  // ---------------------------------------------------------------------------

  const handleUpscaleUpload = useCallback((url: string | null) => {
    setUpscaleSourceImageUrl(url);
  }, []);

  // ---------------------------------------------------------------------------
  // ReferenceBar handlers
  // ---------------------------------------------------------------------------

  const handleReferenceAdd = useCallback(
    (file: File, position: number) => {
      // Upload file via server action, then add to slots
      (async () => {
        const result = await uploadReferenceImage({ projectId, file });
        if ("error" in result) {
          toast(result.error);
          return;
        }
        setReferenceSlots((prev) => [
          ...prev,
          {
            id: result.id,
            imageUrl: result.imageUrl,
            slotPosition: position,
            role: "general" as ReferenceRole,
            strength: "moderate" as ReferenceStrength,
            width: result.width,
            height: result.height,
          },
        ]);
      })();
    },
    [projectId]
  );

  const handleReferenceRemove = useCallback((slotPosition: number) => {
    setReferenceSlots((prev) => {
      const slot = prev.find((s) => s.slotPosition === slotPosition);
      if (slot) {
        // Fire-and-forget delete from server
        deleteReferenceImage({ id: slot.id }).catch(() => {});
      }
      return prev.filter((s) => s.slotPosition !== slotPosition);
    });
  }, []);

  const handleReferenceRoleChange = useCallback(
    (slotPosition: number, role: ReferenceRole) => {
      setReferenceSlots((prev) =>
        prev.map((s) =>
          s.slotPosition === slotPosition ? { ...s, role } : s
        )
      );
    },
    []
  );

  const handleReferenceStrengthChange = useCallback(
    (slotPosition: number, strength: ReferenceStrength) => {
      setReferenceSlots((prev) =>
        prev.map((s) =>
          s.slotPosition === slotPosition ? { ...s, strength } : s
        )
      );
    },
    []
  );

  const handleReferenceUpload = useCallback(
    (file: File, slotPosition: number) => {
      (async () => {
        const result = await uploadReferenceImage({ projectId, file });
        if ("error" in result) {
          toast(result.error);
          return;
        }
        setReferenceSlots((prev) => {
          // If slot already exists, replace it; otherwise add new
          const exists = prev.find((s) => s.slotPosition === slotPosition);
          if (exists) {
            return prev.map((s) =>
              s.slotPosition === slotPosition
                ? {
                    ...s,
                    id: result.id,
                    imageUrl: result.imageUrl,
                    width: result.width,
                    height: result.height,
                  }
                : s
            );
          }
          return [
            ...prev,
            {
              id: result.id,
              imageUrl: result.imageUrl,
              slotPosition,
              role: "general" as ReferenceRole,
              strength: "moderate" as ReferenceStrength,
              width: result.width,
              height: result.height,
            },
          ];
        });
      })();
    },
    [projectId]
  );

  const handleReferenceUploadUrl = useCallback(
    (url: string, slotPosition: number) => {
      (async () => {
        const result = await uploadReferenceImage({ projectId, url });
        if ("error" in result) {
          toast(result.error);
          return;
        }
        setReferenceSlots((prev) => {
          const exists = prev.find((s) => s.slotPosition === slotPosition);
          if (exists) {
            return prev.map((s) =>
              s.slotPosition === slotPosition
                ? {
                    ...s,
                    id: result.id,
                    imageUrl: result.imageUrl,
                    width: result.width,
                    height: result.height,
                  }
                : s
            );
          }
          return [
            ...prev,
            {
              id: result.id,
              imageUrl: result.imageUrl,
              slotPosition,
              role: "general" as ReferenceRole,
              strength: "moderate" as ReferenceStrength,
              width: result.width,
              height: result.height,
            },
          ];
        });
      })();
    },
    [projectId]
  );

  const handleReferenceGalleryDrop = useCallback(
    (data: GalleryDragPayload, slotPosition: number) => {
      (async () => {
        const result = await addGalleryAsReference({
          projectId,
          generationId: data.generationId,
          imageUrl: data.imageUrl,
        });
        if ("error" in result) {
          toast(result.error);
          return;
        }
        setReferenceSlots((prev) => [
          ...prev,
          {
            id: result.id,
            imageUrl: result.imageUrl,
            slotPosition,
            role: "general" as ReferenceRole,
            strength: "moderate" as ReferenceStrength,
            width: result.width ?? undefined,
            height: result.height ?? undefined,
          },
        ]);
      })();
    },
    [projectId]
  );

  // ---------------------------------------------------------------------------
  // Generate / Upscale handlers
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(() => {
    // Prevent generation when model slots are not loaded
    if (modelSlots.length === 0) return;

    if (currentMode === "txt2img") {
      if (!promptMotiv.trim()) return;

      // Resolve active slots for txt2img mode
      const activeSlots = resolveActiveSlots(modelSlots, "txt2img");
      if (activeSlots.length === 0) return;

      const modelIds = activeSlots.map((s) => s.modelId);
      // Merge params from all active slots (first slot's params as base)
      const params = activeSlots[0].modelParams;

      startGeneration(async () => {
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelIds,
          params,
          count: variantCount,
          generationMode: "txt2img",
        });
        if (Array.isArray(result)) {
          onGenerationsCreated?.(result);
        }
      });
    } else if (currentMode === "img2img") {
      if (!promptMotiv.trim()) return;

      // Resolve active slots for img2img mode
      const activeSlots = resolveActiveSlots(modelSlots, "img2img");
      if (activeSlots.length === 0) return;

      const modelIds = activeSlots.map((s) => s.modelId);
      const params = activeSlots[0].modelParams;

      // Pass referenceSlots data to generateImages
      const filledSlots = referenceSlots.filter((s) => s.imageUrl);
      const references = filledSlots.length > 0
        ? filledSlots.map((s) => ({
            referenceImageId: s.id,
            imageUrl: s.imageUrl,
            role: s.role,
            strength: s.strength,
            slotPosition: s.slotPosition,
          }))
        : undefined;

      const sourceImageUrl = filledSlots.length > 0 ? filledSlots[0].imageUrl : undefined;

      startGeneration(async () => {
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelIds,
          params,
          count: variantCount,
          generationMode: "img2img",
          sourceImageUrl,
          references,
        });
        if (Array.isArray(result)) {
          onGenerationsCreated?.(result);
        }
      });
    } else if (currentMode === "upscale") {
      if (!upscaleSourceImageUrl) return;

      // Resolve active slots for upscale mode (use first active)
      const activeSlots = resolveActiveSlots(modelSlots, "upscale");
      if (activeSlots.length === 0) return;

      const resolved = activeSlots[0];

      startGeneration(async () => {
        const result = await upscaleImage({
          projectId,
          sourceImageUrl: upscaleSourceImageUrl,
          scale: upscaleScale,
          modelId: resolved.modelId,
          modelParams: resolved.modelParams,
        });
        if (result && !("error" in result)) {
          onGenerationsCreated?.([result]);
        }
      });
    }
  }, [
    currentMode,
    promptMotiv,
    promptStyle,
    negativePrompt,
    variantCount,
    referenceSlots,
    upscaleSourceImageUrl,
    upscaleScale,
    projectId,
    onGenerationsCreated,
    modelSlots,
  ]);

  // ----- Keyboard shortcut (Cmd/Ctrl+Enter) on Motiv field -----
  const handleMotivKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  // ---------------------------------------------------------------------------
  // Button disabled logic
  // ---------------------------------------------------------------------------

  const isButtonDisabled = (() => {
    if (isGenerating) return true;
    // Disable when model slots not loaded
    if (modelSlots.length === 0) return true;
    if (currentMode === "txt2img") return !promptMotiv.trim();
    if (currentMode === "img2img") return !promptMotiv.trim();
    if (currentMode === "upscale") return !upscaleSourceImageUrl;
    return true;
  })();

  const buttonLabel = currentMode === "upscale" ? "Upscale" : "Generate";
  const buttonLoadingLabel = currentMode === "upscale" ? "Upscaling..." : "Generating...";

  // ---------------------------------------------------------------------------
  // Conditional rendering flags
  // ---------------------------------------------------------------------------

  const showPromptFields = currentMode !== "upscale";
  const showVariants = currentMode !== "upscale";
  const showImageDropzone = currentMode === "upscale";
  const showReferenceBar = true; // Always rendered; hidden via CSS when not img2img

  // Shared textarea class
  const textareaClass =
    "flex w-full rounded-md border border-border bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden";

  return (
    <div className="space-y-3" data-testid="prompt-area">
      {/* Mode Selector — always visible at top */}
      <ModeSelector value={currentMode} onChange={handleModeChange} />

      <PromptTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLoadHistoryEntry={(entry) => {
          setPromptMotiv(entry.promptMotiv);
          setPromptStyle(entry.promptStyle ?? "");
          setNegativePrompt(entry.negativePrompt ?? "");
        }}
        promptMotiv={promptMotiv}
        promptStyle={promptStyle}
        negativePrompt={negativePrompt}
      >
        <div className="space-y-5 pt-3">
          {/* ── Group: ReferenceBar (img2img) — hidden, not unmounted, in other modes ── */}
          {showReferenceBar && (
            <div
              className={currentMode === "img2img" ? "" : "hidden"}
              data-testid="reference-bar-wrapper"
            >
              <ReferenceBar
                slots={referenceSlots}
                onAdd={handleReferenceAdd}
                onRemove={handleReferenceRemove}
                onRoleChange={handleReferenceRoleChange}
                onStrengthChange={handleReferenceStrengthChange}
                onUpload={handleReferenceUpload}
                onUploadUrl={handleReferenceUploadUrl}
                onGalleryDrop={handleReferenceGalleryDrop}
              />
            </div>
          )}

          {/* ── Group: Source Input (upscale only) ── */}
          {showImageDropzone && (
            <div className="space-y-2">
              <SectionLabel>Source Image</SectionLabel>
              <ImageDropzone
                projectId={projectId}
                onUpload={handleUpscaleUpload}
                initialUrl={upscaleSourceImageUrl ?? undefined}
                key={`dropzone-${currentMode}`}
              />
            </div>
          )}

          {/* ── Group: Prompt Composition ── */}
          {showPromptFields && (
            <div className="space-y-3">
              {/* Motiv Textarea (required) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-motiv-textarea" className="text-sm font-bold font-display [letter-spacing:-0.5px]">
                  Motiv <span aria-hidden="true" className="text-destructive">*</span>
                </Label>
                <textarea
                  id="prompt-motiv-textarea"
                  data-testid="prompt-motiv-textarea"
                  ref={motivRef}
                  value={promptMotiv}
                  onChange={handleMotivChange}
                  onKeyDown={handleMotivKeyDown}
                  placeholder="Describe the main subject of your image..."
                  rows={5}
                  className={textareaClass}
                />
              </div>

              {/* Style / Modifier — collapsible */}
              <Collapsible open={styleOpen} onOpenChange={setStyleOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-testid="prompt-style-toggle"
                  >
                    <span className="flex items-center gap-2">
                      Style / Modifier
                      {!!promptStyle.trim() && (
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-label="has content" />
                      )}
                    </span>
                    <ChevronDown
                      className={`size-4 transition-transform ${styleOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <textarea
                    id="prompt-style-textarea"
                    data-testid="prompt-style-textarea"
                    ref={styleRef}
                    value={promptStyle}
                    onChange={handleStyleChange}
                    placeholder="Add style, mood, or modifier keywords..."
                    rows={2}
                    className={`${textareaClass} mt-2`}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Negative Prompt — collapsible */}
              <Collapsible open={negativeOpen} onOpenChange={setNegativeOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-testid="prompt-negative-toggle"
                  >
                    <span className="flex items-center gap-2">
                      Negative Prompt
                      {!!negativePrompt.trim() && (
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-label="has content" />
                      )}
                    </span>
                    <ChevronDown
                      className={`size-4 transition-transform ${negativeOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <textarea
                    id="negative-prompt-textarea"
                    data-testid="negative-prompt-textarea"
                    ref={negativeRef}
                    value={negativePrompt}
                    onChange={handleNegativePromptChange}
                    placeholder="What to avoid in the image..."
                    rows={2}
                    className={`${textareaClass} mt-2`}
                  />
                </CollapsibleContent>
              </Collapsible>

              {/* Prompt Tools */}
              <div className="flex gap-2">
                <AssistantTrigger
                  isOpen={assistantOpen}
                  onClick={handleAssistantToggle}
                />
                <button
                  type="button"
                  onClick={() => setShowImprove(true)}
                  disabled={!promptMotiv.trim() || showImprove}
                  data-testid="improve-btn"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-[#E5E5E3] text-muted-foreground dark:border-[#2A2A2A] disabled:pointer-events-none disabled:opacity-50 hover:text-foreground"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  Improve
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isGenerating}
                  data-testid="clear-all-btn"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-[#E5E5E3] text-muted-foreground dark:border-[#2A2A2A] disabled:pointer-events-none disabled:opacity-50 hover:text-foreground"
                >
                  <Eraser className="size-3.5 text-primary" />
                  Clear
                </button>
              </div>

              {/* LLM Prompt Improvement */}
              {showImprove && (() => {
                const activeSlots = resolveActiveSlots(modelSlots, currentMode);
                const mid = activeSlots.length > 0 ? activeSlots[0].modelId : "";
                return (
                <LLMComparison
                  prompt={promptMotiv}
                  modelId={mid}
                  modelDisplayName={modelIdToDisplayName(mid)}
                  generationMode={currentMode}
                  onAdopt={(improved) => {
                    setPromptMotiv(improved);
                    setShowImprove(false);
                  }}
                  onDiscard={() => setShowImprove(false)}
                />
                );
              })()}
            </div>
          )}

          {/* Upscale mode: Scale selector */}
          {currentMode === "upscale" && (
            <div className="flex items-center gap-3">
              <SectionLabel className="whitespace-nowrap">Scale</SectionLabel>
              <div className="flex gap-1" data-testid="scale-selector">
                {([2, 4] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={upscaleScale === s ? "default" : "outline"}
                    onClick={() => setUpscaleScale(s)}
                    data-testid={`scale-${s}x`}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Action Bar: Model Slots + Variants + Generate ── */}
          <div className="space-y-3">
            <hr className="border-border my-8" />

            {/* Model Slots — replaces TierToggle and standalone ParameterPanel */}
            <ModelSlots
              mode={currentMode}
              slots={modelSlots}
              models={models}
              variant="stacked"
              disabled={isGenerating}
              onSlotsChanged={loadModelSlots}
            />

            {/* Variant Count Stepper — hidden in upscale mode */}
            {showVariants && (
              <div className="flex items-center justify-between px-1">
                <Label className="text-sm text-muted-foreground">
                  Variants
                </Label>
                <div className="flex items-center" data-testid="variant-count-selector">
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() => setVariantCount((v) => Math.max(1, v - 1) as 1 | 2 | 3 | 4)}
                    disabled={variantCount <= 1}
                    data-testid="variant-count-minus"
                    aria-label="Decrease variants"
                  >
                    <Minus />
                  </Button>
                  <span
                    className="w-8 text-center text-sm font-medium tabular-nums"
                    data-testid="variant-count-value"
                  >
                    {variantCount}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    onClick={() => setVariantCount((v) => Math.min(4, v + 1) as 1 | 2 | 3 | 4)}
                    disabled={variantCount >= 4}
                    data-testid="variant-count-plus"
                    aria-label="Increase variants"
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            )}

            {/* Generate / Upscale Button */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isButtonDisabled}
              className="w-full h-12 text-base font-semibold tracking-wide"
              data-testid="generate-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {buttonLoadingLabel}
                </>
              ) : (
                buttonLabel
              )}
            </Button>
          </div>
        </div>
      </PromptTabs>

    </div>
  );
}
