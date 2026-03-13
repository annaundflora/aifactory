"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { type Generation } from "@/lib/db/queries";
import { fetchGenerations } from "@/app/actions/generations";
import { PromptArea } from "@/components/workspace/prompt-area";
import { GalleryGrid } from "@/components/workspace/gallery-grid";
import { GenerationPlaceholder } from "@/components/workspace/generation-placeholder";
import { FilterChips, type FilterValue } from "@/components/workspace/filter-chips";
import { LightboxModal } from "@/components/lightbox/lightbox-modal";
import { LightboxNavigation } from "@/components/lightbox/lightbox-navigation";
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { startViewTransitionIfSupported } from "@/lib/utils/view-transition";

const POLLING_INTERVAL_MS = 3000;

interface WorkspaceContentProps {
  projectId: string;
  initialGenerations: Generation[];
}

export function WorkspaceContent({
  projectId,
  initialGenerations,
}: WorkspaceContentProps) {
  // ----- All generations state (single source of truth) -----
  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);

  // ----- Filter state -----
  const [modeFilter, setModeFilter] = useState<FilterValue>("all");

  // ----- Detail-View state -----
  // NOTE(slice-18): detailViewOpen state is internal here. Slice-18 will
  // refactor this component to lift the state into a shared context or expose
  // it via props/callbacks so external consumers can read it.
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null);

  // ----- Lightbox state -----
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ----- Polling -----
  const hasPending = useMemo(
    () => generations.some((g) => g.status === "pending"),
    [generations]
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasPending) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const result = await fetchGenerations(projectId);
        setGenerations(result);
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // Poll immediately, then every interval
    poll();
    intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasPending, projectId]);

  // ----- Toast for newly failed generations -----
  const prevGenerationsRef = useRef<Generation[]>(initialGenerations);
  useEffect(() => {
    const prevMap = new Map(prevGenerationsRef.current.map((g) => [g.id, g.status]));
    for (const gen of generations) {
      if (gen.status === "failed" && prevMap.get(gen.id) !== "failed") {
        const msg = gen.errorMessage?.toLowerCase() ?? "";
        if (msg.includes("429") || msg.includes("rate limit") || msg.includes("zu viele")) {
          toast.error("Zu viele Anfragen. Bitte kurz warten.");
        } else if (msg.includes("r2") || msg.includes("upload")) {
          toast.error("Bild konnte nicht gespeichert werden.");
        } else {
          toast.error(gen.errorMessage || "Generation fehlgeschlagen.");
        }
      }
    }
    prevGenerationsRef.current = generations;
  }, [generations]);

  // ----- Handle new generations from PromptArea -----
  const handleGenerationsCreated = useCallback((newGens: Generation[]) => {
    setGenerations((prev) => [...newGens, ...prev]);
  }, []);

  // ----- Derived data -----
  const completedGenerations = useMemo(
    () =>
      generations
        .filter((g) => g.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [generations]
  );

  const pendingGenerations = useMemo(
    () => generations.filter((g) => g.status === "pending"),
    [generations]
  );

  // ----- Detail-View handlers -----
  const handleSelectGeneration = useCallback(
    (id: string) => {
      startViewTransitionIfSupported(() => {
        setSelectedGenerationId(id);
        setDetailViewOpen(true);
      });
    },
    []
  );

  const handleDetailViewClose = useCallback(() => {
    startViewTransitionIfSupported(() => {
      setDetailViewOpen(false);
      setSelectedGenerationId(null);
    });
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const handleLightboxNavigate = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleLightboxDelete = useCallback(() => {
    // Refresh after delete
    setLightboxOpen(false);
    fetchGenerations(projectId).then(setGenerations).catch(console.error);
  }, [projectId]);

  const currentGeneration = completedGenerations[lightboxIndex];

  // Find the selected generation for the detail view
  const selectedGeneration = selectedGenerationId
    ? completedGenerations.find((g) => g.id === selectedGenerationId) ?? null
    : null;

  // ----- Detail-View open -----
  if (detailViewOpen && selectedGeneration && selectedGenerationId) {
    return (
      <div className="flex flex-1 overflow-hidden" data-testid="workspace-detail-view">
        <CanvasDetailProvider initialGenerationId={selectedGenerationId}>
          <CanvasDetailView
            generation={selectedGeneration}
            allGenerations={completedGenerations}
            onBack={handleDetailViewClose}
          />
        </CanvasDetailProvider>
      </div>
    );
  }

  // ----- Gallery-View -----
  return (
    <div className="flex flex-1 gap-3 overflow-hidden bg-muted/40 p-3" data-testid="workspace-gallery-view">
      {/* Left: Prompt Area */}
      <div className="w-[480px] shrink-0 overflow-y-auto rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <PromptArea
          projectId={projectId}
          onGenerationsCreated={handleGenerationsCreated}
        />
      </div>

      {/* Right: Gallery */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        {/* Pending Placeholders (failed -> only toast, no card) */}
        {pendingGenerations.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pendingGenerations.map((gen) => (
              <GenerationPlaceholder key={gen.id} generation={gen} />
            ))}
          </div>
        )}

        {/* Filter Chips */}
        <div className="mb-4">
          <FilterChips value={modeFilter} onChange={setModeFilter} />
        </div>

        {/* Completed Gallery */}
        <GalleryGrid
          generations={generations}
          onSelectGeneration={handleSelectGeneration}
          modeFilter={modeFilter}
        />
      </div>

      {/* Lightbox */}
      {currentGeneration && lightboxOpen && (
        <div className="fixed inset-0 z-50">
          <LightboxModal
            generation={currentGeneration}
            isOpen={lightboxOpen}
            onClose={handleLightboxClose}
            onDeleted={handleLightboxDelete}
            onGenerationCreated={(gen) => setGenerations((prev) => [gen, ...prev])}
          />
          <LightboxNavigation
            generations={completedGenerations}
            currentIndex={lightboxIndex}
            onNavigate={handleLightboxNavigate}
          />
        </div>
      )}
    </div>
  );
}
