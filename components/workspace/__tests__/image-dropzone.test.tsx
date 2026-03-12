// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Mocks — uploadSourceImage is a server action (mock_external strategy)
// ---------------------------------------------------------------------------

const mockUploadSourceImage = vi.fn();

vi.mock("@/app/actions/upload", () => ({
  uploadSourceImage: (...args: unknown[]) => mockUploadSourceImage(...args),
}));

// Mock lucide-react icons to simple elements
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <svg data-testid={props["data-testid"] as string} />
  ),
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { ImageDropzone } from "../image-dropzone";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal File object for testing */
function createTestFile(
  name = "test-image.png",
  type = "image/png",
  size = 1024
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

/** Stubs URL.createObjectURL and URL.revokeObjectURL */
function stubObjectUrl() {
  vi.stubGlobal(
    "URL",
    new Proxy(globalThis.URL, {
      get(target, prop) {
        if (prop === "createObjectURL") return () => "blob:mock-object-url";
        if (prop === "revokeObjectURL") return () => undefined;
        return Reflect.get(target, prop);
      },
    })
  );
}

/**
 * Stubs the global Image constructor so that readImageDimensions resolves
 * with controlled width/height values.
 */
function stubImage(width = 1024, height = 768) {
  const OriginalImage = globalThis.Image;
  vi.stubGlobal(
    "Image",
    class MockImage {
      naturalWidth = width;
      naturalHeight = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";

      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        // Trigger onload asynchronously to mimic real browser behavior
        queueMicrotask(() => {
          if (this.onload) this.onload();
        });
      }
    }
  );
  return () => {
    vi.stubGlobal("Image", OriginalImage);
  };
}

/** Fires a drop event with a file on the given element */
function fireDrop(element: HTMLElement, file: File) {
  const dataTransfer = {
    files: [file],
    types: ["Files"],
  };
  fireEvent.drop(element, { dataTransfer });
}

/** Fires a dragOver event on the given element */
function fireDragOver(element: HTMLElement) {
  fireEvent.dragOver(element, {
    dataTransfer: { files: [], types: ["Files"] },
  });
}

