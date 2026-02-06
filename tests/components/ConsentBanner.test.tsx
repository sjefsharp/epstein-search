/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsentBanner from "../../src/components/consent/ConsentBanner";
import { renderWithIntl } from "../utils/renderWithIntl";
import { useConsentStore } from "../../src/store/consent-store";

describe("ConsentBanner", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    useConsentStore.setState({
      status: "unknown",
      adsConsent: false,
      draftAdsConsent: false,
      policyVersion: "1.0.0",
      locale: "en",
      lastUpdated: undefined,
      preferencesOpen: false,
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders banner and accepts consent", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    const acceptButton = screen.getByRole("button", { name: /accept/i });
    await user.click(acceptButton);

    await waitFor(() => {
      expect(useConsentStore.getState().status).toBe("accepted");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/consent",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("opens preferences panel", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    const manageButton = screen.getByRole("button", { name: /manage/i });
    await user.click(manageButton);

    expect(screen.getByText(/advertising preferences/i)).toBeInTheDocument();
  });
});
