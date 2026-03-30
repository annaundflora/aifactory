"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowRightLeft, Minus, Plus } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { ReferenceBar } from "@/components/workspace/reference-bar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TierToggle } from "@/components/ui/tier-toggle";
import { ModelSlots } from "@/components/ui/model-slots";
import { ParameterPanel, type SchemaProperties } from "@/components/workspace/parameter-panel";
import { useModelSchema } from "@/lib/hooks/use-model-schema";
import { resolveActiveSlots } from "@/lib/utils/resolve-model";
import type {
  ReferenceRole,
  ReferenceStrength,
  ReferenceSlotData,
} from "@/lib/types/reference";
import type { GalleryDragPayload } from "@/lib/constants/drag-types";
import type { ModelSlot, Model } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Legacy Tier type (kept locally since removed from lib/types in slice-03)
// ---------------------------------------------------------------------------

/** @deprecated Tier type is deprecated. Use ModelSlot-based workflow instead. */
type Tier = "draft" | "quality" | "max";

/** @deprecated Legacy type kept for backward compat until consumers migrate to ModelSlot. */
type ModelSetting = {
  id: string;
  mode: string;
  tier: string;
  modelId: string;
  modelParams: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Legacy resolveModel (inline, since removed from resolve-model.ts in slice-03)
// ---------------------------------------------------------------------------

/** @deprecated Use resolveActiveSlots instead. Kept for legacy path only. */
function resolveModel(
  settings: ModelSetting[],
  mode: string,
  tier: string,
): { modelId: string; modelParams: Record<string, unknown> } | null {
  const setting = settings.find((s) => s.mode === mode && s.tier === tier);
  if (!setting) return null;
  return {
    modelId: setting.modelId,
    modelParams: (setting.modelParams ?? {}) as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Img2imgParams type (exported for slice-12 consumer)
// ---------------------------------------------------------------------------

export interface ReferenceInput {
  imageUrl: string;
  role: ReferenceRole;
  strength: ReferenceStrength;
}

export interface Img2imgParams {
  references: ReferenceInput[];
  motiv: string;
  style: string;
  variants: number;
  /** Active model IDs from model slots (new path). */
  modelIds: string[];
  /** @deprecated Use modelIds instead. Kept for legacy consumers until slice-12 migration. */
  tier?: Tier;
  imageParams?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REFERENCES = 5;
const VARIANTS_MIN = 1;
const VARIANTS_MAX = 4;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface Img2imgPopoverProps {
  onGenerate?: (params: Img2imgParams) => void;
  /** Model slots for the new ModelSlots-based workflow. Optional for backward compat. */
  modelSlots?: ModelSlot[];
  /** Available models for dropdown population. Optional for backward compat. */
  models?: Model[];
  /** @deprecated Use modelSlots + models instead. Kept for legacy consumers until slice-12. */
  modelSettings?: ModelSetting[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Img2imgPopover({
  onGenerate,
  modelSlots,
  models,
  modelSettings = [],
}: Img2imgPopoverProps) {
  const { state, dispatch } = useCanvasDetail();

  // Determine whether to use the new ModelSlots path or the legacy TierToggle path
  const useNewPath = modelSlots !== undefined && models !== undefined;

  // Local state for references, prompt fields, and variants
  const [slots, setSlots] = useState<ReferenceSlotData[]>([]);
  const [motiv, setMotiv] = useState("");
  const [style, setStyle] = useState("");
  const [variants, setVariants] = useState(1);

  // Legacy-only state
  const [tier, setTier] = useState<Tier>("draft");
  const [imageParams, setImageParams] = useState<Record<string, unknown>>({});

  // Legacy path: resolve modelId from settings for schema fetching
  const resolved = !useNewPath ? resolveModel(modelSettings, "img2img", tier) : null;
  const { schema, isLoading, error } = useModelSchema(
    !useNewPath ? resolved?.modelId : undefined,
  );

  // Reset imageParams when tier/model changes (legacy path only)
  useEffect(() => {
    if (!useNewPath) {
      setImageParams({});
    }
  }, [resolved?.modelId, useNewPath]);

  // Track all blob URLs we create so we can revoke them on unmount
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // Cleanup all blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  const isOpen = state.activeToolId === "img2img";

  // -------------------------------------------------------------------------
  // Popover open/close
  // -------------------------------------------------------------------------

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isOpen) {
        // Close the popover by toggling the active tool off
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: "img2img" });
      }
    },
    [isOpen, dispatch]
  );

  // -------------------------------------------------------------------------
  // Reference slot management
  // -------------------------------------------------------------------------

  const handleAddReference = useCallback(
    (file: File, position: number) => {
      const objectUrl = URL.createObjectURL(file);
      blobUrlsRef.current.add(objectUrl);

      const newSlot: ReferenceSlotData = {
        id: `ref-${crypto.randomUUID()}`,
        imageUrl: objectUrl,
        slotPosition: position,
        role: "general" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
        originalFilename: file.name,
      };
      setSlots((prev) => {
        if (prev.length >= MAX_REFERENCES) {
          // Revoke the URL we just created since we won't use it
          URL.revokeObjectURL(objectUrl);
          blobUrlsRef.current.delete(objectUrl);
          return prev;
        }
        return [...prev, newSlot];
      });
    },
    []
  );

  const handleRemoveReference = useCallback((slotPosition: number) => {
    setSlots((prev) => {
      const slot = prev.find((s) => s.slotPosition === slotPosition);
      if (slot && slot.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(slot.imageUrl);
        blobUrlsRef.current.delete(slot.imageUrl);
      }
      return prev.filter((s) => s.slotPosition !== slotPosition);
    });
  }, []);

  const handleRoleChange = useCallback(
    (slotPosition: number, role: ReferenceRole) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.slotPosition === slotPosition ? { ...s, role } : s
        )
      );
    },
    []
  );

  const handleStrengthChange = useCallback(
    (slotPosition: number, strength: ReferenceStrength) => {
      setSlots((prev) =>
        prev.map((s) =>
          s.slotPosition === slotPosition ? { ...s, strength } : s
        )
      );
    },
    []
  );

  const handleUpload = useCallback(
    async (file: File, slotPosition: number) => {
      // Create a temporary slot with object URL for immediate feedback
      const objectUrl = URL.createObjectURL(file);
      blobUrlsRef.current.add(objectUrl);

      const tempSlot: ReferenceSlotData = {
        id: `ref-${crypto.randomUUID()}`,
        imageUrl: objectUrl,
        slotPosition,
        role: "general" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
        originalFilename: file.name,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          // Revoke old blob URL when replacing
          if (existing.imageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(existing.imageUrl);
            blobUrlsRef.current.delete(existing.imageUrl);
          }
          return prev.map((s) =>
            s.slotPosition === slotPosition ? tempSlot : s
          );
        }
        if (prev.length >= MAX_REFERENCES) {
          URL.revokeObjectURL(objectUrl);
          blobUrlsRef.current.delete(objectUrl);
          return prev;
        }
        return [...prev, tempSlot];
      });
    },
    []
  );

  const handleUploadUrl = useCallback(
    (url: string, slotPosition: number) => {
      const newSlot: ReferenceSlotData = {
        id: `ref-${crypto.randomUUID()}`,
        imageUrl: url,
        slotPosition,
        role: "general" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          if (existing.imageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(existing.imageUrl);
            blobUrlsRef.current.delete(existing.imageUrl);
          }
          return prev.map((s) =>
            s.slotPosition === slotPosition ? newSlot : s
          );
        }
        if (prev.length >= MAX_REFERENCES) return prev;
        return [...prev, newSlot];
      });
    },
    []
  );

  const handleGalleryDrop = useCallback(
    (data: GalleryDragPayload, slotPosition: number) => {
      const newSlot: ReferenceSlotData = {
        id: `ref-${crypto.randomUUID()}`,
        imageUrl: data.imageUrl,
        slotPosition,
        role: "general" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          if (existing.imageUrl.startsWith("blob:")) {
            URL.revokeObjectURL(existing.imageUrl);
            blobUrlsRef.current.delete(existing.imageUrl);
          }
          return prev.map((s) =>
            s.slotPosition === slotPosition ? newSlot : s
          );
        }
        if (prev.length >= MAX_REFERENCES) return prev;
        return [...prev, newSlot];
      });
    },
    []
  );

  // -------------------------------------------------------------------------
  // Variants counter
  // -------------------------------------------------------------------------

  const handleDecrement = useCallback(() => {
    setVariants((prev) => Math.max(VARIANTS_MIN, prev - 1));
  }, []);

  const handleIncrement = useCallback(() => {
    setVariants((prev) => Math.min(VARIANTS_MAX, prev + 1));
  }, []);


  // -------------------------------------------------------------------------
  // Generate
  // -------------------------------------------------------------------------

  const handleGenerate = useCallback(() => {
    const references = slots.map((s) => ({
      imageUrl: s.imageUrl,
      role: s.role,
      strength: s.strength,
    }));

    if (useNewPath && modelSlots) {
      // New path: collect active slot modelIds via resolveActiveSlots
      const activeSlots = resolveActiveSlots(modelSlots, "img2img");
      const modelIds = activeSlots.map((s) => s.modelId);

      const params: Img2imgParams = {
        references,
        motiv,
        style,
        variants,
        modelIds,
        imageParams: undefined,
      };
      onGenerate?.(params);
    } else {
      // Legacy path: use tier
      const params: Img2imgParams = {
        references,
        motiv,
        style,
        variants,
        modelIds: [],
        tier,
        imageParams,
      };
      onGenerate?.(params);
    }
  }, [slots, motiv, style, variants, tier, imageParams, onGenerate, useNewPath, modelSlots]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Anchor is invisible -- positioned where the toolbar icon is */}
      <PopoverAnchor asChild>
        <span
          data-testid="img2img-popover-anchor"
          className="pointer-events-none absolute left-0 h-10 w-px"
          style={{ top: 48 }}
        />
      </PopoverAnchor>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-96 max-h-[80vh] overflow-y-auto p-4"
        data-testid="img2img-popover"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-4">
          {/* ---- Header ---- */}
          <PopoverHeader>
            <PopoverTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-4" />
              Image to Image
            </PopoverTitle>
          </PopoverHeader>

          {/* ---- References Section ---- */}
          <section data-testid="references-section">
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              data-testid="references-header"
            >
              References [{slots.length}/{MAX_REFERENCES}]
            </h3>
            <ReferenceBar
              slots={slots}
              onAdd={handleAddReference}
              onRemove={handleRemoveReference}
              onRoleChange={handleRoleChange}
              onStrengthChange={handleStrengthChange}
              onUpload={handleUpload}
              onUploadUrl={handleUploadUrl}
              onGalleryDrop={handleGalleryDrop}
            />
          </section>

          {/* ---- Prompt Section ---- */}
          <section data-testid="prompt-section">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prompt
            </h3>

            <div className="flex flex-col gap-3">
              {/* Motiv (required) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="img2img-motiv">
                  Motiv <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="img2img-motiv"
                  placeholder="Describe the main subject..."
                  value={motiv}
                  onChange={(e) => setMotiv(e.target.value)}
                  required
                  data-testid="motiv-textarea"
                  className="min-h-[60px] resize-none"
                />
              </div>

              {/* Style / Modifier (optional) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="img2img-style">Style / Modifier</Label>
                <Textarea
                  id="img2img-style"
                  placeholder="Style, mood, technique..."
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  data-testid="style-textarea"
                  className="min-h-[60px] resize-none"
                />
              </div>
            </div>
          </section>

          {/* ---- Variants Section ---- */}
          <section data-testid="variants-section">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variants
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={handleDecrement}
                disabled={variants <= VARIANTS_MIN}
                aria-label="Decrease variants"
                data-testid="variants-minus"
              >
                <Minus className="size-3" />
              </Button>
              <span
                className="min-w-[2ch] text-center text-sm font-medium tabular-nums"
                data-testid="variants-value"
              >
                {variants}
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={handleIncrement}
                disabled={variants >= VARIANTS_MAX}
                aria-label="Increase variants"
                data-testid="variants-plus"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </section>

          {/* ---- Model Selection: New Path (ModelSlots) or Legacy Path (TierToggle) ---- */}
          {useNewPath && modelSlots && models ? (
            /* New path: ModelSlots replaces TierToggle and separate ParameterPanel */
            <section data-testid="model-slots-section">
              <ModelSlots
                mode="img2img"
                slots={modelSlots}
                models={models}
                variant="stacked"
                disabled={state.isGenerating}
              />
            </section>
          ) : (
            /* Legacy path: TierToggle + separate ParameterPanel */
            <>
              <section data-testid="tier-section">
                <div className="space-y-2">
                  <TierToggle
                    tier={tier}
                    onTierChange={setTier}
                    disabled={state.isGenerating}
                  />
                </div>
              </section>

              {/* ---- Parameter Controls (schema-based, legacy path only) ---- */}
              {!error && (
                <section data-testid="parameter-section">
                  <ParameterPanel
                    schema={schema as SchemaProperties | null}
                    isLoading={isLoading}
                    values={imageParams}
                    onChange={setImageParams}
                    primaryFields={["aspect_ratio", "megapixels", "resolution"]}
                  />
                </section>
              )}
            </>
          )}

          {/* ---- Generate Button ---- */}
          <Button
            onClick={handleGenerate}
            className="w-full"
            data-testid="generate-button"
          >
            Generate
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
