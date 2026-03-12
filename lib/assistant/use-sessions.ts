"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: string;
  title: string | null;
  status: string;
  message_count: number;
  has_draft: boolean;
  last_message_at: string;
  created_at: string;
}

export interface UseSessionsResult {
  sessions: SessionSummary[];
  isLoading: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Hook: useSessions
// ---------------------------------------------------------------------------

/**
 * Fetches sessions for a given project from the backend API.
 * Calls GET /api/assistant/sessions?project_id=<projectId>
 * Returns sessions sorted by last_message_at DESC (server-side).
 */
export function useSessions(projectId: string): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/assistant/sessions?project_id=${encodeURIComponent(projectId)}`
      );

      if (!response.ok) {
        throw new Error(
          `Fehler beim Laden der Sessions (${response.status})`
        );
      }

      const data = await response.json();
      const fetchedSessions: SessionSummary[] = data.sessions ?? [];

      // Sort by last_message_at DESC (client-side safety, server should also sort)
      const sorted = [...fetchedSessions].sort(
        (a, b) =>
          new Date(b.last_message_at).getTime() -
          new Date(a.last_message_at).getTime()
      );

      setSessions(sorted);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Unbekannter Fehler beim Laden der Sessions");
      setError(error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, isLoading, error };
}
