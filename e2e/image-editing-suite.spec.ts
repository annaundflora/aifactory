import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_SESSION_ID = "e2e-canvas-session-001";
const MOCK_MASK_URL = "https://pub-test.r2.dev/masks/e2e-test-mask.png";

// ---------------------------------------------------------------------------
// SSE Helpers
// ---------------------------------------------------------------------------

/**
 * Build an SSE response body containing a canvas-generate event.
 * The frontend's consumeSSEStream parser expects: `event: {type}\ndata: {json}\n\n`
 */
function buildCanvasGenerateSSE(
  action: string,
  prompt: string,
  extras: Record<string, unknown> = {}
): string {
  const data = JSON.stringify({
    action,
    prompt,
    model_id: "black-forest-labs/flux-fill-pro",
    params: {},
    ...extras,
  });
  return `event: canvas-generate\ndata: ${data}\n\n`;
}

// ---------------------------------------------------------------------------
// Navigation Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate into the first available workspace project.
 * Falls back to creating a project if none exist.
 * Pattern reused from e2e/model-slots.spec.ts.
 */
async function navigateToWorkspace(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const projectLink = page.locator("a[href^='/projects/']").first();
  const exists = (await projectLink.count()) > 0;

  if (exists) {
    await projectLink.click();
  } else {
    const nameInput = page.getByPlaceholder("Project name");
    await nameInput.fill("E2E Editing Project");
    await nameInput.press("Enter");
    await page.waitForURL(/\/projects\//, { timeout: 15_000 });
  }

  await page
    .getByTestId("prompt-area")
    .waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Open the canvas detail view by clicking the first image in the gallery.
 * Assumes at least one completed generation exists.
 */
async function openCanvasDetailView(page: Page) {
  const galleryGrid = page.getByTestId("gallery-grid");
  await galleryGrid.waitFor({ state: "visible", timeout: 15_000 });

  const firstImage = galleryGrid
    .locator("[data-testid='generation-card-image']")
    .first();
  await firstImage.waitFor({ state: "visible", timeout: 15_000 });
  await firstImage.click();

  await page
    .getByTestId("canvas-detail-view")
    .waitFor({ state: "visible", timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Interaction Helpers
// ---------------------------------------------------------------------------

/**
 * Read the current `src` of the canvas image element.
 */
async function getCanvasImageSrc(page: Page): Promise<string | null> {
  const img = page.getByTestId("canvas-image");
  await img.waitFor({ state: "visible", timeout: 10_000 });
  return img.getAttribute("src");
}

/**
 * Simulate painting a mask stroke via mouse drag on the MaskCanvas element.
 * Draws a diagonal line from 30 % to 70 % of the element with intermediate
 * points for realistic coverage.
 */
async function paintMaskStroke(page: Page) {
  const maskCanvas = page.getByTestId("mask-canvas");
  await maskCanvas.waitFor({ state: "visible", timeout: 10_000 });

  const box = await maskCanvas.boundingBox();
  if (!box) throw new Error("MaskCanvas bounding box not found");

  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.7;
  const endY = box.y + box.height * 0.7;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    await page.mouse.move(
      startX + (endX - startX) * t,
      startY + (endY - startY) * t
    );
  }
  await page.mouse.up();
}

/**
 * Fill the canvas chat input and click the send button.
 */
async function sendChatPrompt(page: Page, prompt: string) {
  const textarea = page.getByTestId("chat-input-textarea");
  await textarea.waitFor({ state: "visible", timeout: 10_000 });
  await textarea.fill(prompt);

  const sendBtn = page.getByTestId("send-btn");
  await sendBtn.click();
}

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

/**
 * Mock canvas SSE endpoints so the chat flow works without a real backend.
 *
 * - POST /api/assistant/canvas/sessions        -> returns mock session ID
 * - POST /api/assistant/canvas/sessions/x/messages -> returns SSE stream
 */
async function mockCanvasSSE(page: Page, sseBody: string) {
  // Session creation
  await page.route("**/api/assistant/canvas/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const segments = url.pathname.split("/").filter(Boolean);
    // Only match the collection endpoint (4 path segments)
    if (segments.length === 4) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: MOCK_SESSION_ID }),
      });
      return;
    }
    await route.continue();
  });

  // Message sending — returns SSE stream
  await page.route(
    "**/api/assistant/canvas/sessions/*/messages",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: sseBody,
      });
    }
  );
}

/**
 * Mock POST /api/sam/segment to return a mask URL without hitting Replicate.
 */
async function mockSamSegment(page: Page) {
  await page.route("**/api/sam/segment", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mask_url: MOCK_MASK_URL }),
    });
  });
}

/**
 * Assert the undo button is in an active (enabled) state.
 * The canvas undo button uses `aria-disabled` + opacity rather than HTML disabled.
 */
async function assertUndoEnabled(page: Page) {
  const undoButton = page.getByTestId("undo-button");
  await undoButton.waitFor({ state: "visible", timeout: 5_000 });
  await expect(undoButton).not.toHaveAttribute("aria-disabled", "true", {
    timeout: 30_000,
  });
}

/**
 * Wait for the canvas image src to differ from the initial value.
 */
