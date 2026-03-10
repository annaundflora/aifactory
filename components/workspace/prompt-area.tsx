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
import { MODELS, getModelById } from "@/lib/models";
import { getModelSchema } from "@/app/actions/models";
import { generateImages, upscaleImage } from "@/app/actions/generations";
import { useWorkspaceVariation } from "@/lib/workspace-state";
import { ModeSelector, type GenerationMode } from "@/components/workspace/mode-selector";
import { ImageDropzone } from "@/components/workspace/image-dropzone";
import { StrengthSlider } from "@/components/workspace/strength-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ParameterPanel,
  type SchemaProperties,
} from "@/components/workspace/parameter-panel";
import { Loader2, Wand2, Sparkles } from "lucide-react";
import { BuilderDrawer } from "@/components/prompt-builder/builder-drawer";
import { LLMComparison } from "@/components/prompt-improve/llm-comparison";
import { TemplateSelector } from "@/components/workspace/template-selector";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptAreaProps {
  projectId: string;
  onGenerationsCreated?: (generations: Generation[]) => void;
}

// Re-export Generation type for callback
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Per-Mode State Types (State Persistence Matrix)
// ---------------------------------------------------------------------------

interface Txt2ImgState {
  promptMotiv: string;
  promptStyle: string;
  negativePrompt: string;
  modelId: string;
  paramValues: Record<string, unknown>;
  variantCount: number;
}

interface Img2ImgState {
  promptMotiv: string;
  promptStyle: string;
  negativePrompt: string;
  modelId: string;
  paramValues: Record<string, unknown>;
  variantCount: number;
  sourceImageUrl: string | null;
  strength: number;
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

const VARIANT_OPTIONS = [1, 2, 3, 4] as const;
const DEFAULT_STRENGTH = 0.6;
const DEFAULT_SCALE: 2 | 4 = 2;

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `$${price.toFixed(3)}`;
}

/** Auto-resize a textarea to fit its content. */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Check if a schema supports img2img by looking for image input params.
 * Excludes `image` when `mask` is also present (inpainting, not img2img).
 */
function schemaSupportsImg2Img(schema: SchemaProperties | null): boolean {
  if (!schema) return false;
  if ("input_images" in schema) return true;
  if ("image_input" in schema) return true;
  if ("image_prompt" in schema) return true;
  if ("init_image" in schema) return true;
  if ("image" in schema && !("mask" in schema)) return true;
  return false;
}

