"use client";

/**
 * <ProjectContextSettings>
 *
 * Modal-Komponente fuer das Editieren von projects.context_instructions.
 *
 * Slice 06 (Project-Context-Settings UI) — siehe
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-06-context-settings-page.md
 *
 * - Lädt initialen Wert via GET /api/projects/{id}/context (Slice 03)
 * - Speichert via updateProjectContext Server-Action (Slice 04)
 * - Erzwingt 8000-Zeichen-Cap im UI (Counter + Save-Disable)
 * - Confirm-Dialog ("Ungespeicherte Änderungen verwerfen?") bei Cancel-mit-Dirty
 *
 * Mount-Point in Project-Card / Workspace-Header wird in Slice 07 verdrahtet.
 * Help-Me-Write Modal (Slice 09) rendert spaeter als Kind und schreibt Drafts
 * via setValue zurueck — der Helper-Button rendert hier nur als Placeholder.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

import { updateProjectContext } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONTEXT_LENGTH = 8000;

const PLACEHOLDER_TEXT =
  "Describe your project, so the assistant knows the vibe, style and recurring themes...";

// Wortlaut exakt aus architecture.md → Section "Error Handling Strategy"
// (Zeile 498) — Discard-Confirm-Dialog bei Cancel-mit-Dirty-State.
const DISCARD_DIALOG_TITLE = "Ungespeicherte Änderungen verwerfen?";
const DISCARD_DIALOG_DESCRIPTION =
  "Deine Änderungen am Project-Context gehen verloren, wenn du das Modal schließt.";
const DISCARD_BUTTON_LABEL = "Verwerfen";
const KEEP_EDITING_BUTTON_LABEL = "Bearbeiten";

const SAVED_INDICATOR_TIMEOUT_MS = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Wire-shape von GET /api/projects/{id}/context (Slice 03).
 * snake_case wie in architecture.md → DTO-Schemas (Zeile 142).
 */
type ProjectContextResponse = {
  id: string;
  context_instructions: string | null;
  context_updated_at: string | null;
};

interface ProjectContextSettingsProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format counter as "{thousands-formatted-n} / 8,000 chars" — siehe
 * wireframes.md (Zeile 264, Beispiel "1,024 / 8,000 chars").
 */
function formatCounter(length: number): string {
  const formatted = length.toLocaleString("en-US");
  const max = MAX_CONTEXT_LENGTH.toLocaleString("en-US");
  return `${formatted} / ${max} chars`;
}

/**
 * Format ISO-Datum-String zu "YYYY-MM-DD · HH:MM" via Intl.DateTimeFormat
 * (siehe wireframes.md Zeile 269, "2026-04-17 · 14:22").
 */
function formatLastUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const datePart = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} · ${timePart}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectContextSettings({
  projectId,
  open,
  onOpenChange,
}: ProjectContextSettingsProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Loaded baseline (canonical server value). Used to detect dirty-state and
  // for re-render after save. `null` while initial fetch is pending.
  const [loadedValue, setLoadedValue] = useState<string | null>(null);
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string | null>(null);

  // Editor draft value (controlled textarea).
  const [draftValue, setDraftValue] = useState<string>("");

  // Lifecycle flags.
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedIndicator, setShowSavedIndicator] = useState<boolean>(false);

  // Confirm-Discard-Dialog
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState<boolean>(false);

  // Stable timeout ref for "✓ Saved" auto-hide (cleared on unmount / re-save)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const charCount = draftValue.length;
  const isOverLimit = charCount > MAX_CONTEXT_LENGTH;
  // Dirty = draft differs from canonical loaded baseline. When loadedValue
  // is null (no context saved yet), treat empty draft as not-dirty.
  const baselineForDirty = loadedValue ?? "";
  const isDirty = draftValue !== baselineForDirty;
  const saveDisabled = !isDirty || isOverLimit || isSaving || isLoading;

  // -------------------------------------------------------------------------
  // Initial fetch (re-runs each time the modal opens for the same projectId)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);

    fetch(`/api/projects/${projectId}/context`, {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          if (response.status === 404) {
            setLoadError("Project not found");
          } else {
            setLoadError("Konnte Context nicht laden.");
          }
          setIsLoading(false);
          return;
        }
        const json = (await response.json()) as ProjectContextResponse;
        if (cancelled) return;
        const ci = json.context_instructions ?? null;
        setLoadedValue(ci);
        setDraftValue(ci ?? "");
        setLastUpdatedIso(json.context_updated_at ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Konnte Context nicht laden.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // -------------------------------------------------------------------------
  // Reset transient state on close (avoid leaking dirty between sessions)
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (open) return;
    // When the modal is closed (after Confirm-Discard or post-save flow),
    // wipe transient state so the next mount starts clean.
    setSaveError(null);
    setShowSavedIndicator(false);
    setConfirmDiscardOpen(false);
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }
  }, [open]);

  // Cleanup the saved-indicator timeout on unmount.
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (saveDisabled) return;

    setIsSaving(true);
    setSaveError(null);
    setShowSavedIndicator(false);
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }

    // Send raw textarea value; trim/null-normalisation lives in the server
    // action (Slice 04). UI does NOT pre-sanitise per Constraints.
    const result = await updateProjectContext({
      projectId,
      contextInstructions: draftValue,
    });

    if ("error" in result) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    // Update canonical baseline with server-returned values; this resets
    // the dirty-state and refreshes the "Last updated" row.
    const newLoaded = result.contextInstructions ?? null;
    setLoadedValue(newLoaded);
    setDraftValue(newLoaded ?? "");
    setLastUpdatedIso(
      result.contextUpdatedAt instanceof Date
        ? result.contextUpdatedAt.toISOString()
        : (result.contextUpdatedAt as unknown as string),
    );
    setIsSaving(false);
    setShowSavedIndicator(true);
    savedTimeoutRef.current = setTimeout(() => {
      setShowSavedIndicator(false);
      savedTimeoutRef.current = null;
    }, SAVED_INDICATOR_TIMEOUT_MS);
  }, [draftValue, projectId, saveDisabled]);

  /**
   * Single entry-point for ALL close-paths (Cancel-Button, ESC, Backdrop).
   * Routes via the Dialog's onOpenChange so Radix' built-in primitives
   * (`onEscapeKeyDown`, `onPointerDownOutside`) hit the same logic.
   *
   * - Dirty state → AlertDialog confirm; do NOT close the modal yet.
   * - Otherwise → close immediately.
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      // User wants to close. Gate on dirty-state.
      if (isDirty) {
        setConfirmDiscardOpen(true);
        return;
      }
      onOpenChange(false);
    },
    [isDirty, onOpenChange],
  );

  const handleCancelClick = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const handleConfirmDiscard = useCallback(() => {
    setConfirmDiscardOpen(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleKeepEditing = useCallback(() => {
    setConfirmDiscardOpen(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render — Project-not-found terminal state (AC-7)
  // -------------------------------------------------------------------------

  const counterClassName = cn(
    "text-xs tabular-nums",
    isOverLimit ? "text-destructive" : "text-muted-foreground",
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-2xl"
          data-testid="project-context-settings-modal"
        >
          <DialogHeader>
            <DialogTitle>Context for Assistant</DialogTitle>
            <DialogDescription>
              Describe your project so the assistant knows the vibe, style and
              recurring themes. Used for the chat LLM only, not for image-model
              prompts.
            </DialogDescription>
          </DialogHeader>

          {loadError !== null ? (
            <div
              role="alert"
              className="text-sm text-destructive"
              data-testid="project-context-load-error"
            >
              {loadError}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Textarea
                aria-label="Project context instructions"
                aria-busy={isLoading}
                aria-invalid={isOverLimit || undefined}
                data-testid="context-textarea"
                placeholder={PLACEHOLDER_TEXT}
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                disabled={isLoading || isSaving}
                rows={10}
                className="min-h-[200px] resize-y"
              />

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading || isSaving}
                  data-testid="help-me-write-btn"
                  // Slice 06 reserviert nur den Render-Slot; die Click-Logik
                  // (Helper-Modal) wird in Slice 09 verdrahtet.
                  onClick={() => {
                    /* slot for slice-09 */
                  }}
                >
                  <Sparkles className="size-4" />
                  Help me write this
                </Button>

                <div className="flex items-center gap-2">
                  {showSavedIndicator && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                      data-testid="saved-indicator"
                      role="status"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Saved
                    </span>
                  )}
                  <span
                    className={counterClassName}
                    data-testid="context-counter"
                  >
                    {formatCounter(charCount)}
                  </span>
                </div>
              </div>

              {lastUpdatedIso !== null && !isLoading && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="last-updated-row"
                >
                  Last updated: {formatLastUpdated(lastUpdatedIso)}
                </p>
              )}

              {saveError !== null && (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                  data-testid="save-error"
                >
                  {saveError}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelClick}
              data-testid="cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={saveDisabled}
              data-testid="save-btn"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save Context
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
       * Confirm-Discard AlertDialog (separat vom Settings-Dialog — KEIN
       * Dialog-in-Dialog Verschachtelung) — siehe slice constraints.
       */}
      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleKeepEditing();
        }}
      >
        <AlertDialogContent data-testid="confirm-discard-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{DISCARD_DIALOG_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>
              {DISCARD_DIALOG_DESCRIPTION}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleKeepEditing}
              data-testid="keep-editing-btn"
            >
              {KEEP_EDITING_BUTTON_LABEL}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
              data-testid="discard-btn"
            >
              {DISCARD_BUTTON_LABEL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
