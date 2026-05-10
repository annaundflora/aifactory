import { test, expect, type Page } from "@playwright/test";

/**
 * E2E tests for Slice 28: Session-Resume mit FSM-Hydrate.
 *
 * Source ACs (slice-28-session-resume-flow-state.md):
 * - AC-5: <IntentSummaryCard> wird nach Hydrate exakt einmal inline gemountet;
 *   Inhalte (Axes-Liste, Prompt-Preview, Buttons) entsprechen 1:1 dem
 *   persistierten ``final_intent`` und ``intent_axes``.
 * - AC-8: Nach hartem Page-Reload (page.reload()) ist die IntentSummaryCard
 *   erneut sichtbar mit identischem Prompt-Preview und identischen Axes;
 *   FSM-State ist "summarizing"; Buttons sind aktiv (nicht frozen).
 *
 * Strategy:
 * The slice spec marks the e2e test as ``test.fixme`` because it requires
 * a full backend with a live LLM that emits ``emit_intent_summary``. The
 * test below documents the canonical interaction path so the fixme can be
 * removed once a deterministic Playwright fixture (or recorded session
 * fixture) is wired up.
 *
 * Constraints:
 * - The test marks itself ``fixme`` per the slice's test-spec; flipping
 *   it to ``test()`` requires a backend session fixture with a persisted
 *   LangGraph state at ``flow_state="summarizing"`` (and a known
 *   ``final_intent``). See the slice spec test-skeleton block.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateToWorkspace(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const projectLink = page.locator("a[href^='/projects/']").first();
  if ((await projectLink.count()) > 0) {
    await projectLink.click();
  } else {
    const nameInput = page.getByPlaceholder("Project name");
    await nameInput.fill("E2E Resume Test Project");
    await nameInput.press("Enter");
    await page.waitForURL(/\/projects\//, { timeout: 15_000 });
  }
  await page
    .getByTestId("prompt-area")
    .waitFor({ state: "visible", timeout: 15_000 });
}

async function openAssistantSheet(page: Page) {
  // Open the assistant sheet via the trigger; the trigger element is
  // typically a button labelled "Assistant" or has data-testid="assistant-trigger".
  const trigger = page.getByTestId("assistant-trigger").first();
  if ((await trigger.count()) > 0) {
    await trigger.click();
  }
  await page
    .getByTestId("assistant-sheet")
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function sendChatMessage(page: Page, text: string) {
  const input = page.getByTestId("chat-input").first();
  await input.fill(text);
  await input.press("Enter");
}

// ---------------------------------------------------------------------------
// AC-5 + AC-8: session resume re-renders IntentSummaryCard
// ---------------------------------------------------------------------------

test.describe.skip("AC-5/AC-8: session resume re-renders IntentSummaryCard", () => {
  test.fixme(
    "renders IntentSummaryCard with identical content after page.reload while flowState=summarizing",
    async ({ page }) => {
      // Step 1 — navigate into workspace and open the assistant.
      await navigateToWorkspace(page);
      await openAssistantSheet(page);

      // Step 2 — drive the interview to the IntentSummaryCard mount.
      // The exact prompts depend on the LLM behaviour; these prompts have
      // historically been sufficient to trigger ``emit_intent_summary``.
      await sendChatMessage(
        page,
        "Generiere ein Bild im dark academia Stil — moody library, weiches Licht."
      );
      // Wait until the card mounts.
      const card = page.getByTestId("intent-summary-card");
      await card.waitFor({ state: "visible", timeout: 60_000 });

      // Step 3 — capture the rendered axes + prompt preview before reload.
      const promptPreviewBefore = await page
        .getByTestId("intent-summary-prompt-preview")
        .innerText();
      const axesBefore = await page
        .getByTestId("intent-summary-axes")
        .innerText();

      // The buttons are active (not frozen) because no click happened.
      const generateButton = page.getByTestId("intent-summary-generate");
      const discussButton = page.getByTestId("intent-summary-discuss");
      await expect(generateButton).toBeEnabled();
      await expect(discussButton).toBeEnabled();

      // Step 4 — hard reload.
      await page.reload();
      await page
        .getByTestId("prompt-area")
        .waitFor({ state: "visible", timeout: 15_000 });
      await openAssistantSheet(page);

      // Step 5 — verify the card re-mounts with identical content (AC-5/AC-8).
      const cardAfter = page.getByTestId("intent-summary-card");
      await cardAfter.waitFor({ state: "visible", timeout: 30_000 });

      const promptPreviewAfter = await page
        .getByTestId("intent-summary-prompt-preview")
        .innerText();
      const axesAfter = await page
        .getByTestId("intent-summary-axes")
        .innerText();

      // AC-5: identical content
      expect(promptPreviewAfter).toBe(promptPreviewBefore);
      expect(axesAfter).toBe(axesBefore);

      // AC-8: buttons remain active (not frozen) — no click happened
      // before reload, so the card must be in its un-frozen state.
      const generateAfter = page.getByTestId("intent-summary-generate");
      const discussAfter = page.getByTestId("intent-summary-discuss");
      await expect(generateAfter).toBeEnabled();
      await expect(discussAfter).toBeEnabled();
    }
  );
});
