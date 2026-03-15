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
import { getModelSettings } from "@/app/actions/model-settings";
import type { ModelSetting } from "@/lib/db/queries";
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
import { TierToggle } from "@/components/ui/tier-toggle";
import { MaxQualityToggle } from "@/components/ui/max-quality-toggle";
import type { Tier } from "@/lib/types";
import { Loader2, Sparkles, Minus, Plus } from "lucide-react";
import { LLMComparison } from "@/components/prompt-improve/llm-comparison";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";
import { SectionLabel } from "@/components/shared/section-label";
import { AssistantSheet } from "@/components/assistant/assistant-sheet";
import { Startscreen } from "@/components/assistant/startscreen";
import { ChatInput } from "@/components/assistant/chat-input";
import { ChatThread } from "@/components/assistant/chat-thread";
import { PromptCanvas } from "@/components/assistant/prompt-canvas";
import { SessionList } from "@/components/assistant/session-list";
import { SessionSwitcher } from "@/components/assistant/session-switcher";
import { ModelSelector } from "@/components/assistant/model-selector";
import {
  PromptAssistantProvider,
  usePromptAssistant,
  getWorkspaceFieldsForChip,
} from "@/lib/assistant/assistant-context";
import { useAssistantRuntime } from "@/lib/assistant/use-assistant-runtime";
import { toast } from "sonner";

