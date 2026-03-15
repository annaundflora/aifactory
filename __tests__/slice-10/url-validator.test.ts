import { describe, it, expect } from "vitest";
import { validateUrl } from "../../lib/security/url-validator";
import type { UrlValidationResult } from "../../lib/security/url-validator";

/**
 * Tests for slice-10-auth-upload-ssrf: validateUrl() SSRF Prevention
 *
 * Pure unit tests for the synchronous URL validator. No mocks needed --
 * validateUrl() is a pure function with no I/O, no DNS resolution, no
 * external dependencies.
 *
 * Each test maps to an Acceptance Criterion from the slice spec.
 */

describe("slice-10-auth-upload-ssrf: validateUrl() URL Validation", () => {
  // ---------------------------------------------------------------------------
  // Protocol checks
  // ---------------------------------------------------------------------------

  describe("Protocol validation", () => {
    /**
     * AC-3: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL http://evil.com/image.png aufgerufen wird (HTTP statt HTTPS)
     *       THEN gibt die Action { error: "Only HTTPS URLs allowed" } zurueck
     */
    it('AC-3: should reject http:// URLs with "Only HTTPS URLs allowed"', () => {
      const result = validateUrl("http://evil.com/image.png");

      expect(result).toEqual({
        valid: false,
        reason: "Only HTTPS URLs allowed",
      });
    });

    /**
     * AC-4: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL file:///etc/passwd aufgerufen wird
     *       THEN gibt die Action { error: "Only HTTPS URLs allowed" } zurueck
     */
    it('AC-4: should reject file:// URLs with "Only HTTPS URLs allowed"', () => {
      const result = validateUrl("file:///etc/passwd");

      expect(result).toEqual({
        valid: false,
        reason: "Only HTTPS URLs allowed",
      });
    });

    it('should reject ftp:// URLs with "Only HTTPS URLs allowed"', () => {
      const result = validateUrl("ftp://files.example.com/image.png");

      expect(result).toEqual({
        valid: false,
        reason: "Only HTTPS URLs allowed",
      });
    });

    it('should reject data: URLs with "Only HTTPS URLs allowed"', () => {
      const result = validateUrl(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA"
      );

      expect(result).toEqual({
        valid: false,
        reason: "Only HTTPS URLs allowed",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Invalid URL
  // ---------------------------------------------------------------------------

  describe("Invalid URL parsing", () => {
    /**
     * AC-13: GIVEN validateUrl() wird mit einem unparsbaren String aufgerufen (z.B. "not-a-url")
     *        WHEN die URL geparsed wird
     *        THEN gibt validateUrl { valid: false, reason: "Invalid URL" } zurueck
     */
    it('AC-13: should reject unparsable strings with "Invalid URL"', () => {
      const result = validateUrl("not-a-url");

      expect(result).toEqual({
        valid: false,
        reason: "Invalid URL",
      });
    });

    it('should reject empty string with "Invalid URL"', () => {
      const result = validateUrl("");

      expect(result).toEqual({
        valid: false,
        reason: "Invalid URL",
      });
    });

    it('should reject whitespace-only string with "Invalid URL"', () => {
      const result = validateUrl("   ");

      expect(result).toEqual({
        valid: false,
        reason: "Invalid URL",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Private IP / SSRF blocking
  // ---------------------------------------------------------------------------

  describe("Private IP range blocking", () => {
    /**
     * AC-5: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://169.254.169.254/latest/meta-data/ aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-5: should reject https://169.254.169.254 (link-local / AWS metadata) with "URL points to private network"', () => {
      const result = validateUrl(
        "https://169.254.169.254/latest/meta-data/"
      );

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-6: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://127.0.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-6: should reject https://127.0.0.1 (loopback) with "URL points to private network"', () => {
      const result = validateUrl("https://127.0.0.1/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-7: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://10.0.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-7: should reject https://10.0.0.1 (10.x private) with "URL points to private network"', () => {
      const result = validateUrl("https://10.0.0.1/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-8: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://172.16.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-8: should reject https://172.16.0.1 (172.16.x private) with "URL points to private network"', () => {
      const result = validateUrl("https://172.16.0.1/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-9: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://192.168.1.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-9: should reject https://192.168.1.1 (192.168.x private) with "URL points to private network"', () => {
      const result = validateUrl("https://192.168.1.1/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-14: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://0.0.0.0/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-14: should reject https://0.0.0.0 (unspecified address) with "URL points to private network"', () => {
      const result = validateUrl("https://0.0.0.0/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Localhost and IPv6 blocking
  // ---------------------------------------------------------------------------

  describe("Localhost and IPv6 blocking", () => {
    /**
     * AC-10: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://localhost/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-10: should reject https://localhost with "URL points to private network"', () => {
      const result = validateUrl("https://localhost/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    /**
     * AC-11: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://[::1]/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-11: should reject https://[::1] (IPv6 loopback) with "URL points to private network"', () => {
      const result = validateUrl("https://[::1]/img.png");

      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Valid public URL
  // ---------------------------------------------------------------------------

  describe("Valid public URL acceptance", () => {
    /**
     * AC-12: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://valid-host.com/img.png aufgerufen wird (gueltige oeffentliche URL)
     *        THEN wird der fetch() ausgefuehrt und die bestehende Upload-Logik verarbeitet das Bild
     */
    it("AC-12: should accept https://valid-host.com/img.png as valid", () => {
      const result = validateUrl("https://valid-host.com/img.png");

      expect(result).toEqual({ valid: true });
    });

    it("should accept https://example.com/path/to/image.jpg as valid", () => {
      const result = validateUrl(
        "https://example.com/path/to/image.jpg"
      );

      expect(result).toEqual({ valid: true });
    });

    it("should accept https://cdn.example.org/assets/photo.webp as valid", () => {
      const result = validateUrl(
        "https://cdn.example.org/assets/photo.webp"
      );

      expect(result).toEqual({ valid: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Additional edge cases for private IP ranges
  // ---------------------------------------------------------------------------

  describe("Edge cases: additional private IP range boundaries", () => {
    it("should reject 127.0.0.0 (start of loopback range)", () => {
      const result = validateUrl("https://127.0.0.0/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should reject 127.255.255.255 (end of loopback range)", () => {
      const result = validateUrl("https://127.255.255.255/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should reject 10.255.255.255 (end of 10.x range)", () => {
      const result = validateUrl("https://10.255.255.255/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should reject 172.31.255.255 (end of 172.16-31.x range)", () => {
      const result = validateUrl("https://172.31.255.255/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should accept 172.32.0.1 (just outside 172.16-31.x range)", () => {
      const result = validateUrl("https://172.32.0.1/img.png");
      expect(result).toEqual({ valid: true });
    });

    it("should reject 192.168.0.1 (start of 192.168.x range)", () => {
      const result = validateUrl("https://192.168.0.1/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should reject 169.254.0.1 (start of link-local range)", () => {
      const result = validateUrl("https://169.254.0.1/img.png");
      expect(result).toEqual({
        valid: false,
        reason: "URL points to private network",
      });
    });

    it("should accept 169.255.0.1 (just outside link-local range)", () => {
      const result = validateUrl("https://169.255.0.1/img.png");
      expect(result).toEqual({ valid: true });
    });
  });

  // ---------------------------------------------------------------------------
  // Return type contract
  // ---------------------------------------------------------------------------

  describe("Return type contract", () => {
    it("should return { valid: true } with no reason for valid URLs", () => {
      const result = validateUrl("https://example.com/img.png");

      expect(result.valid).toBe(true);
      expect(result).not.toHaveProperty("reason");
    });

    it("should return { valid: false, reason: string } for invalid URLs", () => {
      const result = validateUrl("http://evil.com/img.png");

      expect(result.valid).toBe(false);
      expect((result as { valid: false; reason: string }).reason).toBe(
        "Only HTTPS URLs allowed"
      );
    });

    it("should be a synchronous function (no Promise returned)", () => {
      const result = validateUrl("https://example.com/img.png");

      // A sync function returns a plain object, not a Promise
      expect(result).not.toBeInstanceOf(Promise);
    });
  });
});
