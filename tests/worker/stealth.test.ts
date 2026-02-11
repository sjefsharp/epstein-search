import { describe, expect, it } from "vitest";

let workerModule: typeof import("../../worker/src/index");

beforeAll(async () => {
  workerModule = await import("../../worker/src/index");
});

describe("Worker stealth helpers", () => {
  it("buildAkamaiDelayMs returns a value within 3000-5999ms", () => {
    for (let i = 0; i < 50; i += 1) {
      const delay = workerModule.buildAkamaiDelayMs();
      expect(delay).toBeGreaterThanOrEqual(3000);
      expect(delay).toBeLessThan(6000);
    }
  });

  it("stealth user agent does not advertise headless or bot", () => {
    const ua = workerModule.STEALTH_USER_AGENT.toLowerCase();
    expect(ua).not.toContain("headless");
    expect(ua).not.toContain("bot");
  });

  it("PREWARM_WAIT_UNTIL uses networkidle", () => {
    expect(workerModule.PREWARM_WAIT_UNTIL).toBe("networkidle");
  });

  describe("buildFingerprint", () => {
    it("returns a valid fingerprint with all required fields", () => {
      const fp = workerModule.buildFingerprint();
      expect(fp.userAgent).toContain("Chrome/");
      expect(fp.headers["sec-ch-ua"]).toContain("Chromium");
      expect(fp.headers["sec-ch-ua-mobile"]).toBe("?0");
      expect(fp.headers["sec-ch-ua-platform"]).toMatch(/"(Windows|macOS|Linux)"/);
      expect(fp.headers["Accept-Language"]).toBe("en-US,en;q=0.9");
      expect(fp.viewport.width).toBeGreaterThanOrEqual(1900);
      expect(fp.viewport.width).toBeLessThanOrEqual(1920);
      expect(fp.viewport.height).toBeGreaterThanOrEqual(1060);
      expect(fp.viewport.height).toBeLessThanOrEqual(1080);
      expect(fp.locale).toBe("en-US");
      expect(fp.timezone).toMatch(/^America\//);
    });

    it("produces varied fingerprints across multiple calls", () => {
      const fps = Array.from({ length: 30 }, () => workerModule.buildFingerprint());
      const uas = new Set(fps.map((f) => f.userAgent));
      const tzs = new Set(fps.map((f) => f.timezone));
      // With 30 samples from 5 UAs and 4 timezones, expect at least 2 unique each
      expect(uas.size).toBeGreaterThanOrEqual(2);
      expect(tzs.size).toBeGreaterThanOrEqual(2);
    });
  });

  it("stealth context options accept a custom fingerprint", () => {
    const fp = workerModule.buildFingerprint();
    const options = workerModule.getStealthContextOptions(fp);
    expect(options.userAgent).toBe(fp.userAgent);
    expect(options.extraHTTPHeaders?.["sec-ch-ua"]).toBe(fp.headers["sec-ch-ua"]);
    expect(options.viewport).toEqual(fp.viewport);
    expect(options.timezoneId).toBe(fp.timezone);
  });

  it("stealth context options use defaults when no fingerprint is provided", () => {
    const options = workerModule.getStealthContextOptions();
    expect(options.userAgent).toContain("Chrome/");
    expect(options.extraHTTPHeaders?.["sec-ch-ua"]).toContain("Chromium");
  });

  it("stealth launch options include anti-detect arguments", () => {
    const options = workerModule.getStealthLaunchOptions();
    expect(options.args).toEqual(
      expect.arrayContaining([
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-infobars",
      ]),
    );
  });

  it("stealth launch options have no proxy when PROXY_URL is unset", () => {
    delete process.env.PROXY_URL;
    const options = workerModule.getStealthLaunchOptions();
    expect(options.proxy).toBeUndefined();
  });

  it("stealth launch options include proxy when PROXY_URL is set", () => {
    process.env.PROXY_URL = "http://user:pass@proxy.example.com:8080";
    const options = workerModule.getStealthLaunchOptions();
    expect(options.proxy).toEqual({
      server: "http://proxy.example.com:8080",
      username: "user",
      password: "pass",
    });
    delete process.env.PROXY_URL;
  });

  describe("parseProxyUrl", () => {
    it("parses HTTP proxy with credentials", () => {
      const result = workerModule.parseProxyUrl("http://user:pass@host.com:8080");
      expect(result.server).toBe("http://host.com:8080");
      expect(result.username).toBe("user");
      expect(result.password).toBe("pass");
    });

    it("parses SOCKS5 proxy without credentials", () => {
      const result = workerModule.parseProxyUrl("socks5://host.com:1080");
      expect(result.server).toBe("socks5://host.com:1080");
      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    it("decodes URL-encoded credentials", () => {
      const result = workerModule.parseProxyUrl("http://us%40er:p%23ss@h.com:80");
      expect(result.username).toBe("us@er");
      expect(result.password).toBe("p#ss");
    });
  });

  describe("isProxyEnabled", () => {
    it("returns false when PROXY_URL is unset", () => {
      delete process.env.PROXY_URL;
      expect(workerModule.isProxyEnabled()).toBe(false);
    });

    it("returns true when PROXY_URL is set", () => {
      process.env.PROXY_URL = "http://proxy:8080";
      expect(workerModule.isProxyEnabled()).toBe(true);
      delete process.env.PROXY_URL;
    });
  });

  describe("getPrewarmIntervalMs", () => {
    it("returns 0 (disabled) when proxy is active and no env override", () => {
      process.env.PROXY_URL = "http://proxy:8080";
      delete process.env.PREWARM_INTERVAL_MINUTES;
      expect(workerModule.getPrewarmIntervalMs()).toBe(0);
      delete process.env.PROXY_URL;
    });

    it("returns 10 minutes when no proxy and no env override", () => {
      delete process.env.PROXY_URL;
      delete process.env.PREWARM_INTERVAL_MINUTES;
      expect(workerModule.getPrewarmIntervalMs()).toBe(10 * 60 * 1000);
    });

    it("respects PREWARM_INTERVAL_MINUTES env var", () => {
      process.env.PREWARM_INTERVAL_MINUTES = "30";
      expect(workerModule.getPrewarmIntervalMs()).toBe(30 * 60 * 1000);
      delete process.env.PREWARM_INTERVAL_MINUTES;
    });

    it("returns 0 when PREWARM_INTERVAL_MINUTES is 0", () => {
      process.env.PREWARM_INTERVAL_MINUTES = "0";
      expect(workerModule.getPrewarmIntervalMs()).toBe(0);
      delete process.env.PREWARM_INTERVAL_MINUTES;
    });
  });

  it("pickRandom selects from the array", () => {
    const arr = [1, 2, 3, 4, 5];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(workerModule.pickRandom(arr));
    }
  });

  it("isAllowedJusticeGovHost only allows public justice.gov hosts", () => {
    expect(workerModule.isAllowedJusticeGovHost("justice.gov")).toBe(true);
    expect(workerModule.isAllowedJusticeGovHost("www.justice.gov")).toBe(true);
    expect(workerModule.isAllowedJusticeGovHost("subdomain.justice.gov")).toBe(true);
    expect(workerModule.isAllowedJusticeGovHost("localhost")).toBe(false);
    expect(workerModule.isAllowedJusticeGovHost("127.0.0.1")).toBe(false);
    expect(workerModule.isAllowedJusticeGovHost("example.com")).toBe(false);
  });

  describe("buildSafeJusticeGovUrl", () => {
    it("returns a valid HTTPS URL for justice.gov hosts", () => {
      const result = workerModule.buildSafeJusticeGovUrl(
        "https://www.justice.gov/d9/2024-09/epstein-document.pdf",
      );
      expect(result).toBe("https://www.justice.gov/d9/2024-09/epstein-document.pdf");
    });

    it("preserves query parameters and hash", () => {
      const result = workerModule.buildSafeJusticeGovUrl(
        "https://www.justice.gov/path?foo=bar#section",
      );
      expect(result).toBe("https://www.justice.gov/path?foo=bar#section");
    });

    it("throws for non-HTTPS URLs", () => {
      expect(() => workerModule.buildSafeJusticeGovUrl("http://www.justice.gov/file.pdf")).toThrow(
        "Only HTTPS URLs are allowed",
      );
    });

    it("throws for non-justice.gov hosts", () => {
      expect(() => workerModule.buildSafeJusticeGovUrl("https://evil.com/file.pdf")).toThrow(
        "Only justice.gov hosts are allowed",
      );
    });

    it("labels unallowed host errors with a reason", () => {
      try {
        workerModule.buildSafeJusticeGovUrl("https://evil.com/file.pdf");
      } catch (error) {
        expect(error).toBeInstanceOf(workerModule.JusticeGovUrlError);
        if (error instanceof workerModule.JusticeGovUrlError) {
          expect(error.reason).toBe("UNALLOWED_HOST");
        }
        return;
      }

      throw new Error("Expected buildSafeJusticeGovUrl to throw");
    });

    it("throws for localhost bypass attempts", () => {
      expect(() => workerModule.buildSafeJusticeGovUrl("https://localhost/file.pdf")).toThrow(
        "Only justice.gov hosts are allowed",
      );
    });

    it("throws for IP address bypass attempts", () => {
      expect(() => workerModule.buildSafeJusticeGovUrl("https://127.0.0.1/file.pdf")).toThrow(
        "Only justice.gov hosts are allowed",
      );
    });

    it("throws for invalid URLs", () => {
      expect(() => workerModule.buildSafeJusticeGovUrl("not-a-url")).toThrow();
    });

    it("blocks credential injection in URL", () => {
      expect(() =>
        workerModule.buildSafeJusticeGovUrl("https://user:pass@evil.com/file.pdf"),
      ).toThrow("Only justice.gov hosts are allowed");
    });

    it("strips credentials from justice.gov URLs", () => {
      const result = workerModule.buildSafeJusticeGovUrl(
        "https://user:pass@www.justice.gov/file.pdf",
      );
      expect(result).toBe("https://www.justice.gov/file.pdf");
    });
  });

  describe("browser pool exports", () => {
    it("exports initBrowserPool and destroyBrowserPool functions", () => {
      expect(typeof workerModule.initBrowserPool).toBe("function");
      expect(typeof workerModule.destroyBrowserPool).toBe("function");
    });
  });
});
