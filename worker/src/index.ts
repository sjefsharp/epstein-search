import express from "express";
import type { Request, Response } from "express";
import { chromium } from "playwright";
import pdfParse from "pdf-parse";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/analyze", async (req: Request, res: Response) => {
  const { fileUri } = req.body as { fileUri?: string };

  if (!fileUri) {
    res.status(400).json({ error: "fileUri is required" });
    return;
  }

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(fileUri, { waitUntil: "domcontentloaded", timeout: 60000 });

    if (page.url().includes("/age-verify")) {
      const button = page.getByRole("button", {
        name: /I am 18|I am 18 years|I am 18 years of age/i,
      });

      try {
        await button.click({ timeout: 15000 });
        await page.waitForLoadState("domcontentloaded");
        await page.waitForURL(/\.pdf/i, { timeout: 30000 });
      } catch {
        // If button not found, proceed with cookies anyway
      }
    }

    const cookies = (await context.cookies()) as Array<{
      name: string;
      value: string;
    }>;
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const pdfResponse = await fetch(fileUri, {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/pdf",
      },
    });

    if (!pdfResponse.ok) {
      throw new Error(
        `PDF download failed: ${pdfResponse.status} ${pdfResponse.statusText}`,
      );
    }

    const buffer = Buffer.from(await pdfResponse.arrayBuffer());
    const parsed = await pdfParse(buffer);

    res.json({
      text: parsed.text || "",
      pages: parsed.numpages || 0,
      metadata: {
        fileSize: buffer.length,
        extractedAt: new Date().toISOString(),
        info: parsed.info || null,
      },
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
    return;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`PDF worker listening on :${port}`);
});
