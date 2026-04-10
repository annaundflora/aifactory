// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadImage, generateDownloadFilename } from "@/lib/utils";

// ---------------------------------------------------------------------------
// downloadImage tests
// ---------------------------------------------------------------------------

describe("downloadImage", () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  /**
   * AC-7: GIVEN eine `downloadImage` Utility-Funktion in `lib/utils.ts`
   * WHEN sie mit `url: string` und `filename: string` aufgerufen wird
   * THEN fuehrt sie fetch(url) aus, erstellt einen Blob, erzeugt eine Object-URL,
   * triggert einen programmatischen Anchor-Klick und raeumt die Object-URL via
   * `revokeObjectURL` wieder auf
   */
  it("AC-7: should fetch the image URL, create a blob, trigger anchor click, and revoke object URL", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-object-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // Spy on anchor click using a real DOM element
    const realAnchor = document.createElement("a");
    const clickSpy = vi.spyOn(realAnchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string) => {
        if (tag === "a") return realAnchor;
        // Fall back to original for other tags
        return Object.getPrototypeOf(document).createElement.call(
          document,
          tag
        );
      }
    );
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    await downloadImage(
      "https://r2.example.com/projects/abc/img.png",
      "test-file.png"
    );

    // Verify fetch was called with the URL
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example.com/projects/abc/img.png"
    );

    // Verify blob was converted to object URL
    expect(URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);

    // Verify anchor href and download attribute were set
    expect(realAnchor.href).toBe(fakeObjectUrl);
    expect(realAnchor.download).toBe("test-file.png");

    // Verify anchor was appended, clicked, and removed
    expect(appendChildSpy).toHaveBeenCalledWith(realAnchor);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledWith(realAnchor);

    // Verify object URL was revoked (cleanup)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });

  /**
   * AC-6: GIVEN der fetch-Request fuer das Bild schlaegt fehl (z.B. Netzwerkfehler)
   * WHEN der Fehler auftritt
   * THEN wird ein Error geworfen
   */
  it("AC-6: should throw when fetch fails", async () => {
    // Mock fetch with network error
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadImage("https://r2.example.com/broken.png", "file.png")
    ).rejects.toThrow("Network error");
  });

  it("AC-6: should throw when fetch returns non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadImage("https://r2.example.com/missing.png", "file.png")
    ).rejects.toThrow("Download failed: 404");
  });

  // ---------------------------------------------------------------------------
  // Slice-01: Web Share API Branch Tests
  // ---------------------------------------------------------------------------

  /**
   * AC-1: GIVEN `navigator.canShare` existiert und `navigator.canShare({ files: [File] })` gibt `true` zurueck
   * WHEN `downloadImage(url, filename)` aufgerufen wird
   * THEN wird `navigator.share({ files: [file] })` mit einem `File`-Objekt aufgerufen,
   * das aus dem gefetchten Blob erstellt wurde (Filename = `filename`-Parameter, Type = `blob.type`),
   * und `URL.revokeObjectURL` wird nach Abschluss des Share-Calls aufgerufen
   */
  it("AC-1: should call navigator.share with File when canShare returns true and revoke objectURL after share resolves", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-share-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // Mock navigator.canShare and navigator.share
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    await downloadImage(
      "https://r2.example.com/projects/abc/img.png",
      "test-download.png"
    );

    // Verify fetch was called
    expect(fetchMock).toHaveBeenCalledWith(
      "https://r2.example.com/projects/abc/img.png"
    );

    // Verify canShare was called with a files array containing a File
    expect(canShareMock).toHaveBeenCalledOnce();
    const canShareArg = canShareMock.mock.calls[0][0];
    expect(canShareArg).toHaveProperty("files");
    expect(canShareArg.files).toHaveLength(1);
    expect(canShareArg.files[0]).toBeInstanceOf(File);

    // Verify navigator.share was called with a File object
    expect(shareMock).toHaveBeenCalledOnce();
    const shareArg = shareMock.mock.calls[0][0];
    expect(shareArg).toHaveProperty("files");
    expect(shareArg.files).toHaveLength(1);
    const sharedFile = shareArg.files[0];
    expect(sharedFile).toBeInstanceOf(File);
    expect(sharedFile.name).toBe("test-download.png");
    expect(sharedFile.type).toBe("image/png");

    // Verify revokeObjectURL was called after share resolved
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });

  /**
   * AC-2: GIVEN `navigator.canShare` existiert nicht
   * WHEN `downloadImage(url, filename)` aufgerufen wird
   * THEN wird der bestehende Anchor-Click-Pfad ausgefuehrt (createElement "a",
   * href = objectURL, download = filename, appendChild, click, removeChild, revokeObjectURL)
   */
  it("AC-2: should fall back to anchor-click when canShare is not available", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-fallback-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // Ensure navigator.canShare does NOT exist
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: undefined,
      share: undefined,
    });

    // Spy on anchor click
    const realAnchor = document.createElement("a");
    const clickSpy = vi.spyOn(realAnchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string) => {
        if (tag === "a") return realAnchor;
        return Object.getPrototypeOf(document).createElement.call(
          document,
          tag
        );
      }
    );
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    await downloadImage(
      "https://r2.example.com/projects/abc/img.png",
      "fallback-file.png"
    );

    // Verify anchor-click fallback was executed
    expect(realAnchor.href).toBe(fakeObjectUrl);
    expect(realAnchor.download).toBe("fallback-file.png");
    expect(appendChildSpy).toHaveBeenCalledWith(realAnchor);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledWith(realAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });

  /**
   * AC-2b: GIVEN `navigator.canShare` existiert aber `navigator.canShare({ files: [File] })` gibt `false` zurueck
   * WHEN `downloadImage(url, filename)` aufgerufen wird
   * THEN wird der bestehende Anchor-Click-Pfad ausgefuehrt
   */
  it("AC-2b: should fall back to anchor-click when canShare returns false", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-canshare-false-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // canShare exists but returns false (device does not support file sharing)
    const canShareMock = vi.fn().mockReturnValue(false);
    const shareMock = vi.fn();
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    // Spy on anchor click
    const realAnchor = document.createElement("a");
    const clickSpy = vi.spyOn(realAnchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string) => {
        if (tag === "a") return realAnchor;
        return Object.getPrototypeOf(document).createElement.call(
          document,
          tag
        );
      }
    );
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");

    await downloadImage(
      "https://r2.example.com/projects/abc/img.png",
      "canshare-false-file.png"
    );

    // Verify canShare was called and returned false
    expect(canShareMock).toHaveBeenCalledOnce();

    // Verify navigator.share was NOT called
    expect(shareMock).not.toHaveBeenCalled();

    // Verify anchor-click fallback was executed
    expect(realAnchor.href).toBe(fakeObjectUrl);
    expect(realAnchor.download).toBe("canshare-false-file.png");
    expect(appendChildSpy).toHaveBeenCalledWith(realAnchor);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledWith(realAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });

  /**
   * AC-3: GIVEN Web Share API ist verfuegbar und `navigator.share()` rejected mit
   * einem Error dessen `name === "AbortError"` (User schliesst Share-Sheet)
   * WHEN `downloadImage(url, filename)` aufgerufen wird und der User das Share-Sheet dismissed
   * THEN resolved die Funktion normal (`Promise<void>` ohne throw),
   * `URL.revokeObjectURL` wird trotzdem aufgerufen
   */
  it("AC-3: should resolve without throwing when navigator.share rejects with AbortError", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-abort-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // Mock navigator.share to reject with AbortError (user dismissed share sheet)
    // Use a plain Error with name="AbortError" to match browser behavior where
    // DOMException extends Error. The implementation checks
    // `error instanceof Error && error.name === "AbortError"`.
    const abortError = Object.assign(new Error("Share canceled"), {
      name: "AbortError",
    });
    const shareMock = vi.fn().mockRejectedValue(abortError);
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    // Should resolve without throwing
    await expect(
      downloadImage(
        "https://r2.example.com/projects/abc/img.png",
        "abort-file.png"
      )
    ).resolves.toBeUndefined();

    // Verify revokeObjectURL was still called (cleanup despite AbortError)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });

  /**
   * AC-4: GIVEN Web Share API ist verfuegbar und `navigator.share()` rejected mit
   * einem Error dessen `name !== "AbortError"` (z.B. `NotAllowedError`)
   * WHEN `downloadImage(url, filename)` aufgerufen wird
   * THEN wird der Error re-thrown (propagiert zum Caller fuer Toast-Handling),
   * `URL.revokeObjectURL` wird trotzdem aufgerufen
   */
  it("AC-4: should re-throw when navigator.share rejects with non-AbortError", async () => {
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/png" });
    const fakeObjectUrl = "blob:http://localhost/fake-notallowed-url";

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock URL.createObjectURL / revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue(fakeObjectUrl);
    URL.revokeObjectURL = vi.fn();

    // Mock navigator.share to reject with NotAllowedError
    const notAllowedError = Object.assign(new Error("Permission denied"), {
      name: "NotAllowedError",
    });
    const shareMock = vi.fn().mockRejectedValue(notAllowedError);
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", {
      ...navigator,
      canShare: canShareMock,
      share: shareMock,
    });

    // Should re-throw the NotAllowedError
    await expect(
      downloadImage(
        "https://r2.example.com/projects/abc/img.png",
        "notallowed-file.png"
      )
    ).rejects.toThrow("Permission denied");

    // Verify the re-thrown error has the correct name
    try {
      await downloadImage(
        "https://r2.example.com/projects/abc/img.png",
        "notallowed-file.png"
      );
    } catch (error: unknown) {
      expect((error as Error).name).toBe("NotAllowedError");
    }

    // Verify revokeObjectURL was still called (cleanup despite error)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeObjectUrl);
  });
});

