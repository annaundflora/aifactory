"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { ReferenceSlotData } from "@/lib/types/reference";
import type { GenerationMode } from "@/components/workspace/mode-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceVariationState {
  promptMotiv: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  targetMode?: string;
  sourceImageUrl?: string;
  strength?: number;
  sourceGenerationId?: string;
  /** Used by Lightbox "Use as Reference" button (slice-16) to add a reference image */
  addReference?: { imageUrl: string; generationId?: string };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface WorkspaceVariationContextValue {
  variationData: WorkspaceVariationState | null;
  setVariation: (data: WorkspaceVariationState) => void;
  clearVariation: () => void;
  /**
   * Slice 22: reactive mirror of the active img2img reference slots.
   * Hochgehoben aus `prompt-area.tsx` damit der `<MultimodalIndicator />`
   * (und künftige Subscriber) reaktiv auf Slot-Änderungen reagieren können
   * — der existierende `referenceSlotsRef` (Slice 19) ist nur für den
   * Sender und löst KEIN Re-Render aus.
   */
  referenceSlots: ReferenceSlotData[];
  setReferenceSlots: (
    next:
      | ReferenceSlotData[]
      | ((prev: ReferenceSlotData[]) => ReferenceSlotData[])
  ) => void;
  /**
   * Slice 22: reactive mirror of the workspace generation mode. Hochgehoben
   * aus `prompt-area.tsx` damit Subscriber den Modus-Gate (txt2img/img2img/
   * upscale) ohne Prop-Drilling beobachten können. Mirror zum bestehenden
   * `generationModeRef` (nicht reaktiv).
   */
  generationMode: GenerationMode;
  setGenerationMode: (
    next: GenerationMode | ((prev: GenerationMode) => GenerationMode)
  ) => void;
}

const WorkspaceVariationContext =
  createContext<WorkspaceVariationContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkspaceStateProvider({ children }: { children: ReactNode }) {
  const [variationData, setVariationData] =
    useState<WorkspaceVariationState | null>(null);

  // Slice 22: reactive slot + mode state. Default `txt2img` matches the
  // existing local default in `prompt-area.tsx` so consumers see the same
  // initial mode whether they read from the provider or from the legacy
  // local state until prompt-area is fully migrated.
  const [referenceSlots, setReferenceSlotsState] = useState<
    ReferenceSlotData[]
  >([]);
  const [generationMode, setGenerationModeState] =
    useState<GenerationMode>("txt2img");

  const setVariation = useCallback((data: WorkspaceVariationState) => {
    setVariationData(data);
  }, []);

  const clearVariation = useCallback(() => {
    setVariationData(null);
  }, []);

  const setReferenceSlots = useCallback(
    (
      next:
        | ReferenceSlotData[]
        | ((prev: ReferenceSlotData[]) => ReferenceSlotData[])
    ) => {
      setReferenceSlotsState(next);
    },
    []
  );

  const setGenerationMode = useCallback(
    (next: GenerationMode | ((prev: GenerationMode) => GenerationMode)) => {
      setGenerationModeState(next);
    },
    []
  );

  return (
    <WorkspaceVariationContext.Provider
      value={{
        variationData,
        setVariation,
        clearVariation,
        referenceSlots,
        setReferenceSlots,
        generationMode,
        setGenerationMode,
      }}
    >
      {children}
    </WorkspaceVariationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkspaceVariation(): WorkspaceVariationContextValue {
  const context = useContext(WorkspaceVariationContext);
  if (!context) {
    throw new Error(
      "useWorkspaceVariation must be used within a WorkspaceStateProvider"
    );
  }
  return context;
}

/**
 * Optional variant that returns null when no WorkspaceStateProvider is present.
 * Use this in components that may render outside the provider tree
 * (e.g. nested inside contexts that are tested independently).
 */
export function useWorkspaceVariationOptional(): WorkspaceVariationContextValue | null {
  return useContext(WorkspaceVariationContext);
}
