import { test, expect, type Page } from "@playwright/test";

/**
 * E2E Acceptance Tests for Slice 22 — Multimodal-Indicator UI
 *
 * Source: specs/2026-04-19-29-interactive-prompt-refinement-project-context/
 *         slices/slice-22-multimodal-indicator-ui.md
 *
 * Test-Skeleton (per slice spec, e2e/assistant/multimodal-indicator.spec.ts):
 *   - AC-2 (E2E): img2img with 2 reference slots + 1 generated result →
 *     indicator shows "Sieht: 2 Refs + letztes Ergebnis"
 *   - AC-4 (E2E): txt2img without attachments → indicator is not visible
 *   - AC-7 (E2E): indicator DOM node is rendered as immediate sibling after
 *     chat-input region
 *
 * These E2E tests live as `test.skip` skeletons until a deterministic
 * fixture path exists for:
 *   1. Seeding 2 reference-slot images into a project (Slice 19 sender state).
 *   2. Driving a generation to `status: completed` so Slice 18 dispatches
 *      `SET_LAST_RESULT_IMAGE_URL`.
 *   3. Mounting the assistant panel with the workspace state populated.
 *
 * Running locally requires `pnpm dev` to be up and a logged-in dev user with
 * R2 credentials wired (see `playwright.config.ts` webServer block). The
 * skeleton documents the canonical interaction path so the skip can be
 * removed once a Playwright fixture / API-seed helper is wired up.
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
    await nameInput.fill("E2E Multimodal Indicator Project");
    await nameInput.press("Enter");
    await page.waitForURL(/\/projects\//, { timeout: 15_000 });
  }
  await page
    .getByTestId("prompt-area")
    .waitFor({ state: "visible", timeout: 15_000 });
}

async function openAssistantPanel(page: Page) {
  const trigger = page.getByTestId("assistant-trigger").first();
  if ((await trigger.count()) > 0) {
    await trigger.click();
  }
  await page
    .getByTestId("assistant-sheet")
    .waitFor({ state: "visible", timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// AC-2 — 2 Refs + Result attached → Indicator shows full text
// ---------------------------------------------------------------------------

test.describe.skip("Slice 22 AC-2 (E2E): 2 Refs + last result → 'Sieht: 2 Refs + letztes Ergebnis'", () => {
  test.skip(
    "img2img with 2 reference slots + 1 generated result shows full indicator text",
    async ({ page }) => {
      /**
       * AC-2 (E2E): GIVEN img2img mode + 2 reference slots + 1 completed
       * generation in the same project session
       *  WHEN the assistant panel is opened
       *  THEN the multimodal indicator renders
       *       "Sieht: 2 Refs + letztes Ergebnis"
       *
       * Skeleton path (TODO when fixture lands):
       *  1. Seed project with 2 reference images via API helper.
       *  2. Switch ModeSelector to "Image to Image".
       *  3. Run a fast txt-to-img generation through the workspace and wait
       *     for status=completed to populate `state.lastResultImageUrl`.
       *  4. Open the assistant panel and read the indicator text.
       */
      await navigateToWorkspace(page);

      // TODO: seed 2 reference slots via Slice-19 API helper.
      // TODO: switch to img2img via mode-selector data-testid.
      // TODO: drive a generation to completion (Slice 18 dispatch).

      await openAssistantPanel(page);

      const indicator = page.getByTestId("multimodal-indicator");
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveText("Sieht: 2 Refs + letztes Ergebnis");
    }
  );
});

// ---------------------------------------------------------------------------
// AC-4 — txt2img without attachments → indicator hidden
// ---------------------------------------------------------------------------

test.describe.skip("Slice 22 AC-4 (E2E): txt2img without attachments → indicator hidden", () => {
  test.skip(
    "txt2img without attachments → multimodal indicator is not visible in panel",
    async ({ page }) => {
      /**
       * AC-4 (E2E): GIVEN txt2img mode and no last result and an empty slot
       * store
       *  WHEN the assistant panel is opened
       *  THEN no `[data-testid="multimodal-indicator"]` exists in the DOM.
       *
       * Skeleton path (TODO when fixture lands):
       *  1. Open a fresh project (no prior generations).
       *  2. Ensure ModeSelector is on "Text to Image" (default).
       *  3. Open assistant panel.
       */
      await navigateToWorkspace(page);
      await openAssistantPanel(page);

      const indicator = page.getByTestId("multimodal-indicator");
      await expect(indicator).toHaveCount(0);
    }
  );
});

// ---------------------------------------------------------------------------
// AC-7 — Indicator DOM order: immediate sibling after ChatInput
// ---------------------------------------------------------------------------

test.describe.skip("Slice 22 AC-7 (E2E): indicator follows ChatInput in DOM", () => {
  test.skip(
    "indicator DOM node is rendered as immediate sibling after chat-input region",
    async ({ page }) => {
      /**
       * AC-7 (E2E): GIVEN <AssistantPanelContent> is rendered
       *  WHEN the panel DOM is inspected
       *  THEN <MultimodalIndicator> follows directly after <ChatInput>
       *  in the same flex column (per wireframes Annotation ④).
       *
       * Skeleton path (TODO when fixture lands):
       *  1. Open project + assistant panel.
       *  2. Trigger a multimodal-attachable state so the indicator is
       *     visible (e.g. img2img + 1 ref) — otherwise AC-4 would hide it.
       *  3. Read the chat-input element's nextElementSibling and assert it
       *     is the multimodal-indicator.
       */
      await navigateToWorkspace(page);
      // TODO: seed a state where the indicator is visible.
      await openAssistantPanel(page);

      const chatInput = page.getByTestId("chat-input");
      await expect(chatInput).toBeVisible();

      // Use page.evaluate to walk the live DOM and verify the immediate
      // sibling relation. The indicator must be the chat-input's next
      // element sibling.
      const isImmediateSibling = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="chat-input"]');
        const next = input?.nextElementSibling ?? null;
        return next?.getAttribute("data-testid") === "multimodal-indicator";
      });

      expect(isImmediateSibling).toBe(true);
    }
  );
});
