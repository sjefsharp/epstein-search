import { type NextRequest, NextResponse } from "next/server";

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<unknown>;
};

type ErrorResponseBuilder<TErrorBody> = (error: unknown) => TErrorBody;

type JsonErrorHandlingOptions<TErrorBody> = {
  routeName: string;
  buildErrorBody: ErrorResponseBuilder<TErrorBody>;
};

type JsonHandler = (request: NextRequest) => Promise<Response>;

export function getStatusCodeFromError(error: unknown): number {
  if (error instanceof Error && error.name === "TimeoutError") {
    return 504;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

export function createRateLimitResponse(
  errorMessage: string,
  rateLimitResult: RateLimitResult,
): Response {
  return NextResponse.json(
    { error: errorMessage },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
      },
    },
  );
}

export function withJsonErrorHandling<TErrorBody>(
  handler: JsonHandler,
  options: JsonErrorHandlingOptions<TErrorBody>,
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      process.stderr.write(
        `${options.routeName} API error: ${
          error instanceof Error ? (error.stack ?? error.message) : String(error)
        }\n`,
      );

      return NextResponse.json(options.buildErrorBody(error), {
        status: getStatusCodeFromError(error),
      });
    }
  };
}
