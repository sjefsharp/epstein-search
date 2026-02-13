import net from "net";

function isIpAddress(hostname: string): boolean {
  return net.isIP(hostname) !== 0;
}

export function isAllowedJusticeGovHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();

  // Explicitly block localhost-style names even if they somehow appear under justice.gov
  if (
    lowerHost === "localhost" ||
    lowerHost === "127.0.0.1" ||
    lowerHost === "::1" ||
    lowerHost.endsWith(".localhost")
  ) {
    return false;
  }

  if (isIpAddress(lowerHost)) {
    return false;
  }

  return lowerHost === "justice.gov" || lowerHost.endsWith(".justice.gov");
}

/**
 * Domain-specific error type for justice.gov URL validation.
 * This allows callers to distinguish between different rejection reasons.
 */
export class JusticeGovUrlError extends Error {
  public readonly reason:
    | "INVALID_URL"
    | "UNSAFE_PROTOCOL"
    | "UNALLOWED_HOST"
    | "DISALLOWED_IP"
    | "DISALLOWED_PORT";

  constructor(message: string, reason: JusticeGovUrlError["reason"]) {
    super(message);
    this.name = "JusticeGovUrlError";
    this.reason = reason;
  }
}

/**
 * Validate and reconstruct a URL from its components to prevent SSRF.
 * Breaks the taint chain by building the URL from validated host + path
 * rather than passing the user-supplied string through directly.
 * Strips any embedded credentials and disallows IP literals, ports, and
 * non-justice.gov hosts.
 */
export function buildSafeJusticeGovUrl(input: string): string {
  const raw = String(input).trim();
  if (!raw) {
    throw new JusticeGovUrlError("URL must not be empty", "INVALID_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new JusticeGovUrlError("Invalid URL", "INVALID_URL");
  }

  if (parsed.protocol !== "https:") {
    throw new JusticeGovUrlError("Only HTTPS URLs are allowed", "UNSAFE_PROTOCOL");
  }

  // Disallow explicit ports to avoid talking to unexpected services.
  if (parsed.port && parsed.port !== "443") {
    throw new JusticeGovUrlError("Explicit ports are not allowed", "DISALLOWED_PORT");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject IP-literal hosts outright (both IPv4 and IPv6).
  const isIPv4 = /^[0-9.]+$/.test(hostname);
  const isBracketedIPv6 = /^\[.*\]$/.test(hostname);
  if (isIPv4 || isBracketedIPv6) {
    throw new JusticeGovUrlError("Only justice.gov hosts are allowed", "DISALLOWED_IP");
  }

  // Ensure the hostname is an allowed justice.gov host.
  if (!isAllowedJusticeGovHost(hostname)) {
    throw new JusticeGovUrlError("Only justice.gov hosts are allowed", "UNALLOWED_HOST");
  }

  // Reconstruct from validated parts — no user-controlled raw string passes through.
  const safe = new URL("https://" + hostname);
  safe.pathname = parsed.pathname;
  safe.search = parsed.search;
  safe.hash = parsed.hash;
  // Credentials intentionally omitted: username/password are not copied.
  safe.username = "";
  safe.password = "";

  return safe.toString();
}
