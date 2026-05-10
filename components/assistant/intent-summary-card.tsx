"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  IntentSummaryPayload,
  SettingsDiff,
} from "@/lib/assistant/assistant-context";

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
   * Slice 17 will wire the actual generate handler (Auto-Apply +
   * Auto-Generate). For Slice 16 the card only renders the button and
   * forwards clicks to whatever consumer passes — there is no internal
   * generate logic.
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
 * **Scope (Slice 16):** rendering + Discuss handler are wired here; the
 * Generate handler is a forwarded slot — Slice 17 attaches the
 * Auto-Apply + Auto-Generate flow via the ``onGenerate`` prop.
 *
 * **History semantics (AC-6 / AC-7):** the card freezes in place after
 * either button is clicked and stays mounted as a past-decision element.
 * Position-tracking + freeze-state is owned by the parent
 * (``chat-thread.tsx``).
 */
export function IntentSummaryCard({
  payload,
  frozen,
  onGenerate,
  onDiscuss,
}: IntentSummaryCardProps) {
  const { axes, prompt_preview, settings_diff } = payload;

  // AC-2 (minimal_axes): only render axes that are actually filled. We
  // iterate AXIS_ORDER instead of ``Object.keys(axes)`` so the rendered
  // order is deterministic regardless of payload-key insertion order.
  const presentAxes = AXIS_ORDER.filter((key) => {
    const value = axes[key];
    return typeof value === "string" && value.length > 0;
  });

  return (
    <Card
      data-testid="intent_summary_card"
      data-frozen={frozen ? "true" : "false"}
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
          disabled={frozen}
          onClick={onGenerate}
          data-testid="intent_summary_card.generate_btn"
        >
          So generieren
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={frozen}
          onClick={onDiscuss}
          data-testid="intent_summary_card.discuss_btn"
        >
          Nochmal diskutieren
        </Button>
      </CardFooter>
    </Card>
  );
}
