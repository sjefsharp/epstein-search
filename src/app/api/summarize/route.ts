// API Route: Generate AI summary using Groq
import { NextRequest } from "next/server";
import { generateSummary } from "@/lib/groq";

export const runtime = "nodejs"; // Node.js runtime for better stability

export async function POST(request: NextRequest) {
  try {
    const encoder = new TextEncoder();
    const body = await request.json();
    const { searchTerm, documents } = body;

    if (!searchTerm || !documents || !Array.isArray(documents)) {
      return new Response(
        JSON.stringify({
          error: "searchTerm and documents array are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await generateSummary(searchTerm, documents, (text) => {
            // Stream each chunk as it arrives
            const chunk = encoder.encode(
              `data: ${JSON.stringify({ text })}\n\n`,
            );
            controller.enqueue(chunk);
          });

          // Send completion signal
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Summary generation failed";
          const errorChunk = encoder.encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`,
          );
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
      },
    });
  } catch (error) {
    console.error("Summarize API error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
