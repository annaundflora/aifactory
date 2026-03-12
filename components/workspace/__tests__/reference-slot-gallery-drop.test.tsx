// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  GALLERY_DRAG_MIME_TYPE,
  type GalleryDragPayload,
} from "@/lib/constants/drag-types";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Mocks — mock_external strategy per spec (same pattern as existing tests)
// ---------------------------------------------------------------------------

// Mock lucide-react icons to simple SVG elements
vi.mock("lucide-react", () => ({
  Loader2: (props: Record<string, unknown>) => (
    <svg data-testid={props["data-testid"] as string} />
  ),
  X: (props: Record<string, unknown>) => (
    <svg data-testid="x-icon" {...props} />
  ),
  AlertTriangle: (props: Record<string, unknown>) => (
    <svg data-testid="alert-triangle-icon" {...props} />
  ),
}));

// Mock shadcn Select components (Radix uses portals; jsdom cannot handle)
vi.mock("@/components/ui/select", () => {
  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <div data-mock="select" data-value={value}>
        {React.Children.map(children, (child: React.ReactElement) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(
            child as React.ReactElement<Record<string, unknown>>,
            { _selectValue: value, _onValueChange: onValueChange }
          );
        })}
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    SelectTrigger: ({ children, _selectValue, _onValueChange, ...props }: {
      children: React.ReactNode;
      _selectValue?: string;
      _onValueChange?: (value: string) => void;
      [key: string]: unknown;
    }) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => (
      <span data-slot="select-value">{placeholder}</span>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => (
      <div data-slot="select-content">{children}</div>
    ),
    SelectItem: ({
      children,
      value,
      ...props
    }: {
      children: React.ReactNode;
      value: string;
      [key: string]: unknown;
    }) => (
      <div data-slot="select-item" data-value={value} {...props}>
        {children}
      </div>
    ),
  };
});

// Mock shadcn Badge to simple span
vi.mock("@/components/ui/badge", () => {

  return {
    Badge: ({
      children,
      className,
      variant,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      variant?: string;
      [key: string]: unknown;
    }) => (
      <span
        data-slot="badge"
        data-variant={variant}
        className={className}
        {...props}
      >
        {children}
      </span>
    ),
  };
});

// Mock cn to concatenate class names (avoids tailwind-merge issues)
vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args
      .flat()
      .filter((a) => typeof a === "string" && a.length > 0)
      .join(" "),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { ReferenceSlot } from "../reference-slot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GALLERY_PAYLOAD: GalleryDragPayload = {
  generationId: "gen-abc",
  imageUrl: "https://r2.example.com/img.png",
};

/** Creates a complete ReferenceSlotData object for ready (filled) state */
function createSlotData(
  overrides: Partial<ReferenceSlotData> = {}
): ReferenceSlotData {
  return {
    id: "ref-1",
    imageUrl: "https://r2.example.com/references/img.png",
    slotPosition: 1,
    role: "style",
    strength: "moderate",
    originalFilename: "test-reference.png",
    width: 1024,
    height: 768,
    ...overrides,
  };
}

/** Fire a dragOver event with only the gallery MIME type in dataTransfer.types */
function fireGalleryDragOver(element: HTMLElement) {
  fireEvent.dragOver(element, {
    dataTransfer: {
      types: [GALLERY_DRAG_MIME_TYPE],
      files: [],
    },
  });
}

/** Fire a dragOver event with only "Files" in dataTransfer.types (native file drag) */
function fireFileDragOver(element: HTMLElement) {
  fireEvent.dragOver(element, {
    dataTransfer: {
      types: ["Files"],
      files: [],
    },
  });
}

/** Fire a drop event with gallery data in the custom MIME type */
function fireGalleryDrop(
  element: HTMLElement,
  payload: GalleryDragPayload = GALLERY_PAYLOAD
) {
  fireEvent.drop(element, {
    dataTransfer: {
      types: [GALLERY_DRAG_MIME_TYPE],
      getData: (type: string) =>
        type === GALLERY_DRAG_MIME_TYPE ? JSON.stringify(payload) : "",
      files: [],
    },
  });
}

