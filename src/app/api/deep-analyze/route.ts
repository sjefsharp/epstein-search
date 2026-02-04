// API Route: Deep analysis via PDF worker + Groq
import { NextRequest } from "next/server";
import { generateDeepSummary } from "@/lib/groq";
import { analyzeRatelimit, getClientIp, checkRateLimit } from "@/lib/ratelimit";
import { analyzeSchema } from "@/lib/validation";
import {
  generateWorkerSignature,
  getWorkerSecret,
  enforceHttps,
  sanitizeError,
} from "@/lib/security";

export const runtime = "nodejs"; // Node.js runtime for worker proxy

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rateLimitResult = await checkRateLimit(ip, analyzeRatelimit);

    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: rateLimitResult.reset?.toString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.reset?.toString() || "60",
          },
        },
      );
    }

    const body = await request.json();

    // Input validation
    const validation = analyzeSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid input",
          details: validation.error.issues,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { fileUri, fileName, searchTerm } = validation.data;

    const workerUrl = process.env.RENDER_WORKER_URL;
    if (!workerUrl) {
      return new Response(
        JSON.stringify({ error: "RENDER_WORKER_URL is niet ingesteld" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // HTTPS enforcement
    if (process.env.NODE_ENV === "production") {
      enforceHttps(workerUrl);
    }

    // Worker authentication
    const workerSecret = getWorkerSecret();
    const payload = JSON.stringify({ fileUri });
    const signature = generateWorkerSignature(payload, workerSecret);

    const workerResponse = await fetch(
      `${workerUrl.replace(/\/$/, "")}/analyze`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Signature": signature,
          Authorization: `Bearer ${signature}`,
        },
        body: payload,
        signal: AbortSignal.timeout(60000), // 60s timeout for PDF processing
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

    const encoder = new TextEncoder();
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

    const isDevelopment = process.env.NODE_ENV === "development";
    const errorBody = sanitizeError(error, isDevelopment);

    return new Response(JSON.stringify(errorBody), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
