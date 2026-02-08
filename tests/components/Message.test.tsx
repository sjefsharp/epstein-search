/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Message from "../../src/components/chat/Message";
import { renderWithIntl } from "../utils/renderWithIntl";
import type { Message as MessageType } from "../../src/lib/types";

describe("Message", () => {
  it("renders streaming indicator", () => {
    const message: MessageType = {
      id: "1",
      role: "assistant",
      content: "Loading",
      timestamp: new Date("2024-01-01T12:00:00Z"),
      isStreaming: true,
    };

    renderWithIntl(<Message message={message} />);

    expect(screen.getByText("▊")).toBeInTheDocument();
  });

  it("renders search results and deep analyze action", async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();

    const message: MessageType = {
      id: "2",
      role: "assistant",
      content: "Results",
      timestamp: new Date("2024-01-01T12:00:00Z"),
      searchResults: [
        {
          documentId: "doc-1",
          chunkIndex: 0,
          totalChunks: 1,
          startPage: 1,
          endPage: 2,
          fileName: "Mock File",
          fileUri: "https://example.com/file.pdf",
          fileSize: 123,
          totalWords: 50,
          totalCharacters: 100,
          processedAt: "2024-01-01T00:00:00Z",
          content: "content",
          highlights: ["highlight"],
          bucket: "bucket",
          key: "key",
        },
      ],
    };

    renderWithIntl(<Message message={message} onAnalyzeDocument={onAnalyze} />);

    expect(screen.getByText("Mock File")).toBeInTheDocument();

    const analyzeButton = screen.getByRole("button", {
      name: /run deep analysis/i,
    });

    await user.click(analyzeButton);

    expect(onAnalyze).toHaveBeenCalledWith("https://example.com/file.pdf", "Mock File");
  });
});
