"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Slice 17: GenerationsContext
//
// Exposes the live ``Generation[]`` array of the active workspace so that
// downstream consumers (most notably ``useIsGenerationPending`` and the
// IntentSummaryCard's "So generieren" click handler) can read the same
// source that ``workspace-content.tsx`` already filters today. The
// ``WorkspaceContent`` component is the canonical provider — it owns the
// ``generations`` state (single source of truth, with polling +
// optimistic insertions) and re-publishes it on every render.
//
// The context also carries the active ``projectId`` so that downstream
// consumers (e.g. the IntentSummaryCard generate-handler) can build the
// ``generateImages()`` server-action input without needing to thread the
// ID through the entire chat-thread → card render chain.
//
// **No-provider case:** consumers may render outside the workspace tree
// (e.g. presentational tests). The optional reader returns ``null`` in
// that case — the ``useIsGenerationPending`` hook coerces this to
// ``false`` so the IntentSummaryCard's concurrent-block defaults to "no
// generation pending" when no provider is mounted.
// ---------------------------------------------------------------------------

export interface GenerationsContextValue {
  /** Live generations array (filtered by callers as needed). */
  generations: Generation[];
  /** Active project id — surfaced for consumers that build per-project payloads. */
  projectId: string;
}

const GenerationsContext = createContext<GenerationsContextValue | null>(null);

export interface GenerationsProviderProps {
  /** The live generations array owned by ``WorkspaceContent``. */
  generations: Generation[];
  /** Active project id (the same id that ``WorkspaceContent`` is mounted for). */
  projectId: string;
  children: ReactNode;
}

export function GenerationsProvider({
  generations,
  projectId,
  children,
}: GenerationsProviderProps) {
  // Stable identity for the context value when neither input changed,
  // so consumers that only read ``projectId`` don't re-render on every
  // ``generations`` mutation (and vice-versa).
  const value = useMemo<GenerationsContextValue>(
    () => ({ generations, projectId }),
    [generations, projectId]
  );
  return (
    <GenerationsContext.Provider value={value}>
      {children}
    </GenerationsContext.Provider>
  );
}

/**
 * Optional reader — returns the live generations array from the nearest
 * ``GenerationsProvider``, or ``null`` when no provider is mounted (e.g.
 * presentational tests). Consumers are expected to handle the ``null``
 * branch defensively.
 */
export function useGenerationsContextOptional(): Generation[] | null {
  const ctx = useContext(GenerationsContext);
  return ctx ? ctx.generations : null;
}

/**
 * Optional reader for the active project id. Returns ``null`` when no
 * ``GenerationsProvider`` is mounted (presentational tests / standalone
 * card render).
 */
export function useGenerationsProjectIdOptional(): string | null {
  const ctx = useContext(GenerationsContext);
  return ctx ? ctx.projectId : null;
}
