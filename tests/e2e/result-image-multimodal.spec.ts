import { test } from "@playwright/test";

/**
 * Slice 18 — Result-Image als Multimodal-Input E2E suite.
 *
 * Spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *     slices/slice-18-result-image-multimodal.md
 *
 * Coverage (1:1 from GIVEN/WHEN/THEN):
 *
 * AC-8 — Next-turn shows thumbnail + comment, click opens detail-view:
 *   GIVEN E2E: User durchläuft Slice 17 happy-path bis Generate succeeded
 *   WHEN  Das Backend den nächsten Assistant-Turn streamt (proaktiv-Starter
 *         via Base-Prompt-Regel — Verhalten kommt aus Slice 12)
 *   THEN  Der nächste Assistant-Message-Bubble zeigt das Thumbnail des
 *         gerade generierten Bildes UND einen Kommentar-Text mit Bezug
 *         zum Bild; Klick auf Thumbnail öffnet Detail-View
 *         (``data-testid="workspace-detail-view"`` wird sichtbar —
 *         vorhanden ab ``workspace-content.tsx:326``).
 *
 * AC-9 — Next sendMessage carries last_result_image_url in body:
 *   GIVEN E2E: ``state.lastResultImageUrl`` ist gesetzt
 *   WHEN  User schickt eine neue Chat-Message ab (egal ob Refinement-Frage
 *         oder beliebiger Text)
 *   THEN  Der Network-Request-Body enthält das Feld
 *         ``last_result_image_url`` mit der korrekten URL
 *         (Playwright ``page.waitForRequest`` matcht den Body).
 *
 * Strategy (per slice Test-Strategy):
 *   - Mocking Strategy = ``mock_external`` — ``generateImages()`` Server-
 *     Action gemockt; SSE-Stream-Stub für E2E; ``CanvasDetailView``-Open-
 *     Verhalten gegen Stub testbar.
 *
 * Status:
 *   Per Test-Skeleton in slice-18-result-image-multimodal.md the
 *   Playwright suite is committed as ``test.skip``. Wiring the LangGraph
 *   backend into Playwright (full Slice-17 happy-path round-trip + SSE
 *   proactive-starter from Slice 12) requires fixtures that are not part
 *   of this slice — Slice 21 (Multimodal Pipeline + Budget) provides the
 *   backend consumption of ``last_result_image_url`` this E2E will
 *   indirectly exercise. Until then the unit + integration suite in
 *   ``lib/assistant/__tests__/assistant-context-result-image.test.tsx``,
 *   ``lib/assistant/__tests__/use-assistant-runtime-result-image.test.ts``
 *   and ``components/assistant/__tests__/chat-thread-result-image.test.tsx``
 *   covers AC-1..AC-7 against the real reducer + dispatch chain (real
 *   reducer state, real body builder, real chat-thread render branch).
 */

// AC-8: E2E next-turn shows thumbnail + comment, click opens detail-view
test.skip(
  "AC-8: after successful generate, next assistant turn renders thumbnail + comment; click opens detail-view",
  async () => {
    // Deferred per slice spec.
    // Steps when fixtures land:
    //   1. Seed an authenticated session + project with no pending gens.
    //   2. Navigate to /workspace/{projectId}; open the assistant panel.
    //   3. Drive the Slice-17 happy-path until a generation reaches
    //      status === "succeeded" and an imageUrl is available.
    //   4. Wait for the auto-apply settle hook to dispatch
    //      SET_LAST_RESULT_IMAGE_URL (probe via test-only DOM marker or
    //      inspect the next assistant message arrival).
    //   5. Wait for the proactive-starter assistant turn to stream in
    //      (Slice 12 Base-Prompt-Regel).
    //   6. Assert [data-testid="result_message.thumbnail"] is visible
    //      inside the latest assistant bubble AND that the bubble carries
    //      a text body referencing the generated image.
    //   7. Click [data-testid="result_message.thumbnail"].
    //   8. Assert [data-testid="workspace-detail-view"] becomes visible
    //      (existing detail-view mounting in workspace-content.tsx:326).
    //   9. Assert NO new modal element was created — the existing detail-
    //      view component is reused (Reuse-Pflicht per slice constraints).
  }
);

// AC-9: E2E next sendMessage carries last_result_image_url in body
test.skip(
  "AC-9: next user message POST body contains last_result_image_url field with correct URL",
  async () => {
    // Deferred per slice spec.
    // Steps when fixtures land:
    //   1. Seed project state where state.lastResultImageUrl is set
    //      (e.g. by driving Slice-17 happy-path through one full settle).
    //   2. Capture the imageUrl that was applied to the reducer (test-only
    //      DOM probe or by intercepting the prior generations response).
    //   3. Set up page.waitForRequest matcher for
    //      POST /api/assistant/sessions/*/messages.
    //   4. User types any message into the assistant input and presses
    //      send (refinement or arbitrary text — both must include the
    //      field per AC-9).
    //   5. Await the matched request and parse its JSON body.
    //   6. Assert body.last_result_image_url === <captured imageUrl>.
    //   7. (Optional) Drive a second turn after a session reset / project
    //      switch and assert the field is null or omitted, mirroring the
    //      AC-2 explicit-clear-Pfad observed in the unit suite.
  }
);
