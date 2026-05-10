"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PromptAssistantContext,
  type IntentSummaryPayload,
  type SettingsDiff,
} from "@/lib/assistant/assistant-context";
import {
  useGenerationsProjectIdOptional,
  useGenerationsContextOptional,
} from "@/lib/workspace/generations-context";
import { useWorkspaceVariation } from "@/lib/workspace-state";
import { generateImages } from "@/app/actions/generations";
import { useIsGenerationPending } from "@/lib/hooks/use-is-generation-pending";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Slice 16 AC-1: the six axis keys are rendered in this exact order in the
 * card list. Mirrors wireframes.md → "Screen: Intent Summary Card"
 * Annotation ②.
 */
const AXIS_ORDER = [
  "subject",
  "medium",
  "style",
  "lighting",
  "composition",
  "palette",
] as const satisfies ReadonlyArray<keyof IntentSummaryPayload["axes"]>;

/** Display labels for each axis (DE chat convention: English-style labels). */
const AXIS_LABELS: Record<(typeof AXIS_ORDER)[number], string> = {
  subject: "Subject",
  medium: "Medium",
  style: "Style",
  lighting: "Lighting",
  composition: "Composition",
  palette: "Palette",
};

// ---------------------------------------------------------------------------
// Slice 17 — toast copy + default count
// ---------------------------------------------------------------------------

/** AC-2 — concurrent-generation block hint. */
const TOAST_CONCURRENT =
  "Es läuft bereits eine Generierung. Bitte warten.";

/** AC-4 — error rollback hint after generateImages() failed post-auto-apply. */
const TOAST_GENERATE_ERROR =
  "Generierung fehlgeschlagen — manuell versuchen?";

/**
 * Default generate-count when the workspace state does not expose one. The
 * Auto-Generate path mirrors the manual ``handleGenerate`` in
 * ``components/workspace/prompt-area.tsx`` which uses ``variantCount`` (1..4)
 * as the count. ``WorkspaceVariationContext`` does not surface
 * ``variantCount`` today; the auto-flow conservatively defaults to 1
 * variant per click (architecture.md → "Auto-Apply + Auto-Generate
 * Trigger" — single ``generateImages()`` call is the contract; count is
 * implementation-defined and intentionally NOT a user-visible knob in the
 * Card).
 */
const DEFAULT_AUTO_GENERATE_COUNT = 1;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IntentSummaryCardProps {
  /** Snapshot of the intent payload to render. */
  payload: IntentSummaryPayload;
  /**
   * Slice 16 AC-6 / AC-7: when ``true`` the card is in the ``history``
   * state — both buttons are ``disabled`` and the card is visually
   * dimmed. Card-Instanz remains in DOM regardless.
   */
  frozen: boolean;
  /**
   * Slice 16 slot — preserved for backwards compatibility with consumers
   * that render the card OUTSIDE the ``PromptAssistantProvider`` /
   * ``GenerationsProvider`` tree (e.g. presentational tests). When the
   * card is mounted INSIDE both providers (production case) it runs the
   * full Auto-Apply + Auto-Generate pipeline internally and this prop is
   * ignored. When the providers are absent the card falls back to
   * forwarding the click to ``onGenerate`` so existing render-contract
   * tests stay green.
   */
  onGenerate: () => void;
  /**
   * Slice 16 AC-6: dispatched by the parent (chat-thread) to set the
   * ``flowState`` to ``"interviewing"`` and call
   * ``sendMessage("Was soll anders sein?")``.
   */
  onDiscuss: () => void;
}

// ---------------------------------------------------------------------------
// SettingsDiff renderer (declarative, per sub-array)
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<
  "subject" | "style" | "composition",
  string
> = {
  subject: "subject",
  style: "style",
  composition: "composition",
};

function formatRole(value: string | null): string {
  if (value === null) return "—";
  return ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value;
}

