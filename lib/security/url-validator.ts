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
 * Check whether an IPv6 address (without brackets) is private/reserved.
 *
 * Blocked IPv6 ranges:
 *   ::1              -- loopback
 *   ::               -- unspecified
 *   ::ffff:x.x.x.x  -- IPv4-mapped (delegates to isPrivateIPv4)
 *   fc00::/7         -- unique local (fc00:: - fdff::)
 *   fe80::/10        -- link-local  (fe80:: - febf::)
 */
function isPrivateIPv6(addr: string): boolean {
  // Normalize: lowercase, strip brackets if present
  const a = addr.toLowerCase().replace(/^\[|\]$/g, "");

  // Loopback
  if (a === "::1") return true;

  // Unspecified
  if (a === "::") return true;

  // IPv4-mapped IPv6 -- two forms:
  //   1. Dotted-decimal:  ::ffff:127.0.0.1    (as typed by user)
  //   2. Hex:             ::ffff:7f00:1        (as normalized by URL constructor)
  // Both must be detected and the embedded IPv4 checked.
  const v4MappedDotted = a.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/
  );
  if (v4MappedDotted) {
    return isPrivateIPv4(v4MappedDotted[1]);
  }

  // Hex form: ::ffff:HHHH:HHHH where each 16-bit group encodes two octets
  const v4MappedHex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const hi = parseInt(v4MappedHex[1], 16);
    const lo = parseInt(v4MappedHex[2], 16);
    // Convert to dotted-decimal: hi >> 8 . hi & 0xff . lo >> 8 . lo & 0xff
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  // Expand the first hex group to check prefix-based ranges.
  // For addresses like "fc00::1" or "fe80::1", the first segment determines the range.
  const firstSegment = a.split(":")[0];
  if (firstSegment) {
    const val = parseInt(firstSegment, 16);
    if (!isNaN(val)) {
      // fc00::/7 -- unique local: first byte 0xfc or 0xfd (val >> 8 gives first byte for 16-bit segment)
      // For a /7, the top 7 bits of the first byte must be 1111110x => 0xfc or 0xfd
      const firstByte = val >> 8;
      if (firstByte === 0xfc || firstByte === 0xfd) return true;

      // fe80::/10 -- link-local: first 10 bits = 1111111010 => fe80-febf
      if (val >= 0xfe80 && val <= 0xfebf) return true;
    }
  }

  return false;
}

/**
 * Check whether a hostname should be treated as private/reserved.
 * Handles: "localhost", IPv4 addresses, IPv6 loopback/mapped/private.
 */
function isPrivateHost(hostname: string): boolean {
  // Lowercase for case-insensitive comparison
  const h = hostname.toLowerCase();

  // localhost
  if (h === "localhost") return true;

  // IPv6 address check (URL.hostname keeps brackets for IPv6, e.g. "[::1]")
  // Detect IPv6: contains ":" which is not valid in IPv4 or domain names
  if (h.includes(":")) {
    return isPrivateIPv6(h);
  }

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
