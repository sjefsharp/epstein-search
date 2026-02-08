import { test, expect } from "@playwright/test";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "epstein-age-storage",
        JSON.stringify({ state: { verified: true }, version: 0 }),
      );
    });
  });

  test("desktop nav links navigate to all pages", async ({ page }) => {
    const home = new HomePage(page);
    await home.gotoHome("en");
    await home.dismissConsentIfVisible();

    // Click About link in navigation
    await page.getByRole("link", { name: /about/i }).first().click();
    await expect(page).toHaveURL(/\/en\/about/);

    // Click FAQ link
    await page.getByRole("link", { name: /faq/i }).first().click();
    await expect(page).toHaveURL(/\/en\/faq/);

    // Click Privacy link
    await page
      .getByRole("link", { name: /privacy/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/privacy/);

    // Click Home link to go back
    await page.getByRole("link", { name: /home/i }).first().click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("breadcrumbs render on sub-pages with correct links", async ({ page }) => {
    const about = new AboutPage(page);
    await about.gotoAbout("en");
    await about.expectLoaded();

    // Breadcrumb nav should exist
    await expect(about.breadcrumbNav.first()).toBeVisible();

    // Home link in breadcrumbs should work
    await about.breadcrumbHome.click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("breadcrumbs show on FAQ page", async ({ page }) => {
    const faq = new FAQPage(page);
    await faq.gotoFAQ("en");
    await faq.expectLoaded();

    await expect(faq.breadcrumbNav.first()).toBeVisible();
  });

  test("breadcrumbs show on Privacy page", async ({ page }) => {
    const privacy = new PrivacyPage(page);
    await privacy.gotoPrivacy("en");
    await privacy.expectLoaded();

    await expect(privacy.breadcrumbNav.first()).toBeVisible();
  });

  test("footer is visible on all pages", async ({ page }) => {
    // Home
    await page.goto("/en");
    await expect(page.locator("footer")).toBeVisible();

    // About
    await page.goto("/en/about");
    await expect(page.locator("footer")).toBeVisible();

    // FAQ
    await page.goto("/en/faq");
    await expect(page.locator("footer")).toBeVisible();

    // Privacy
    await page.goto("/en/privacy");
    await expect(page.locator("footer")).toBeVisible();
  });
});