function createInitialModeStates(modelId: string): ModeStates {
  return {
    txt2img: {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      modelId,
      paramValues: {},
      variantCount: 1,
    },
    img2img: {
      promptMotiv: "",
      promptStyle: "",
      negativePrompt: "",
      modelId,
      paramValues: {},
      variantCount: 1,
      sourceImageUrl: null,
      strength: DEFAULT_STRENGTH,
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

export function PromptArea({ projectId, onGenerationsCreated }: PromptAreaProps) {
  // ----- Mode state -----
  const [currentMode, setCurrentMode] = useState<GenerationMode>("txt2img");

  // ----- Per-mode state (State Persistence Matrix) -----
  const [modeStates, setModeStates] = useState<ModeStates>(() =>
    createInitialModeStates(MODELS[0].id)
  );

  // ----- Active state derived from current mode -----
  // For txt2img and img2img, we use these common fields directly.
  // For upscale, we only use sourceImageUrl and scale from upscale state.
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);

  // ----- Schema state -----
  const [schema, setSchema] = useState<SchemaProperties | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);

  // ----- Structured prompt state -----
  const [promptMotiv, setPromptMotiv] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const motivRef = useRef<HTMLTextAreaElement>(null);

  // ----- Parameter state -----
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  // ----- Variant count -----
  const [variantCount, setVariantCount] = useState(1);

  // ----- img2img-specific state -----
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);

  // ----- upscale-specific state -----
  const [upscaleSourceImageUrl, setUpscaleSourceImageUrl] = useState<string | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(DEFAULT_SCALE);

  // ----- Generation state -----
  const [isGenerating, startGeneration] = useTransition();

  // ----- Tab state -----
  const [activeTab, setActiveTab] = useState<PromptTab>("prompt");

  // ----- Builder drawer + LLM comparison -----
  const [builderOpen, setBuilderOpen] = useState(false);
  const [showImprove, setShowImprove] = useState(false);

  // ----- Variation state consumption -----
  const { variationData, clearVariation } = useWorkspaceVariation();
  const pendingVariationParamsRef = useRef<Record<string, unknown> | null>(null);

  // ----- Schema cache for img2img compatibility checks -----
  const schemaCacheRef = useRef<Map<string, SchemaProperties>>(new Map());

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
          modelId: selectedModelId,
          paramValues,
          variantCount,
        };
      } else if (currentMode === "img2img") {
        updated.img2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          modelId: selectedModelId,
          paramValues,
          variantCount,
          sourceImageUrl,
          strength,
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
    selectedModelId,
    paramValues,
    variantCount,
    sourceImageUrl,
    strength,
    upscaleSourceImageUrl,
    upscaleScale,
  ]);

  // ---------------------------------------------------------------------------
  // Model auto-switch for img2img compatibility (AC-12)
  // ---------------------------------------------------------------------------

  const checkAndAutoSwitchModel = useCallback(
    async (modelId: string): Promise<string> => {
      // Check if current model supports img2img
      let modelSchema = schemaCacheRef.current.get(modelId);
      if (!modelSchema) {
        try {
          const result = await getModelSchema({ modelId });
          if ("properties" in result) {
            modelSchema = result.properties as SchemaProperties;
            schemaCacheRef.current.set(modelId, modelSchema);
          }
        } catch {
          // If schema fetch fails, assume incompatible
        }
      }

      if (modelSchema && schemaSupportsImg2Img(modelSchema)) {
        return modelId; // Current model is compatible
      }

      // Find first compatible model
      for (const model of MODELS) {
        if (model.id === modelId) continue;

        let candidateSchema = schemaCacheRef.current.get(model.id);
        if (!candidateSchema) {
          try {
            const result = await getModelSchema({ modelId: model.id });
            if ("properties" in result) {
              candidateSchema = result.properties as SchemaProperties;
              schemaCacheRef.current.set(model.id, candidateSchema);
            }
          } catch {
            continue;
          }
        }

        if (candidateSchema && schemaSupportsImg2Img(candidateSchema)) {
          const display = getModelById(model.id)?.displayName ?? model.id;
          toast(`Model switched to ${display} (supports img2img)`);
          return model.id;
        }
      }

      // No compatible model found (edge case)
      return modelId;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Mode change handler
  // ---------------------------------------------------------------------------

  const handleModeChange = useCallback(
    async (targetMode: GenerationMode) => {
      if (targetMode === currentMode) return;

      // 1. Compute a local snapshot of the saved state BEFORE calling setModeStates.
      //    This avoids a race condition where setModeStates (async React batch)
      //    hasn't updated modeStates yet when we try to read it below.
      const snapshot: ModeStates = { ...modeStates };
      if (currentMode === "txt2img") {
        snapshot.txt2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          modelId: selectedModelId,
          paramValues,
          variantCount,
        };
      } else if (currentMode === "img2img") {
        snapshot.img2img = {
          promptMotiv,
          promptStyle,
          negativePrompt,
          modelId: selectedModelId,
          paramValues,
          variantCount,
          sourceImageUrl,
          strength,
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
      //    Per State Persistence Matrix:
      //    - Prompt fields "Keep" when both modes have them (txt2img <-> img2img)
      //    - Prompt fields "Restore" from target mode when coming from upscale
      //    - Source image "Keep (transfer)" between img2img <-> upscale
      const fromHasPrompt = currentMode !== "upscale";

      if (targetMode === "upscale") {
        // Switching TO upscale: restore upscale-specific state only
        setUpscaleSourceImageUrl(snapshot.upscale.sourceImageUrl);
        setUpscaleScale(snapshot.upscale.scale);
      } else if (targetMode === "img2img") {
        if (fromHasPrompt) {
          // txt2img -> img2img: "Keep" prompt, model, params; restore img2img-specific fields
          setSourceImageUrl(snapshot.img2img.sourceImageUrl);
          setStrength(snapshot.img2img.strength);
          // Prompt, model, params, variantCount stay as-is (Keep)
        } else {
          // upscale -> img2img: "Restore" all from snapshot
          const s = snapshot.img2img;
          setPromptMotiv(s.promptMotiv);
          setPromptStyle(s.promptStyle);
          setNegativePrompt(s.negativePrompt);
          setSelectedModelId(s.modelId);
          setParamValues(s.paramValues);
          setVariantCount(s.variantCount);
          setSourceImageUrl(s.sourceImageUrl);
          setStrength(s.strength);
        }
      } else if (targetMode === "txt2img") {
        if (fromHasPrompt) {
          // img2img -> txt2img: "Keep" prompt, model, params
          // Prompt, model, params, variantCount stay as-is (Keep)
        } else {
          // upscale -> txt2img: "Restore" all from snapshot
          const s = snapshot.txt2img;
          setPromptMotiv(s.promptMotiv);
          setPromptStyle(s.promptStyle);
          setNegativePrompt(s.negativePrompt);
          setSelectedModelId(s.modelId);
          setParamValues(s.paramValues);
          setVariantCount(s.variantCount);
        }
      }

      // 3. Transfer source image if moving between img2img and upscale
      //    Only transfer when the target mode's stored sourceImageUrl is null/undefined
      //    (restore wins over transfer — avoids overwriting a previously stored image)
      if (currentMode === "img2img" && targetMode === "upscale") {
        if (!snapshot.upscale.sourceImageUrl) {
          setUpscaleSourceImageUrl(sourceImageUrl);
        }
      } else if (currentMode === "upscale" && targetMode === "img2img") {
        if (!snapshot.img2img.sourceImageUrl) {
          setSourceImageUrl(upscaleSourceImageUrl);
        }
      }

      // 4. If switching to img2img, check model compatibility (AC-12)
      if (targetMode === "img2img") {
        const activeModelId = fromHasPrompt ? selectedModelId : snapshot.img2img.modelId;
        const compatibleModelId = await checkAndAutoSwitchModel(activeModelId);
        if (compatibleModelId !== activeModelId) {
          setSelectedModelId(compatibleModelId);
          // Also update the modeStates for img2img
          setModeStates((prev) => ({
            ...prev,
            img2img: { ...prev.img2img, modelId: compatibleModelId },
          }));
        }
      }

      // 5. Set the mode
      setCurrentMode(targetMode);
    },
    [
      currentMode,
      selectedModelId,
      promptMotiv,
      promptStyle,
      negativePrompt,
      paramValues,
      variantCount,
      sourceImageUrl,
      strength,
      upscaleSourceImageUrl,
      upscaleScale,
      checkAndAutoSwitchModel,
      modeStates,
    ]
  );

  // ---------------------------------------------------------------------------
  // Variation state consumption (Cross-Mode from Lightbox) — AC-7
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!variationData) return;

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
        setSourceImageUrl(variationData.sourceImageUrl ?? null);
        if (variationData.strength !== undefined) {
          setStrength(variationData.strength);
        }

        if (variationData.modelId !== selectedModelId) {
          pendingVariationParamsRef.current = variationData.modelParams;
          setSelectedModelId(variationData.modelId);
        } else {
          setParamValues(variationData.modelParams);
        }
      } else if (targetMode === "upscale") {
        setUpscaleSourceImageUrl(variationData.sourceImageUrl ?? null);
      }

      setCurrentMode(targetMode);
    } else {
      // Standard variation (no mode change) — same as before
      setPromptMotiv(variationData.promptMotiv);
      setPromptStyle(variationData.promptStyle ?? "");
      setNegativePrompt(variationData.negativePrompt ?? "");

      if (variationData.modelId !== selectedModelId) {
        pendingVariationParamsRef.current = variationData.modelParams;
        setSelectedModelId(variationData.modelId);
      } else {
        setParamValues(variationData.modelParams);
      }
    }

    clearVariation();
  }, [variationData, clearVariation, selectedModelId, saveCurrentModeState]);

  // ----- Load schema on model change -----
  const loadSchema = useCallback(async (modelId: string) => {
    setSchemaLoading(true);
    setParamValues({});
    try {
      const result = await getModelSchema({ modelId });
      if ("properties" in result) {
        const props = result.properties as SchemaProperties;
        setSchema(props);
        schemaCacheRef.current.set(modelId, props);
      } else {
        setSchema(null);
      }
    } catch {
      setSchema(null);
    } finally {
      setSchemaLoading(false);
      // Restore variation params after schema load if pending
      if (pendingVariationParamsRef.current) {
        setParamValues(pendingVariationParamsRef.current);
        pendingVariationParamsRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    loadSchema(selectedModelId);
  }, [selectedModelId, loadSchema]);

  // ----- Schema-derived flags -----
  const hasNegativePrompt = schema
    ? "negative_prompt" in schema
    : false;

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

  // ---------------------------------------------------------------------------
  // Image upload handlers
  // ---------------------------------------------------------------------------

  const handleImg2ImgUpload = useCallback((url: string | null) => {
    setSourceImageUrl(url);
  }, []);

  const handleUpscaleUpload = useCallback((url: string | null) => {
    setUpscaleSourceImageUrl(url);
  }, []);

  // ---------------------------------------------------------------------------
  // Generate / Upscale handlers
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(() => {
    if (currentMode === "txt2img") {
      if (!promptMotiv.trim()) return;

      startGeneration(async () => {
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelId: selectedModelId,
          params: paramValues,
          count: variantCount,
          generationMode: "txt2img",
        });
        if (Array.isArray(result)) {
          onGenerationsCreated?.(result);
        }
      });
    } else if (currentMode === "img2img") {
      // AC-8: Don't generate without source image
      if (!sourceImageUrl) return;
      if (!promptMotiv.trim()) return;

      startGeneration(async () => {
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelId: selectedModelId,
          params: paramValues,
          count: variantCount,
          generationMode: "img2img",
          sourceImageUrl,
          strength,
        });
        if (Array.isArray(result)) {
          onGenerationsCreated?.(result);
        }
      });
    } else if (currentMode === "upscale") {
      // AC-11: Don't upscale without source image
      if (!upscaleSourceImageUrl) return;

      startGeneration(async () => {
        const result = await upscaleImage({
          projectId,
          sourceImageUrl: upscaleSourceImageUrl,
          scale: upscaleScale,
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
    selectedModelId,
    paramValues,
    variantCount,
    sourceImageUrl,
    strength,
    upscaleSourceImageUrl,
    upscaleScale,
    projectId,
    onGenerationsCreated,
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

  // ----- Model change handler -----
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
  }, []);

  // ---------------------------------------------------------------------------
  // Button disabled logic
  // ---------------------------------------------------------------------------

  const isButtonDisabled = (() => {
    if (isGenerating) return true;
    if (currentMode === "txt2img") return !promptMotiv.trim();
    if (currentMode === "img2img") return !sourceImageUrl || !promptMotiv.trim();
    if (currentMode === "upscale") return !upscaleSourceImageUrl;
    return true;
  })();

  const buttonLabel = currentMode === "upscale" ? "Upscale" : "Generate";
  const buttonLoadingLabel = currentMode === "upscale" ? "Upscaling..." : "Generating...";

  // ---------------------------------------------------------------------------
  // Conditional rendering flags
  // ---------------------------------------------------------------------------

  const showPromptFields = currentMode !== "upscale";
  const showModelSelector = currentMode !== "upscale";
  const showVariants = currentMode !== "upscale";
  const showImageDropzone = currentMode === "img2img" || currentMode === "upscale";
  const showStrengthSlider = currentMode === "img2img";

  // Shared textarea class
  const textareaClass =
    "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden";

  return (
    <div className="space-y-4" data-testid="prompt-area">
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
        <div className="space-y-4 pt-2">
          {/* Model Dropdown — hidden in upscale mode */}
          {showModelSelector && (
            <div className="space-y-2">
              <Label htmlFor="model-select">Model</Label>
              <Select value={selectedModelId} onValueChange={handleModelChange}>
                <SelectTrigger id="model-select" data-testid="model-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.displayName} -- {formatPrice(model.pricePerImage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ImageDropzone — visible in img2img and upscale modes */}
          {showImageDropzone && (
            <ImageDropzone
              projectId={projectId}
              onUpload={currentMode === "img2img" ? handleImg2ImgUpload : handleUpscaleUpload}
              initialUrl={
                currentMode === "img2img"
                  ? sourceImageUrl ?? undefined
                  : upscaleSourceImageUrl ?? undefined
              }
              key={`dropzone-${currentMode}`}
            />
          )}

          {/* StrengthSlider — visible only in img2img mode */}
          {showStrengthSlider && (
            <StrengthSlider value={strength} onChange={setStrength} />
          )}

          {/* Prompt fields — hidden in upscale mode */}
          {showPromptFields && (
            <>
              {/* Motiv Textarea (required) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-motiv-textarea">
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
                {/* Prompt Helper Buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBuilderOpen(true)}
                    data-testid="builder-btn"
                  >
                    <Wand2 className="mr-1 size-3" />
                    Builder
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowImprove(true)}
                    disabled={!promptMotiv.trim() || showImprove}
                    data-testid="improve-btn"
                  >
                    <Sparkles className="mr-1 size-3" />
                    Improve
                  </Button>
                </div>
                {/* Template Selector */}
                <TemplateSelector
                  hasContent={
                    promptMotiv.trim().length > 0 ||
                    promptStyle.trim().length > 0 ||
                    negativePrompt.trim().length > 0
                  }
                  onApplyTemplate={(template) => {
                    setPromptMotiv(template.motiv);
                    setPromptStyle(template.style);
                    setNegativePrompt(template.negativePrompt);
                  }}
                />
              </div>

              {/* Style / Modifier Textarea (optional) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-style-textarea">Style / Modifier</Label>
                <textarea
                  id="prompt-style-textarea"
                  data-testid="prompt-style-textarea"
                  value={promptStyle}
                  onChange={handleStyleChange}
                  placeholder="Add style, mood, or modifier keywords..."
                  rows={2}
                  className={textareaClass}
                />
              </div>

              {/* LLM Prompt Improvement */}
              {showImprove && (
                <LLMComparison
                  prompt={promptMotiv}
                  modelId={selectedModelId}
                  modelDisplayName={getModelById(selectedModelId)?.displayName ?? selectedModelId}
                  onAdopt={(improved) => {
                    setPromptMotiv(improved);
                    setShowImprove(false);
                  }}
                  onDiscard={() => setShowImprove(false)}
                />
              )}

              {/* Prompt Builder Drawer — output goes to Style/Modifier field */}
              <BuilderDrawer
                open={builderOpen}
                onClose={(composedPrompt) => {
                  setBuilderOpen(false);
                  if (composedPrompt) {
                    setPromptStyle(composedPrompt);
                  }
                }}
                basePrompt={promptStyle}
              />

              {/* Negative Prompt (conditionally visible based on model schema) */}
              {hasNegativePrompt && (
                <div className="space-y-2">
                  <Label htmlFor="negative-prompt-textarea">Negative Prompt</Label>
                  <textarea
                    id="negative-prompt-textarea"
                    data-testid="negative-prompt-textarea"
                    value={negativePrompt}
                    onChange={handleNegativePromptChange}
                    placeholder="What to avoid in the image..."
                    rows={2}
                    className={textareaClass}
                  />
                </div>
              )}

              {/* Parameter Panel */}
              <ParameterPanel
                schema={schema}
                isLoading={schemaLoading}
                values={paramValues}
                onChange={setParamValues}
              />
            </>
          )}

          {/* Upscale mode: Scale selector (inline toggle, no separate slice) */}
          {currentMode === "upscale" && (
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Scale</Label>
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

          {/* Bottom row: Variant Count + Generate/Upscale Button */}
          <div className="flex items-center gap-3">
            {/* Variant Count Selector — hidden in upscale mode */}
            {showVariants && (
              <div className="flex items-center gap-2">
                <Label htmlFor="variant-count" className="text-sm whitespace-nowrap">
                  Variants
                </Label>
                <div className="flex gap-1" data-testid="variant-count-selector">
                  {VARIANT_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      type="button"
                      size="sm"
                      variant={variantCount === count ? "default" : "outline"}
                      onClick={() => setVariantCount(count)}
                      data-testid={`variant-count-${count}`}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Generate / Upscale Button */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isButtonDisabled}
              className="ml-auto"
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
