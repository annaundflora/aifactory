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
import { getModelSchema } from "@/app/actions/models";
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
  // ----- Model state -----
  const [selectedModelId, setSelectedModelId] = useState("black-forest-labs/flux-1.1-pro");

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

  useEffect(() => {
    if (!variationData) return;

    setPromptMotiv(variationData.promptMotiv);
    setPromptStyle(variationData.promptStyle ?? "");
    setNegativePrompt(variationData.negativePrompt ?? "");

    if (variationData.modelId !== selectedModelId) {
      // Store params to restore after schema load clears them
      pendingVariationParamsRef.current = variationData.modelParams;
      setSelectedModelId(variationData.modelId);
    } else {
      setParamValues(variationData.modelParams);
    }

    clearVariation();
  }, [variationData, clearVariation, selectedModelId]);

  // ----- Load schema on model change -----
  const loadSchema = useCallback(async (modelId: string) => {
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

  // ----- Generate handler -----
  const handleGenerate = useCallback(() => {
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
      });
      if (Array.isArray(result)) {
        onGenerationsCreated?.(result);
      }
    });
  }, [
    promptMotiv,
    promptStyle,
    negativePrompt,
    selectedModelId,
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
          {/* Model selector placeholder — replaced in slice-10 */}
          <div className="space-y-2">
            <Label htmlFor="model-select">Model</Label>
            <select
              id="model-select"
              data-testid="model-select"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
            >
              <option value={selectedModelId}>{selectedModelId}</option>
            </select>
          </div>

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

          {/* Parameter Panel */}
          <ParameterPanel
            schema={schema}
            isLoading={schemaLoading}
            values={paramValues}
            onChange={setParamValues}
          />

          {/* Bottom row: Variant Count + Generate Button */}
          <div className="flex items-center gap-3">
            {/* Variant Count Selector */}
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

            {/* Generate Button */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !promptMotiv.trim()}
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
