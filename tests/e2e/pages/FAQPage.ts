import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";

export default class FAQPage extends BasePage {
  readonly heading: Locator;
  readonly breadcrumbNav: Locator;
  readonly breadcrumbHome: Locator;
  readonly accordion: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { level: 1 });
    this.breadcrumbNav = page.getByRole("navigation", {
      name: /breadcrumb/i,
    });
    this.breadcrumbHome = this.breadcrumbNav.first().getByRole("link", {
      name: /home/i,
    });
    this.accordion = page.locator("[data-state]");
    this.footer = page.locator("footer");
  }

  async gotoFAQ(locale: string = "en") {
    await this.goto(`/${locale}/faq`);
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.breadcrumbNav.first()).toBeVisible();
  }
}
