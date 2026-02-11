let workerModule: typeof import("../../worker/src/index");

beforeAll(async () => {
  workerModule = await import("../../worker/src/index");
});

describe("Worker stealth helpers", () => {
  it("buildAkamaiDelayMs returns a value within 2000-3999ms", () => {
    for (let i = 0; i < 50; i += 1) {
      const delay = workerModule.buildAkamaiDelayMs();
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(4000);
    }
  });

  it("stealth user agent does not advertise headless or bot", () => {
    const ua = workerModule.STEALTH_USER_AGENT.toLowerCase();
    expect(ua).not.toContain("headless");
    expect(ua).not.toContain("bot");
  });

  it("stealth context options include UA and client hints", () => {
    const options = workerModule.getStealthContextOptions();
    expect(options.userAgent).toContain("Chrome/131");
    expect(options.extraHTTPHeaders?.["sec-ch-ua"]).toContain("Chromium");
    expect(options.extraHTTPHeaders?.["sec-ch-ua-mobile"]).toBe("?0");
    expect(options.extraHTTPHeaders?.["sec-ch-ua-platform"]).toBe('"Windows"');
  });

  it("stealth launch options include anti-detect arguments", () => {
    const options = workerModule.getStealthLaunchOptions();
    expect(options.args).toEqual(
      expect.arrayContaining([
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ]),
    );
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
});
