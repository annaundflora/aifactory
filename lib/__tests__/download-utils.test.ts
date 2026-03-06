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
