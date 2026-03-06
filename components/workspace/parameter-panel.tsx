"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Properties that are handled separately by PromptArea, not ParameterPanel */
const EXCLUDED_KEYS = new Set(["prompt", "negative_prompt"]);

/** Only render enum, integer, and number properties */
function isSupportedType(prop: SchemaProperty): boolean {
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
// Component
// ---------------------------------------------------------------------------

export function ParameterPanel({
  schema,
  isLoading,
  values,
  onChange,
}: ParameterPanelProps) {
  const filteredEntries = useMemo(() => {
    if (!schema) return [];
    return Object.entries(schema).filter(
      ([key, prop]) => !EXCLUDED_KEYS.has(key) && isSupportedType(prop)
    );
  }, [schema]);

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

  if (filteredEntries.length === 0) {
    return null;
  }

  function handleChange(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="space-y-4" data-testid="parameter-panel">
      {filteredEntries.map(([key, prop]) => {
        const label = prop.title || formatLabel(key);

        // Enum property -> Select dropdown
        if (prop.enum && prop.enum.length > 0) {
          const currentValue =
            (values[key] as string) ??
            (prop.default as string) ??
            prop.enum[0];

          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={`param-${key}`}>{label}</Label>
              <Select
                value={currentValue}
                onValueChange={(v) => handleChange(key, v)}
              >
                <SelectTrigger id={`param-${key}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prop.enum.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        // Integer / number property -> Slider
        if (prop.type === "integer" || prop.type === "number") {
          const min = prop.minimum ?? 0;
          const max = prop.maximum ?? 100;
          const defaultVal =
            typeof prop.default === "number" ? prop.default : min;
          const currentValue =
            typeof values[key] === "number"
              ? (values[key] as number)
              : defaultVal;
          const step = prop.type === "integer" ? 1 : 0.1;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`param-${key}`}>{label}</Label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {currentValue}
                </span>
              </div>
              <Slider
                id={`param-${key}`}
                min={min}
                max={max}
                step={step}
                value={[currentValue]}
                onValueChange={([v]) => handleChange(key, v)}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
