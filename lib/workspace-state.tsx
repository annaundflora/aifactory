"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceVariationState {
  promptMotiv: string;
  promptStyle?: string;
  negativePrompt?: string;
  modelId: string;
  modelParams: Record<string, unknown>;
  targetMode?: string;
  sourceImageUrl?: string;
  strength?: number;
  sourceGenerationId?: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface WorkspaceVariationContextValue {
  variationData: WorkspaceVariationState | null;
  setVariation: (data: WorkspaceVariationState) => void;
  clearVariation: () => void;
}

const WorkspaceVariationContext =
  createContext<WorkspaceVariationContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkspaceStateProvider({ children }: { children: ReactNode }) {
  const [variationData, setVariationData] =
    useState<WorkspaceVariationState | null>(null);

  const setVariation = useCallback((data: WorkspaceVariationState) => {
    setVariationData(data);
  }, []);

  const clearVariation = useCallback(() => {
    setVariationData(null);
  }, []);

  return (
    <WorkspaceVariationContext.Provider
      value={{ variationData, setVariation, clearVariation }}
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
