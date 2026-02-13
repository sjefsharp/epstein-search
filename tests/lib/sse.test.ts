import { describe, expect, it } from "vitest";
import { createSSEResponse } from "@/lib/sse";

const readResponseText = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
};

describe("sse", () => {
  it("streams text chunks and terminates with DONE", async () => {
    const response = createSSEResponse(async (emitText) => {
      emitText("hello");
      emitText("world");
    });

    const body = await readResponseText(response);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(body).toContain('data: {"text":"hello"}\n\n');
    expect(body).toContain('data: {"text":"world"}\n\n');
    expect(body).toContain("data: [DONE]\n\n");
  });

  it("streams error chunk when producer throws", async () => {
    const response = createSSEResponse(
      async () => {
        throw new Error("boom");
      },
      {
        getErrorMessage: (error) => (error instanceof Error ? error.message : "Unknown"),
      },
    );

    const body = await readResponseText(response);

    expect(body).toContain('data: {"error":"boom"}\n\n');
    expect(body).not.toContain("data: [DONE]\n\n");
  });
});