function formatStrength(value: number | null): string {
  if (value === null) return "—";
  // Strengths are floats in [0.0, 1.0]; render with 2 decimals so the
  // diff is human-readable (e.g. "0.30 → 0.75").
  return value.toFixed(2);
}

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function SettingsDiffSection({ diff }: { diff: SettingsDiff }) {
  // AC-4: declarative, per sub-array. Order is fixed:
  // slotRoles → slotStrengths → modelId → modelParams.
  const lines: { key: string; text: string }[] = [];

  if (diff.slotRoles && diff.slotRoles.length > 0) {
    diff.slotRoles.forEach((entry, idx) => {
      lines.push({
        key: `slotRoles-${idx}`,
        text: `Slot ${entry.slotIndex + 1} role: ${formatRole(entry.from)} → ${formatRole(entry.to)}`,
      });
    });
  }

  if (diff.slotStrengths && diff.slotStrengths.length > 0) {
    diff.slotStrengths.forEach((entry, idx) => {
      lines.push({
        key: `slotStrengths-${idx}`,
        text: `Slot ${entry.slotIndex + 1} strength: ${formatStrength(entry.from)} → ${formatStrength(entry.to)}`,
      });
    });
  }

  if (diff.modelId) {
    lines.push({
      key: "modelId",
      text: `Model: ${diff.modelId.from} → ${diff.modelId.to}`,
    });
  }

  if (diff.modelParams && diff.modelParams.length > 0) {
    diff.modelParams.forEach((entry, idx) => {
      lines.push({
        key: `modelParams-${idx}`,
        text: `${entry.key}: ${formatParamValue(entry.from)} → ${formatParamValue(entry.to)}`,
      });
    });
  }

  if (lines.length === 0) {
    // Defensive: if all sub-arrays were empty arrays / undefined, skip.
    return null;
  }

  return (
    <div
      className="space-y-1"
      data-testid="intent_summary_card.settings_diff"
    >
      <div className="text-xs font-medium text-muted-foreground">
        Settings diff
      </div>
      <ul className="space-y-0.5 text-sm">
        {lines.map((line) => (
          <li key={line.key} className="flex gap-2">
            <span aria-hidden="true">•</span>
            <span className="break-words">{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IntentSummaryCard
// ---------------------------------------------------------------------------

/**
 * Inline card rendered in the chat thread when the LLM has reached
 * semantic confidence (``flowState === "summarizing"``). Shows the
 * captured intent axes, the drafted prompt preview (monospace), an
 * optional declarative settings diff, and two action buttons.
 *
 * **Scope (Slice 17):** this slice wires the full Auto-Apply +
 * Auto-Generate pipeline behind the "So generieren" button. Sequence
 * (architecture.md → "Auto-Apply + Auto-Generate Trigger"):
 *
 *   1. ``useIsGenerationPending(projectId)`` precondition. If ``true``,
 *      surface the concurrent-block toast, arm the retry-watcher, and
 *      return without mutating FSM / calling ``generateImages``. The
 *      buttons stay active so the user can still click "Nochmal
 *      diskutieren" or wait for the auto-retry.
 *   2. Else dispatch ``SET_FLOW_STATE("generating")`` (frontend-only —
 *      backend never receives this transition).
 *   3. Call ``applyToWorkspace()`` from ``usePromptAssistant()``.
 *   4. Call ``generateImages()`` server action. On ``{ error }``: roll
 *      back ``flowState`` to ``"summarizing"``, surface the error toast,
 *      and re-enable the buttons. On success: keep ``flowState ===
 *      "generating"`` and let the existing polling pipeline drive the
 *      generation lifecycle.
 *
 * **Discuss handler (slice 16):** stays a parent-owned slot via
 * ``onDiscuss``; chat-thread dispatches ``SET_FLOW_STATE("interviewing")``
 * + ``sendMessage("Was soll anders sein?")``.
 *
 * **History semantics (AC-6 / AC-7):** the card freezes in place after
 * either button is clicked and stays mounted as a past-decision element.
 * Position-tracking + freeze-state is owned by the parent
 * (``chat-thread.tsx``).
 *
 * **No-provider fallback:** when rendered outside the
 * ``PromptAssistantProvider`` (e.g. presentational tests), the card
 * falls back to forwarding the generate click to the ``onGenerate``
 * prop so the slice-16 render contract continues to hold.
 */
export function IntentSummaryCard({
  payload,
  frozen,
  onGenerate,
  onDiscuss,
}: IntentSummaryCardProps) {
  const { axes, prompt_preview, settings_diff } = payload;

  // -------------------------------------------------------------------------
  // Slice 17 — context wiring (graceful degradation when providers absent)
  // -------------------------------------------------------------------------
  //
  // ``PromptAssistantContext`` exposes ``dispatch`` + ``applyToWorkspace``
  // (from ``usePromptAssistant`` — see ``lib/assistant/assistant-context.tsx``).
  // ``useGenerationsContextOptional`` / ``useGenerationsProjectIdOptional``
  // surface the live generations array + active project id from the
  // ``GenerationsProvider`` published by ``WorkspaceContent``.
  // ``useWorkspaceVariation`` exposes the current ``modelId`` /
  // ``modelParams`` selected by the user in PromptArea — used to build the
  // ``generateImages()`` input.
  const assistantCtx = useContext(PromptAssistantContext);
  const projectId = useGenerationsProjectIdOptional();
  const generations = useGenerationsContextOptional();
  const workspaceVariation = useWorkspaceVariation();

  /**
   * The card is "wired" (full Auto-Apply + Auto-Generate flow available)
   * only when ALL providers are mounted. Outside the workspace tree the
   * card silently falls back to the slice-16 slot semantics.
   */
  const isWired =
    assistantCtx !== null &&
    projectId !== null &&
    generations !== null;

  // Derived: is any generation for this project currently pending?
  // Sourced from ``useIsGenerationPending`` (architecture.md → "Concurrent-
  // Generation Handling" / Slice 17 deliverable) so the selector logic lives
  // in exactly one place. The hook returns ``false`` when no
  // ``GenerationsProvider`` is mounted, so the unwired-fallback path never
  // trips the concurrent block. We pass an empty string when ``projectId``
  // is ``null`` — the hook short-circuits to ``false`` in that case (no
  // entry will ever match an empty projectId, and unwired returns ``false``
  // outright).
  const isGenerationPending = useIsGenerationPending(projectId ?? "");

  // -------------------------------------------------------------------------
  // Slice 17 — local card-state for the "pending" visual treatment (AC-5)
  // -------------------------------------------------------------------------
  //
  // ``isAutoGenerating`` is a card-local flag flipped to ``true`` while
  // the ``generateImages()`` promise is in-flight. It controls the
  // button-disabled + label-variation ("Generiere…") per wireframes.md →
  // "State Variations" → ``pending``. Distinct from the
  // ``flowState === "generating"`` reducer state because the reducer
  // value also covers the entire downstream lifecycle (polling settle,
  // SSE flow-state events) — only the in-flight server-action window
  // should swap the button label.
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  // -------------------------------------------------------------------------
  // Slice 17 AC-3 — Auto-Retry Watcher
  // -------------------------------------------------------------------------
  //
  // When AC-2 fires (click while a previous gen is still pending), the
  // retry-watcher is "armed" by setting ``pendingRetryRef.current = true``.
  // The ``useEffect`` below observes ``isGenerationPending`` and triggers
  // exactly one retry on the ``true → false`` transition, then disarms
  // the watcher so a subsequent settle does NOT replay it. Card-unmount
  // also disarms (cleanup runs on unmount, which clears the ref).
  const pendingRetryRef = useRef(false);
  // Tracks the previous ``isGenerationPending`` value across renders so
  // the ``useEffect`` can detect the ``true → false`` edge.
  const prevPendingRef = useRef<boolean>(isGenerationPending);

  // Forward declaration for the actual generate trigger — defined below
  // (useCallback) and referenced both by the click handler and the
  // retry-watcher effect.
  const triggerAutoGenerateRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const prev = prevPendingRef.current;
    prevPendingRef.current = isGenerationPending;

    if (prev === true && isGenerationPending === false && pendingRetryRef.current) {
      // Edge: pending settled while a retry was armed → fire ONE retry,
      // then disarm. The retry runs the same sequence as a fresh click
      // (AC-1) by invoking the same ``triggerAutoGenerate`` closure.
      pendingRetryRef.current = false;
      const trigger = triggerAutoGenerateRef.current;
      if (trigger) {
        // Fire-and-forget — the closure handles its own error / state.
        void trigger();
      }
    }
  }, [isGenerationPending]);

  // -------------------------------------------------------------------------
  // Slice 17 — actual Auto-Apply + Auto-Generate trigger
  // -------------------------------------------------------------------------
  //
  // Encapsulates steps (a)..(d) of architecture.md → "Auto-Apply +
  // Auto-Generate Trigger". Pre-condition checks happen at the call-site
  // (click handler / retry watcher) so this function ONLY runs the apply +
  // generate sequence.
  const triggerAutoGenerate = useCallback(async () => {
    if (!isWired || !assistantCtx || !projectId) return;

    // Read variation snapshot at trigger-time (not on render) so the
    // input reflects the latest workspace selection.
    const modelId = workspaceVariation.variationData?.modelId ?? "";
    const modelParams =
      workspaceVariation.variationData?.modelParams ?? {};

    // (a) FSM transition — ``"generating"`` is set BEFORE apply so any
    //     reducer-based selectors (Slice 22 indicator etc.) pick up the
    //     transition synchronously with the apply (Slice 17 constraint:
    //     "Apply-Reihenfolge ist STRENG: SET_FLOW_STATE('generating')
    //     ZUERST, dann applyToWorkspace, dann generateImages").
    assistantCtx.dispatch({
      type: "SET_FLOW_STATE",
      flowState: "generating",
    });

    // (b) Apply the prompt preview to the workspace — re-uses the
    //     existing ``applyToWorkspace`` mechanic verbatim (constraint:
    //     "KEINE Re-Implementation der Apply-Mechanik"). Push the drafted
    //     prompt into the reducer first so the existing ``SET_DRAFT_PROMPT``
    //     auto-apply effect at assistant-context.tsx:855 fires the
    //     ``setVariation`` call on the next render. The explicit
    //     ``applyToWorkspace()`` invocation is required by AC-1 (the click
    //     handler must call it directly). The function is a no-op when
    //     ``state.draftPrompt`` is still ``null`` (closure captures stale
    //     state); the auto-apply effect handles the actual write on the
    //     subsequent render — this is the migration path described at
    //     lib/assistant/assistant-context.tsx:487-551.
    assistantCtx.dispatch({
      type: "SET_DRAFT_PROMPT",
      draftPrompt: { prompt: prompt_preview },
    });
    assistantCtx.applyToWorkspace();

    // (c) Auto-generate — single server-action call. Single-model array
    //     because the WorkspaceVariation context exposes ``modelId``
    //     (singular) — multi-slot generation lives in PromptArea-local
    //     state and is not surfaced cross-tree (architecture decision:
    //     auto-flow is intentionally narrower than manual flow).
    const modelIds = modelId ? [modelId] : [];

    setIsAutoGenerating(true);
    try {
      const result = await generateImages({
        projectId,
        promptMotiv: prompt_preview,
        modelIds,
        params: modelParams,
        count: DEFAULT_AUTO_GENERATE_COUNT,
      });

      if (result && !Array.isArray(result) && "error" in result) {
        // (d) Error rollback per AC-4 + architecture.md → "Error
        //     Handling Strategy" (``generateImages() server-action
        //     failure post-auto-apply``).
        assistantCtx.dispatch({
          type: "SET_FLOW_STATE",
          flowState: "summarizing",
        });
        toast.error(TOAST_GENERATE_ERROR);
      }
      // Success branch: stay in ``generating`` — downstream polling +
      // SSE flow-state events drive the next transition (``reviewing``).
    } catch {
      // Defensive: server-action throws should never reach here (the
      // action itself catches and returns ``{ error }``), but a thrown
      // promise is treated as an error path for parity.
      assistantCtx.dispatch({
        type: "SET_FLOW_STATE",
        flowState: "summarizing",
      });
      toast.error(TOAST_GENERATE_ERROR);
    } finally {
      setIsAutoGenerating(false);
    }
  }, [
    isWired,
    assistantCtx,
    projectId,
    workspaceVariation,
    prompt_preview,
  ]);

  // Keep the ref in sync so the retry-watcher effect can call the latest
  // closure without re-arming the watcher every time the closure
  // identity changes.
  useEffect(() => {
    triggerAutoGenerateRef.current = triggerAutoGenerate;
  }, [triggerAutoGenerate]);

  // Cleanup — disarm on unmount so a settle that lands after the card
  // has been removed never fires a phantom retry.
  useEffect(() => {
    return () => {
      pendingRetryRef.current = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Slice 17 — click handler
  // -------------------------------------------------------------------------
  const handleGenerateClick = useCallback(() => {
    if (frozen) return;

    if (!isWired) {
      // No-provider fallback — preserve slice-16 slot semantics.
      onGenerate();
      return;
    }

    if (isAutoGenerating) {
      // Defensive: the button is disabled in this state, but a stray
      // double-click should still be a no-op.
      return;
    }

    if (isGenerationPending) {
      // AC-2 — concurrent block. Surface the toast, arm the retry-
      // watcher, and bail. Buttons stay active.
      pendingRetryRef.current = true;
      toast(TOAST_CONCURRENT);
      return;
    }

    // AC-1 — happy path.
    void triggerAutoGenerate();
  }, [
    frozen,
    isWired,
    isAutoGenerating,
    isGenerationPending,
    onGenerate,
    triggerAutoGenerate,
  ]);

  // AC-2 (minimal_axes): only render axes that are actually filled. We
  // iterate AXIS_ORDER instead of ``Object.keys(axes)`` so the rendered
  // order is deterministic regardless of payload-key insertion order.
  const presentAxes = AXIS_ORDER.filter((key) => {
    const value = axes[key];
    return typeof value === "string" && value.length > 0;
  });

  // AC-5: while a generateImages() promise is in-flight the generate
  // button is disabled and shows the "Generiere…" label (wireframes.md →
  // State Variations → ``pending``). The discuss button is also
  // disabled in that window so the user can't switch tracks mid-flight.
  const generateBtnDisabled = frozen || isAutoGenerating;
  const discussBtnDisabled = frozen || isAutoGenerating;
  const generateBtnLabel = isAutoGenerating ? "Generiere…" : "So generieren";

  return (
    <Card
      data-testid="intent_summary_card"
      data-frozen={frozen ? "true" : "false"}
      data-pending={isAutoGenerating ? "true" : "false"}
      className={cn(
        "w-full max-w-[90%] gap-4 py-4",
        frozen && "opacity-60"
      )}
    >
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold">
          Zusammenfassung — stimmt das?
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 px-4">
        {/* AC-1 / AC-2: axes list (only filled axes) */}
        {presentAxes.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Intent
            </div>
            <ul
              className="space-y-0.5 text-sm"
              data-testid="intent_summary_card.axes"
            >
              {presentAxes.map((key) => (
                <li
                  key={key}
                  className="flex gap-2"
                  data-testid={`intent_summary_card.axis.${key}`}
                >
                  <span aria-hidden="true">•</span>
                  <span>
                    <span className="font-medium">{AXIS_LABELS[key]}:</span>{" "}
                    <span className="text-muted-foreground">
                      {axes[key]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AC-3: prompt preview in monospace block */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Prompt draft
          </div>
          <pre
            data-testid="intent_summary_card.prompt_preview"
            className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs font-mono leading-relaxed"
          >
            {prompt_preview}
          </pre>
        </div>

        {/* AC-4 / AC-5: settings diff (omitted entirely when undefined) */}
        {settings_diff && <SettingsDiffSection diff={settings_diff} />}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 px-4">
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={generateBtnDisabled}
          onClick={handleGenerateClick}
          data-testid="intent_summary_card.generate_btn"
        >
          {isAutoGenerating && (
            <Loader2
              className="size-4 animate-spin"
              aria-hidden="true"
              data-testid="intent_summary_card.generate_btn.spinner"
            />
          )}
          {generateBtnLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={discussBtnDisabled}
          onClick={onDiscuss}
          data-testid="intent_summary_card.discuss_btn"
        >
          Nochmal diskutieren
        </Button>
      </CardFooter>
    </Card>
  );
}
