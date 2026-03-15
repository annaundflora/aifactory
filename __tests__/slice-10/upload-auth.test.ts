import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for slice-10-auth-upload-ssrf: uploadSourceImage Server Action
 *
 * These tests validate that uploadSourceImage():
 * - Calls requireAuth() as the first guard
 * - Returns { error: "Unauthorized" } without fetch for unauthenticated users
 * - Integrates validateUrl() for SSRF prevention on URL uploads
 * - Passes valid URLs through to fetch + upload pipeline
 *
 * Mock strategy (per spec metadata "mock_external"):
 * - requireAuth() is mocked (requires NextAuth + DB session)
 * - StorageService.upload is mocked (requires R2/S3 credentials)
 * - Global fetch is mocked (to prevent real network calls in unit tests)
 * - validateUrl() is NOT mocked -- it is a pure function under test
 */

// ---------------------------------------------------------------------------
// Mocks -- must be declared before imports
// ---------------------------------------------------------------------------

// Mock the auth guard (external dependency: NextAuth + DB)
vi.mock("@/lib/auth/guard", () => ({
  requireAuth: vi.fn(),
}));

// Mock storage service (external dependency: R2/S3)
vi.mock("@/lib/clients/storage", () => ({
  StorageService: {
    upload: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from "@/lib/auth/guard";
import { StorageService } from "@/lib/clients/storage";
import { uploadSourceImage } from "../../app/actions/upload";

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockRequireAuth = vi.mocked(requireAuth);
const mockStorageUpload = vi.mocked(StorageService.upload);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_USER = { userId: "user-test-123", email: "test@example.com" };
const UNAUTHORIZED = { error: "Unauthorized" };

function createFakeFile(
  content: string = "fake-image-data",
  type: string = "image/png",
  name: string = "test.png"
): File {
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slice-10-auth-upload-ssrf: uploadSourceImage Auth + SSRF", () => {
  // =========================================================================
  // AC-1 & AC-2: Unauthenticated access
  // =========================================================================

  describe("Unauthenticated access", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(UNAUTHORIZED);
    });

    /**
     * AC-1: GIVEN kein User ist eingeloggt (keine gueltige Session)
     *       WHEN uploadSourceImage({ projectId: "abc", url: "https://example.com/img.png" }) aufgerufen wird
     *       THEN gibt die Action { error: "Unauthorized" } zurueck, OHNE einen fetch() auszufuehren
     */
    it('AC-1: should return { error: "Unauthorized" } for URL upload without session', async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://example.com/img.png",
      });

      expect(result).toEqual({ error: "Unauthorized" });
      // Verify NO fetch was made
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    /**
     * AC-2: GIVEN kein User ist eingeloggt (keine gueltige Session)
     *       WHEN uploadSourceImage({ projectId: "abc", file: validFile }) aufgerufen wird
     *       THEN gibt die Action { error: "Unauthorized" } zurueck, OHNE einen Upload auszufuehren
     */
    it('AC-2: should return { error: "Unauthorized" } for file upload without session', async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        file: createFakeFile(),
      });

      expect(result).toEqual({ error: "Unauthorized" });
      // Verify NO storage upload was attempted
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AC-3 & AC-4: Protocol validation via validateUrl integration
  // =========================================================================

  describe("Authenticated SSRF prevention — protocol checks", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(FAKE_USER);
    });

    /**
     * AC-3: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL http://evil.com/image.png aufgerufen wird (HTTP statt HTTPS)
     *       THEN gibt die Action { error: "Only HTTPS URLs allowed" } zurueck
     */
    it('AC-3: should return SSRF error for http:// URL with valid session', async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "http://evil.com/image.png",
      });

      expect(result).toEqual({ error: "Only HTTPS URLs allowed" });
    });

    /**
     * AC-4: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL file:///etc/passwd aufgerufen wird
     *       THEN gibt die Action { error: "Only HTTPS URLs allowed" } zurueck
     */
    it('AC-4: should return SSRF error for file:// URL with valid session', async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "file:///etc/passwd",
      });

      expect(result).toEqual({ error: "Only HTTPS URLs allowed" });
    });
  });

  // =========================================================================
  // AC-5 through AC-11, AC-14: Private IP blocking via validateUrl integration
  // =========================================================================

  describe("Authenticated SSRF prevention — private IP blocking", () => {
    beforeEach(() => {
      mockRequireAuth.mockResolvedValue(FAKE_USER);
    });

    /**
     * AC-5: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://169.254.169.254/latest/meta-data/ aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it('AC-5: should block AWS metadata endpoint (169.254.169.254)', async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://169.254.169.254/latest/meta-data/",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-6: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://127.0.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-6: should block loopback IP (127.0.0.1)", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://127.0.0.1/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-7: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://10.0.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-7: should block private IP (10.0.0.1)", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://10.0.0.1/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-8: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://172.16.0.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-8: should block private IP (172.16.0.1)", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://172.16.0.1/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-9: GIVEN ein User ist eingeloggt
     *       WHEN uploadSourceImage mit URL https://192.168.1.1/img.png aufgerufen wird
     *       THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-9: should block private IP (192.168.1.1)", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://192.168.1.1/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-10: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://localhost/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-10: should block localhost hostname", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://localhost/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-11: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://[::1]/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-11: should block IPv6 loopback ([::1])", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://[::1]/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });

    /**
     * AC-14: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://0.0.0.0/img.png aufgerufen wird
     *        THEN gibt die Action { error: "URL points to private network" } zurueck
     */
    it("AC-14: should block unspecified address (0.0.0.0)", async () => {
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://0.0.0.0/img.png",
      });

      expect(result).toEqual({ error: "URL points to private network" });
    });
  });

  // =========================================================================
  // AC-12: Valid public URL proceeds to fetch
  // =========================================================================

  describe("Authenticated valid URL — proceeds to fetch", () => {
    /**
     * AC-12: GIVEN ein User ist eingeloggt
     *        WHEN uploadSourceImage mit URL https://valid-host.com/img.png aufgerufen wird (gueltige oeffentliche URL)
     *        THEN wird der fetch() ausgefuehrt und die bestehende Upload-Logik verarbeitet das Bild
     */
    it("AC-12: should call fetch() for valid HTTPS URL with valid session", async () => {
      mockRequireAuth.mockResolvedValue(FAKE_USER);

      // Mock fetch to return a valid image response
      const fakeImageBuffer = new ArrayBuffer(8);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(fakeImageBuffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      );

      mockStorageUpload.mockResolvedValue(
        "https://cdn.example.com/sources/abc/uuid.png"
      );

      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://valid-host.com/img.png",
      });

      // Verify fetch was called with the valid URL
      expect(fetchSpy).toHaveBeenCalledWith("https://valid-host.com/img.png", {
        redirect: "error",
        signal: expect.any(AbortSignal),
      });

      // Verify upload was called
      expect(mockStorageUpload).toHaveBeenCalled();

      // Verify success response
      expect(result).toHaveProperty("url");
      expect((result as { url: string }).url).toContain(
        "https://cdn.example.com/sources/abc/"
      );

      fetchSpy.mockRestore();
    });
  });

  // =========================================================================
  // AC-13: Unparsable URL (via validateUrl integration)
  // =========================================================================

  describe("Authenticated invalid URL string", () => {
    /**
     * AC-13: GIVEN validateUrl() wird mit einem unparsbaren String aufgerufen (z.B. "not-a-url")
     *        WHEN die URL geparsed wird
     *        THEN gibt validateUrl { valid: false, reason: "Invalid URL" } zurueck
     */
    it('AC-13: should return { error: "Invalid URL" } for unparsable URL string', async () => {
      mockRequireAuth.mockResolvedValue(FAKE_USER);

      const result = await uploadSourceImage({
        projectId: "abc",
        url: "not-a-url",
      });

      expect(result).toEqual({ error: "Invalid URL" });
    });
  });

  // =========================================================================
  // Guard ordering: requireAuth is called before validateUrl
  // =========================================================================

  describe("Guard ordering", () => {
    it("should call requireAuth() before any URL validation", async () => {
      mockRequireAuth.mockResolvedValue(UNAUTHORIZED);

      // Even with a private IP URL, auth should fail first
      const result = await uploadSourceImage({
        projectId: "abc",
        url: "https://127.0.0.1/img.png",
      });

      expect(result).toEqual({ error: "Unauthorized" });
      expect(mockRequireAuth).toHaveBeenCalledTimes(1);
    });
  });
});
