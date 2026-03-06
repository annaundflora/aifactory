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
import { MODELS } from "@/lib/models";
import { getModelSchema } from "@/app/actions/models";
import { generateImages } from "@/app/actions/generations";
import { useWorkspaceVariation } from "@/lib/workspace-state";
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
import { Loader2 } from "lucide-react";

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

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `$${price.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptArea({ projectId, onGenerationsCreated }: PromptAreaProps) {
  // ----- Model state -----
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);

  // ----- Schema state -----
  const [schema, setSchema] = useState<SchemaProperties | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);

  // ----- Prompt state -----
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // ----- Parameter state -----
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  // ----- Variant count -----
  const [variantCount, setVariantCount] = useState(1);

  // ----- Generation state -----
  const [isGenerating, startGeneration] = useTransition();

  // ----- Variation state consumption -----
  const { variationData, clearVariation } = useWorkspaceVariation();
  const pendingVariationParamsRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!variationData) return;

    setPrompt(variationData.prompt);
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

  // ----- Auto-resize textarea -----
  const handlePromptChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    },
    []
  );

  // ----- Generate handler -----
  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;

    startGeneration(async () => {
      const result = await generateImages({
        projectId,
        prompt: prompt.trim(),
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
    prompt,
    negativePrompt,
    selectedModelId,
    paramValues,
    variantCount,
    projectId,
    onGenerationsCreated,
  ]);

  // ----- Keyboard shortcut (Cmd/Ctrl+Enter) -----
  const handleKeyDown = useCallback(
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

  return (
    <div className="space-y-4" data-testid="prompt-area">
      {/* Model Dropdown */}
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

      {/* Prompt Textarea */}
      <div className="space-y-2">
        <Label htmlFor="prompt-textarea">Prompt</Label>
        <textarea
          id="prompt-textarea"
          data-testid="prompt-textarea"
          ref={promptRef}
          value={prompt}
          onChange={handlePromptChange}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to generate..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden"
        />
      </div>

      {/* Negative Prompt (conditionally visible) */}
      {hasNegativePrompt && (
        <div className="space-y-2">
          <Label htmlFor="negative-prompt-textarea">Negative Prompt</Label>
          <textarea
            id="negative-prompt-textarea"
            data-testid="negative-prompt-textarea"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="What to avoid in the image..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none"
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
          disabled={isGenerating}
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
  );
}
