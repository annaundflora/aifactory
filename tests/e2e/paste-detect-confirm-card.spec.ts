import { test } from "@playwright/test";

/**
 * Slice 27 — PasteDetectConfirmCard E2E (AC-10, AC-11)
 *
 * Spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-27-paste-detect-card-component.md
 *
 * Coverage:
 *   AC-10: GIVEN E2E-Setup: leere Session, Heuristik-passender Style-Prompt
 *           im Input
 *          WHEN User Send drückt UND danach
 *           ``data-testid="paste_confirm_card.refine_btn"`` klickt
 *          THEN verschwindet die Card UND es folgt ein Assistant-Turn, der
 *           via ``refine_prompt``-Tool zu einer IntentSummaryCard
 *           (``data-testid="intent_summary_card"``) führt (Slice 16
 *           Mount-Branch).
 *
 *   AC-11: GIVEN E2E-Setup: leere Session, Heuristik-passender Style-Prompt
 *           im Input
 *          WHEN User Send drückt UND danach
 *           ``data-testid="paste_confirm_card.interview_btn"`` klickt
 *          THEN verschwindet die Card UND der Assistant streamt eine erste
 *           Interview-Frage als Text-Bubble (kein Tool-Call, ``flowState``
 *           wechselt zu ``"interviewing"``).
 *
 * Strategy (per slice Test-Strategy):
 *   - Mocking Strategy = ``mock_external`` — Backend-SSE für
 *     ``refine_prompt``-Tool-Result + Intent-Summary für AC-10 gemockt;
 *     Interview-Frage für AC-11 gemockt.
 *
 * Status:
 *   Per Test-Skeleton in slice-27-paste-detect-card-component.md the
 *   Playwright spec is committed as ``test.skip``. Wiring the LangGraph
 *   backend (full ``refine_prompt`` round-trip + ``emit_intent_summary``)
 *   into Playwright requires SSE fixtures that are not part of this slice.
 *   Until then the unit + integration suite in
 *   ``components/assistant/__tests__/paste-detect-confirm-card.test.tsx``
 *   covers AC-1..AC-6 against the real reducer + dispatch chain, and the
 *   reducer suite in
 *   ``lib/assistant/__tests__/assistant-context.paste-confirm.test.tsx``
 *   covers AC-7..AC-9.
 */

test.skip(
  "AC-10: first paste-like message → card → refine_btn click → intent_summary_card appears",
  async () => {
    // AC-10: deferred per slice spec (test.skip skeleton).
    // Backend SSE fixture (``refine_prompt`` tool-result + intent-summary)
    // lands together with the broader E2E backend wiring.
  }
);

test.skip(
  "AC-11: first paste-like message → card → interview_btn click → assistant streams interview question",
  async () => {
    // AC-11: deferred per slice spec (test.skip skeleton).
    // Backend SSE fixture (interview-question text-delta) lands together
    // with the broader E2E backend wiring.
  }
);
