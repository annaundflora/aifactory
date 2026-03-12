// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { useSessions } from "../use-sessions";

// ---------------------------------------------------------------------------
// Helpers: mock_external strategy per spec -- mock fetch calls to
// /api/assistant/sessions
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;

function mockFetchResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSessions", () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN der useSessions-Hook wird mit einer projectId (UUID) aufgerufen
  //       WHEN der Hook mountet
  //       THEN wird GET /api/assistant/sessions?project_id=<projectId> aufgerufen
  //            und der Hook liefert { sessions, isLoading, error }
  // --------------------------------------------------------------------------
  it("AC-2: should fetch sessions from /api/assistant/sessions with project_id query param", async () => {
    const fetchCalls: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      return mockFetchResponse({
        sessions: [
          {
            id: "s1",
            title: "Test Session",
            status: "active",
            message_count: 3,
            has_draft: false,
            last_message_at: "2026-03-11T10:00:00Z",
            created_at: "2026-03-11T09:00:00Z",
          },
        ],
      });
    }) as typeof fetch;

    const projectId = "project-uuid-abc-123";
    const { result } = renderHook(() => useSessions(projectId));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify the correct URL was called with the project_id query param
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toBe(
      `/api/assistant/sessions?project_id=${encodeURIComponent(projectId)}`
    );
  });

  // --------------------------------------------------------------------------
  // AC-2 (return shape): Hook liefert sessions, isLoading, error
  // --------------------------------------------------------------------------
  it("AC-2: should return sessions array, isLoading flag, and error state", async () => {
    const sessionsData = [
      {
        id: "s1",
        title: "Session One",
        status: "active",
        message_count: 5,
        has_draft: true,
        last_message_at: "2026-03-11T14:00:00Z",
        created_at: "2026-03-11T12:00:00Z",
      },
      {
        id: "s2",
        title: "Session Two",
        status: "active",
        message_count: 2,
        has_draft: false,
        last_message_at: "2026-03-11T10:00:00Z",
        created_at: "2026-03-11T09:00:00Z",
      },
    ];

    globalThis.fetch = vi.fn(async () => {
      return mockFetchResponse({ sessions: sessionsData });
    }) as typeof fetch;

    const { result } = renderHook(() => useSessions("project-123"));

    // Initially isLoading should be true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // After loading, sessions should be populated and sorted by last_message_at DESC
    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0].id).toBe("s1"); // 14:00 first
    expect(result.current.sessions[1].id).toBe("s2"); // 10:00 second
    expect(result.current.error).toBeNull();

    // Verify the return shape has all three fields
    expect(result.current).toHaveProperty("sessions");
    expect(result.current).toHaveProperty("isLoading");
    expect(result.current).toHaveProperty("error");
  });

  // --------------------------------------------------------------------------
  // AC-2 (sorting): Hook sorts sessions by last_message_at DESC client-side
  // --------------------------------------------------------------------------
  it("AC-2: should sort sessions by last_message_at descending", async () => {
    const unsortedSessions = [
      {
        id: "s-a",
        title: "Session A",
        status: "active",
        message_count: 5,
        has_draft: false,
        last_message_at: "2026-03-11T10:00:00Z",
        created_at: "2026-03-11T09:00:00Z",
      },
      {
        id: "s-b",
        title: "Session B",
        status: "active",
        message_count: 8,
        has_draft: true,
        last_message_at: "2026-03-11T14:00:00Z",
        created_at: "2026-03-11T12:00:00Z",
      },
      {
        id: "s-c",
        title: "Session C",
        status: "active",
        message_count: 2,
        has_draft: false,
        last_message_at: "2026-03-10T08:00:00Z",
        created_at: "2026-03-10T07:00:00Z",
      },
    ];

    globalThis.fetch = vi.fn(async () => {
      return mockFetchResponse({ sessions: unsortedSessions });
    }) as typeof fetch;

    const { result } = renderHook(() => useSessions("project-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should be sorted: B (14:00), A (10:00), C (08:00 prev day)
    expect(result.current.sessions.map((s) => s.id)).toEqual([
      "s-b",
      "s-a",
      "s-c",
    ]);
  });

  // --------------------------------------------------------------------------
  // AC-11: GIVEN der useSessions-Hook und ein fetch-Fehler (z.B. Netzwerkfehler)
  //        WHEN error nicht null ist
  //        THEN zeigt die Session-Liste eine Fehlermeldung und der sessions-Array
  //             ist leer
  // --------------------------------------------------------------------------
  it("AC-11: should set error when fetch fails with network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network request failed");
    }) as typeof fetch;

    const { result } = renderHook(() => useSessions("project-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Network request failed");
    expect(result.current.sessions).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // AC-11 (HTTP error): Hook sets error when response is not ok (e.g. 500)
  // --------------------------------------------------------------------------
  it("AC-11: should set error when fetch returns non-ok status", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    const { result } = renderHook(() => useSessions("project-123"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toMatch(/500/);
    expect(result.current.sessions).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // AC-2 (empty projectId): Hook should not fetch when projectId is empty
  // --------------------------------------------------------------------------
  it("AC-2: should not fetch when projectId is empty", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() => useSessions(""));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