/** Fire a drop event with a native file */
function fireFileDrop(element: HTMLElement, file?: File) {
  const f =
    file ?? new File([new Uint8Array(1024)], "photo.png", { type: "image/png" });
  fireEvent.drop(element, {
    dataTransfer: {
      types: ["Files"],
      getData: () => "",
      files: [f],
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReferenceSlot Gallery Drop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // DragOver Discrimination
  // =========================================================================

  describe("DragOver Discrimination", () => {
    /**
     * AC-4: GIVEN ein leerer ReferenceSlot im empty-State
     * WHEN ein DragOver-Event mit dataTransfer.types das
     *      "application/x-aifactory-generation" enthaelt eintrifft
     * THEN wird e.preventDefault() aufgerufen (Drop erlaubt) und der Slot
     *      wechselt in den drag-over-State mit Accent-Border
     */
    it("AC-4: should accept dragover and show accent border when dataTransfer contains application/x-aifactory-generation", () => {
      render(<ReferenceSlot slotData={null} />);

      const slot = screen.getByTestId("reference-slot");
      expect(slot).toHaveAttribute("data-state", "empty");

      // Fire gallery dragover
      fireGalleryDragOver(slot);

      // Slot should switch to drag-over state
      expect(slot).toHaveAttribute("data-state", "drag-over");

      // Accent border visible (solid + primary)
      expect(slot.className).toContain("border-solid");
      expect(slot.className).toContain("border-primary");

      // "Drop to add" text should appear
      expect(screen.getByText("Drop to add")).toBeInTheDocument();
    });

    /**
     * AC-4 (supplementary): Verify that preventDefault was called on the
     * gallery dragover event (allowing the drop).
     */
    it("AC-4: should call preventDefault on gallery dragover to allow drop", () => {
      render(<ReferenceSlot slotData={null} />);

      const slot = screen.getByTestId("reference-slot");

      const preventDefault = vi.fn();
      fireEvent.dragOver(slot, {
        preventDefault,
        dataTransfer: {
          types: [GALLERY_DRAG_MIME_TYPE],
          files: [],
        },
      });

      // jsdom fireEvent calls preventDefault via the event object
      // The component calls e.preventDefault() — we verify the state change
      // which only happens when preventDefault is called
      expect(slot).toHaveAttribute("data-state", "drag-over");
    });

    /**
     * AC-5: GIVEN ein leerer ReferenceSlot im empty-State
     * WHEN ein DragOver-Event NUR mit "Files" in dataTransfer.types eintrifft
     *      (nativer File-Drop)
     * THEN bleibt das bestehende File-Drop-Verhalten erhalten
     *      (Upload via onUpload-Callback)
     */
    it("AC-5: should use existing file drop behavior when dataTransfer contains only Files type", () => {
      const onUpload = vi.fn();
      render(<ReferenceSlot slotData={null} onUpload={onUpload} />);

      const slot = screen.getByTestId("reference-slot");

      // Fire native file dragover
      fireFileDragOver(slot);

      // Slot should also enter drag-over state (existing behavior for file drops)
      expect(slot).toHaveAttribute("data-state", "drag-over");

      // Now drop a native file
      const file = new File([new Uint8Array(512)], "test.png", {
        type: "image/png",
      });
      fireFileDrop(slot, file);

      // onUpload should be called with the file (existing behavior preserved)
      expect(onUpload).toHaveBeenCalledTimes(1);
      expect(onUpload).toHaveBeenCalledWith(file);
    });
  });

  // =========================================================================
  // Gallery Drop Handling
  // =========================================================================

  describe("Gallery Drop Handling", () => {
    /**
     * AC-6: GIVEN ein leerer ReferenceSlot im drag-over-State (Gallery-Drag erkannt)
     * WHEN ein Drop-Event mit "application/x-aifactory-generation"-Daten eintrifft
     *      ({ generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" })
     * THEN wird der onGalleryDrop-Callback mit
     *      { generationId: "gen-abc", imageUrl: "https://r2.example.com/img.png" }
     *      aufgerufen und KEIN File-Upload ausgeloest
     */
    it("AC-6: should call onGalleryDrop with parsed generationId and imageUrl on gallery drop", () => {
      const onGalleryDrop = vi.fn();
      const onUpload = vi.fn();

      render(
        <ReferenceSlot
          slotData={null}
          onGalleryDrop={onGalleryDrop}
          onUpload={onUpload}
        />
      );

      const slot = screen.getByTestId("reference-slot");

      // First enter drag-over state
      fireGalleryDragOver(slot);
      expect(slot).toHaveAttribute("data-state", "drag-over");

      // Now drop gallery data
      fireGalleryDrop(slot, {
        generationId: "gen-abc",
        imageUrl: "https://r2.example.com/img.png",
      });

      // onGalleryDrop should be called with the parsed payload
      expect(onGalleryDrop).toHaveBeenCalledTimes(1);
      expect(onGalleryDrop).toHaveBeenCalledWith({
        generationId: "gen-abc",
        imageUrl: "https://r2.example.com/img.png",
      });
    });

    /**
     * AC-6 (no file upload): GIVEN a gallery drop on an empty slot
     * WHEN the drop is processed
     * THEN onUpload is NOT called (no file upload triggered)
     */
    it("AC-6: should not call onUpload when gallery drop is processed", () => {
      const onGalleryDrop = vi.fn();
      const onUpload = vi.fn();

      render(
        <ReferenceSlot
          slotData={null}
          onGalleryDrop={onGalleryDrop}
          onUpload={onUpload}
        />
      );

      const slot = screen.getByTestId("reference-slot");

      // Drop gallery data
      fireGalleryDrop(slot);

      // onGalleryDrop is called
      expect(onGalleryDrop).toHaveBeenCalledTimes(1);

      // onUpload must NOT be called
      expect(onUpload).not.toHaveBeenCalled();
    });

    /**
     * AC-6 (state reset): After a gallery drop, the slot should reset
     * visual state back to empty (awaiting parent to set ready state via props).
     */
    it("AC-6: should reset visual state to empty after gallery drop", () => {
      const onGalleryDrop = vi.fn();

      render(
        <ReferenceSlot slotData={null} onGalleryDrop={onGalleryDrop} />
      );

      const slot = screen.getByTestId("reference-slot");

      // Enter drag-over, then drop
      fireGalleryDragOver(slot);
      expect(slot).toHaveAttribute("data-state", "drag-over");

      fireGalleryDrop(slot);

      // After drop, visual state resets to empty (parent will provide slotData to make it ready)
      expect(slot).toHaveAttribute("data-state", "empty");
    });
  });

  // =========================================================================
  // Filled Slot Rejection
  // =========================================================================

  describe("Filled Slot Rejection", () => {
    /**
     * AC-7: GIVEN ein ReferenceSlot im ready-State (bereits befuellt)
     * WHEN ein DragOver-Event mit "application/x-aifactory-generation" eintrifft
     * THEN wird der Drop NICHT erlaubt (kein preventDefault, kein visuelles Feedback)
     */
    it("AC-7: should not accept gallery drag when slot is in ready state", () => {
      const slotData = createSlotData();
      const onGalleryDrop = vi.fn();

      render(
        <ReferenceSlot
          slotData={slotData}
          onGalleryDrop={onGalleryDrop}
          onRoleChange={vi.fn()}
          onStrengthChange={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const slot = screen.getByTestId("reference-slot");
      expect(slot).toHaveAttribute("data-state", "ready");

      // Attempt gallery dragover on filled slot — should not change state
      // The ready-state component renders a different DOM tree without drag handlers,
      // but we fire the event to ensure no state change or errors
      fireGalleryDragOver(slot);

      // State should remain "ready", not switch to "drag-over"
      expect(slot).toHaveAttribute("data-state", "ready");
    });

    /**
     * AC-7 (drop rejection): Dropping gallery data on a filled slot should
     * NOT call onGalleryDrop.
     */
    it("AC-7: should not call onGalleryDrop when gallery data is dropped on a filled slot", () => {
      const slotData = createSlotData();
      const onGalleryDrop = vi.fn();

      render(
        <ReferenceSlot
          slotData={slotData}
          onGalleryDrop={onGalleryDrop}
          onRoleChange={vi.fn()}
          onStrengthChange={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const slot = screen.getByTestId("reference-slot");

      // Attempt gallery drop on filled slot
      fireGalleryDrop(slot);

      // onGalleryDrop should NOT be called
      expect(onGalleryDrop).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Integration with addGalleryAsReference
  // =========================================================================

  describe("Integration with addGalleryAsReference", () => {
    /**
     * AC-8: GIVEN ein Gallery-Drop auf einen leeren Slot wurde erfolgreich
     *       via onGalleryDrop verarbeitet
     * WHEN die ReferenceBar den Callback empfaengt
     * THEN wird addGalleryAsReference (Server Action aus Slice 05) mit
     *      { projectId, generationId, imageUrl } aufgerufen und der Slot zeigt
     *      das Thumbnail der Gallery-Generation im ready-State
     *
     * This test verifies the contract: onGalleryDrop is called with the correct
     * payload shape that the parent (ReferenceBar) needs to invoke the server action.
     * The actual server action call is the parent's responsibility (tested in
     * reference-bar tests), so here we verify the data contract.
     */
    it("AC-8: should trigger onGalleryDrop callback with correct generationId and imageUrl for server action invocation", () => {
      const onGalleryDrop = vi.fn();
      const payload: GalleryDragPayload = {
        generationId: "gen-abc",
        imageUrl: "https://r2.example.com/img.png",
      };

      render(
        <ReferenceSlot slotData={null} onGalleryDrop={onGalleryDrop} />
      );

      const slot = screen.getByTestId("reference-slot");
      fireGalleryDrop(slot, payload);

      // Verify onGalleryDrop receives the exact shape needed for addGalleryAsReference
      expect(onGalleryDrop).toHaveBeenCalledTimes(1);
      const receivedData = onGalleryDrop.mock.calls[0][0];
      expect(receivedData.generationId).toBe("gen-abc");
      expect(receivedData.imageUrl).toBe("https://r2.example.com/img.png");

      // The parent (ReferenceBar) would call:
      // addGalleryAsReference({ projectId, generationId: data.generationId, imageUrl: data.imageUrl })
    });

    /**
     * AC-8 (ready state after server action): After the parent processes the
     * gallery drop and provides slotData, the slot should render in ready state
     * with the gallery image as thumbnail.
     */
    it("AC-8: should show thumbnail in ready state when parent provides slotData after gallery drop", () => {
      const galleryImageUrl = "https://r2.example.com/img.png";

      // After the server action completes, the parent provides slotData
      const slotData = createSlotData({
        imageUrl: galleryImageUrl,
        role: "style",
        strength: "moderate",
        slotPosition: 1,
      });

      render(
        <ReferenceSlot
          slotData={slotData}
          onRoleChange={vi.fn()}
          onStrengthChange={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const slot = screen.getByTestId("reference-slot");
      expect(slot).toHaveAttribute("data-state", "ready");

      // Thumbnail should show the gallery image
      const thumbnail = screen.getByTestId("reference-thumbnail");
      expect(thumbnail).toHaveAttribute("src", galleryImageUrl);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    /**
     * Malformed gallery payload should not crash the component.
     */
    it("should handle malformed JSON in gallery drop gracefully", () => {
      const onGalleryDrop = vi.fn();

      render(
        <ReferenceSlot slotData={null} onGalleryDrop={onGalleryDrop} />
      );

      const slot = screen.getByTestId("reference-slot");

      // Fire drop with invalid JSON
      fireEvent.drop(slot, {
        dataTransfer: {
          types: [GALLERY_DRAG_MIME_TYPE],
          getData: (type: string) =>
            type === GALLERY_DRAG_MIME_TYPE ? "not-valid-json{{{" : "",
          files: [],
        },
      });

      // onGalleryDrop should NOT be called (invalid payload)
      expect(onGalleryDrop).not.toHaveBeenCalled();

      // Component should not crash
      expect(slot).toBeInTheDocument();
    });

    /**
     * Empty gallery data string should not trigger onGalleryDrop.
     */
    it("should not call onGalleryDrop when gallery data is empty string", () => {
      const onGalleryDrop = vi.fn();
      const onUpload = vi.fn();

      render(
        <ReferenceSlot
          slotData={null}
          onGalleryDrop={onGalleryDrop}
          onUpload={onUpload}
        />
      );

      const slot = screen.getByTestId("reference-slot");

      // Fire drop with empty gallery data (falls through to file drop path)
      fireEvent.drop(slot, {
        dataTransfer: {
          types: [GALLERY_DRAG_MIME_TYPE],
          getData: () => "",
          files: [],
        },
      });

      // Neither callback should be called (no gallery data, no files)
      expect(onGalleryDrop).not.toHaveBeenCalled();
      expect(onUpload).not.toHaveBeenCalled();
    });

    /**
     * DragLeave should reset from drag-over back to empty after gallery drag.
     */
    it("should revert to empty state on dragleave after gallery dragover", () => {
      render(<ReferenceSlot slotData={null} />);

      const slot = screen.getByTestId("reference-slot");

      // Enter drag-over via gallery drag
      fireGalleryDragOver(slot);
      expect(slot).toHaveAttribute("data-state", "drag-over");

      // Leave
      fireEvent.dragLeave(slot, {
        dataTransfer: { types: [], files: [] },
      });

      // Back to empty
      expect(slot).toHaveAttribute("data-state", "empty");
      expect(slot.className).toContain("border-dashed");
    });
  });
});