// ---------------------------------------------------------------------------
// generateDownloadFilename tests
// ---------------------------------------------------------------------------

describe("generateDownloadFilename", () => {
  /**
   * AC-2: GIVEN eine Generation mit `prompt: "A fox in oil painting style, warm colors"`
   * und `created_at: "2026-03-02T14:32:00Z"`
   * WHEN der Download-Dateiname generiert wird
   * THEN lautet der Dateiname `a-fox-in-oil-painting-style-warm-colors_2026-03-02.png`
   * (slugified prompt, max 60 Zeichen vor dem Datum, Sonderzeichen entfernt, Kleinbuchstaben)
   */
  it("AC-2: should generate slugified filename from prompt and created_at date", () => {
    const result = generateDownloadFilename(
      "A fox in oil painting style, warm colors",
      new Date("2026-03-02T14:32:00Z")
    );

    expect(result).toBe(
      "a-fox-in-oil-painting-style-warm-colors_2026-03-02.png"
    );
  });

  /**
   * AC-2: Sonderzeichen entfernt, Kleinbuchstaben
   */
  it("AC-2: should remove special characters and convert to lowercase", () => {
    const result = generateDownloadFilename(
      "Hello! World? (Test) #123 @art",
      new Date("2026-01-15T10:00:00Z")
    );

    expect(result).toBe("hello-world-test-123-art_2026-01-15.png");
  });

  it("AC-2: should handle string date input", () => {
    const result = generateDownloadFilename(
      "simple prompt",
      "2026-03-02T14:32:00Z"
    );

    expect(result).toBe("simple-prompt_2026-03-02.png");
  });

  /**
   * AC-3: GIVEN eine Generation mit einem sehr langen Prompt (>60 Zeichen)
   * WHEN der Download-Dateiname generiert wird
   * THEN wird der Prompt auf maximal 60 Zeichen gekuerzt (am letzten Wort-Ende
   * vor dem Limit) und mit `_{datum}.png` ergaenzt
   */
  it("AC-3: should truncate prompt to max 60 characters at last word boundary", () => {
    // This prompt slug will be well over 60 characters
    const longPrompt =
      "a very detailed oil painting of a beautiful sunset over the ocean with warm golden colors and dramatic clouds";
    const result = generateDownloadFilename(
      longPrompt,
      new Date("2026-03-02T00:00:00Z")
    );

    // Extract the slug part (before _YYYY-MM-DD.png)
    const slugPart = result.replace(/_\d{4}-\d{2}-\d{2}\.png$/, "");

    // Slug should be at most 60 characters
    expect(slugPart.length).toBeLessThanOrEqual(60);

    // Should end at a word boundary (no partial words = no trailing hyphen)
    expect(slugPart).not.toMatch(/-$/);

    // Should end with date suffix
    expect(result).toMatch(/_2026-03-02\.png$/);
  });

  it("AC-3: should not truncate prompt that is exactly 60 characters or less", () => {
    // A prompt whose slug is under 60 chars should not be truncated
    const shortPrompt = "a fox in a forest";
    const result = generateDownloadFilename(
      shortPrompt,
      new Date("2026-06-15T00:00:00Z")
    );

    expect(result).toBe("a-fox-in-a-forest_2026-06-15.png");
  });
});