/** Fires a dragLeave event on the given element */
function fireDragLeave(element: HTMLElement) {
  fireEvent.dragLeave(element, {
    dataTransfer: { files: [], types: ["Files"] },
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

const R2_URL = "https://r2.example.com/sources/p1/abc.png";
const PROJECT_ID = "test-project-1";

describe("ImageDropzone Acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubObjectUrl();
    stubImage(1024, 768);
  });

  // --------------------------------------------------------------------------
  // AC-1: empty-State zeigt Platzhalter-Texte, kein Thumbnail
  // GIVEN `ImageDropzone` ohne vorherigen Upload gerendert wird
  // WHEN die Komponente im DOM erscheint
  // THEN ist der `empty`-State sichtbar: Dashed-Border-Container mit den Texten
  //      "Drop image here", "or click to upload" und "or paste URL";
  //      kein Thumbnail, kein Remove-Button
  // --------------------------------------------------------------------------
  it("AC-1: should render empty state with dropzone placeholder text and no thumbnail", () => {
    const onUpload = vi.fn();
    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    // Dropzone container in empty state
    const dropzone = screen.getByTestId("image-dropzone");
    expect(dropzone).toHaveAttribute("data-state", "empty");

    // Placeholder texts
    expect(screen.getByText("Drop image here")).toBeInTheDocument();
    expect(screen.getByText("or click to upload")).toBeInTheDocument();
    expect(screen.getByText("or paste URL")).toBeInTheDocument();

    // No thumbnail, no remove button
    expect(screen.queryByTestId("image-thumbnail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-image-button")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-2: drag-over wechselt State zu drag-over mit Border-Highlighting
  // GIVEN `ImageDropzone` im `empty`-State
  // WHEN eine Datei ueber die Dropzone gezogen wird (dragover-Event)
  // THEN wechselt die Komponente in den `drag-over`-State: Border-Highlighting
  //      sichtbar (andere Farbe oder staerkerer Border als im `empty`-State)
  // --------------------------------------------------------------------------
  it("AC-2: should switch to drag-over state when file is dragged over the dropzone", () => {
    const onUpload = vi.fn();
    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    expect(dropzone).toHaveAttribute("data-state", "empty");

    // Drag over the dropzone
    fireDragOver(dropzone);

    expect(dropzone).toHaveAttribute("data-state", "drag-over");
  });

  // --------------------------------------------------------------------------
  // AC-3: dragleave kehrt zu empty zurueck
  // GIVEN `ImageDropzone` im `drag-over`-State
  // WHEN die Datei die Dropzone verlaesst (dragleave-Event)
  // THEN kehrt die Komponente in den `empty`-State zurueck
  // --------------------------------------------------------------------------
  it("AC-3: should return to empty state when dragged file leaves the dropzone", () => {
    const onUpload = vi.fn();
    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");

    // Enter drag-over state
    fireDragOver(dropzone);
    expect(dropzone).toHaveAttribute("data-state", "drag-over");

    // Leave the dropzone
    fireDragLeave(dropzone);
    expect(dropzone).toHaveAttribute("data-state", "empty");
  });

  // --------------------------------------------------------------------------
  // AC-4: Drop einer gueltigen Datei -> uploading -> preview State-Transition
  // GIVEN `ImageDropzone` im `empty`-State und `uploadSourceImage` resolvet
  //       nach 100ms mit { url: "https://r2.example.com/sources/p1/abc.png" }
  // WHEN eine gueltige PNG-Datei per Drop abgelegt wird
  // THEN wechselt die Komponente sofort in den `uploading`-State
  //      (Progress-Indikator sichtbar, kein Thumbnail); nach dem Resolve
  //      wechselt sie in den `preview`-State
  // --------------------------------------------------------------------------
  it("AC-4: should transition through uploading to preview state after successful drop upload", async () => {
    const onUpload = vi.fn();

    // uploadSourceImage resolves after a brief delay to allow checking uploading state
    let resolveUpload!: (value: { url: string }) => void;
    mockUploadSourceImage.mockImplementation(
      () =>
        new Promise<{ url: string }>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("test.png", "image/png");

    // Drop a valid PNG
    fireDrop(dropzone, file);

    // Should immediately be in uploading state
    await waitFor(() => {
      const dz = screen.getByTestId("image-dropzone");
      expect(dz).toHaveAttribute("data-state", "uploading");
    });

    // Upload spinner is visible, no thumbnail
    expect(screen.getByTestId("upload-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("image-thumbnail")).not.toBeInTheDocument();

    // Resolve the upload
    resolveUpload({ url: R2_URL });

    // After resolve, transitions to preview state
    await waitFor(() => {
      const dz = screen.getByTestId("image-dropzone");
      expect(dz).toHaveAttribute("data-state", "preview");
    });
  });

  // --------------------------------------------------------------------------
  // AC-5: preview-State zeigt Thumbnail, Dateiname, Dimensionen, Remove-Button
  // GIVEN `ImageDropzone` im `preview`-State nach erfolgreichem Upload
  // WHEN der State gerendert wird
  // THEN sind sichtbar: Thumbnail (<img>), Dateiname der hochgeladenen Datei,
  //      Bildabmessungen in Format "WIDTHxHEIGHT" und ein Remove-Button;
  //      kein Dashed-Border-Platzhalter
  // --------------------------------------------------------------------------
  it("AC-5: should show thumbnail, filename, dimensions and remove button in preview state", async () => {
    const onUpload = vi.fn();
    mockUploadSourceImage.mockResolvedValue({ url: R2_URL });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("my-photo.png", "image/png");

    // Drop file to trigger upload
    fireDrop(dropzone, file);

    // Wait for preview state
    await waitFor(() => {
      const dz = screen.getByTestId("image-dropzone");
      expect(dz).toHaveAttribute("data-state", "preview");
    });

    // Thumbnail visible
    const thumbnail = screen.getByTestId("image-thumbnail");
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute("src", R2_URL);

    // Filename visible
    expect(screen.getByTestId("image-filename")).toHaveTextContent("my-photo.png");

    // Dimensions visible in WIDTHxHEIGHT format
    expect(screen.getByTestId("image-dimensions")).toHaveTextContent("1024x768");

    // Remove button visible
    expect(screen.getByTestId("remove-image-button")).toBeInTheDocument();

    // No placeholder texts (empty-state markers)
    expect(screen.queryByText("Drop image here")).not.toBeInTheDocument();
    expect(screen.queryByText("or click to upload")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-6: Remove-Button setzt Komponente zurueck in empty-State; onUpload(null)
  // GIVEN `ImageDropzone` im `preview`-State
  // WHEN der Remove-Button geklickt wird
  // THEN wechselt die Komponente zurueck in den `empty`-State; `onUpload` wird
  //      mit `null` aufgerufen; Thumbnail und Dateiname sind nicht mehr im DOM
  // --------------------------------------------------------------------------
  it("AC-6: should return to empty state and call onUpload with null when remove button is clicked", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    mockUploadSourceImage.mockResolvedValue({ url: R2_URL });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("removable.png", "image/png");

    // Drop file to get to preview state
    fireDrop(dropzone, file);

    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });

    // Clear the onUpload calls from the upload itself
    onUpload.mockClear();

    // Click remove button
    const removeBtn = screen.getByTestId("remove-image-button");
    await user.click(removeBtn);

    // Should be back in empty state
    const dz = screen.getByTestId("image-dropzone");
    expect(dz).toHaveAttribute("data-state", "empty");

    // onUpload called with null
    expect(onUpload).toHaveBeenCalledWith(null);

    // Thumbnail and filename no longer in DOM
    expect(screen.queryByTestId("image-thumbnail")).not.toBeInTheDocument();
    expect(screen.queryByTestId("image-filename")).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // AC-7: Upload-Fehler (Dateityp) zeigt error-State mit Fehlermeldung
  // GIVEN `uploadSourceImage` resolvet mit { error: "Nur PNG, JPG, JPEG und WebP erlaubt" }
  // WHEN eine Datei per Drop abgelegt wird
  // THEN wechselt die Komponente in den `error`-State: Fehlermeldung
  //      "Nur PNG, JPG, JPEG und WebP erlaubt" ist im Container sichtbar;
  //      `onUpload` wird nicht mit einer URL aufgerufen
  // --------------------------------------------------------------------------
  it("AC-7: should show error state with file type error message when uploadSourceImage returns type error", async () => {
    const onUpload = vi.fn();
    mockUploadSourceImage.mockResolvedValue({
      error: "Nur PNG, JPG, JPEG und WebP erlaubt",
    });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("bad-file.gif", "image/gif");

    fireDrop(dropzone, file);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "error");
    });

    // Error message visible
    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "Nur PNG, JPG, JPEG und WebP erlaubt"
    );

    // onUpload was never called with a URL
    expect(onUpload).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // AC-8: Upload-Fehler (Dateigroesse) zeigt error-State mit Fehlermeldung
  // GIVEN `uploadSourceImage` resolvet mit { error: "Datei darf maximal 10MB gross sein" }
  // WHEN eine Datei per Drop abgelegt wird
  // THEN wechselt die Komponente in den `error`-State: Fehlermeldung
  //      "Datei darf maximal 10MB gross sein" ist im Container sichtbar
  // --------------------------------------------------------------------------
  it("AC-8: should show error state with size error message when uploadSourceImage returns size error", async () => {
    const onUpload = vi.fn();
    const sizeError = "Datei darf maximal 10MB gro\u00df sein";
    mockUploadSourceImage.mockResolvedValue({ error: sizeError });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("huge.png", "image/png", 11 * 1024 * 1024);

    fireDrop(dropzone, file);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "error");
    });

    // Error message visible
    expect(screen.getByTestId("error-message")).toHaveTextContent(sizeError);
  });

  // --------------------------------------------------------------------------
  // AC-9: error-State -> neuer Drop startet uploading-State
  // GIVEN `ImageDropzone` im `error`-State
  // WHEN der Nutzer erneut eine Datei per Drop oder Click-to-Browse eingibt
  // THEN wechselt die Komponente sofort in den `uploading`-State
  //      (error-State wird verlassen)
  // --------------------------------------------------------------------------
  it("AC-9: should transition from error state to uploading state on new file drop", async () => {
    const onUpload = vi.fn();

    // First upload fails
    mockUploadSourceImage.mockResolvedValueOnce({
      error: "Nur PNG, JPG, JPEG und WebP erlaubt",
    });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const badFile = createTestFile("bad.gif", "image/gif");

    fireDrop(dropzone, badFile);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "error");
    });

    // Now set up a pending upload for the second attempt
    let resolveSecond!: (value: { url: string }) => void;
    mockUploadSourceImage.mockImplementation(
      () =>
        new Promise<{ url: string }>((resolve) => {
          resolveSecond = resolve;
        })
    );

    // Drop a new valid file
    const goodFile = createTestFile("good.png", "image/png");
    const errorDropzone = screen.getByTestId("image-dropzone");
    fireDrop(errorDropzone, goodFile);

    // Should immediately enter uploading state (leaving error)
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "uploading");
    });

    // Resolve to clean up
    resolveSecond({ url: R2_URL });

    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });
  });

  // --------------------------------------------------------------------------
  // AC-10: onUpload wird einmal mit der exakten R2-URL aufgerufen
  // GIVEN `ImageDropzone` mit einem `onUpload`-Spy und `uploadSourceImage`
  //       resolvet mit { url: "https://r2.example.com/sources/p1/abc.png" }
  // WHEN ein Upload per Drop abgeschlossen wird
  // THEN wird `onUpload` einmal mit dem exakten Argument
  //      "https://r2.example.com/sources/p1/abc.png" aufgerufen
  // --------------------------------------------------------------------------
  it("AC-10: should call onUpload exactly once with the R2 url after successful upload", async () => {
    const onUpload = vi.fn();
    mockUploadSourceImage.mockResolvedValue({ url: R2_URL });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    const dropzone = screen.getByTestId("image-dropzone");
    const file = createTestFile("upload-test.png", "image/png");

    fireDrop(dropzone, file);

    // Wait for preview (upload completed)
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });

    // onUpload called exactly once with the R2 URL
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(R2_URL);
  });

  // --------------------------------------------------------------------------
  // AC-11: Klick auf Dropzone oeffnet File-Picker (hidden input erhaelt click)
  // GIVEN `ImageDropzone` im `empty`-State
  // WHEN der Nutzer auf den Dropzone-Bereich klickt
  // THEN wird ein File-Picker-Dialog geoeffnet (hidden <input type="file">
  //      erhaelt `.click()`); nach Dateiauswahl startet der Upload-Zyklus
  //      identisch zum Drop-Flow
  // --------------------------------------------------------------------------
  it("AC-11: should trigger file input click when dropzone area is clicked", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    mockUploadSourceImage.mockResolvedValue({ url: R2_URL });

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    // Get the hidden file input and spy on its click method
    const fileInput = screen.getByTestId("file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    // Click the dropzone area
    const dropzone = screen.getByTestId("image-dropzone");
    await user.click(dropzone);

    // Hidden file input should have received click()
    expect(clickSpy).toHaveBeenCalled();

    // Simulate file selection via the input (same as after file picker dialog)
    fireEvent.change(fileInput, {
      target: {
        files: [createTestFile("selected.png", "image/png")],
      },
    });

    // Upload cycle starts — uploading state
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "uploading");
    });

    // Then settles into preview
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });
  });

  // --------------------------------------------------------------------------
  // AC-12: URL-Paste startet Upload-Flow
  // GIVEN `ImageDropzone` im `empty`-State mit einem URL-Eingabefeld
  // WHEN der Nutzer einen String, der mit "http" beginnt, in das Eingabefeld
  //      einfuegt (paste-Event)
  // THEN ruft die Komponente `uploadSourceImage` mit { projectId, file } auf
  //      und wechselt in den `uploading`-State; der Flow ist identisch zum
  //      Drop-Flow
  // --------------------------------------------------------------------------
  it('AC-12: should call uploadSourceImage and enter uploading state when a URL starting with "http" is pasted', async () => {
    const onUpload = vi.fn();

    let resolveUpload!: (value: { url: string }) => void;
    mockUploadSourceImage.mockImplementation(
      () =>
        new Promise<{ url: string }>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(<ImageDropzone projectId={PROJECT_ID} onUpload={onUpload} />);

    // URL input field should be visible in empty state
    const urlInput = screen.getByTestId("url-input");
    expect(urlInput).toBeInTheDocument();

    // Paste a URL starting with "http"
    const pastedUrl = "https://example.com/image.png";
    fireEvent.paste(urlInput, {
      clipboardData: {
        getData: () => pastedUrl,
      },
    });

    // Should enter uploading state
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "uploading");
    });

    // uploadSourceImage was called with projectId and the URL
    expect(mockUploadSourceImage).toHaveBeenCalledTimes(1);
    expect(mockUploadSourceImage).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      url: pastedUrl,
    });

    // Resolve the upload
    resolveUpload({ url: R2_URL });

    // Transitions to preview just like drop-flow
    await waitFor(() => {
      expect(screen.getByTestId("image-dropzone")).toHaveAttribute("data-state", "preview");
    });

    expect(onUpload).toHaveBeenCalledWith(R2_URL);
  });
});
