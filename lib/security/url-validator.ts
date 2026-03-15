// ---------------------------------------------------------------------------
// URL Validator -- SSRF Prevention
//
// Pure synchronous function. No I/O, no DNS resolution.
// Validates URL scheme (HTTPS-only) and blocks private/reserved IP ranges.
// ---------------------------------------------------------------------------

export type UrlValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

// ---------------------------------------------------------------------------
// Private / Reserved IP helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a dotted-decimal IPv4 string falls within any blocked range.
 *
 * Blocked ranges (RFC 1918, loopback, link-local, unspecified):
 *   127.0.0.0/8      -- loopback
 *   10.0.0.0/8       -- private
 *   172.16.0.0/12    -- private
 *   192.168.0.0/16   -- private
 *   169.254.0.0/16   -- link-local
 *   0.0.0.0          -- unspecified
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

  const [a, b] = octets;

  // 0.0.0.0
  if (a === 0 && octets[1] === 0 && octets[2] === 0 && octets[3] === 0) {
    return true;
  }

  // 127.0.0.0/8 -- loopback
  if (a === 127) return true;

  // 10.0.0.0/8 -- private
  if (a === 10) return true;

  // 172.16.0.0/12 -- private (172.16.x.x through 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 -- private
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 -- link-local
  if (a === 169 && b === 254) return true;

  return false;
}

/**
 * Check whether a hostname should be treated as private/reserved.
 * Handles: "localhost", IPv4 addresses, IPv6 loopback [::1].
 */
function isPrivateHost(hostname: string): boolean {
  // Lowercase for case-insensitive comparison
  const h = hostname.toLowerCase();

  // localhost
  if (h === "localhost") return true;

  // IPv6 loopback -- URL.hostname strips brackets, so we get "::1"
  if (h === "::1" || h === "[::1]") return true;

  // IPv4 address check
  if (isPrivateIPv4(h)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// validateUrl
// ---------------------------------------------------------------------------

/**
 * Validates a URL for use in server-side fetch().
 *
 * Rules:
 * 1. Must be a parseable URL
 * 2. Protocol must be https:
 * 3. Hostname must not resolve to a private/reserved IP range
 *
 * This is a pure synchronous function -- no DNS resolution, no I/O.
 */
export function validateUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "Invalid URL" };
  }

  // Protocol check -- HTTPS only
  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Only HTTPS URLs allowed" };
  }

  // Private IP / hostname check
  if (isPrivateHost(parsed.hostname)) {
    return { valid: false, reason: "URL points to private network" };
  }

  return { valid: true };
}
