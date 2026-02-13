import type { Request, Response } from "express";
import { getPool, prewarmAkamai } from "./browser-pool";
import { buildSafeJusticeGovUrl, JusticeGovUrlError } from "./ssrf";

type PdfParseResult = {
  text: string;
  numpages: number;
  info?: unknown;
};

type PdfParseFn = (data: Buffer | Uint8Array) => Promise<PdfParseResult>;

export const createSearchHandler = () => async (req: Request, res: Response) => {
  const {
    query,
    from = 0,
    size = 100,
  } = req.body as {
    query?: string;
    from?: number;
    size?: number;
  };

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const pool = await getPool();

    // Build the DOJ search URL
    const searchUrl = new URL("https://www.justice.gov/multimedia-search");
    searchUrl.searchParams.set("keys", query);
    searchUrl.searchParams.set("from", from.toString());
    searchUrl.searchParams.set("size", Math.min(size, 100).toString());
    const searchUrlStr = searchUrl.toString();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await pool.context.newPage();
      try {
        // If this is a retry, re-prewarm on the new page to refresh cookies
        if (attempt > 1) {
          await prewarmAkamai(page);
        }

        // Make the API call from WITHIN the page context as an XHR.
        // This carries all Akamai cookies/tokens, matching a real browser flow.
        const result = await page.evaluate(async (url: string) => {
          const resp = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json, text/javascript, */*; q=0.01",
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
          });
          if (!resp.ok) {
            const body = await resp.text();
            return {
              error: true as const,
              status: resp.status,
              statusText: resp.statusText,
              body: body.slice(0, 500),
            };
          }
          const json = await resp.json();
          return { error: false as const, data: json };
        }, searchUrlStr);

        if (result.error) {
          const bodySuffix = result.body ? `: ${result.body.slice(0, 300)}` : "";
          throw new Error(
            `DOJ search failed with ${result.status} ${result.statusText}${bodySuffix}`,
          );
        }

        res.json(result.data);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        process.stderr.write(`[worker] search attempt ${attempt}/3 failed: ${lastError.message}\n`);
        if (attempt < 3) {
          // Wait longer between retries to let bot-protection settle
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    throw lastError ?? new Error("Unknown error");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
    return;
  }
};

export const createAnalyzeHandler =
  (pdfParse: PdfParseFn) => async (req: Request, res: Response) => {
    const { fileUri } = req.body as { fileUri?: string };

    if (!fileUri) {
      res.status(400).json({ error: "fileUri is required" });
      return;
    }

    // SSRF Protection: Only allow justice.gov domains over HTTPS
    // buildSafeJusticeGovUrl reconstructs the URL from validated parts,
    // breaking the user-input taint chain (CodeQL CWE-918).
    let safeUrl: string;
    try {
      safeUrl = buildSafeJusticeGovUrl(fileUri);
    } catch (urlError) {
      const message = urlError instanceof Error ? urlError.message : "Invalid URL";
      let status = 400;
      if (urlError instanceof JusticeGovUrlError && urlError.reason === "UNALLOWED_HOST") {
        // Explicitly mark requests that fail justice.gov host checks as forbidden
        status = 403;
      }
      res.status(status).json({ error: message });
      return;
    }

    try {
      const pool = await getPool();
      const page = await pool.context.newPage();

      try {
        await page.goto(safeUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        if (page.url().includes("/age-verify")) {
          const button = page.getByRole("button", {
            name: /I am 18|I am 18 years|I am 18 years of age/i,
          });

          try {
            await button.click({ timeout: 15000 });
            await page.waitForLoadState("domcontentloaded");
            await page.waitForURL(/\.pdf/i, { timeout: 30000 });
          } catch {
            // If button not found, proceed anyway
          }
        }

        // Download the PDF INSIDE the browser context to retain Akamai
        // session cookies and JS challenge tokens. The previous approach of
        // extracting cookies and using Node.js fetch() lost the JS-based
        // Akamai fingerprint, causing 403 errors.
        // safeUrl is pre-validated by buildSafeJusticeGovUrl before being passed in.
        const pdfBase64 = await page.evaluate(async (url: string) => {
          const resp = await fetch(url, {
            headers: { Accept: "application/pdf" },
            credentials: "same-origin",
          });
          if (!resp.ok) {
            return {
              error: true as const,
              status: resp.status,
              statusText: resp.statusText,
            };
          }
          const buf = await resp.arrayBuffer();
          // Convert to base64 to transfer binary data out of browser context
          const bytes = new Uint8Array(buf);
          const binary = new TextDecoder("latin1").decode(bytes);
          return { error: false as const, data: btoa(binary) };
        }, safeUrl);

        if (pdfBase64.error) {
          throw new Error(`PDF download failed: ${pdfBase64.status} ${pdfBase64.statusText}`);
        }

        const buffer = Buffer.from(pdfBase64.data, "base64");
        const parsed = await pdfParse(buffer);
        const info = parsed.info == null ? null : parsed.info;

        res.json({
          text: parsed.text || "",
          pages: parsed.numpages || 0,
          metadata: {
            fileSize: buffer.length,
            extractedAt: new Date().toISOString(),
            info,
          },
        });
        return;
      } finally {
        await page.close().catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
      return;
    }
  };
