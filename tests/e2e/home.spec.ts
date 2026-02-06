import { test } from "@playwright/test";
import HomePage from "./pages/HomePage";

test("homepage renders key UI", async ({ page }) => {
  const home = new HomePage(page);

  await home.gotoHome("en");
  await home.dismissConsentIfVisible();
  await home.expectLoaded();
});
