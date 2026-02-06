import { test, expect } from "@playwright/test";
import HomePage from "./pages/HomePage";

test("search flow renders results and summary", async ({ page }) => {
  const home = new HomePage(page);

  await page.route("**/api/consent", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.route("**/api/search**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        total: 1,
        documents: [
          {
            documentId: "doc-1",
            chunkIndex: 0,
            totalChunks: 1,
            startPage: 1,
            endPage: 2,
            fileName: "Mock Document.pdf",
            fileUri: "https://example.com/doc.pdf",
            fileSize: 123,
            totalWords: 50,
            totalCharacters: 100,
            processedAt: "2024-01-01T00:00:00Z",
            content: "content",
            highlights: ["highlight"],
            bucket: "bucket",
            key: "key",
          },
        ],
        searchTerm: "epstein",
        from: 0,
        size: 100,
        uniqueCount: 1,
      }),
    }),
  );

  const sseBody = [
    'data: {"text":"Summary chunk"}\n\n',
    "data: [DONE]\n\n",
  ].join("");

  await page.route("**/api/summarize", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody,
    }),
  );

  await home.gotoHome("en");
  await home.dismissConsentIfVisible();
  await home.expectLoaded();

  await home.searchInput.fill("epstein test");
  await home.searchInput.press("Enter");

  await expect(page.getByText("Mock Document.pdf")).toBeVisible();
  await expect(page.getByText("Summary chunk")).toBeVisible();
});
