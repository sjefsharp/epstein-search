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
});
