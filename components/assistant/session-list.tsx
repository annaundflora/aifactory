"use client";

import { ArrowLeft, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSessions, type SessionSummary } from "@/lib/assistant/use-sessions";

// ---------------------------------------------------------------------------
// Date formatting helper
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SessionListProps {
  projectId: string;
  onSelectSession: (id: string) => void;
  onBack: () => void;
  onNewSession: () => void;
}

// ---------------------------------------------------------------------------
// SessionEntry
// ---------------------------------------------------------------------------

function SessionEntry({
  session,
  onClick,
}: {
  session: SessionSummary;
  onClick: () => void;
}) {
  const title = session.title ?? "Neue Session";
  const messageLabel =
    session.message_count === 1
      ? "1 Nachricht"
      : `${session.message_count} Nachrichten`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50"
      data-testid="session-entry"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-medium text-foreground truncate"
          data-testid="session-title"
        >
          {title}
        </h3>
        {session.has_draft && (
          <Badge
            variant="secondary"
            className="shrink-0"
            data-testid="draft-indicator"
          >
            <FileText className="size-3" />
            Draft
          </Badge>
        )}
      </div>
      <p
        className="mt-1 text-xs text-muted-foreground"
        data-testid="session-meta"
      >
        {formatDate(session.last_message_at)} &middot; {messageLabel}
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// SkeletonEntries
// ---------------------------------------------------------------------------

function SkeletonEntries() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4" data-testid="session-skeletons">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-4"
          data-testid="session-skeleton"
        >
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      className="flex flex-1 items-center justify-center px-6"
      data-testid="session-empty-state"
    >
      <p className="text-sm text-muted-foreground">
        Noch keine Sessions vorhanden
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center px-6"
      data-testid="session-error"
    >
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionList
// ---------------------------------------------------------------------------

export function SessionList({
  projectId,
  onSelectSession,
  onBack,
  onNewSession,
}: SessionListProps) {
  const { sessions, isLoading, error } = useSessions(projectId);

  return (
    <div
      className="flex h-full flex-col"
      data-testid="session-list"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onBack}
          aria-label="Zurueck"
          data-testid="session-list-back"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-medium text-foreground">
          Vergangene Sessions
        </h2>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonEntries />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          data-testid="session-entries"
        >
          {sessions.map((session) => (
            <SessionEntry
              key={session.id}
              session={session}
              onClick={() => onSelectSession(session.id)}
            />
          ))}
        </div>
      )}

      {/* Footer: New Session Button */}
      <div className="border-t px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onNewSession}
          data-testid="new-session-button"
        >
          <Plus className="size-4" />
          Neue Session
        </Button>
      </div>
    </div>
  );
}
