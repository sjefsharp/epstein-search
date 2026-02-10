import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";

test.describe("Accessibility (axe-core)", () => {
  test.describe.configure({ timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    // Dismiss age gate by setting localStorage before navigation
    await page.addInitScript(() => {
      localStorage.setItem(
        "epstein-age-storage",
        JSON.stringify({ state: { verified: true }, version: 0 }),
      );
    });
  });

  test("home page has no axe violations", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoHome("en");
    await home.dismissConsentIfVisible();
    await home.expectLoaded();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("about page has no axe violations", async ({ page }) => {
    const about = new AboutPage(page);
    await about.gotoAbout("en");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("faq page has no axe violations", async ({ page }) => {
    const faq = new FAQPage(page);
    await faq.gotoFAQ("en");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("privacy page has no axe violations", async ({ page }) => {
    const privacy = new PrivacyPage(page);
    await privacy.gotoPrivacy("en");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("age gate dialog has no axe violations", async ({ page }) => {
    // Navigate WITHOUT pre-setting age storage so gate is visible
    await page.addInitScript(() => {
      localStorage.removeItem("epstein-age-storage");
    });
    await page.goto("/en");
    await expect(page.getByRole("button", { name: /18|I am 18/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
