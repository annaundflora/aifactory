"use client";

import { useCallback, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { PromptAssistantContext } from "@/lib/assistant/assistant-context";

// ---------------------------------------------------------------------------
// Constants — Tool-Hint mechanics for the Refine path (AC-4)
// ---------------------------------------------------------------------------

/**
 * Slice 27 AC-4: tool-hint suffix appended to the seed text on the Refine
 * path. The backend ``_BASE_PROMPT`` rules treat this marker as a
 * directive to call ``refine_prompt`` on the preceding text instead of
 * starting a free-form interview.
 *
 * The mechanic is intentionally a plain text suffix (not a hidden body
 * field) to keep the existing ``sendMessage(content, imageUrls?)``
 * signature unchanged — see Slice spec Constraints → Technical
 * Constraints. The verbatim string below MUST stay aligned with the
 * matching tool-hint recognition rule in
 * ``backend/app/agent/prompts.py`` (handled by Slice E).
 */
const REFINE_TOOL_HINT =
  "\n\n[Hinweis: Bitte refine_prompt direkt auf den obigen Text anwenden.]";

// ---------------------------------------------------------------------------
// PasteDetectConfirmCard
// ---------------------------------------------------------------------------

/**
 * Inline card rendered in the chat thread when the paste-detect heuristic
 * matches the very first user message of a session. Offers two routes:
 *
 *   - **Direkt verfeinern** (``refine_btn``): dispatches
 *     ``DISMISS_PASTE_CONFIRM`` and re-sends the seed text with a
 *     tool-hint suffix that nudges the backend LLM to invoke
 *     ``refine_prompt`` directly. The downstream Assistant turn lands on
 *     an ``IntentSummaryCard`` (see Slice 16 mount branch).
 *   - **Interview starten** (``interview_btn``): dispatches
 *     ``DISMISS_PASTE_CONFIRM`` and re-sends the seed text as a normal
 *     user message — no tool hint, normal Interview path.
 *
 * **History semantics (AC-6):** the card is **transient**. Once either
 * button has been clicked the reducer payload flips to ``null`` and the
 * card un-mounts from the DOM. Subsequent assistant turns do NOT cause
 * the card to re-appear (this differs from the IntentSummaryCard, which
 * remains in history).
 *
 * **Provider safety:** the card guards against being rendered outside
 * ``PromptAssistantProvider`` by reading the context with
 * ``useContext(PromptAssistantContext)`` directly. When the provider is
 * absent (e.g. presentational tests) the component renders ``null``.
 */
export function PasteDetectConfirmCard() {
  const ctx = useContext(PromptAssistantContext);

  // No-provider fallback: if the card is rendered outside the provider,
  // there is nothing to read — render nothing. The chat-thread render
  // branch is the only production caller and always has the provider.
  const payload = ctx?.pasteConfirmPayload ?? null;
  const dispatch = ctx?.dispatch ?? null;
  const sendMessage = ctx?.sendMessage ?? null;

  const handleRefineClick = useCallback(() => {
    if (!payload || !dispatch || !sendMessage) return;
    const seed = payload.seedText;
    // AC-4: dismiss FIRST so the card un-mounts immediately, then
    // re-send the seed text with a tool-hint suffix that veranlasst the
    // backend LLM to call ``refine_prompt`` on the obigen Text.
    dispatch({ type: "DISMISS_PASTE_CONFIRM" });
    sendMessage(`${seed}${REFINE_TOOL_HINT}`);
  }, [payload, dispatch, sendMessage]);

  const handleInterviewClick = useCallback(() => {
    if (!payload || !dispatch || !sendMessage) return;
    const seed = payload.seedText;
    // AC-5: dismiss FIRST, then re-send the seed text unchanged so the
    // backend treats it as a normal user message and starts the
    // adaptive Interview flow.
    dispatch({ type: "DISMISS_PASTE_CONFIRM" });
    sendMessage(seed);
  }, [payload, dispatch, sendMessage]);

  // No payload → render nothing. The chat-thread render-branch already
  // gates on ``pasteConfirmPayload !== null`` so this branch is mostly
  // defensive (unwired tests, transient race during dismiss).
  if (!payload) {
    return null;
  }

  return (
    <Card
      data-testid="paste_confirm_card"
      className="w-full max-w-[90%] gap-3 py-4"
    >
      <CardContent className="px-4 text-sm leading-relaxed">
        Das sieht nach einem fertigen Prompt aus. Soll ich ihn direkt
        verfeinern oder lieber ein paar Fragen stellen?
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 px-4">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleRefineClick}
          data-testid="paste_confirm_card.refine_btn"
        >
          Direkt verfeinern
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleInterviewClick}
          data-testid="paste_confirm_card.interview_btn"
        >
          Interview starten
        </Button>
      </CardFooter>
    </Card>
  );
}
