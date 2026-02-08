/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import ChatInput from "../../src/components/chat/ChatInput";
import { renderWithIntl } from "../utils/renderWithIntl";

describe("ChatInput", () => {
  it("disables submit when empty and sends message on Enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    renderWithIntl(<ChatInput onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(
      /search epstein documents/i,
    ) as HTMLTextAreaElement;
    const button = screen.getByRole("button", { name: /search/i });

    expect(button).toBeDisabled();

    await user.type(textarea, "hello{enter}");

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(textarea.value).toBe("");
  });

  it("does not submit on Shift+Enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    renderWithIntl(<ChatInput onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(
      /search epstein documents/i,
    ) as HTMLTextAreaElement;

    await user.type(textarea, "line 1{shift>}{enter}{/shift}");

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea.value).toContain("line 1");
  });

  it("renders loading state when disabled", () => {
    const onSend = vi.fn();

    renderWithIntl(<ChatInput onSend={onSend} disabled />);

    const button = screen.getByRole("button", { name: /search/i });
    expect(button).toBeDisabled();
  });
});
