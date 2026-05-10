"use client";

import { useGenerationsContextOptional } from "@/lib/workspace/generations-context";

// ---------------------------------------------------------------------------
// Slice 17 — useIsGenerationPending
// ---------------------------------------------------------------------------
//
// Selector hook that mirrors the filter at
// ``components/workspace/workspace-content.tsx:217``:
//
//   const hasPending = generations.some((g) => g.status === "pending");
//
// scoped per ``projectId`` (architecture.md → "Concurrent-Generation
// Handling" — the precondition is per-project, never global). Reads from
// the ``GenerationsContext`` published by ``WorkspaceContent``; reacts to
// every update of the underlying array (insert / status flip / polling
// settle).
//
// **Contract:**
//   - Returns ``false`` when no ``GenerationsProvider`` is mounted (e.g.
//     presentational tests outside the workspace tree). This keeps the
//     IntentSummaryCard's concurrent-block off in those scenarios.
//   - Returns ``false`` when the array contains no entry with
//     ``status === "pending"`` for the given ``projectId``.
//   - Returns ``true`` as soon as at least one entry with
//     ``status === "pending"`` for the given ``projectId`` is present.
//
// The hook is consumed by the ``IntentSummaryCard`` "So generieren"
// click handler (Slice 17 AC-2 / AC-3 / AC-7) and is exported as the
// public extension surface for future concurrent guards.
// ---------------------------------------------------------------------------

export function useIsGenerationPending(projectId: string): boolean {
  const generations = useGenerationsContextOptional();
  if (generations === null) {
    return false;
  }
  return generations.some(
    (g) => g.projectId === projectId && g.status === "pending"
  );
}
