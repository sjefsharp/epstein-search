/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

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

  it("closes the banner after accepting consent", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    await user.click(screen.getByRole("button", { name: /accept/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    });
  });

  it("opens preferences panel", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    const manageButton = screen.getByRole("button", { name: /manage/i });
    await user.click(manageButton);

    expect(screen.getByText(/advertising preferences/i)).toBeInTheDocument();
  });

  it("hides initial buttons when preferences are open", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    await user.click(screen.getByRole("button", { name: /manage/i }));

    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("dismiss button rejects consent and hides banner", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(dismissButton);

    await waitFor(() => {
      expect(useConsentStore.getState().status).toBe("rejected");
      expect(useConsentStore.getState().adsConsent).toBe(false);
    });

    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
  });

  it("preferences save button applies draft consent and dismisses banner", async () => {
    const user = userEvent.setup();

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    await user.click(screen.getByRole("button", { name: /manage/i }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(useConsentStore.getState().status).toBe("accepted");
      expect(useConsentStore.getState().adsConsent).toBe(true);
      expect(useConsentStore.getState().preferencesOpen).toBe(false);
    });
  });

  it("preferences close button closes panel without changing consent", async () => {
    const user = userEvent.setup();

    useConsentStore.setState({
      status: "accepted",
      adsConsent: true,
      preferencesOpen: true,
      draftAdsConsent: true,
      hasHydrated: true,
    });

    renderWithIntl(<ConsentBanner locale="en" policyVersion="1.0.0" />);

    await user.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(() => {
      expect(useConsentStore.getState().preferencesOpen).toBe(false);
      expect(useConsentStore.getState().status).toBe("accepted");
      expect(useConsentStore.getState().adsConsent).toBe(true);
    });
  });
});
