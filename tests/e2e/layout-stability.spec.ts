import { test, expect } from "@playwright/test";

test.describe("Layout stability", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "epstein-age-storage",
        JSON.stringify({ state: { verified: true }, version: 0 }),
      );
    });
  });

  test("no horizontal overflow on home page", async ({ page }) => {
    await page.goto("/en");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("no horizontal overflow on about page", async ({ page }) => {
    await page.goto("/en/about");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("no horizontal overflow on FAQ page", async ({ page }) => {
    await page.goto("/en/faq");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("no horizontal overflow on privacy page", async ({ page }) => {
    await page.goto("/en/privacy");

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalScroll).toBe(false);
  });

  test("no empty ad card when ads are disabled", async ({ page }) => {
    await page.goto("/en");

    // Without NEXT_PUBLIC_ADSENSE_ID, no ad cards should render
    const adCards = page.locator("ins.adsbygoogle");
    await expect(adCards).toHaveCount(0);
  });

  test("search input is visible without scrolling (above the fold)", async ({ page }) => {
    await page.goto("/en");

    const searchInput = page.getByPlaceholder(/search epstein documents/i);
    await expect(searchInput).toBeVisible();

    // Verify it's actually in the viewport (above the fold)
    const box = await searchInput.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.y + box.height).toBeLessThan(viewport.height);
    }
  });
});
