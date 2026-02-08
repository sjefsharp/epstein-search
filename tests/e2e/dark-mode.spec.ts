import { test, expect } from "@playwright/test";
import HomePage from "./pages/HomePage";

test.describe("Dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "epstein-age-storage",
        JSON.stringify({ state: { verified: true }, version: 0 }),
      );
    });
  });

  test("toggles dark mode and persists preference", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoHome("en");
    await home.dismissConsentIfVisible();

    // Open theme dropdown
    const themeButton = page.getByRole("button", { name: /theme/i });
    await themeButton.click();

    // Select dark mode
    await page.getByRole("menuitem", { name: /dark/i }).click();

    // Verify dark class is applied
    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(true);

    // Reload and verify persistence
    await page.reload();
    await home.dismissConsentIfVisible();

    const isDarkAfterReload = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(isDarkAfterReload).toBe(true);
  });

  test("toggles light mode", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoHome("en");
    await home.dismissConsentIfVisible();

    const themeButton = page.getByRole("button", { name: /theme/i });
    await themeButton.click();
    await page.getByRole("menuitem", { name: /light/i }).click();

    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(false);
  });

  test("system mode follows prefers-color-scheme", async ({ page }) => {
    // Emulate dark system preference
    await page.emulateMedia({ colorScheme: "dark" });

    const home = new HomePage(page);
    await home.gotoHome("en");
    await home.dismissConsentIfVisible();

    const themeButton = page.getByRole("button", { name: /theme/i });
    await themeButton.click();
    await page.getByRole("menuitem", { name: /system/i }).click();

    const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(isDark).toBe(true);
  });
});
