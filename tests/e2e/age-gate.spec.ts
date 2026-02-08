import { test, expect } from "@playwright/test";

test.describe("Age verification gate", () => {
  test("blocks content on first visit and unlocks after confirmation", async ({ page }) => {
    await page.goto("/en");

    // Age gate should be visible
    const confirmButton = page.getByRole("button", { name: /18|I am 18/i });
    await expect(confirmButton).toBeVisible();

    // Verify the gate has proper ARIA attributes
    const dialog = page.locator("[role='alertdialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Click confirm
    await confirmButton.click();

    // Gate should disappear
    await expect(dialog).not.toBeVisible();

    // Page content should now be accessible
    await expect(
      page.getByRole("heading", {
        name: /search, analyze and contextualize/i,
      }),
    ).toBeVisible();
  });

  test("persists verification after page reload", async ({ page }) => {
    await page.goto("/en");

    // Dismiss age gate
    const confirmButton = page.getByRole("button", { name: /18|I am 18/i });
    await confirmButton.click();

    // Reload
    await page.reload();

    // Age gate should NOT appear again
    const dialog = page.locator("[role='alertdialog']");
    await expect(dialog).not.toBeVisible();
  });

  test("confirm button receives focus automatically", async ({ page }) => {
    await page.goto("/en");

    const confirmButton = page.getByRole("button", { name: /18|I am 18/i });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeFocused();
  });
});
