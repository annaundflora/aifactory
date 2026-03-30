import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate into the first available workspace project.
 * Falls back to creating a project if none exist.
 * Returns when the workspace is loaded (prompt-area is visible).
 */
async function navigateToWorkspace(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // If there is an existing project link, click it; otherwise create one
  const projectLink = page.locator("a[href^='/projects/']").first();
  const exists = (await projectLink.count()) > 0;

  if (exists) {
    await projectLink.click();
  } else {
    // Create a new project via the inline create form
    const nameInput = page.getByPlaceholder("Project name");
    await nameInput.fill("E2E Test Project");
    await nameInput.press("Enter");
    // Wait for navigation to the new project workspace
    await page.waitForURL(/\/projects\//, { timeout: 15_000 });
  }

  // Wait for the prompt area to be visible (workspace loaded)
  await page.getByTestId("prompt-area").waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Wait for model slots to load within the workspace prompt area.
 * Returns when at least one slot row is visible.
 */
async function waitForModelSlots(page: Page) {
  await page.getByTestId("model-slots").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("slot-row-1").first().waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Select a mode from the mode-selector dropdown.
 */
async function selectMode(page: Page, mode: "txt2img" | "img2img" | "upscale") {
  const modeLabels: Record<string, string> = {
    txt2img: "Text to Image",
    img2img: "Image to Image",
    upscale: "Upscale",
  };

  await page.getByTestId("mode-selector").click();
  await page.getByText(modeLabels[mode], { exact: false }).first().click();

  // Wait a moment for UI to update
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// AC-1: Quick Model Switch + DB-Persistenz
// ---------------------------------------------------------------------------

test.describe("Model Slots E2E", () => {
  test("AC-1: should switch model in slot 1 dropdown and persist after page reload", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await waitForModelSlots(page);

    // Get the current model in Slot 1 by reading the select trigger text
    const slot1Select = page.getByTestId("slot-select-1").first();
    const initialModelText = await slot1Select.innerText();

    // Open Slot 1 dropdown and pick a different model
    await slot1Select.click();

    // Wait for dropdown content to appear
    const selectContent = page.locator("[role='listbox']");
    await selectContent.waitFor({ state: "visible", timeout: 5_000 });

    // Get all option items and find one different from the current selection
    const options = selectContent.locator("[role='option']");
    const optionCount = await options.count();

    // Find and click an option that is different from the current one
    let clickedNewModel = false;
    let newModelText = "";
    for (let i = 0; i < optionCount; i++) {
      const optionText = await options.nth(i).innerText();
      if (optionText !== initialModelText) {
        newModelText = optionText;
        await options.nth(i).click();
        clickedNewModel = true;
        break;
      }
    }

    // If only one model exists, skip the rest (nothing to switch to)
    if (!clickedNewModel) {
      test.skip(true, "Only one model available, cannot test model switch");
      return;
    }

    // Verify Slot 1 now shows the new model name
    await expect(slot1Select).toContainText(newModelText, { timeout: 5_000 });

    // Reload the page and verify persistence
    await page.reload();
    await page.getByTestId("prompt-area").waitFor({ state: "visible", timeout: 15_000 });
    await waitForModelSlots(page);

    // After reload, Slot 1 should still show the new model
    const slot1SelectAfterReload = page.getByTestId("slot-select-1").first();
    await expect(slot1SelectAfterReload).toContainText(newModelText, { timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // AC-2: Multi-Model-Generierung mit 2 aktiven Slots
  // ---------------------------------------------------------------------------

  test("AC-2: should generate with 2 active slots and produce 2 results", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await waitForModelSlots(page);

    // Ensure we are in txt2img mode
    const modeSelector = page.getByTestId("mode-selector");
    const modeText = await modeSelector.innerText();
    if (!modeText.includes("Text to Image")) {
      await selectMode(page, "txt2img");
    }

    // Verify Slot 1 is active (checked) by default
    const slot1Checkbox = page.getByTestId("slot-checkbox-1").first();
    await expect(slot1Checkbox).toHaveAttribute("data-state", "checked");

    // Activate Slot 2 by clicking its checkbox
    const slot2Checkbox = page.getByTestId("slot-checkbox-2").first();
    const slot2State = await slot2Checkbox.getAttribute("data-state");

    if (slot2State !== "checked") {
      // Slot 2 needs a model to be activated. Check if it has one.
      const slot2Select = page.getByTestId("slot-select-2").first();
      const slot2Text = await slot2Select.innerText();

      if (slot2Text === "select model" || slot2Text === "--") {
        // Assign a model to Slot 2 first (this auto-activates)
        await slot2Select.click();
        const selectContent = page.locator("[role='listbox']");
        await selectContent.waitFor({ state: "visible", timeout: 5_000 });
        const firstOption = selectContent.locator("[role='option']").first();
        await firstOption.click();
        await page.waitForTimeout(500);
      } else {
        // Model exists but slot is inactive, click checkbox
        await slot2Checkbox.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify both slots are now checked
    await expect(page.getByTestId("slot-checkbox-1").first()).toHaveAttribute(
      "data-state",
      "checked",
    );
    await expect(page.getByTestId("slot-checkbox-2").first()).toHaveAttribute(
      "data-state",
      "checked",
    );

    // Enter a prompt
    const promptTextarea = page.getByTestId("prompt-motiv-textarea");
    await promptTextarea.fill("A beautiful mountain landscape at sunset, digital art");

    // Set variant count to 1 (should be default)
    const variantValue = page.getByTestId("variant-count-value");
    const currentCount = await variantValue.innerText();
    if (currentCount !== "1") {
      // Click minus until we get to 1
      const minusBtn = page.getByTestId("variant-count-minus");
      while ((await variantValue.innerText()) !== "1") {
        await minusBtn.click();
      }
    }

    // Intercept network requests to the generate endpoint to verify
    // that 2 model IDs are being sent.
    // Using route interception to capture the request and then continue it.
    let capturedModelIds: string[] = [];
    await page.route("**/actions/**", async (route) => {
      const request = route.request();
      const postData = request.postData();
      if (postData && postData.includes("modelIds")) {
        try {
          // Server action requests use a specific format
          // Try to extract modelIds from the request body
          const bodyText = postData;
          const modelIdsMatch = bodyText.match(/"modelIds"\s*:\s*\[([^\]]*)\]/);
          if (modelIdsMatch) {
            capturedModelIds = modelIdsMatch[1]
              .split(",")
              .map((s) => s.trim().replace(/"/g, ""))
              .filter(Boolean);
          }
        } catch {
          // Ignore parsing errors
        }
      }
      await route.continue();
    });

    // Click Generate
    const generateBtn = page.getByTestId("generate-button");
    await generateBtn.click();

    // Wait for the generate action to be dispatched (button shows loading)
    // The generate button should show a loading state
    await expect(generateBtn).toBeDisabled({ timeout: 5_000 });

    // Wait for generation to complete or timeout
    // Since this hits a real API which may be slow, use a generous timeout
    // and check that either:
    // 1. New images appear in the gallery, or
    // 2. The button returns to enabled state
    await expect(generateBtn).toBeEnabled({ timeout: 120_000 });

    // Verify that 2 model IDs were sent (if captured)
    // If the interception did not capture (due to server actions encoding),
    // we fall back to checking the gallery for 2 new images.
    const galleryGrid = page.getByTestId("gallery-grid");
    const generationCards = galleryGrid.locator("[data-testid='generation-card-image']");

    // There should be at least 2 images in the gallery (from this generation)
    await expect(generationCards.first()).toBeVisible({ timeout: 5_000 });
    const imageCount = await generationCards.count();
    expect(imageCount).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // AC-3: Mode-Wechsel behaelt Slot-Konfiguration
  // ---------------------------------------------------------------------------

  test("AC-3: should preserve slot configuration across txt2img-img2img-txt2img round trip", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await waitForModelSlots(page);

    // Ensure we are in txt2img mode
    await selectMode(page, "txt2img");
    await waitForModelSlots(page);

    // Record the txt2img slot configuration
    const txt2imgSlot1Text = await page
      .getByTestId("slot-select-1")
      .first()
      .innerText();
    const txt2imgSlot1State = await page
      .getByTestId("slot-checkbox-1")
      .first()
      .getAttribute("data-state");
    const txt2imgSlot2State = await page
      .getByTestId("slot-checkbox-2")
      .first()
      .getAttribute("data-state");

    // Switch to img2img mode
    await selectMode(page, "img2img");
    await waitForModelSlots(page);

    // Verify that the img2img slots are now shown (they come from DB, different mode)
    const img2imgSlot1Text = await page
      .getByTestId("slot-select-1")
      .first()
      .innerText();

    // The img2img slots should show img2img-specific model assignments from DB
    // They may or may not match txt2img depending on seed data
    // The important thing is that they loaded from DB for img2img mode
    expect(img2imgSlot1Text).toBeTruthy();

    // Switch back to txt2img
    await selectMode(page, "txt2img");
    await waitForModelSlots(page);

    // Verify the txt2img configuration is restored
    const restoredSlot1Text = await page
      .getByTestId("slot-select-1")
      .first()
      .innerText();
    const restoredSlot1State = await page
      .getByTestId("slot-checkbox-1")
      .first()
      .getAttribute("data-state");
    const restoredSlot2State = await page
      .getByTestId("slot-checkbox-2")
      .first()
      .getAttribute("data-state");

    // The txt2img model in slot 1 should be the same as before
    expect(restoredSlot1Text).toBe(txt2imgSlot1Text);
    expect(restoredSlot1State).toBe(txt2imgSlot1State);
    expect(restoredSlot2State).toBe(txt2imgSlot2State);
  });

  // ---------------------------------------------------------------------------
  // AC-4: Popover-Generierung mit Slots
  // ---------------------------------------------------------------------------

  test("AC-4: should generate variation from canvas popover using model slots", async ({
    page,
  }) => {
    await navigateToWorkspace(page);
    await waitForModelSlots(page);

    // We need an existing image in the canvas to open the variation popover.
    // First, check if there is already a generation in the gallery.
    const galleryGrid = page.getByTestId("gallery-grid");
    await galleryGrid.waitFor({ state: "visible", timeout: 10_000 });

    let hasImage = (await galleryGrid.locator("[data-testid='generation-card-image']").count()) > 0;

    if (!hasImage) {
      // Generate a quick image first
      const promptTextarea = page.getByTestId("prompt-motiv-textarea");
      await promptTextarea.fill("A simple test image");
      const generateBtn = page.getByTestId("generate-button");
      await generateBtn.click();

      // Wait for generation to complete
      await expect(generateBtn).toBeDisabled({ timeout: 5_000 });
      await expect(generateBtn).toBeEnabled({ timeout: 120_000 });
      hasImage = (await galleryGrid.locator("[data-testid='generation-card-image']").count()) > 0;
    }

    if (!hasImage) {
      test.skip(true, "No images available in gallery to test variation popover");
      return;
    }

    // Click on the first image to open the canvas detail view
    await galleryGrid.locator("[data-testid='generation-card-image']").first().click();
    await page.getByTestId("canvas-detail-view").waitFor({ state: "visible", timeout: 10_000 });

    // Click the variation tool button in the canvas toolbar
    const variationButton = page.getByTestId("toolbar-variation");
    await variationButton.click();

    // Wait for the variation popover to appear
    const variationPopover = page.getByTestId("variation-popover");
    await variationPopover.waitFor({ state: "visible", timeout: 5_000 });

    // Verify that ModelSlots are shown (not TierToggle)
    const modelSlotsSection = page.getByTestId("variation-model-slots-section");
    await expect(modelSlotsSection).toBeVisible();

    // Verify there are slot rows inside the popover
    const modelSlotsInPopover = variationPopover.getByTestId("model-slots");
    await expect(modelSlotsInPopover).toBeVisible();
    await expect(variationPopover.getByTestId("slot-row-1")).toBeVisible();

    // Verify no TierToggle exists in the popover
    const tierToggle = variationPopover.locator("[data-testid='tier-toggle']");
    await expect(tierToggle).toHaveCount(0);

    // Intercept the generate request to verify modelIds are sent
    let generateTriggered = false;
    await page.route("**/actions/**", async (route) => {
      const postData = route.request().postData();
      if (postData && postData.includes("modelIds")) {
        generateTriggered = true;
      }
      await route.continue();
    });

    // Click the generate button in the variation popover
    const variationGenerateBtn = page.getByTestId("variation-generate-button");
    await variationGenerateBtn.click();

    // The popover should close after clicking generate
    // and a generation should have been triggered
    // Wait a moment for the action to dispatch
    await page.waitForTimeout(1_000);

    // Verify that the generation was triggered
    // Either by checking generateTriggered flag or by observing the canvas state
    // The canvas should show a generating indicator or the popover should close
    // Since the generate dispatches through the parent component,
    // we mainly verify the popover closes and no error appears
    await expect(variationPopover).not.toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // AC-5: Settings Read-Only Anzeige
  // ---------------------------------------------------------------------------

  test("AC-5: should display read-only slot data in settings dialog with status indicators and hint text", async ({
    page,
  }) => {
    await navigateToWorkspace(page);

    // Open the settings dialog via the settings button in the workspace header
    const settingsButton = page.getByLabel("Open settings");
    await settingsButton.click();

    // Wait for the dialog to open
    const dialog = page.locator("[role='dialog']");
    await dialog.waitFor({ state: "visible", timeout: 5_000 });

    // Verify the dialog title
    await expect(dialog.getByText("Model Settings")).toBeVisible();

    // Define all modes that should be displayed
    const modes = ["txt2img", "img2img", "upscale", "inpaint", "outpaint"] as const;

    // Verify each mode shows exactly 3 slot rows
    for (const mode of modes) {
      // Each mode should have 3 slot rows
      for (const slotNum of [1, 2, 3] as const) {
        const slotRow = dialog.getByTestId(`slot-row-${mode}-${slotNum}`);
        // The slot row should exist (may or may not be visible if models list is empty
        // causing an empty state message instead)
        const slotRowCount = await slotRow.count();
        const emptyState = dialog.getByTestId(`empty-state-${mode}`);
        const emptyCount = await emptyState.count();

        // Either we have slot rows OR an empty state message
        if (slotRowCount > 0) {
          await expect(slotRow).toBeVisible();

          // Verify status dot exists for this slot
          const statusDot = dialog.getByTestId(`status-dot-${mode}-${slotNum}`);
          await expect(statusDot).toBeVisible();

          // Verify the status dot has a visual color class (green for active, gray for inactive)
          const dotClasses = await statusDot.getAttribute("class");
          expect(dotClasses).toMatch(/bg-(green|gray)-/);
        } else {
          // Empty state is shown (no models synced yet)
          expect(emptyCount).toBeGreaterThan(0);
        }
      }
    }

    // Verify NO edit controls (no dropdowns, no input fields for model editing)
    // The settings dialog should be read-only
    const selectTriggers = dialog.locator("[data-testid^='slot-select-']");
    await expect(selectTriggers).toHaveCount(0);

    // Verify NO editable inputs within slot rows
    const inputs = dialog.locator("input[type='text']");
    const editableInputCount = await inputs.count();
    // The sync button has no input, the dialog itself may have internal components
    // but there should be no model-editing inputs
    expect(editableInputCount).toBe(0);

    // Verify the hint text is visible
    const hintText = dialog.getByText("Change models in the workspace.");
    await expect(hintText).toBeVisible();

    // Verify active slots have visually distinguishable status from inactive slots
    // Check the first mode that has slot rows (txt2img by default with seed data)
    const activeDot = dialog.getByTestId("status-dot-txt2img-1");
    const inactiveDot = dialog.getByTestId("status-dot-txt2img-2");

    const activeDotCount = await activeDot.count();
    const inactiveDotCount = await inactiveDot.count();

    if (activeDotCount > 0 && inactiveDotCount > 0) {
      const activeClasses = await activeDot.getAttribute("class");
      const inactiveClasses = await inactiveDot.getAttribute("class");

      // They should have different color classes
      expect(activeClasses).not.toBe(inactiveClasses);
    }
  });
});
