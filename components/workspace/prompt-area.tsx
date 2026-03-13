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
import { getModelSchema, getCollectionModels, getProjectSelectedModels, saveProjectSelectedModels } from "@/app/actions/models";
import { generateImages, upscaleImage } from "@/app/actions/generations";
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
import {
  ParameterPanel,
  type SchemaProperties,
} from "@/components/workspace/parameter-panel";
import { Loader2, Sparkles, Minus, Plus, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { LLMComparison } from "@/components/prompt-improve/llm-comparison";
import { type CollectionModel } from "@/lib/types/collection-model";
import { ModelTrigger } from "@/components/models/model-trigger";
import { ModelBrowserDrawer } from "@/components/models/model-browser-drawer";
import { AssistantTrigger } from "@/components/assistant/assistant-trigger";
import { AssistantSheet } from "@/components/assistant/assistant-sheet";
import { Startscreen } from "@/components/assistant/startscreen";
import { ChatInput } from "@/components/assistant/chat-input";
import { ChatThread } from "@/components/assistant/chat-thread";
import { PromptCanvas } from "@/components/assistant/prompt-canvas";
import { SessionList } from "@/components/assistant/session-list";
import { SessionSwitcher } from "@/components/assistant/session-switcher";
import {
  ModelSelector,
  DEFAULT_MODEL_SLUG,
} from "@/components/assistant/model-selector";
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
  const styleRef = useRef<HTMLTextAreaElement>(null);
  const negativeRef = useRef<HTMLTextAreaElement>(null);

  // ----- Parameter state -----
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

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
        // Initialize selectedModels: load from DB, fallback to preferred default
        setSelectedModels((prev) => {
          if (prev.length === 0 && result.length > 0) {
            const preferred = result.find(
              (m) => m.owner === "bytedance" && m.name === "seedream-4.5"
            );
            return [preferred ?? result[0]];
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

  // Load saved model selection from DB, then fetch collection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [savedModelIds, collectionResult] = await Promise.all([
          getProjectSelectedModels({ projectId }),
          getCollectionModels(),
        ]);
        if (cancelled) return;

        if (Array.isArray(collectionResult)) {
          setCollectionModels(collectionResult);

          if (savedModelIds.length > 0) {
            // Resolve saved IDs to CollectionModel objects
            const resolved = savedModelIds
              .map((id) => collectionResult.find((m) => `${m.owner}/${m.name}` === id))
              .filter((m): m is CollectionModel => m !== undefined);
            if (resolved.length > 0) {
              setSelectedModels(resolved);
            } else {
              // Saved models no longer in collection — use default
              const preferred = collectionResult.find(
                (m) => m.owner === "bytedance" && m.name === "seedream-4.5"
              );
              setSelectedModels([preferred ?? collectionResult[0]]);
            }
          } else {
            // No saved selection — use default
            const preferred = collectionResult.find(
              (m) => m.owner === "bytedance" && m.name === "seedream-4.5"
            );
            if (collectionResult.length > 0) {
              setSelectedModels([preferred ?? collectionResult[0]]);
            }
          }
        } else {
          setCollectionError(collectionResult.error);
        }
      } catch {
        setCollectionError("Failed to load models");
      } finally {
        if (!cancelled) setCollectionLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

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
    selectedModelId,
    paramValues,
    variantCount,
    referenceSlots,
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
            created_at: "",
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
          setReferenceSlots(snapshot.img2img.referenceSlots);
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
          setReferenceSlots(s.referenceSlots);
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
        if (!snapshot.upscale.sourceImageUrl && referenceSlots.length > 0) {
          // Use the first reference slot's image as the upscale source
          setUpscaleSourceImageUrl(referenceSlots[0].imageUrl);
        }
      } else if (currentMode === "upscale" && targetMode === "img2img") {
        // Upscale -> img2img: referenceSlots are restored from snapshot already
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
      referenceSlots,
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

    // Skip addReference-only payloads — they are handled by the dedicated
    // addReference useEffect below. Without this guard the else-branch would
    // set promptMotiv to undefined (corrupting the current prompt) and call
    // clearVariation() before the addReference useEffect ever runs.
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
                role: "content" as ReferenceRole,
                strength: "moderate" as ReferenceStrength,
              },
            ]);
          }
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
                created_at: "",
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
              created_at: "",
            },
          ]);
        }
      } else {
        setParamValues(variationData.modelParams);
      }
    }

    clearVariation();
  }, [variationData, clearVariation, collectionModels, saveCurrentModeState, referenceSlots]);

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
          role: "content" as ReferenceRole,
          strength: "moderate" as ReferenceStrength,
        },
      ];
    });

    clearVariation();
  }, [variationData?.addReference, clearVariation, currentMode, saveCurrentModeState]);

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
    const modelIds = models.map((m) => `${m.owner}/${m.name}`);
    saveProjectSelectedModels({ projectId, modelIds }).catch(() => {
      // Silently fail — UI state is already updated
    });
  }, [projectId]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

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
            role: "content" as ReferenceRole,
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
              role: "content" as ReferenceRole,
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
              role: "content" as ReferenceRole,
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
            role: "content" as ReferenceRole,
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
      if (!promptMotiv.trim()) return;
      if (selectedModels.length === 0) return;

      // AC-9: Pass referenceSlots data to generateImages
      // AC-10: If no references, generate without them (backwards compat)
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

      // Backwards compat: use first reference as sourceImageUrl if present
      const sourceImageUrl = filledSlots.length > 0 ? filledSlots[0].imageUrl : undefined;

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
          references,
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
    referenceSlots,
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
    if (currentMode === "img2img") return !promptMotiv.trim() || selectedModels.length === 0;
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
  const showImageDropzone = currentMode === "upscale";
  const showReferenceBar = true; // Always rendered; hidden via CSS when not img2img

  // Shared textarea class
  const textareaClass =
    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden";

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
        <div className="space-y-3 pt-2">
          {/* ── Group: Model Selection ── */}
          {showModelSelector && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Model
              </Label>
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
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source Image
              </Label>
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
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt
              </Label>

              {/* Motiv Textarea (required) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-motiv-textarea" className="text-sm">
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
                {/* Prompt Tools */}
                <div className="flex gap-2">
                  <AssistantTrigger
                    isOpen={assistantOpen}
                    onClick={handleAssistantToggle}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowImprove(true)}
                    disabled={!promptMotiv.trim() || showImprove}
                    data-testid="improve-btn"
                  >
                    <Sparkles className="mr-1 size-3" />
                    Improve
                  </Button>
                </div>
              </div>

              {/* Style / Modifier Textarea (optional) */}
              <div className="space-y-2">
                <Label htmlFor="prompt-style-textarea" className="text-sm">Style / Modifier</Label>
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

              {/* Negative Prompt (conditionally visible based on model schema) */}
              {hasNegativePrompt && (
                <div className="space-y-2">
                  <Label htmlFor="negative-prompt-textarea" className="text-sm">Negative Prompt</Label>
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
            </div>
          )}

          {/* ── Group: Parameters (collapsible, default closed) ── */}
          {showPromptFields && isSingleModel && schema && !schemaLoading && (
            <Collapsible defaultOpen={false} className="group rounded-lg border border-border/60 bg-muted/30">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pointer-events-none">
                  Parameters
                </Label>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3">
                <ParameterPanel
                  schema={schema}
                  isLoading={schemaLoading}
                  values={paramValues}
                  onChange={setParamValues}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Multi-model notice */}
          {showPromptFields && selectedModels.length > 1 && (
            <p
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
              data-testid="multi-model-notice"
            >
              Default parameters will be used for multi-model generation.
            </p>
          )}

          {/* Upscale mode: Scale selector */}
          {currentMode === "upscale" && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                Scale
              </Label>
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

          {/* ── Action Bar: Variants + Generate ── */}
          <div className="space-y-2.5">
            {/* Variant Count Stepper — hidden in upscale mode, only when single model */}
            {showVariants && isSingleModel && (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <Label className="text-xs text-muted-foreground">
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
              className="w-full h-11 text-base font-semibold tracking-wide"
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
