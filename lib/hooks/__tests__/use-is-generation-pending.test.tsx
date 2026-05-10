// @vitest-environment jsdom
/**
 * Slice 17 — Tests for ``useIsGenerationPending``.
 *
 * Source spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-17-auto-apply-generate-handler.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN):
 *   - AC-7: GIVEN useIsGenerationPending() with active projectId
 *           WHEN underlying generations source has no entry with
 *                ``status === "pending"`` for that projectId
 *           THEN hook returns ``false``; once a pending entry for that
 *                projectId appears, the hook returns ``true``
 *           (Selector mirrors the filter from
 *            components/workspace/workspace-content.tsx:217)
 *
 * Plus extra invariants asserted by the spec body:
 *   - Hook returns ``false`` when no GenerationsProvider is mounted.
 *   - Hook reacts to source updates (true → false) when pending settles
 *     (covers the AC-3 watcher precondition; supplemental).
 *   - Hook scopes ``status === "pending"`` per projectId — pending entries
 *     belonging to OTHER projects must not flip the boolean.
 *
 * Mocking Strategy: per slice spec, ``mock_external`` — the
 * ``GenerationsProvider`` itself is real (it is the source under test);
 * no external services are touched.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import {
  GenerationsProvider,
} from "@/lib/workspace/generations-context";
import { useIsGenerationPending } from "../use-is-generation-pending";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Test data factory — minimal Generation shape
// ---------------------------------------------------------------------------
//
// ``Generation`` is inferred from drizzle schema (lib/db/queries.ts:9). The
// hook only inspects ``projectId`` + ``status`` so the factory provides
// realistic strings for those two fields and stubs the rest. We cast to
// ``Generation`` for type-compat — the hook's filter is structural, not
// nominal, so the stub fields never get read.
// ---------------------------------------------------------------------------

function makeGen(
  projectId: string,
  status: "pending" | "succeeded" | "failed",
  id: string = `gen-${Math.random().toString(36).slice(2)}`
): Generation {
  return {
    id,
    projectId,
    prompt: "",
    modelId: "",
    modelParams: {},
    status,
    imageUrl: null,
    replicatePredictionId: null,
    errorMessage: null,
    width: null,
    height: null,
    seed: null,
    promptMotiv: "",
    isFavorite: false,
    createdAt: new Date(),
    generationMode: "txt2img",
  } as unknown as Generation;
}

// ---------------------------------------------------------------------------
// Mutable provider — lets the test mutate ``generations`` between renders
// to exercise the hook's reactivity to source updates.
// ---------------------------------------------------------------------------

interface MutableHandle {
  setGenerations: (gens: Generation[]) => void;
}
let providerHandle: MutableHandle | null = null;

function MutableProvider({
  initial,
  projectId,
  children,
}: {
  initial: Generation[];
  projectId: string;
  children: ReactNode;
}) {
  const [gens, setGens] = useState<Generation[]>(initial);
  providerHandle = { setGenerations: setGens };
  return (
    <GenerationsProvider generations={gens} projectId={projectId}>
      {children}
    </GenerationsProvider>
  );
}

// ===========================================================================
// AC-7 — Mirror of workspace-content.tsx:217 filter
// ===========================================================================

describe("useIsGenerationPending — AC-7 selector parity", () => {
  it('AC-7: returns false when no generation has status === "pending" for active projectId', () => {
    const projectId = "project-A";
    const initial: Generation[] = [
      makeGen(projectId, "succeeded", "g1"),
      makeGen(projectId, "failed", "g2"),
    ];

    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={initial} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });

    expect(result.current).toBe(false);
  });

  it('AC-7: returns true when at least one generation has status === "pending" for active projectId', () => {
    const projectId = "project-A";
    const initial: Generation[] = [
      makeGen(projectId, "succeeded", "g1"),
      makeGen(projectId, "pending", "g2"),
    ];

    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={initial} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });

    expect(result.current).toBe(true);
  });

  it("AC-7: reacts to generations-source updates (false → true → false) when pending arrives and settles", () => {
    const projectId = "project-A";
    const initial: Generation[] = [makeGen(projectId, "succeeded", "g1")];

    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={initial} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });

    // Initial: no pending → false.
    expect(result.current).toBe(false);

    // Source mutates: insert a pending entry.
    act(() => {
      providerHandle!.setGenerations([
        makeGen(projectId, "succeeded", "g1"),
        makeGen(projectId, "pending", "g2"),
      ]);
    });
    expect(result.current).toBe(true);

    // Pending settles to succeeded — hook flips back to false (the AC-3
    // retry-watcher relies on this true → false edge).
    act(() => {
      providerHandle!.setGenerations([
        makeGen(projectId, "succeeded", "g1"),
        makeGen(projectId, "succeeded", "g2"),
      ]);
    });
    expect(result.current).toBe(false);
  });

  it("AC-7: scopes the filter per projectId — pending entries of OTHER projects do not flip the boolean", () => {
    const projectId = "project-A";
    const initial: Generation[] = [
      makeGen("project-B", "pending", "g-other"),
      makeGen(projectId, "succeeded", "g1"),
    ];

    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={initial} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });

    // Pending for project-B must NOT flip the boolean for project-A.
    expect(result.current).toBe(false);
  });

  it("AC-7: returns false when no GenerationsProvider is mounted (defensive default for presentational tests)", () => {
    const { result } = renderHook(() =>
      useIsGenerationPending("any-project")
    );
    expect(result.current).toBe(false);
  });

  it("AC-7: returns false when generations array is empty", () => {
    const projectId = "project-A";
    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={[]} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });
    expect(result.current).toBe(false);
  });

  it("AC-7: returns true when multiple pending entries exist for the active project (not just one)", () => {
    const projectId = "project-A";
    const initial: Generation[] = [
      makeGen(projectId, "pending", "g1"),
      makeGen(projectId, "pending", "g2"),
    ];
    const { result } = renderHook(() => useIsGenerationPending(projectId), {
      wrapper: ({ children }) => (
        <MutableProvider initial={initial} projectId={projectId}>
          {children}
        </MutableProvider>
      ),
    });
    expect(result.current).toBe(true);
  });
});
