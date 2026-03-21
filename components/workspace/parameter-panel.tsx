"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchemaProperty {
  type?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  title?: string;
  description?: string;
}

export type SchemaProperties = Record<string, SchemaProperty>;

interface ParameterPanelProps {
  schema: SchemaProperties | null;
  isLoading: boolean;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  /** Field names to show in the always-visible Primary section */
  primaryFields?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default primary fields shown in the always-visible section */
const DEFAULT_PRIMARY_FIELDS = ["aspect_ratio", "megapixels", "resolution"];

/**
 * Internal fields that are set programmatically and must NOT appear in the UI.
 * Covers: prompt fields, image input fields, img2img control fields,
 * inpainting fields, backend-only fields, and API keys.
 */
const INTERNAL_FIELDS = new Set([
  // Prompt fields
  "prompt",
  "negative_prompt",
  // Image input fields
  "image",
  "image_url",
  "input_image",
  "reference_image",
  "reference_image_url",
  "control_image",
  "control_image_url",
  "subject_image",
  "subject_image_url",
  "style_image",
  "style_image_url",
  "mask",
  "mask_image",
  "mask_url",
  // img2img control fields
  "prompt_strength",
  "strength",
  // Inpainting fields
  "inpaint_prompt",
  "inpaint_strength",
  // Backend-only fields
  "seed",
  "num_outputs",
  "num_images",
  "output_format",
  "output_quality",
  "disable_safety_checker",
  "safety_checker",
  "go_fast",
  "webhook",
  "webhook_events_filter",
  // API keys
  "api_key",
  "replicate_api_token",
]);

/** Common aspect ratio values shown first when grouping is active */
const COMMON_ASPECT_RATIOS = new Set([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter out internal fields, unsupported types, and type-based exclusions */
function isVisibleField(key: string, prop: SchemaProperty): boolean {
  // Exclude internal fields
  if (INTERNAL_FIELDS.has(key)) return false;

  // Type-based exclusions: string without enum
  if (prop.type === "string" && (!prop.enum || prop.enum.length === 0)) {
    return false;
  }

  // Type-based exclusions: boolean
  if (prop.type === "boolean") return false;

  // Type-based exclusions: array without enum
  if (prop.type === "array" && (!prop.enum || prop.enum.length === 0)) {
    return false;
  }

  // Only render enum, integer, and number properties
  if (prop.enum && prop.enum.length > 0) return true;
  if (prop.type === "integer" || prop.type === "number") return true;

  return false;
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderEnumSelect(
  key: string,
  prop: SchemaProperty,
  currentValue: string,
  onValueChange: (key: string, value: unknown) => void,
) {
  const label = prop.title || formatLabel(key);
  const enumValues = prop.enum!;

  // Aspect ratio grouping: if key is aspect_ratio and >8 values, group them
  const needsGrouping = key === "aspect_ratio" && enumValues.length > 8;

  return (
    <div key={key} className="space-y-2">
      <Label htmlFor={`param-${key}`}>{label}</Label>
      <Select
        value={currentValue}
        onValueChange={(v) => onValueChange(key, v)}
      >
        <SelectTrigger id={`param-${key}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {needsGrouping ? (
            <>
              <SelectGroup>
                {enumValues
                  .filter((v) => COMMON_ASPECT_RATIOS.has(v))
                  .map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                {enumValues
                  .filter((v) => !COMMON_ASPECT_RATIOS.has(v))
                  .map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </>
          ) : (
            enumValues.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function renderNumberInput(
  key: string,
  prop: SchemaProperty,
  currentValue: number,
  onValueChange: (key: string, value: unknown) => void,
) {
  const label = prop.title || formatLabel(key);
  const min = prop.minimum ?? 0;
  const max = prop.maximum ?? 100;
  const step = prop.type === "integer" ? 1 : 0.1;

  return (
    <div key={key} className="space-y-2">
      <Label htmlFor={`param-${key}`}>{label}</Label>
      <Input
        id={`param-${key}`}
        type="number"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={(e) => {
          const val =
            prop.type === "integer"
              ? parseInt(e.target.value, 10)
              : parseFloat(e.target.value);
          if (!isNaN(val)) onValueChange(key, val);
        }}
        className="w-full"
      />
    </div>
  );
}

function renderField(
  key: string,
  prop: SchemaProperty,
  values: Record<string, unknown>,
  onValueChange: (key: string, value: unknown) => void,
) {
  // Enum property -> Select dropdown
  if (prop.enum && prop.enum.length > 0) {
    const currentValue =
      (values[key] as string) ??
      (prop.default as string) ??
      prop.enum[0];

    return renderEnumSelect(key, prop, currentValue, onValueChange);
  }

  // Integer / number property -> Input
  if (prop.type === "integer" || prop.type === "number") {
    const min = prop.minimum ?? 0;
    const defaultVal =
      typeof prop.default === "number" ? prop.default : min;
    const currentValue =
      typeof values[key] === "number"
        ? (values[key] as number)
        : defaultVal;

    return renderNumberInput(key, prop, currentValue, onValueChange);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ParameterPanel({
  schema,
  isLoading,
  values,
  onChange,
  primaryFields = DEFAULT_PRIMARY_FIELDS,
}: ParameterPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { primary, advanced } = useMemo(() => {
    if (!schema) return { primary: [], advanced: [] };

    const primarySet = new Set(primaryFields);
    const primaryEntries: [string, SchemaProperty][] = [];
    const advancedEntries: [string, SchemaProperty][] = [];

    for (const [key, prop] of Object.entries(schema)) {
      if (!isVisibleField(key, prop)) continue;

      if (primarySet.has(key)) {
        primaryEntries.push([key, prop]);
      } else {
        advancedEntries.push([key, prop]);
      }
    }

    return { primary: primaryEntries, advanced: advancedEntries };
  }, [schema, primaryFields]);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="parameter-panel-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (primary.length === 0 && advanced.length === 0) {
    return null;
  }

  function handleChange(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4" data-testid="parameter-panel">
      {/* Primary fields - always visible, 2-column grid */}
      {primary.length > 0 && (
        <div className="grid grid-cols-2 gap-4" data-testid="parameter-panel-primary">
          {primary.map(([key, prop]) => renderField(key, prop, values, handleChange))}
        </div>
      )}

      {/* Advanced fields - collapsible */}
      {advanced.length > 0 && (
        <Collapsible
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          data-testid="parameter-panel-advanced"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
              data-testid="parameter-panel-advanced-toggle"
            >
              <span>Advanced</span>
              <ChevronDown
                className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-4 pt-2">
              {advanced.map(([key, prop]) => renderField(key, prop, values, handleChange))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
