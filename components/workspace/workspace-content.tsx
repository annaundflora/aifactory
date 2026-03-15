"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { PenLine, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Generation } from "@/lib/db/queries";
import { fetchGenerations } from "@/app/actions/generations";
import { PromptArea } from "@/components/workspace/prompt-area";
import { GalleryGrid } from "@/components/workspace/gallery-grid";
import { GenerationPlaceholder } from "@/components/workspace/generation-placeholder";
import { FilterChips, type FilterValue } from "@/components/workspace/filter-chips";
import { CanvasDetailView } from "@/components/canvas/canvas-detail-view";
import { CanvasDetailProvider } from "@/lib/canvas-detail-context";
import { startViewTransitionIfSupported } from "@/lib/utils/view-transition";
import { PromptAssistantProvider } from "@/lib/assistant/assistant-context";
import { AssistantPanelContent } from "@/components/assistant/assistant-panel";

const POLLING_INTERVAL_MS = 3000;

// Prompt area resize/collapse constants
const PROMPT_MIN_WIDTH = 320;
const PROMPT_MAX_WIDTH = 480;
const PROMPT_DEFAULT_WIDTH = 480;
const PROMPT_COLLAPSED_WIDTH = 48;

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

  // ----- Assistant Panel state -----
  const [assistantOpen, setAssistantOpen] = useState(false);
  const handleAssistantToggle = useCallback(() => {
    setAssistantOpen((prev) => !prev);
  }, []);
  const handleAssistantClose = useCallback(() => {
    setAssistantOpen(false);
  }, []);

  // ----- Prompt Area resize/collapse -----
  const [promptWidth, setPromptWidth] = useState(PROMPT_DEFAULT_WIDTH);
  const [promptCollapsed, setPromptCollapsed] = useState(false);
  const promptPreCollapseWidthRef = useRef(PROMPT_DEFAULT_WIDTH);
  const promptIsResizing = useRef(false);
  const promptRafRef = useRef<number | null>(null);
  const promptMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const promptMouseUpRef = useRef<(() => void) | null>(null);

  const cleanupPromptResize = useCallback(() => {
    if (promptRafRef.current !== null) {
      cancelAnimationFrame(promptRafRef.current);
      promptRafRef.current = null;
    }
    if (promptMouseMoveRef.current) {
      document.removeEventListener("mousemove", promptMouseMoveRef.current);
      promptMouseMoveRef.current = null;
    }
    if (promptMouseUpRef.current) {
      document.removeEventListener("mouseup", promptMouseUpRef.current);
      promptMouseUpRef.current = null;
    }
    promptIsResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return () => cleanupPromptResize();
  }, [cleanupPromptResize]);

  const handlePromptCollapse = useCallback(() => {
    promptPreCollapseWidthRef.current = promptWidth;
    setPromptCollapsed(true);
  }, [promptWidth]);

  const handlePromptExpand = useCallback(() => {
    setPromptCollapsed(false);
    setPromptWidth(promptPreCollapseWidthRef.current || PROMPT_DEFAULT_WIDTH);
  }, []);

  const handlePromptResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (promptCollapsed) return;
      e.preventDefault();
      promptIsResizing.current = true;

      const startX = e.clientX;
      const startWidth = promptWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!promptIsResizing.current) return;
        if (promptRafRef.current !== null) {
          cancelAnimationFrame(promptRafRef.current);
        }
        // Right edge: dragging right = wider
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.min(
          PROMPT_MAX_WIDTH,
          Math.max(PROMPT_MIN_WIDTH, startWidth + delta)
        );
        promptRafRef.current = requestAnimationFrame(() => {
          promptRafRef.current = null;
          setPromptWidth(newWidth);
        });
      };

      const handleMouseUp = () => {
        cleanupPromptResize();
      };

      promptMouseMoveRef.current = handleMouseMove;
      promptMouseUpRef.current = handleMouseUp;

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [promptCollapsed, promptWidth, cleanupPromptResize]
  );

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

  // Find the selected generation for the detail view
  const selectedGeneration = selectedGenerationId
    ? completedGenerations.find((g) => g.id === selectedGenerationId) ?? null
    : null;

  const showDetailView = detailViewOpen && selectedGeneration && selectedGenerationId;

  // ----- Render both views, hide gallery when detail is open -----
  // This prevents PromptArea from unmounting (and losing state) during canvas roundtrip.
  return (
    <>
      {showDetailView && (
        <div className="fixed inset-0 z-50 flex overflow-hidden bg-background" data-testid="workspace-detail-view">
          <CanvasDetailProvider initialGenerationId={selectedGenerationId}>
            <CanvasDetailView
              generation={selectedGeneration}
              allGenerations={completedGenerations}
              onBack={handleDetailViewClose}
              onGenerationsCreated={handleGenerationsCreated}
            />
          </CanvasDetailProvider>
        </div>
      )}

      {/* Gallery-View: hidden (not unmounted) when detail view is open */}
      <div
        className="flex h-[calc(100dvh-3.5rem)] gap-3 overflow-hidden bg-muted/40 p-3"
        data-testid="workspace-gallery-view"
        style={showDetailView ? { display: "none" } : undefined}
      >
        {/* Left: Prompt Area (resizable + collapsible) */}
        {promptCollapsed ? (
          <div
            className="flex shrink-0 flex-col items-center rounded-xl border border-border/80 bg-card py-3 cursor-pointer shadow-sm"
            style={{ width: PROMPT_COLLAPSED_WIDTH }}
            onClick={handlePromptExpand}
            data-testid="prompt-area-collapsed"
            role="button"
            aria-label="Expand prompt panel"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handlePromptExpand();
              }
            }}
          >
            <PenLine className="size-5 text-muted-foreground" />
          </div>
        ) : (
          <div
            className="relative shrink-0 overflow-y-auto rounded-xl border border-border/80 bg-card shadow-sm"
            style={{ width: promptWidth }}
            data-testid="prompt-area-panel"
          >
            {/* Resize handle on right edge */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30"
              onMouseDown={handlePromptResizeStart}
              data-testid="prompt-resize-handle"
              role="separator"
              aria-orientation="vertical"
            />
            {/* Collapse button — left-aligned, matches collapse direction */}
            <div className="flex items-center justify-start px-3 pt-2 pb-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handlePromptCollapse}
                aria-label="Collapse prompt panel"
                data-testid="prompt-collapse-button"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>
            <div className="px-4 pb-4">
              <PromptArea
                projectId={projectId}
                onGenerationsCreated={handleGenerationsCreated}
                assistantOpen={assistantOpen}
                onAssistantToggle={handleAssistantToggle}
              />
            </div>
          </div>
        )}

        {/* Center: Gallery */}
        <div className="min-w-[300px] flex-1 overflow-y-auto rounded-xl border border-border/80 bg-card p-6 shadow-sm">
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

        {/* Right: Assistant Panel — always mounted, width animated */}
        <div
          className="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
          style={{ width: assistantOpen ? 480 : 0 }}
          data-testid="assistant-panel-wrapper"
        >
          <div className="h-full w-[480px] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <PromptAssistantProvider projectId={projectId}>
              <AssistantPanelContent
                open={assistantOpen}
                onClose={handleAssistantClose}
                projectId={projectId}
              />
            </PromptAssistantProvider>
          </div>
        </div>

      </div>
    </>
  );
}
