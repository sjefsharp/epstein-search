import { expect, Locator, Page } from "@playwright/test";
import BasePage from "./BasePage";

export default class HomePage extends BasePage {
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly heading: Locator;
  readonly rejectConsentButton: Locator;
  readonly ageConfirmButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder(/search epstein documents/i);
    this.searchButton = page.getByRole("button", { name: /search/i });
    this.heading = page.getByRole("heading", {
      name: /search, analyze and contextualize/i,
    });
    this.rejectConsentButton = page.getByRole("button", {
      name: /reject ads cookies|reject/i,
    });
    this.ageConfirmButton = page.getByRole("button", {
      name: /18|I am 18/i,
    });
  }

  async gotoHome(locale: string = "en") {
    await this.goto(`/${locale}`);
  }

  async dismissAgeGateIfVisible() {
    if (await this.ageConfirmButton.count()) {
      await this.ageConfirmButton.first().click();
    }
  }

  async dismissConsentIfVisible() {
    if (await this.rejectConsentButton.count()) {
      await this.rejectConsentButton.first().click();
    }
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }
}
