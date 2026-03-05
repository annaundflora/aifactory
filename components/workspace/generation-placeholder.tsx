"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Generation } from "@/lib/db/queries";
import { retryGeneration } from "@/app/actions/generations";
import { fetchGenerations } from "@/app/actions/generations";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLLING_INTERVAL_MS = 3000;

// ---------------------------------------------------------------------------
// useGenerationPolling Hook
// ---------------------------------------------------------------------------

/**
 * Polls the server for updated generation statuses at a regular interval.
 * Stops polling automatically when no pending generations remain.
 * Cleans up interval on unmount.
 *
 * @param projectId - The project to poll generations for
 * @param pendingIds - Array of generation IDs that are currently pending
 * @returns The latest array of Generation objects from the server
 */
export function useGenerationPolling(
  projectId: string,
  pendingIds: string[]
): Generation[] {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingIdsRef = useRef<string[]>(pendingIds);

  // Keep the ref in sync so the interval callback always sees latest pending IDs
  useEffect(() => {
    pendingIdsRef.current = pendingIds;
  }, [pendingIds]);

  useEffect(() => {
    // If there are no pending IDs, don't start polling
    if (pendingIds.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on mount / when pendingIds change
    const poll = async () => {
      try {
        const result = await fetchGenerations(projectId);
        setGenerations(result);
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    poll();

    intervalRef.current = setInterval(() => {
      // Check latest pendingIds via ref — if none remain, stop
      if (pendingIdsRef.current.length === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      poll();
    }, POLLING_INTERVAL_MS);

    // Cleanup on unmount or when deps change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectId, pendingIds.length > 0]);

  return generations;
}

// ---------------------------------------------------------------------------
// GenerationPlaceholder Props
// ---------------------------------------------------------------------------

export interface GenerationPlaceholderProps {
  generation: Generation;
  onCompleted?: (generation: Generation) => void;
  onRetry?: (generation: Generation) => void;
}

// ---------------------------------------------------------------------------
// GenerationPlaceholder Component
// ---------------------------------------------------------------------------

/**
 * Displays a placeholder card in the gallery for a generation that is either
 * pending (skeleton + spinner) or failed (error state + retry button).
 *
 * When `generation.status` is "completed", calls onCompleted so the parent
 * can replace this placeholder with the actual image card.
 */
export function GenerationPlaceholder({
  generation,
  onCompleted,
  onRetry,
}: GenerationPlaceholderProps) {
  const [localStatus, setLocalStatus] = useState(generation.status);
  const [isRetrying, setIsRetrying] = useState(false);
  const prevStatusRef = useRef(generation.status);

  // Sync local status when the generation prop changes (e.g. from polling)
  useEffect(() => {
    if (generation.status !== prevStatusRef.current) {
      prevStatusRef.current = generation.status;
      setLocalStatus(generation.status);

      if (generation.status === "completed" && onCompleted) {
        onCompleted(generation);
      }
    }
  }, [generation, onCompleted]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setLocalStatus("pending");

    try {
      const result = await retryGeneration({ id: generation.id });

      if ("error" in result) {
        // Retry failed, go back to failed state
        setLocalStatus("failed");
        console.error("Retry failed:", result.error);
      } else {
        // Retry started successfully, notify parent
        if (onRetry) {
          onRetry(result);
        }
      }
    } catch (error) {
      setLocalStatus("failed");
      console.error("Retry error:", error);
    } finally {
      setIsRetrying(false);
    }
  }, [generation.id, onRetry]);

  // Pending / Retrying state: skeleton with spinner
  if (localStatus === "pending" || isRetrying) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border bg-card break-inside-avoid mb-4"
        data-testid="generation-placeholder"
        data-status="pending"
      >
        <Skeleton className="aspect-square w-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Failed state: error icon, message, retry button
  if (localStatus === "failed") {
    return (
      <div
        className="relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-destructive/50 bg-card break-inside-avoid mb-4"
        data-testid="generation-placeholder"
        data-status="failed"
      >
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Generation fehlgeschlagen
        </p>
        {generation.errorMessage && (
          <p className="max-w-[80%] text-center text-xs text-muted-foreground/70">
            {generation.errorMessage}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          data-testid="retry-button"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Completed state: this component should not normally render for completed
  // generations, but if it does, call onCompleted and render nothing visible
  if (localStatus === "completed" && onCompleted) {
    // The useEffect above handles calling onCompleted, but as a safety net:
    return null;
  }

  return null;
}
