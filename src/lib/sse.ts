type EmitText = (text: string) => void;

interface CreateSSEResponseOptions {
  getErrorMessage?: (error: unknown) => string;
}

const DEFAULT_ERROR_MESSAGE = "Stream failed";

export const createSSEResponse = (
  producer: (emitText: EmitText) => Promise<void>,
  options: CreateSSEResponseOptions = {},
): Response => {
  const encoder = new TextEncoder();
  const getErrorMessage = options.getErrorMessage;

  const stream = new ReadableStream({
    async start(controller) {
      const emitText: EmitText = (text) => {
        const chunk = encoder.encode(`data: ${JSON.stringify({ text })}\n\n`);
        controller.enqueue(chunk);
      };

      try {
        await producer(emitText);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errorMessage =
          getErrorMessage?.(error) ??
          (error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE);

        const errorChunk = encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        controller.enqueue(errorChunk);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
