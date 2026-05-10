"use client";

/**
 * <HelpMeWriteModal>
 *
 * Slice 09 (Help-Me-Write Modal-Komponente) — siehe
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-09-helper-modal-component.md
 *
 * Radix-Dialog mit Brief-Input (10..500 chars) + Generate / Regenerate /
 * Accept / Cancel. Ruft POST /api/projects/context/generate (Slice 08) und
 * gibt den akzeptierten Draft via onAccept-Callback an den Parent
 * (<ProjectContextSettings>, Slice 06).
 *
 * Internes State-Modell (siehe wireframes.md → "Help-me-write-this Modal"):
 *   empty         → Brief leer, Generate disabled
 *   brief_filled  → Brief 10..500 chars, Generate enabled
 *   pending       → Fetch läuft, alle Buttons disabled, Spinner
 *   draft_ready   → Draft sichtbar, Cancel/Regenerate/Accept enabled
 *   error         → Inline-Fehler, Brief erhalten, Generate retry-bar
 *
 * Constraints:
 * - KEIN direkter DB- oder Server-Action-Aufruf — nur via fetch()
 * - KEIN Toast — Status inline im Modal
 * - KEIN Confirm-Dialog beim Cancel (anders als Slice 06)
 * - Brief-Trim client-seitig vor Fetch; rohen Wert für Input belassen
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_BRIEF_LENGTH = 10;
const MAX_BRIEF_LENGTH = 500;

const PLACEHOLDER_TEXT =
  "Describe your project in 1–2 sentences. I'll draft a context block you can then edit.";

// Wortlaut exakt aus architecture.md → Section "Error Handling Strategy"
// (Zeile 492) + wireframes.md → State `error` (Zeile 358).
const ERROR_MESSAGE = "Could not generate. Try again.";

const GENERATE_ENDPOINT = "/api/projects/context/generate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Wire-shape von POST /api/projects/context/generate (Slice 08).
 * Siehe architecture.md → DTOs Zeilen 143-144.
 */
type GenerateProjectContextResponse = {
  draft: string;
};

type ModalState =
  | "empty"
  | "brief_filled"
  | "pending"
  | "draft_ready"
  | "error";

