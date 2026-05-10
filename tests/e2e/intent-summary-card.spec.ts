import { test } from "@playwright/test";

/**
 * Slice 16 — IntentSummaryCard E2E (AC-9)
 *
 * Spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-16-intent-summary-card-component.md
 *
 * Coverage:
 *   AC-9: GIVEN E2E-Setup: User durchlaeuft Interview bis Backend
 *          ``emit_intent_summary`` triggert (SSE-Events ``flow-state`` +
 *          ``intent-summary`` empfangen)
 *         WHEN Card erscheint UND User klickt "Nochmal diskutieren"
 *         THEN ist im Reducer ``flowState === "interviewing"`` UND eine
 *              User-Message ``"Was soll anders sein?"`` wurde an
 *              ``/api/assistant/sessions/{id}/messages`` gepostet UND die
 *              Card-Instanz aus dem Summary-Turn ist weiterhin sichtbar.
 *
 * Strategy (per slice Test-Strategy):
 *   - Mocking Strategy = ``mock_external`` — SSE-Stream + Reducer-Payload
 *     gemockt; Generate-Server-Action gemockt.
 *
 * Status:
 *   Per Test-Skeleton in slice-16-intent-summary-card-component.md the
 *   Playwright spec is committed as ``test.skip``. Wiring the LangGraph
 *   backend into Playwright (full ``emit_intent_summary`` round-trip)
 *   requires fixtures that are not part of this slice — Slice 28
 *   (Session Resume Flow State) provides the persisted-payload fixture
 *   that this E2E will consume. Until then the unit + integration suite in
 *   ``components/assistant/__tests__/intent-summary-card.test.tsx`` covers
 *   AC-1..AC-8 against the real reducer + dispatch chain.
 */

test.skip(
  "AC-9: interview triggers card render; discuss click sets interviewing + posts message; card persists",
  async () => {
    // AC-9: deferred per slice spec (test.skip skeleton).
    // E2E backend fixture lands with Slice 28.
  }
);