async function waitForImageChange(
  page: Page,
  initialSrc: string | null,
  timeoutMs = 60_000
) {
  const img = page.getByTestId("canvas-image");
  await expect(img).not.toHaveAttribute("src", initialSrc ?? "", {
    timeout: timeoutMs,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Image Editing Suite E2E", () => {
  // -------------------------------------------------------------------------
  // AC-1: Inpaint — brush mask + chat prompt -> image replaced
  // -------------------------------------------------------------------------
  test("inpaint: should paint mask, send prompt, and replace canvas image", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await openCanvasDetailView(page);

    const initialSrc = await getCanvasImageSrc(page);

    // Mock SSE: chat message returns canvas-generate with inpaint action
    await mockCanvasSSE(
      page,
      buildCanvasGenerateSSE("inpaint", "Replace with a red dress")
    );

    // 1. Activate brush-edit (inpaint) mode via toolbar
    await page.getByTestId("toolbar-brush-edit").click();

    // 2. Paint a mask on the MaskCanvas
    await paintMaskStroke(page);

    // 3. Send prompt via chat — SSE mock triggers handleCanvasGenerate
    await sendChatPrompt(page, "Replace with a red dress");

    // 4. Wait for image to change (generation pipeline: uploadMask -> generateImages -> polling)
    await waitForImageChange(page, initialSrc);

    // 5. Undo button should be enabled (PUSH_UNDO dispatched by polling)
    await assertUndoEnabled(page);
  });

  // -------------------------------------------------------------------------
  // AC-2: Erase — brush mask + erase button -> image replaced
  // -------------------------------------------------------------------------
  test("erase: should paint mask, click remove button, and replace canvas image", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await openCanvasDetailView(page);

    const initialSrc = await getCanvasImageSrc(page);

    // 1. Activate erase mode via toolbar
    await page.getByTestId("toolbar-erase").click();

    // 2. Paint a mask on the MaskCanvas
    await paintMaskStroke(page);

    // 3. Click the "Entfernen" button in the floating brush toolbar
    const eraseBtn = page.getByTestId("erase-action-btn");
    await eraseBtn.waitFor({ state: "visible", timeout: 5_000 });
    await eraseBtn.click();

    // 4. Wait for image to change (direct: uploadMask -> generateImages -> polling)
    await waitForImageChange(page, initialSrc);

    // 5. Undo button should be enabled
    await assertUndoEnabled(page);
  });

  // -------------------------------------------------------------------------
  // AC-3: Instruction Edit — prompt without mask/tool -> image replaced
  // -------------------------------------------------------------------------
  test("instruction edit: should send prompt without mask and replace canvas image", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await openCanvasDetailView(page);

    const initialSrc = await getCanvasImageSrc(page);

    // Mock SSE: returns canvas-generate with instruction action
    await mockCanvasSSE(
      page,
      buildCanvasGenerateSSE("instruction", "Make the sky bluer")
    );

    // 1. Send prompt WITHOUT activating any editing tool
    await sendChatPrompt(page, "Make the sky bluer");

    // 2. Wait for image to change
    await waitForImageChange(page, initialSrc);

    // 3. Undo button should be enabled
    await assertUndoEnabled(page);
  });

  // -------------------------------------------------------------------------
  // AC-4: Click-to-Edit — click -> SAM mask -> prompt -> image replaced
  // -------------------------------------------------------------------------
  test("click-to-edit: should click image for SAM mask, send prompt, and replace canvas image", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await openCanvasDetailView(page);

    // Mock SAM segment endpoint
    await mockSamSegment(page);

    // 1. Activate click-edit tool
    await page.getByTestId("toolbar-click-edit").click();

    // 2. Click on the canvas image to trigger SAM segmentation
    const imageArea = page.getByTestId("canvas-image-area");
    await imageArea.waitFor({ state: "visible", timeout: 5_000 });
    const box = await imageArea.boundingBox();
    if (!box) throw new Error("Canvas image area bounding box not found");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    // 3. After mocked SAM returns, editMode transitions to inpaint.
    //    MaskCanvas should appear with the SAM-generated mask overlay.
    const maskCanvas = page.getByTestId("mask-canvas");
    await maskCanvas.waitFor({ state: "visible", timeout: 15_000 });

    // 4. Floating brush toolbar appears (confirms editMode = "inpaint")
    await page
      .getByTestId("floating-brush-toolbar")
      .waitFor({ state: "visible", timeout: 10_000 });

    // 5. Send a prompt to replace the SAM-masked area
    const initialSrc = await getCanvasImageSrc(page);
    await mockCanvasSSE(
      page,
      buildCanvasGenerateSSE("inpaint", "Replace with a cat")
    );
    await sendChatPrompt(page, "Replace with a cat");

    // 6. Wait for image to change
    await waitForImageChange(page, initialSrc);
  });

  // -------------------------------------------------------------------------
  // AC-5: Outpaint — select direction + prompt -> extended image
  // -------------------------------------------------------------------------
  test("outpaint: should select direction, send prompt, and replace canvas image with extended result", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await openCanvasDetailView(page);

    const initialSrc = await getCanvasImageSrc(page);

    // Mock SSE: returns canvas-generate with outpaint action + directions
    await mockCanvasSSE(
      page,
      buildCanvasGenerateSSE("outpaint", "Extend with blue sky", {
        outpaint_directions: ["top"],
        outpaint_size: 50,
      })
    );

    // 1. Activate outpaint (expand) mode via toolbar
    await page.getByTestId("toolbar-expand").click();

    // 2. OutpaintControls should appear; select "top" direction
    await page
      .getByTestId("outpaint-controls")
      .waitFor({ state: "visible", timeout: 10_000 });
    await page.getByTestId("outpaint-direction-top").click();

    // 3. Send prompt via chat
    await sendChatPrompt(page, "Extend with blue sky");

    // 4. Wait for image to change
    await waitForImageChange(page, initialSrc);

    // 5. Undo button should be enabled
    await assertUndoEnabled(page);
  });
});
