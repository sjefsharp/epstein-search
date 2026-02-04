// API Route: Deep analysis via PDF worker + Groq
import { NextRequest } from "next/server";
import { generateDeepSummary } from "@/lib/groq";

export const runtime = "nodejs"; // Node.js runtime for worker proxy

export async function POST(request: NextRequest) {
  try {
    const encoder = new TextEncoder();
    const body = await request.json();
    const { fileUri, fileName, searchTerm } = body as {
      fileUri?: string;
      fileName?: string;
      searchTerm?: string;
    };

    if (!fileUri || !fileName) {
      return new Response(
        JSON.stringify({ error: "fileUri en fileName zijn verplicht" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      return new Response(
        JSON.stringify({ error: "RENDER_WORKER_URL is niet ingesteld" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const workerResponse = await fetch(
      `${workerUrl.replace(/\/$/, "")}/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUri }),
      },
    );

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      throw new Error(
        `Worker fout (${workerResponse.status}): ${errorText || "Onbekend"}`,
      );
    }

    const workerData = (await workerResponse.json()) as {
      text: string;
      pages: number;
      metadata: { fileSize: number; extractedAt: string };
    };

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await generateDeepSummary(
            fileName,
            workerData.text,
            searchTerm,
            (text) => {
              const chunk = encoder.encode(
                `data: ${JSON.stringify({ text })}\n\n`,
              );
              controller.enqueue(chunk);
            },
          );

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Analyse mislukt";
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
    console.error("Deep analyze API error:", error);

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
