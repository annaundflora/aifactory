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
import { getModelSchema, getCollectionModels } from "@/app/actions/models";
import { generateImages, upscaleImage } from "@/app/actions/generations";
import { useWorkspaceVariation } from "@/lib/workspace-state";
import { ModeSelector, type GenerationMode } from "@/components/workspace/mode-selector";
import { ImageDropzone } from "@/components/workspace/image-dropzone";
import { StrengthSlider } from "@/components/workspace/strength-slider";
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
import { type CollectionModel } from "@/lib/types/collection-model";
import { ModelTrigger } from "@/components/models/model-trigger";
import { ModelBrowserDrawer } from "@/components/models/model-browser-drawer";
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
    createInitialModeStates("")
  );

  // ----- Model state (multi-model from model-cards) -----
  const [selectedModels, setSelectedModels] = useState<CollectionModel[]>([]);

  // ----- Collection state (for drawer) -----
  const [collectionModels, setCollectionModels] = useState<CollectionModel[]>([]);
  const [collectionError, setCollectionError] = useState<string | undefined>(undefined);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // ----- Derived: current model ID (for schema, LLM comparison, generate) -----
  const selectedModelId =
    selectedModels.length > 0
      ? `${selectedModels[0].owner}/${selectedModels[0].name}`
      : "";
  const selectedModelIdRef = useRef(selectedModelId);
  selectedModelIdRef.current = selectedModelId;

  // ----- Derived: single model mode -----
  const isSingleModel = selectedModels.length === 1;

  // ----- Schema cache for img2img compatibility checks -----
  const schemaCacheRef = useRef<Map<string, SchemaProperties>>(new Map());

  // ----- Fetch collection models on mount -----
  const fetchCollectionModels = useCallback(async () => {
    setCollectionLoading(true);
    setCollectionError(undefined);
    try {
      const result = await getCollectionModels();
      if (Array.isArray(result)) {
        setCollectionModels(result);
        // Initialize selectedModels with first model if currently empty
        setSelectedModels((prev) => {
          if (prev.length === 0 && result.length > 0) {
            return [result[0]];
          }
          return prev;
        });
      } else {
        setCollectionError(result.error);
      }
    } catch {
      setCollectionError("Failed to load models");
    } finally {
      setCollectionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollectionModels();
  }, [fetchCollectionModels]);

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

      // Find first compatible model from collection
      for (const model of collectionModels) {
        const candidateId = `${model.owner}/${model.name}`;
        if (candidateId === modelId) continue;

        let candidateSchema = schemaCacheRef.current.get(candidateId);
        if (!candidateSchema) {
          try {
            const result = await getModelSchema({ modelId: candidateId });
            if ("properties" in result) {
              candidateSchema = result.properties as SchemaProperties;
              schemaCacheRef.current.set(candidateId, candidateSchema);
            }
          } catch {
            continue;
          }
        }

        if (candidateSchema && schemaSupportsImg2Img(candidateSchema)) {
          toast(`Model switched to ${model.name} (supports img2img)`);
          // Update selectedModels to the compatible model
          setSelectedModels([model]);
          return candidateId;
        }
      }

      // No compatible model found (edge case)
      return modelId;
    },
    [collectionModels]
  );

  // ---------------------------------------------------------------------------
  // Helper: set selectedModels from a modelId string
  // ---------------------------------------------------------------------------

  const setSelectedModelFromId = useCallback(
    (modelId: string) => {
      const matchingModel = collectionModels.find(
        (m) => `${m.owner}/${m.name}` === modelId,
      );
      if (matchingModel) {
        setSelectedModels([matchingModel]);
      } else {
        // Fallback: create a minimal CollectionModel from the modelId
        const [owner, name] = modelId.split("/");
        setSelectedModels([
          {
            url: "",
            owner: owner ?? "",
            name: name ?? "",
            description: null,
            cover_image_url: null,
            run_count: 0,
          },
        ]);
      }
    },
    [collectionModels]
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
          setSelectedModelFromId(s.modelId);
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
          setSelectedModelFromId(s.modelId);
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
          setSelectedModelFromId(compatibleModelId);
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
      setSelectedModelFromId,
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

        if (variationData.modelId !== selectedModelIdRef.current) {
          pendingVariationParamsRef.current = variationData.modelParams;
          // Find the matching CollectionModel in the collection, or create a minimal one
          const matchingModel = collectionModels.find(
            (m) => `${m.owner}/${m.name}` === variationData.modelId,
          );
          if (matchingModel) {
            setSelectedModels([matchingModel]);
          } else {
            const [owner, name] = variationData.modelId.split("/");
            setSelectedModels([
              {
                url: "",
                owner: owner ?? "",
                name: name ?? "",
                description: null,
                cover_image_url: null,
                run_count: 0,
              },
            ]);
          }
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

      if (variationData.modelId !== selectedModelIdRef.current) {
        // Store params to restore after schema load clears them
        pendingVariationParamsRef.current = variationData.modelParams;
        // Find the matching CollectionModel in the collection, or create a minimal one
        const matchingModel = collectionModels.find(
          (m) => `${m.owner}/${m.name}` === variationData.modelId,
        );
        if (matchingModel) {
          setSelectedModels([matchingModel]);
        } else {
          const [owner, name] = variationData.modelId.split("/");
          setSelectedModels([
            {
              url: "",
              owner: owner ?? "",
              name: name ?? "",
              description: null,
              cover_image_url: null,
              run_count: 0,
            },
          ]);
        }
      } else {
        setParamValues(variationData.modelParams);
      }
    }

    clearVariation();
  }, [variationData, clearVariation, collectionModels, saveCurrentModeState]);

  // ----- Load schema on model change -----
  const loadSchema = useCallback(async (modelId: string) => {
    if (!modelId) {
      setSchema(null);
      setSchemaLoading(false);
      return;
    }
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

  // ----- Model trigger handlers -----
  const handleModelRemove = useCallback((model: CollectionModel) => {
    setSelectedModels((prev) =>
      prev.filter((m) => !(m.owner === model.owner && m.name === model.name)),
    );
  }, []);

  const handleBrowse = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleDrawerConfirm = useCallback((models: CollectionModel[]) => {
    setSelectedModels(models);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

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
      if (selectedModels.length === 0) return;

      startGeneration(async () => {
        const modelIds = selectedModels.map((m) => `${m.owner}/${m.name}`);
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelIds,
          params: isSingleModel ? paramValues : {},
          count: isSingleModel ? variantCount : 1,
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
      if (selectedModels.length === 0) return;

      startGeneration(async () => {
        const modelIds = selectedModels.map((m) => `${m.owner}/${m.name}`);
        const result = await generateImages({
          projectId,
          promptMotiv: promptMotiv.trim(),
          promptStyle: promptStyle.trim() || undefined,
          negativePrompt: negativePrompt.trim() || undefined,
          modelIds,
          params: isSingleModel ? paramValues : {},
          count: isSingleModel ? variantCount : 1,
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
    selectedModels,
    isSingleModel,
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

  // ---------------------------------------------------------------------------
  // Button disabled logic
  // ---------------------------------------------------------------------------

  const isButtonDisabled = (() => {
    if (isGenerating) return true;
    if (currentMode === "txt2img") return !promptMotiv.trim() || selectedModels.length === 0;
    if (currentMode === "img2img") return !sourceImageUrl || !promptMotiv.trim() || selectedModels.length === 0;
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
          {/* Model Trigger (replaces Select dropdown) — hidden in upscale mode */}
          {showModelSelector && (
            <div className="space-y-2">
              <Label>Model</Label>
              <ModelTrigger
                models={selectedModels}
                onRemove={handleModelRemove}
                onBrowse={handleBrowse}
              />
            </div>
          )}

          {/* Model Browser Drawer */}
          <ModelBrowserDrawer
            open={drawerOpen}
            models={collectionModels}
            selectedModels={selectedModels}
            isLoading={collectionLoading}
            error={collectionError}
            onConfirm={handleDrawerConfirm}
            onClose={handleDrawerClose}
            onRetry={fetchCollectionModels}
          />

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
                  modelDisplayName={selectedModelId}
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

              {/* Parameter Panel — only shown when exactly 1 model selected */}
              {isSingleModel && (
                <ParameterPanel
                  schema={schema}
                  isLoading={schemaLoading}
                  values={paramValues}
                  onChange={setParamValues}
                />
              )}

              {/* Multi-model notice */}
              {selectedModels.length > 1 && (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="multi-model-notice"
                >
                  Default parameters will be used for multi-model generation.
                </p>
              )}
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
            {/* Variant Count Selector — hidden in upscale mode, only when single model */}
            {showVariants && isSingleModel && (
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