// Re-export Generation type for callback
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptAreaProps {
  projectId: string;
  onGenerationsCreated?: (generations: Generation[]) => void;
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
// Model Resolution Helper
// ---------------------------------------------------------------------------

/**
 * Resolve model ID and params from cached model settings based on mode, tier,
 * and maxQuality flag.
 *
 * effectiveTier = maxQuality ? "max" : tier
 *
 * Returns { modelId, modelParams } or undefined if no matching setting found.
 */
function resolveModel(
  settings: ModelSetting[],
  mode: GenerationMode,
  tier: Tier,
  maxQuality: boolean
): { modelId: string; modelParams: Record<string, unknown> } | undefined {
  const effectiveTier = maxQuality ? "max" : tier;
  const setting = settings.find(
    (s) => s.mode === mode && s.tier === effectiveTier
  );
  if (!setting) return undefined;
  return {
    modelId: setting.modelId,
    modelParams: (setting.modelParams ?? {}) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptArea({ projectId, onGenerationsCreated }: PromptAreaProps) {
  // ----- Mode state -----
  const [currentMode, setCurrentMode] = useState<GenerationMode>("txt2img");

  // ----- Per-mode state (State Persistence Matrix) -----
  const [modeStates, setModeStates] = useState<ModeStates>(() =>
    createInitialModeStates()
  );

  // ----- Tier state (Draft/Quality) -----
  const [tier, setTier] = useState<Tier>("draft");
  const [maxQuality, setMaxQuality] = useState<boolean>(false);

  // ----- Model settings (cached from DB) -----
  const [modelSettings, setModelSettings] = useState<ModelSetting[]>([]);

  // Fetch model settings on mount and when settings change
  const loadModelSettings = useCallback(() => {
    getModelSettings().then((settings) => {
      setModelSettings(settings);
    }).catch((err) => {
      console.error("Failed to load model settings:", err);
    });
  }, []);

  useEffect(() => {
    loadModelSettings();
    window.addEventListener("model-settings-changed", loadModelSettings);
    return () => {
      window.removeEventListener("model-settings-changed", loadModelSettings);
    };
  }, [loadModelSettings]);

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

  // ----- Generation state -----
  const [isGenerating, startGeneration] = useTransition();

  // ----- Tab state -----
  const [activeTab, setActiveTab] = useState<PromptTab>("prompt");

  // ----- LLM comparison -----
  const [showImprove, setShowImprove] = useState(false);

  // ----- Assistant Sheet state -----
  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleAssistantToggle = useCallback(() => {
    setAssistantOpen((prev) => !prev);
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
    // AC-10: Prevent generation when model settings are not loaded
    if (modelSettings.length === 0) return;

    if (currentMode === "txt2img") {
      if (!promptMotiv.trim()) return;

      // Resolve model from settings based on tier + maxQuality
      const resolved = resolveModel(modelSettings, "txt2img", tier, maxQuality);
      if (!resolved) return;

      startGeneration(async () => {
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelIds: [resolved.modelId],
          params: resolved.modelParams,
          count: variantCount,
          generationMode: "txt2img",
        });
        if (Array.isArray(result)) {
          onGenerationsCreated?.(result);
        }
      });
    } else if (currentMode === "img2img") {
      if (!promptMotiv.trim()) return;

      // Resolve model from settings based on tier + maxQuality
      const resolved = resolveModel(modelSettings, "img2img", tier, maxQuality);
      if (!resolved) return;

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
          modelIds: [resolved.modelId],
          params: resolved.modelParams,
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

      // Resolve upscale model from settings (upscale has no max tier)
      const resolved = resolveModel(modelSettings, "upscale", tier, false);
      if (!resolved) return;

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
    modelSettings,
    tier,
    maxQuality,
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
    // AC-10: Disable when model settings not loaded
    if (modelSettings.length === 0) return true;
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
              <hr className="border-border my-8" />
              <SectionLabel>Prompt</SectionLabel>

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
                  rows={3}
                  className={textareaClass}
                />
              </div>

              {/* Style / Modifier Textarea (optional) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-style-textarea" className="text-sm font-bold font-display [letter-spacing:-0.5px]">Style / Modifier</Label>
                <textarea
                  id="prompt-style-textarea"
                  data-testid="prompt-style-textarea"
                  ref={styleRef}
                  value={promptStyle}
                  onChange={handleStyleChange}
                  placeholder="Add style, mood, or modifier keywords..."
                  rows={2}
                  className={textareaClass}
                />
              </div>

              {/* Negative Prompt (conditionally visible based on model schema) */}
              {hasNegativePrompt && (
                <div className="space-y-2">
                  <Label htmlFor="negative-prompt-textarea" className="text-sm font-bold font-display [letter-spacing:-0.5px]">Negative Prompt</Label>
                  <textarea
                    id="negative-prompt-textarea"
                    data-testid="negative-prompt-textarea"
                    ref={negativeRef}
                    value={negativePrompt}
                    onChange={handleNegativePromptChange}
                    placeholder="What to avoid in the image..."
                    rows={2}
                    className={textareaClass}
                  />
                </div>
              )}

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
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-[#E5E5E3] text-foreground dark:border-[#2A2A2A] dark:text-white disabled:pointer-events-none disabled:opacity-50"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  Improve
                </button>
              </div>

              {/* LLM Prompt Improvement */}
              {showImprove && (
                <LLMComparison
                  prompt={promptMotiv}
                  modelId=""
                  modelDisplayName=""
                  onAdopt={(improved) => {
                    setPromptMotiv(improved);
                    setShowImprove(false);
                  }}
                  onDiscard={() => setShowImprove(false)}
                />
              )}
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

          {/* ── Action Bar: Tier Toggle + Variants + Generate ── */}
          <div className="space-y-3">
            <hr className="border-border my-8" />

            {/* Tier Toggle — always visible */}
            <TierToggle
              tier={tier}
              onTierChange={setTier}
              disabled={isGenerating}
            />

            {/* Max Quality Toggle — visible only when quality tier and not upscale mode */}
            {tier === "quality" && currentMode !== "upscale" && (
              <MaxQualityToggle
                maxQuality={maxQuality}
                onMaxQualityChange={setMaxQuality}
              />
            )}

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

      {/* Assistant Sheet with Context Provider */}
      <PromptAssistantProvider projectId={projectId}>
        <AssistantSheetContent
          open={assistantOpen}
          onOpenChange={setAssistantOpen}
          projectId={projectId}
        />
      </PromptAssistantProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssistantSheetContent (inner component using PromptAssistantContext)
// ---------------------------------------------------------------------------

interface AssistantSheetContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

function AssistantSheetContent({
  open,
  onOpenChange,
  projectId,
}: AssistantSheetContentProps) {
  const {
    messages,
    isStreaming,
    hasCanvas,
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
    (text: string, imageUrl?: string) => {
      sendMessage(text, imageUrl);
    },
    [sendMessage]
  );

  /**
   * Slice-19 AC-8/AC-9: "Verbessere meinen aktuellen Prompt" chip handler.
   * Enriches the chip text with current workspace fields when available.
   */
  const handleChipClick = useCallback(
    (text: string) => {
      const IMPROVE_CHIP_TEXT = "Verbessere meinen aktuellen Prompt";
      if (text === IMPROVE_CHIP_TEXT) {
        const context = getWorkspaceFieldsForChip(variationData);
        if (context) {
          // AC-8: Prepend workspace fields as context
          sendMessage(`${text}\n\n${context}`);
        } else {
          // AC-9: Send chip text as-is when all workspace fields are empty
          sendMessage(text);
        }
      } else {
        sendMessage(text);
      }
    },
    [sendMessage, variationData]
  );

  /**
   * Slice-19 AC-1/AC-4: Auto-resume active session when sheet opens.
   * If sessionId exists but messages are empty (e.g., after page-level navigation),
   * reload the session from backend. If messages already exist in context, the
   * state is already preserved (AC-4/AC-7).
   * AC-5: When no sessionId exists, startscreen is shown (default behavior).
   */
  const handleSheetOpen = useCallback(() => {
    if (sessionId && messages.length === 0) {
      // Session ID exists but state was lost -- reload from backend
      loadSession(sessionId);
    } else if (sessionId && messages.length > 0) {
      // AC-1: Session is already in memory, ensure chat view is active
      if (activeView === "startscreen") {
        setActiveView("chat");
      }
    }
    // AC-5: No sessionId -> startscreen remains (default)
  }, [sessionId, messages.length, loadSession, activeView, setActiveView]);

  // AC-7: Session switcher navigates to session list
  const handleSwitcherClick = useCallback(() => {
    setActiveView("session-list");
  }, [setActiveView]);

  // AC-4: Loading a session from the list
  const handleSelectSession = useCallback(
    (id: string) => {
      loadSession(id);
    },
    [loadSession]
  );

  // Navigate back from session list to startscreen or chat
  const handleSessionListBack = useCallback(() => {
    if (messages.length > 0) {
      setActiveView("chat");
    } else {
      setActiveView("startscreen");
    }
  }, [messages.length, setActiveView]);

  // New session from session list
  const handleNewSession = useCallback(() => {
    dispatch({ type: "RESET_SESSION" });
    setActiveView("startscreen");
  }, [dispatch, setActiveView]);

  // Navigate to session list from startscreen
  const handleSessionHistoryClick = useCallback(() => {
    setActiveView("session-list");
  }, [setActiveView]);

  // Render the appropriate content based on activeView
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

    // For "chat" and "startscreen" views
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
    <AssistantSheet
      open={open}
      onOpenChange={onOpenChange}
      onOpen={handleSheetOpen}
      hasCanvas={hasCanvas && activeView !== "session-list"}
      canvasSlot={<PromptCanvas />}
      headerSlot={
        <>
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          <SessionSwitcher onClick={handleSwitcherClick} />
        </>
      }
    >
      {renderContent()}
    </AssistantSheet>
  );
}
