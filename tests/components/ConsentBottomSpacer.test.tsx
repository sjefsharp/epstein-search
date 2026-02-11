/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import ConsentBottomSpacer from "../../src/components/consent/ConsentBottomSpacer";
import { useConsentStore } from "../../src/store/consent-store";

describe("ConsentBottomSpacer", () => {
  beforeEach(() => {
    useConsentStore.setState((state) => ({
      ...state,
      status: "unknown",
      preferencesOpen: false,
      hasHydrated: true,
    }));
  });

  it("renders when consent is unknown", () => {
    render(<ConsentBottomSpacer enabled />);

    expect(screen.getByRole("presentation", { hidden: true })).toBeInTheDocument();
  });

  it("hides when consent is accepted", () => {
    useConsentStore.setState((state) => ({
      ...state,
      status: "accepted",
      preferencesOpen: false,
      hasHydrated: true,
    }));

    render(<ConsentBottomSpacer enabled />);

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });

  it("uses a taller spacer when preferences are open", () => {
    useConsentStore.setState((state) => ({
      ...state,
      status: "accepted",
      preferencesOpen: true,
      hasHydrated: true,
    }));

    render(<ConsentBottomSpacer enabled />);

    expect(screen.getByRole("presentation", { hidden: true })).toHaveClass("h-52");
  });

  it("does not render when disabled", () => {
    render(<ConsentBottomSpacer />);

    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  });
});
