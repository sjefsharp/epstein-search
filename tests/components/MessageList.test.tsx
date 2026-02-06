/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import MessageList from "../../src/components/chat/MessageList";
import { renderWithIntl } from "../utils/renderWithIntl";

describe("MessageList", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it("renders empty state when no messages", () => {
    renderWithIntl(<MessageList messages={[]} />);

    expect(
      screen.getByRole("heading", { name: /doj epstein files search/i }),
    ).toBeInTheDocument();
  });

  it("renders messages when provided", () => {
    renderWithIntl(
      <MessageList
        messages={[
          {
            id: "1",
            role: "user",
            content: "Hello",
            timestamp: new Date("2024-01-01T12:00:00Z"),
          },
        ]}
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
