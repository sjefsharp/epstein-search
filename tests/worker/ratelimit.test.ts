import { describe, expect, it } from "vitest";

import { applyTrustProxy, PREWARM_WAIT_UNTIL } from "../../worker/src/index";

type ExpressLike = {
  set: (key: string, value: unknown) => unknown;
  get: (key: string) => unknown;
};

describe("Worker rate-limit proxy config", () => {
  it("applies trust proxy for Render", () => {
    const settings = new Map<string, unknown>();
    const app: ExpressLike = {
      set: (key: string, value: unknown) => {
        settings.set(key, value);
        return app;
      },
      get: (key: string) => settings.get(key),
    };

    expect(app.get("trust proxy")).toBeUndefined();

    applyTrustProxy(app);

    expect(app.get("trust proxy")).toBe(1);
  });

  it("prewarm uses domcontentloaded to avoid Akamai timeout hangs", () => {
    expect(PREWARM_WAIT_UNTIL).toBe("domcontentloaded");
  });
});