interface HelpMeWriteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Wird genau einmal beim Klick auf "Use this" mit dem aktuellen Draft-Text
   * aufgerufen. Parent (<ProjectContextSettings>) übernimmt den Wert in das
   * `context_textarea` und markiert Dirty-State.
   */
  onAccept: (draft: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counter-Format `{n} / 500 chars` analog zu wireframes.md (Zeile 318).
 * Keine Tausender-Trenner — max ist 500.
 */
function formatCounter(length: number): string {
  return `${length} / ${MAX_BRIEF_LENGTH} chars`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HelpMeWriteModal({
  open,
  onOpenChange,
  onAccept,
}: HelpMeWriteModalProps) {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Roher User-Input — UNGESCHNITTEN (Cursor / Whitespace bleiben erhalten);
  // Trim findet nur vor dem Fetch + bei der Längen-Bewertung statt.
  const [briefValue, setBriefValue] = useState<string>("");

  // Internes State-Modell (5 States — siehe Doc-Block oben).
  const [state, setState] = useState<ModalState>("empty");

  // Aktueller Draft (vom Server). null vor erstem Generate / nach Reset.
  const [draft, setDraft] = useState<string | null>(null);

  // AbortController für laufenden Fetch — wird bei Cancel / neuer Generate-
  // Anfrage / Modal-Close abgebrochen.
  const abortControllerRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const trimmedLength = briefValue.trim().length;
  const rawLength = briefValue.length;
  const isOverLimit = rawLength > MAX_BRIEF_LENGTH;
  const isBriefValid =
    trimmedLength >= MIN_BRIEF_LENGTH && rawLength <= MAX_BRIEF_LENGTH;

  // -------------------------------------------------------------------------
  // Cleanup: abort pending fetch when modal closes / component unmounts.
  // -------------------------------------------------------------------------

  const abortPendingFetch = useCallback(() => {
    if (abortControllerRef.current !== null) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Reset state when modal closes — pending fetch abgebrochen, alle Felder
  // geleert, damit das nächste Open-Cycle bei `empty` startet.
  useEffect(() => {
    if (open) return;
    abortPendingFetch();
    setBriefValue("");
    setState("empty");
    setDraft(null);
  }, [open, abortPendingFetch]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      abortPendingFetch();
    };
  }, [abortPendingFetch]);

  // -------------------------------------------------------------------------
  // Live-State-Sync: brief-input changes drive empty / brief_filled state
  //
  // We only auto-transition between `empty` ↔ `brief_filled`. Once a draft has
  // been generated (`draft_ready`) or an error occurred (`error`), the
  // user editing the brief should NOT collapse those panels — only an
  // explicit Generate / Regenerate / Cancel does.
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (state === "pending" || state === "draft_ready" || state === "error") {
      return;
    }
    if (isBriefValid) {
      setState("brief_filled");
    } else {
      setState("empty");
    }
  }, [briefValue, isBriefValid, state]);

  // -------------------------------------------------------------------------
  // Fetch logic — used by Generate AND Regenerate
  // -------------------------------------------------------------------------

  const runGenerate = useCallback(async () => {
    const trimmedBrief = briefValue.trim();
    if (
      trimmedBrief.length < MIN_BRIEF_LENGTH ||
      trimmedBrief.length > MAX_BRIEF_LENGTH
    ) {
      // Should not happen — Generate is gated by isBriefValid — but guard
      // defensively to avoid stale fetches when user races the disable.
      return;
    }

    // Abort any previously inflight call (e.g. user clicks Generate twice
    // fast, or Regenerate is fired while previous response is still in
    // flight).
    abortPendingFetch();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState("pending");

    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: trimmedBrief }),
        signal: controller.signal,
      });

      // Discard the response if the controller has been aborted in the
      // meantime (modal-close / new fetch). The aborted signal also
      // surfaces as an exception in fetch, but Safari/older runtimes can
      // resolve before throwing — be defensive.
      if (controller.signal.aborted) return;

      if (!response.ok) {
        // 401 / 422 / 502 / etc. — fold all non-2xx into the same error
        // path with the constant UX-Wortlaut (architecture.md Zeile 492).
        setState("error");
        abortControllerRef.current = null;
        return;
      }

      const json = (await response.json()) as GenerateProjectContextResponse;
      if (controller.signal.aborted) return;

      // Replace previous draft fully (no append, no history — AC-5).
      setDraft(json.draft ?? "");
      setState("draft_ready");
      abortControllerRef.current = null;
    } catch (err) {
      // AbortError means the fetch was cancelled (modal close / new
      // fetch) — do NOT transition into error state in that case.
      if (controller.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;

      setState("error");
      abortControllerRef.current = null;
    }
  }, [briefValue, abortPendingFetch]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleGenerate = useCallback(() => {
    void runGenerate();
  }, [runGenerate]);

  const handleRegenerate = useCallback(() => {
    void runGenerate();
  }, [runGenerate]);

  const handleAccept = useCallback(() => {
    if (state !== "draft_ready" || draft === null) return;
    onAccept(draft);
    onOpenChange(false);
  }, [draft, onAccept, onOpenChange, state]);

  /**
   * Single entry-point for ALL close-paths (Cancel-Button, ESC, Backdrop).
   * Routes via the Dialog's onOpenChange so Radix' built-in primitives
   * (`onEscapeKeyDown`, `onPointerDownOutside`) hit the same logic.
   *
   * KEIN Confirm-Dialog beim Cancel — anders als Slice 06; Brief/Draft-
   * Verlust ist rein modal-intern (Wireframe Zeile 354).
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        abortPendingFetch();
      }
      onOpenChange(nextOpen);
    },
    [abortPendingFetch, onOpenChange],
  );

  const handleCancelClick = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // -------------------------------------------------------------------------
  // Derived render flags
  // -------------------------------------------------------------------------

  const isPending = state === "pending";
  const isDraftReady = state === "draft_ready";
  const isError = state === "error";

  // Generate-Button visible in `empty`, `brief_filled`, `pending`, `error`
  // (Retry läuft via Generate, NICHT via Regenerate — Constraint).
  const showGenerateButton = !isDraftReady;
  // Regenerate + Accept ONLY visible in `draft_ready`.
  const showDraftReadyActions = isDraftReady;

  // Generate-Button enabled only when brief is valid AND not pending.
  const generateDisabled = !isBriefValid || isPending;

  // During pending — input is read-only; otherwise editable (incl. error
  // state where user may want to tweak the brief before retry).
  const inputReadOnly = isPending;

  const counterClassName = cn(
    "text-xs tabular-nums",
    isOverLimit ? "text-destructive" : "text-muted-foreground",
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="help-me-write-modal"
      >
        <DialogHeader>
          <DialogTitle>Help me write this</DialogTitle>
          <DialogDescription>
            Describe your project in 1–2 sentences. I&apos;ll draft a context
            block you can then edit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            aria-label="Brief for context generation"
            aria-invalid={isOverLimit || undefined}
            data-testid="helper-brief-input"
            placeholder={PLACEHOLDER_TEXT}
            value={briefValue}
            onChange={(e) => setBriefValue(e.target.value)}
            readOnly={inputReadOnly}
            disabled={isPending}
            rows={4}
            className="min-h-[100px] resize-y"
          />

          <div className="flex items-center justify-end">
            <span
              className={counterClassName}
              data-testid="helper-brief-counter"
            >
              {formatCounter(rawLength)}
            </span>
          </div>

          {isDraftReady && draft !== null && (
            <div
              className="flex flex-col gap-2 border-t pt-3"
              data-testid="helper-draft-section"
            >
              <p className="text-sm font-medium">Draft</p>
              <div
                className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap"
                data-testid="helper-draft-preview"
                aria-readonly="true"
              >
                {draft}
              </div>
            </div>
          )}

          {isError && (
            <p
              role="alert"
              className="text-sm text-destructive"
              data-testid="helper-error-message"
            >
              {ERROR_MESSAGE}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelClick}
            data-testid="helper-cancel-btn"
          >
            Cancel
          </Button>

          {showDraftReadyActions && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRegenerate}
              data-testid="helper-regenerate-btn"
            >
              Regenerate
            </Button>
          )}

          {showGenerateButton && (
            <Button
              type="button"
              variant="default"
              onClick={handleGenerate}
              disabled={generateDisabled}
              data-testid="helper-generate-btn"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate context
                </>
              )}
            </Button>
          )}

          {showDraftReadyActions && (
            <Button
              type="button"
              variant="default"
              onClick={handleAccept}
              data-testid="helper-accept-btn"
            >
              Use this
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
