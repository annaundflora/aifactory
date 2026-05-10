"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePromptAssistant } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NoContextBannerProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Local fetch state
// ---------------------------------------------------------------------------

type FetchStatus = "loading" | "ready" | "error";

interface FetchState {
  status: FetchStatus;
  contextInstructions: string | null;
}

// ---------------------------------------------------------------------------
// Banner-link target.
//
// Slice 10 Constraint: "KEINE neue Settings-Route — Link-Ziel kommt aus Slice 06".
// Slice 06 mounts a settings page at this path; until 06 is wired we keep this
// constant centralised so the path can be tweaked without touching the
// component logic.
// ---------------------------------------------------------------------------

function buildSettingsPath(projectId: string): string {
  return `/projects/${projectId}/settings/context`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NoContextBanner — Slice 10
 *
 * Renders a dismissible single-line banner above the chat thread when the
 * active project has NO `context_instructions` set (null / empty / whitespace).
 *
 * Visibility rules:
 *  - Loads `GET /api/projects/{id}/context` once on mount (no polling, no
 *    re-fetch on re-render). Re-fetch only happens on remount (= tab reload
 *    or project-id change).
 *  - Hidden during the initial loading state.
 *  - Hidden when the fetch fails with 401/404/network-error (fail-closed —
 *    avoids nagging the user when something is off with auth/ownership).
 *  - Hidden when `context_instructions` is non-empty post-trim.
 *  - Hidden when the user has dismissed the banner this tab-session
 *    (`noContextBannerDismissed === true`).
 *
 * Interactions:
 *  - "Add" link → next/link to project context settings (Slice 06 mount-point).
 *    No automatic dismiss; the user must click the (✕) explicitly.
 *  - "✕" button → dispatches `DISMISS_NO_CONTEXT_BANNER`; banner unmounts.
 */
export function NoContextBanner({ projectId }: NoContextBannerProps) {
  const { dispatch, noContextBannerDismissed } = usePromptAssistant();

  const [fetchState, setFetchState] = useState<FetchState>({
    status: "loading",
    contextInstructions: null,
  });

  // Fetch project-context once per (projectId) mount. AbortController guards
  // against state-updates after unmount/projectId-change.
  useEffect(() => {
    const controller = new AbortController();

    setFetchState({ status: "loading", contextInstructions: null });

    fetch(`/api/projects/${projectId}/context`, {
      signal: controller.signal,
      // Banner is per-session; cache "no-store" so user-edits in Slice 06
      // are reflected on the next remount (tab reload / project switch).
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          // 401 / 404 / 5xx → fail-closed: don't render banner.
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          id?: string;
          context_instructions?: string | null;
          context_updated_at?: string | null;
        };
        return data.context_instructions ?? null;
      })
      .then((contextInstructions) => {
        if (!controller.signal.aborted) {
          setFetchState({ status: "ready", contextInstructions });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Includes AbortError (suppressed above) and any network/parse error.
        if ((err as { name?: string })?.name === "AbortError") return;
        setFetchState({ status: "error", contextInstructions: null });
      });

    return () => {
      controller.abort();
    };
  }, [projectId]);

  // Tab-session dismiss → unmount.
  if (noContextBannerDismissed) {
    return null;
  }

  // Loading / error → fail-closed (no banner).
  if (fetchState.status !== "ready") {
    return null;
  }

  // Empty-check: matches null, "", whitespace-only.
  const isContextEmpty =
    (fetchState.contextInstructions ?? "").trim() === "";

  if (!isContextEmpty) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="no_context_banner"
      className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate">
          Kein Projekt-Kontext gesetzt.
        </span>
        <Link
          href={buildSettingsPath(projectId)}
          data-testid="no_context_banner.link"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Hinzufügen
        </Link>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => dispatch({ type: "DISMISS_NO_CONTEXT_BANNER" })}
        data-testid="no_context_banner.dismiss"
        aria-label="Banner schließen"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
