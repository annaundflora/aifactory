"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Slice 18: DetailViewOpenerContext
//
// Thin shared-state context that exposes a single ``openDetailView(generationId)``
// function. Consumers (currently the ``result_message`` thumbnail click
// handler in ``components/assistant/chat-thread.tsx``) call it to open the
// existing detail-view (``components/canvas/canvas-detail-view.tsx``) without
// owning the open-state themselves. The opener's identity is registered by
// ``components/workspace/workspace-content.tsx`` via ``registerOpener`` —
// internally that function calls the same ``handleSelectGeneration`` path
// that gallery-grid clicks already use today (workspace-content.tsx:298-306).
//
// **Why a registration ref instead of lifting state up?**
//   ``WorkspaceContent`` already owns ``detailViewOpen`` /
//   ``selectedGenerationId`` as local component state with a synchronous
//   ``startViewTransitionIfSupported`` wrapper. Lifting that state into the
//   context would require duplicating the transition wrapper or threading
//   the state down again. A ref-based registration keeps the opener
//   implementation co-located with the rest of the workspace state and
//   ensures the assistant chat-thread reuses the EXACT same opener path
//   (Slice 18 constraint: "KEINE neue Detail-View, KEIN neues Modal").
//
// **No-provider case:** consumers may render outside the workspace tree
// (e.g. presentational tests, or the assistant-panel sheet rendered outside
// of ``WorkspaceContent``). ``useDetailViewOpener()`` returns ``null`` in
// that case — callers MUST guard before invoking the function.
// ---------------------------------------------------------------------------

export interface DetailViewOpenerContextValue {
  /**
   * Opens the existing detail-view for the given ``generationId``. No-op
   * when no opener has been registered yet (defensive — registration is
   * synchronous in ``WorkspaceContent`` mount, but a stray race between
   * card-mount and provider-mount should not throw).
   */
  openDetailView: (generationId: string) => void;
  /**
   * Internal — called by ``WorkspaceContent`` to register its
   * ``handleSelectGeneration`` callback. Re-registration overwrites the
   * previous opener (latest-wins).
   */
  registerOpener: (opener: ((generationId: string) => void) | null) => void;
}

const DetailViewOpenerContext =
  createContext<DetailViewOpenerContextValue | null>(null);

export interface DetailViewOpenerProviderProps {
  children: ReactNode;
}

export function DetailViewOpenerProvider({
  children,
}: DetailViewOpenerProviderProps) {
  // Stable ref so the registration callback identity does not flip on
  // every render (avoids unnecessary effect re-runs in the registering
  // component).
  const openerRef = useRef<((generationId: string) => void) | null>(null);

  const registerOpener = useCallback(
    (opener: ((generationId: string) => void) | null) => {
      openerRef.current = opener;
    },
    []
  );

  const openDetailView = useCallback((generationId: string) => {
    const opener = openerRef.current;
    if (opener) {
      opener(generationId);
    } else {
      // Defensive: should not happen in production where
      // ``WorkspaceContent`` registers synchronously on mount.
      console.warn(
        "[DetailViewOpenerProvider] openDetailView called before opener " +
          "was registered; ignoring"
      );
    }
  }, []);

  const value = useMemo<DetailViewOpenerContextValue>(
    () => ({ openDetailView, registerOpener }),
    [openDetailView, registerOpener]
  );

  return (
    <DetailViewOpenerContext.Provider value={value}>
      {children}
    </DetailViewOpenerContext.Provider>
  );
}

/**
 * Optional reader — returns the opener-context value, or ``null`` when no
 * provider is mounted (e.g. presentational tests). Callers MUST defensively
 * guard the ``null`` case.
 */
export function useDetailViewOpener(): DetailViewOpenerContextValue | null {
  return useContext(DetailViewOpenerContext);
}
