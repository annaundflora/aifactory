"use client";

import { useState, useCallback, useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { useCanvasDetail } from "@/lib/canvas-detail-context";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { ReferenceBar } from "@/components/workspace/reference-bar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getLowestFreePosition } from "@/components/workspace/reference-bar";
import { uploadSourceImage } from "@/app/actions/upload";
import type { Generation } from "@/lib/db/queries";
import type {
  ReferenceRole,
  ReferenceStrength,
  ReferenceSlotData,
} from "@/lib/types/reference";
import type { GalleryDragPayload } from "@/lib/constants/drag-types";

// ---------------------------------------------------------------------------
// Img2imgParams type (exported for slice-14 consumer)
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
  generation: Generation;
  onGenerate?: (params: Img2imgParams) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Img2imgPopover({
  generation,
  onGenerate,
}: Img2imgPopoverProps) {
  const { state, dispatch } = useCanvasDetail();

  // Local state for references, prompt fields, and variants
  const [slots, setSlots] = useState<ReferenceSlotData[]>([]);
  const [motiv, setMotiv] = useState("");
  const [style, setStyle] = useState("");
  const [variants, setVariants] = useState(1);

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
      if (slots.length >= MAX_REFERENCES) return;

      const objectUrl = URL.createObjectURL(file);
      const newSlot: ReferenceSlotData = {
        id: `ref-${Date.now()}-${position}`,
        imageUrl: objectUrl,
        slotPosition: position,
        role: "style" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
        originalFilename: file.name,
      };
      setSlots((prev) => [...prev, newSlot]);
    },
    [slots.length]
  );

  const handleRemoveReference = useCallback((slotPosition: number) => {
    setSlots((prev) => prev.filter((s) => s.slotPosition !== slotPosition));
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
      if (slots.length >= MAX_REFERENCES && !slots.find((s) => s.slotPosition === slotPosition)) return;

      // Create a temporary slot with object URL for immediate feedback
      const objectUrl = URL.createObjectURL(file);
      const tempSlot: ReferenceSlotData = {
        id: `ref-${Date.now()}-${slotPosition}`,
        imageUrl: objectUrl,
        slotPosition,
        role: "style" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
        originalFilename: file.name,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          return prev.map((s) =>
            s.slotPosition === slotPosition ? tempSlot : s
          );
        }
        return [...prev, tempSlot];
      });
    },
    [slots]
  );

  const handleUploadUrl = useCallback(
    (url: string, slotPosition: number) => {
      if (slots.length >= MAX_REFERENCES && !slots.find((s) => s.slotPosition === slotPosition)) return;

      const newSlot: ReferenceSlotData = {
        id: `ref-${Date.now()}-${slotPosition}`,
        imageUrl: url,
        slotPosition,
        role: "style" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          return prev.map((s) =>
            s.slotPosition === slotPosition ? newSlot : s
          );
        }
        return [...prev, newSlot];
      });
    },
    [slots]
  );

  const handleGalleryDrop = useCallback(
    (data: GalleryDragPayload, slotPosition: number) => {
      if (slots.length >= MAX_REFERENCES && !slots.find((s) => s.slotPosition === slotPosition)) return;

      const newSlot: ReferenceSlotData = {
        id: `ref-${Date.now()}-${slotPosition}`,
        imageUrl: data.imageUrl,
        slotPosition,
        role: "style" as ReferenceRole,
        strength: "moderate" as ReferenceStrength,
      };

      setSlots((prev) => {
        const existing = prev.find((s) => s.slotPosition === slotPosition);
        if (existing) {
          return prev.map((s) =>
            s.slotPosition === slotPosition ? newSlot : s
          );
        }
        return [...prev, newSlot];
      });
    },
    [slots]
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
    const params: Img2imgParams = {
      references: slots.map((s) => ({
        imageUrl: s.imageUrl,
        role: s.role,
        strength: s.strength,
      })),
      motiv,
      style,
      variants,
    };
    onGenerate?.(params);
  }, [slots, motiv, style, variants, onGenerate]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      {/* Anchor is invisible -- positioned where the toolbar icon is */}
      <PopoverAnchor asChild>
        <span className="sr-only" />
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
