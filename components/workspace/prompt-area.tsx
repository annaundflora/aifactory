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
import { generateImages } from "@/app/actions/generations";
import { useWorkspaceVariation } from "@/lib/workspace-state";
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
// Helpers
// ---------------------------------------------------------------------------

const VARIANT_OPTIONS = [1, 2, 3, 4] as const;

/** Auto-resize a textarea to fit its content. */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptArea({ projectId, onGenerationsCreated }: PromptAreaProps) {
  // ----- Model state (multi-model) -----
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

  // ----- Variation handling -----
  useEffect(() => {
    if (!variationData) return;

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
        // Fallback: create a minimal CollectionModel from the modelId
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

    clearVariation();
  }, [variationData, clearVariation, collectionModels]);

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
        setSchema(result.properties as SchemaProperties);
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

  // ----- Generate handler -----
  const handleGenerate = useCallback(() => {
    if (!promptMotiv.trim()) return;
    if (selectedModels.length === 0) return;

    startGeneration(async () => {
      // Map selectedModels to modelIds
      const modelIds = selectedModels.map((m) => `${m.owner}/${m.name}`);
      const result = await generateImages({
        projectId,
        promptMotiv: promptMotiv.trim(),
        promptStyle: promptStyle.trim() || undefined,
        negativePrompt: negativePrompt.trim() || undefined,
        modelIds,
        params: isSingleModel ? paramValues : {},
        count: isSingleModel ? variantCount : 1,
      });
      if (Array.isArray(result)) {
        onGenerationsCreated?.(result);
      }
    });
  }, [
    promptMotiv,
    promptStyle,
    negativePrompt,
    selectedModels,
    isSingleModel,
    paramValues,
    variantCount,
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

  // Shared textarea class
  const textareaClass =
    "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden";

  return (
    <div className="space-y-4" data-testid="prompt-area">
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
          {/* Model Trigger (replaces Select dropdown) */}
          <div className="space-y-2">
            <Label>Model</Label>
            <ModelTrigger
              models={selectedModels}
              onRemove={handleModelRemove}
              onBrowse={handleBrowse}
            />
          </div>

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

          {/* Bottom row: Variant Count + Generate Button */}
          <div className="flex items-center gap-3">
            {/* Variant Count Selector — only shown when exactly 1 model selected */}
            {isSingleModel && (
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

            {/* Generate Button */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !promptMotiv.trim() || selectedModels.length === 0}
              className="ml-auto"
              data-testid="generate-button"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </div>
      </PromptTabs>
    </div>
  );
}
