import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createMock = vi.fn();

vi.mock("groq-sdk", () => ({
  default: class Groq {
    chat = { completions: { create: createMock } };
    constructor() {
      // noop
    }
  },
}));

describe("groq", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    process.env = { ...originalEnv, GROQ_API_KEY: "test-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("generates a non-streaming summary", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "summary" } }],
    });

    const { generateSummary } = await import("../../src/lib/groq");

    const result = await generateSummary(
      "epstein",
      [{ fileName: "Doc", content: "content", fileUri: "file" }],
      "en",
    );

    expect(result).toBe("summary");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "llama-3.3-70b-versatile" }),
    );
    expect(createMock.mock.calls[0][0].stream).toBeUndefined();
  });

  it("streams summary chunks when onStream is provided", async () => {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: "Hello " } }] };
        yield { choices: [{ delta: { content: "world" } }] };
      },
    };

    createMock.mockResolvedValue(stream);

    const { generateSummary } = await import("../../src/lib/groq");
    const onStream = vi.fn();

    const result = await generateSummary(
      "epstein",
      [{ fileName: "Doc", content: "content", fileUri: "file" }],
      "en",
      onStream,
    );

    expect(result).toBe("Hello world");
    expect(onStream).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true }),
    );
  });

  it("generates a deep summary", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: "deep summary" } }],
    });

    const { generateDeepSummary } = await import("../../src/lib/groq");

    const result = await generateDeepSummary(
      "doc.pdf",
      "full text",
      "epstein",
      "en",
    );

    expect(result).toBe("deep summary");
  });
});
