import { test, expect, type Page } from "@playwright/test";

/**
 * Slice 09 — Help-Me-Write Modal E2E (AC-9, Done-Signal)
 *
 * Spec:
 *   specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/slice-09-helper-modal-component.md
 *
 * Coverage:
 *   AC-9: Open Settings (Slice 06) → click "Help me write this" → type brief
 *         → click Generate → wait for Draft → click Accept. Modal closes AND
 *         the parent's context_textarea contains the draft text.
 *   AC-9 sub-case (a): Regenerate replaces an already-shown draft.
 *   AC-9 sub-case (b): Cancel after generate leaves context_textarea
 *         unchanged.
 *
 * Strategy (per slice Test-Strategy):
 *   - Mocking Strategy = `mock_external` — Slice 08's POST /api/projects/
 *     context/generate is stubbed via `page.route()` so the spec is
 *     deterministic (no real LLM call). The Settings GET endpoint
 *     `/api/projects/{id}/context` (Slice 03) is also stubbed for
 *     determinism. The component code-paths under test are unchanged.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HELPER_ENDPOINT = "/api/projects/context/generate";

const HELPER_BRIEF_INPUT_TESTID = "helper-brief-input";
const HELPER_GENERATE_TESTID = "helper-generate-btn";
const HELPER_REGENERATE_TESTID = "helper-regenerate-btn";
const HELPER_ACCEPT_TESTID = "helper-accept-btn";
const HELPER_CANCEL_TESTID = "helper-cancel-btn";
const HELPER_DRAFT_PREVIEW_TESTID = "helper-draft-preview";

const HELP_TRIGGER_TESTID = "help-me-write-btn";
const CONTEXT_TEXTAREA_TESTID = "context-textarea";

/**
 * Stub the Slice 08 generate endpoint with a sequence of responses. Each
 * call to fulfill() pops the next pre-baked draft string.
 */
async function stubGenerateEndpoint(page: Page, drafts: string[]) {
  let index = 0;
  await page.route(HELPER_ENDPOINT, async (route, request) => {
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    const body = drafts[index] ?? drafts[drafts.length - 1] ?? "";
    index += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ draft: body }),
    });
  });
}

/**
 * Open the Project-Context Settings modal for the first available project on
 * the project list page. Reuses the same selectors as the Slice 07 spec to
 * stay aligned with the rest of the suite.
 */
async function openSettingsForFirstProject(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const firstCard = page.locator("a[href^='/projects/']").first();
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.hover();

  const editButton = page.locator('[data-action="edit-context"]').first();
  await editButton.click({ force: true });

  // Wait for the Settings modal to be visible
  await expect(
    page.getByTestId("project-context-settings-modal"),
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// AC-9 Happy Path: Brief → Generate → Accept fills parent textarea
// ---------------------------------------------------------------------------

test.describe("Slice 09 — Help-Me-Write Modal E2E", () => {
  test("AC-9: open settings, click Help-me-write, type brief, generate, Accept fills context_textarea with draft", async ({
    page,
  }) => {
    const draftText =
      "Magic Mushroom POD shop. Posters, prints, ceramics; trippy retro vibes.";
    await stubGenerateEndpoint(page, [draftText]);

    // Open settings, capture baseline context value
    await openSettingsForFirstProject(page);
    const contextTextarea = page.getByTestId(CONTEXT_TEXTAREA_TESTID);
    await expect(contextTextarea).toBeVisible();
    const baseline = (await contextTextarea.inputValue()) ?? "";

    // Open the helper modal
    await page.getByTestId(HELP_TRIGGER_TESTID).click();
    const briefInput = page.getByTestId(HELPER_BRIEF_INPUT_TESTID);
    await expect(briefInput).toBeVisible();
    await expect(briefInput).toHaveValue("");

    // Type a valid brief (≥ 10 chars, ≤ 500)
    await briefInput.fill("psychedelic mushroom poster shop with trippy vibes");

    // Click Generate
    await page.getByTestId(HELPER_GENERATE_TESTID).click();

    // Wait for the draft preview to appear
    const preview = page.getByTestId(HELPER_DRAFT_PREVIEW_TESTID);
    await expect(preview).toBeVisible();
    await expect(preview).toHaveText(draftText);

    // Click Accept (helper_accept_btn)
    await page.getByTestId(HELPER_ACCEPT_TESTID).click();

    // Helper modal closes
    await expect(briefInput).toBeHidden();

    // Parent context_textarea now contains the draft
    await expect(contextTextarea).toHaveValue(draftText);
    // And the value is different from baseline (proves the write happened)
    expect(draftText).not.toBe(baseline);
  });

  // -------------------------------------------------------------------------
  // AC-9 sub-case (a): Regenerate replaces an already-shown draft
  // -------------------------------------------------------------------------

  test("AC-9 (a): Regenerate replaces the previously shown draft with the new one", async ({
    page,
  }) => {
    const drafts = ["first-generated-draft", "second-regenerated-draft"];
    await stubGenerateEndpoint(page, drafts);

    await openSettingsForFirstProject(page);

    await page.getByTestId(HELP_TRIGGER_TESTID).click();
    const briefInput = page.getByTestId(HELPER_BRIEF_INPUT_TESTID);
    await briefInput.fill("valid brief content for the regenerate sub case");

    // First Generate
    await page.getByTestId(HELPER_GENERATE_TESTID).click();
    const preview = page.getByTestId(HELPER_DRAFT_PREVIEW_TESTID);
    await expect(preview).toHaveText(drafts[0]);

    // Click Regenerate
    await page.getByTestId(HELPER_REGENERATE_TESTID).click();

    // Preview now shows the SECOND draft, fully replacing the first
    await expect(preview).toHaveText(drafts[1]);
    // First draft text is gone (no append, no history)
    await expect(preview).not.toHaveText(drafts[0]);

    // Accept writes the SECOND draft into the parent textarea
    await page.getByTestId(HELPER_ACCEPT_TESTID).click();
    await expect(briefInput).toBeHidden();

    const contextTextarea = page.getByTestId(CONTEXT_TEXTAREA_TESTID);
    await expect(contextTextarea).toHaveValue(drafts[1]);
  });

  // -------------------------------------------------------------------------
  // AC-9 sub-case (b): Cancel after generate leaves parent textarea unchanged
  // -------------------------------------------------------------------------

  test("AC-9 (b): Cancel after generating draft does not modify context_textarea", async ({
    page,
  }) => {
    const draftText = "this draft should NEVER reach the parent textarea";
    await stubGenerateEndpoint(page, [draftText]);

    await openSettingsForFirstProject(page);
    const contextTextarea = page.getByTestId(CONTEXT_TEXTAREA_TESTID);
    const baseline = (await contextTextarea.inputValue()) ?? "";

    await page.getByTestId(HELP_TRIGGER_TESTID).click();
    const briefInput = page.getByTestId(HELPER_BRIEF_INPUT_TESTID);
    await briefInput.fill("valid brief content for the cancel sub case here");

    await page.getByTestId(HELPER_GENERATE_TESTID).click();

    const preview = page.getByTestId(HELPER_DRAFT_PREVIEW_TESTID);
    await expect(preview).toHaveText(draftText);

    // Click Cancel — NOT Accept
    await page.getByTestId(HELPER_CANCEL_TESTID).click();

    // Helper modal closes
    await expect(briefInput).toBeHidden();

    // Parent textarea unchanged — exactly the baseline value
    await expect(contextTextarea).toHaveValue(baseline);
  });
});
