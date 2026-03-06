"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { type Generation } from "@/lib/db/queries";
import { fetchGenerations } from "@/app/actions/generations";
import { PromptArea } from "@/components/workspace/prompt-area";
import { GalleryGrid } from "@/components/workspace/gallery-grid";
import { GenerationPlaceholder } from "@/components/workspace/generation-placeholder";
import { LightboxModal } from "@/components/lightbox/lightbox-modal";
import { LightboxNavigation } from "@/components/lightbox/lightbox-navigation";

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
    () => generations.filter((g) => g.status === "pending" || g.status === "failed"),
    [generations]
  );

  // ----- Lightbox handlers -----
  const handleSelectGeneration = useCallback(
    (id: string) => {
      const index = completedGenerations.findIndex((g) => g.id === id);
      if (index >= 0) {
        setLightboxIndex(index);
        setLightboxOpen(true);
      }
    },
    [completedGenerations]
  );

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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Prompt Area */}
      <div className="w-80 shrink-0 overflow-y-auto border-r p-4">
        <PromptArea
          projectId={projectId}
          onGenerationsCreated={handleGenerationsCreated}
        />
      </div>

      {/* Right: Gallery */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Pending/Failed Placeholders */}
        {pendingGenerations.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {pendingGenerations.map((gen) => (
              <GenerationPlaceholder key={gen.id} generation={gen} />
            ))}
          </div>
        )}

        {/* Completed Gallery */}
        <GalleryGrid
          generations={generations}
          onSelectGeneration={handleSelectGeneration}
        />
      </div>

      {/* Lightbox */}
      {currentGeneration && lightboxOpen && (
        <div className="fixed inset-0 z-50">
          <LightboxModal
            generation={currentGeneration}
            isOpen={lightboxOpen}
            onClose={handleLightboxClose}
          />
          <LightboxNavigation
            generations={completedGenerations}
            currentIndex={lightboxIndex}
            onNavigate={handleLightboxNavigate}
            onDelete={handleLightboxDelete}
          />
        </div>
      )}
    </div>
  );
}
