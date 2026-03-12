// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Mocks -- mock_external strategy per spec
// ---------------------------------------------------------------------------

// Mock lucide-react icons to simple SVG/span elements
vi.mock("lucide-react", () => ({
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid={props["data-testid"] as string} className={props.className as string} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <svg data-testid="plus-icon" className={props.className as string} />
  ),
}));

// Mock ReferenceSlot as simplified component (per spec: mock_external)
vi.mock("@/components/workspace/reference-slot", () => ({
  ReferenceSlot: (props: {
    slotData: ReferenceSlotData | null;
    slotPosition?: number;
    onUpload?: (file: File) => void;
    onUploadUrl?: (url: string) => void;
    onRoleChange?: (role: string) => void;
    onStrengthChange?: (strength: string) => void;
    onRemove?: () => void;
  }) => (
    <div
      data-testid={
        props.slotData
          ? `reference-slot-${props.slotData.slotPosition}`
          : `reference-slot-empty-${props.slotPosition ?? "unknown"}`
      }
      data-slot-position={props.slotData?.slotPosition ?? props.slotPosition}
      data-state={props.slotData ? "ready" : "empty"}
    >
      {props.slotData
        ? `Slot @${props.slotData.slotPosition}`
        : `Empty Dropzone @${props.slotPosition ?? "?"}`}
    </div>
  ),
  ROLE_COLORS: {
    style: { border: "border-violet", badgeBg: "bg-violet", text: "text-violet", dotColor: "#9333EA", label: "Style" },
    content: { border: "border-blue", badgeBg: "bg-blue", text: "text-blue", dotColor: "#3B82F6", label: "Content" },
    structure: { border: "border-green", badgeBg: "bg-green", text: "text-green", dotColor: "#059669", label: "Structure" },
    character: { border: "border-amber", badgeBg: "bg-amber", text: "text-amber", dotColor: "#D97706", label: "Character" },
    color: { border: "border-pink", badgeBg: "bg-pink", text: "text-pink", dotColor: "#DB2777", label: "Color" },
  },
}));

// Mock shadcn Collapsible components using React Context (avoids prop-cloning issues)
vi.mock("@/components/ui/collapsible", () => {
  const React = require("react");

  const CollapsibleCtx = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>({ open: false, onOpenChange: () => {} });

  return {
    Collapsible: ({
      children,
      open,
      onOpenChange,
      ...props
    }: {
      children: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
      [key: string]: unknown;
    }) => (
      <CollapsibleCtx.Provider
        value={{ open: !!open, onOpenChange: onOpenChange ?? (() => {}) }}
      >
        <div data-slot="collapsible" data-state={open ? "open" : "closed"} {...props}>
          {children}
        </div>
      </CollapsibleCtx.Provider>
    ),
    CollapsibleTrigger: ({
      children,
      asChild,
      ...props
    }: {
      children: React.ReactNode;
      asChild?: boolean;
      [key: string]: unknown;
    }) => {
      const { open, onOpenChange } = React.useContext(CollapsibleCtx);
      if (asChild && React.isValidElement(children)) {
        const child = children as React.ReactElement<Record<string, unknown>>;
        return React.cloneElement(child, {
          onClick: (e: React.MouseEvent) => {
            onOpenChange(!open);
            if (typeof child.props?.onClick === "function") {
              (child.props.onClick as (e: React.MouseEvent) => void)(e);
            }
          },
        });
      }
      return (
        <button
          type="button"
          data-slot="collapsible-trigger"
          onClick={() => onOpenChange(!open)}
          {...props}
        >
          {children}
        </button>
      );
    },
    CollapsibleContent: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => {
      const { open } = React.useContext(CollapsibleCtx);
      if (!open) return null;
      return (
        <div data-slot="collapsible-content" {...props}>
          {children}
        </div>
      );
    },
  };
});

// Mock shadcn Badge to simple span
vi.mock("@/components/ui/badge", () => {
  const React = require("react");
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
      <span data-slot="badge" data-variant={variant} className={className} {...props}>
        {children}
      </span>
    ),
  };
});

// Mock shadcn Button to a real HTML button
vi.mock("@/components/ui/button", () => {
  const React = require("react");
  return {
    Button: ({
      children,
      className,
      variant,
      size,
      asChild,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      variant?: string;
      size?: string;
      asChild?: boolean;
      [key: string]: unknown;
    }) => (
      <button
        type="button"
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={className}
        {...props}
      >
        {children}
      </button>
    ),
  };
});

// Mock cn to just concatenate class names
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

import { ReferenceBar, getLowestFreePosition } from "../reference-bar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSlotData(
  overrides: Partial<ReferenceSlotData> = {}
): ReferenceSlotData {
  return {
    id: "ref-1",
    imageUrl: "https://r2.example.com/references/img1.png",
    slotPosition: 1,
    role: "style",
    strength: "moderate",
    originalFilename: "test-reference.png",
    width: 1024,
    height: 768,
    ...overrides,
  };
}

function createSlotsAtPositions(positions: number[]): ReferenceSlotData[] {
  return positions.map((pos) =>
    createSlotData({
      id: `ref-${pos}`,
      imageUrl: `https://r2.example.com/references/img${pos}.png`,
      slotPosition: pos,
      originalFilename: `reference-${pos}.png`,
    })
  );
}

function createTestFile(
  name = "test-image.png",
  type = "image/png",
  size = 1024
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// Unit Tests: getLowestFreePosition
// ---------------------------------------------------------------------------

describe("getLowestFreePosition (Unit)", () => {
  it("should return 1 when no positions are occupied", () => {
    expect(getLowestFreePosition([])).toBe(1);
  });

  it("should return 2 when position 1 is occupied", () => {
    expect(getLowestFreePosition([1])).toBe(2);
  });

  it("should return the lowest gap in sparse positions", () => {
    // Positions @1 and @3 occupied -> lowest free is @2
    expect(getLowestFreePosition([1, 3])).toBe(2);
  });

  it("should return the lowest gap when middle positions are free", () => {
    // Positions @1, @3, @5 occupied -> lowest free is @2
    expect(getLowestFreePosition([1, 3, 5])).toBe(2);
  });

  it("should return next sequential when all lower are occupied", () => {
    // Positions @1, @2, @3 occupied -> lowest free is @4
    expect(getLowestFreePosition([1, 2, 3])).toBe(4);
  });

  it("should return -1 when all 5 positions are occupied", () => {
    expect(getLowestFreePosition([1, 2, 3, 4, 5])).toBe(-1);
  });

  it("should handle unordered input correctly", () => {
    // Positions @5, @1, @3 -> lowest free is @2
    expect(getLowestFreePosition([5, 1, 3])).toBe(2);
  });

  it("should reuse freed position (AC-10 unit logic)", () => {
    // After removing @2 from @1,@2,@3 -> occupied is [1,3] -> lowest free is @2
    expect(getLowestFreePosition([1, 3])).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Acceptance Tests: ReferenceBar
// ---------------------------------------------------------------------------

describe("ReferenceBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Collapsed-Empty State", () => {
    // AC-1: Leerer State zeigt Chevron-Right, "References (0)", aktiven Add-Button
    it('AC-1: should render collapsed-empty with chevron-right, "References (0)" text, and enabled add button', () => {
      /**
       * AC-1: GIVEN eine ReferenceBar ohne Referenz-Bilder (`slots` ist leeres Array)
       * WHEN sie gerendert wird
       * THEN zeigt der Header: Chevron-Right-Icon, Text "References (0)", und einen aktiven [+ Add]-Button
       */
      render(<ReferenceBar slots={[]} />);

      // Chevron-Right icon present
      const chevronIcon = screen.getByTestId("chevron-icon");
      expect(chevronIcon).toBeInTheDocument();

      // Text "References (0)" visible
      expect(screen.getByText("References (0)")).toBeInTheDocument();

      // [+ Add] button is present and enabled
      const addButton = screen.getByTestId("add-reference-button");
      expect(addButton).toBeInTheDocument();
      expect(addButton).not.toBeDisabled();
    });
  });

  describe("Collapsed-Filled State", () => {
    // AC-2: Mini-Thumbnails mit sparse Labels und Counter-Badge
    it('AC-2: should render counter badge [3/5] with mini-thumbnails showing sparse labels @1, @3, @5', () => {
      /**
       * AC-2: GIVEN eine ReferenceBar mit 3 Referenzen (Positionen @1, @3, @5)
       * WHEN der Header im collapsed-State gerendert wird
       * THEN zeigt er: Chevron-Right-Icon, Counter-Badge "[3/5]", Mini-Thumbnails mit sparse Labels (@1, @3, @5), und einen aktiven [+ Add]-Button
       */
      const slots = createSlotsAtPositions([1, 3, 5]);
      render(<ReferenceBar slots={slots} />);

      // Chevron-Right icon present
      const chevronIcon = screen.getByTestId("chevron-icon");
      expect(chevronIcon).toBeInTheDocument();

      // Counter badge shows [3/5]
      const counterBadge = screen.getByTestId("counter-badge");
      expect(counterBadge).toBeInTheDocument();
      expect(counterBadge).toHaveTextContent("[3/5]");

      // Mini-thumbnails container visible (collapsed state)
      const miniThumbnails = screen.getByTestId("mini-thumbnails");
      expect(miniThumbnails).toBeInTheDocument();

      // Sparse labels @1, @3, @5
      const label1 = screen.getByTestId("mini-label-1");
      expect(label1).toHaveTextContent("@1");

      const label3 = screen.getByTestId("mini-label-3");
      expect(label3).toHaveTextContent("@3");

      const label5 = screen.getByTestId("mini-label-5");
      expect(label5).toHaveTextContent("@5");

      // Mini-thumbnail images present
      expect(screen.getByTestId("mini-thumb-1")).toBeInTheDocument();
      expect(screen.getByTestId("mini-thumb-3")).toBeInTheDocument();
      expect(screen.getByTestId("mini-thumb-5")).toBeInTheDocument();

      // [+ Add] button active
      const addButton = screen.getByTestId("add-reference-button");
      expect(addButton).not.toBeDisabled();
    });
  });

  describe("Collapse/Expand Toggle", () => {
    // AC-3: Header-Click expandiert
    it("AC-3: should expand bar and show full ReferenceSlots when collapsed header is clicked", async () => {
      /**
       * AC-3: GIVEN eine ReferenceBar im collapsed-State
       * WHEN der User auf den Header klickt
       * THEN expandiert die Bar und zeigt alle ReferenceSlot-Components in voller Groesse
       */
      const user = userEvent.setup();
      const slots = createSlotsAtPositions([1, 2]);
      render(<ReferenceBar slots={slots} />);

      // Initially collapsed -- ReferenceSlots not visible
      expect(screen.queryByTestId("reference-slots-container")).not.toBeInTheDocument();

      // Click header to expand
      const header = screen.getByTestId("reference-bar-header");
      await user.click(header);

      // Now expanded: ReferenceSlots container visible
      const container = screen.getByTestId("reference-slots-container");
      expect(container).toBeInTheDocument();

      // Full ReferenceSlot components rendered
      expect(screen.getByTestId("reference-slot-1")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-2")).toBeInTheDocument();
    });

    // AC-4: Header-Click kollabiert
    it("AC-4: should collapse bar when expanded header is clicked", async () => {
      /**
       * AC-4: GIVEN eine ReferenceBar im expanded-State
       * WHEN der User auf den Header klickt
       * THEN kollabiert die Bar (collapsed-filled bei vorhandenen Slots, collapsed-empty bei 0 Slots)
       */
      const user = userEvent.setup();
      const slots = createSlotsAtPositions([1, 3]);
      render(<ReferenceBar slots={slots} />);

      const header = screen.getByTestId("reference-bar-header");

      // Click to expand
      await user.click(header);
      expect(screen.getByTestId("reference-slots-container")).toBeInTheDocument();

      // Click again to collapse
      await user.click(header);

      // Content hidden
      expect(screen.queryByTestId("reference-slots-container")).not.toBeInTheDocument();

      // Mini-thumbnails visible again (collapsed-filled)
      expect(screen.getByTestId("mini-thumbnails")).toBeInTheDocument();
    });

    it("AC-4 (empty): should collapse to collapsed-empty when no slots", async () => {
      /**
       * AC-4 supplementary: GIVEN an expanded ReferenceBar with 0 slots
       * WHEN header is clicked to collapse
       * THEN shows collapsed-empty state with "References (0)"
       */
      const user = userEvent.setup();
      render(<ReferenceBar slots={[]} />);

      const header = screen.getByTestId("reference-bar-header");

      // Click to expand (even though empty)
      await user.click(header);

      // Click to collapse
      await user.click(header);

      // Collapsed-empty: "References (0)" visible
      expect(screen.getByText("References (0)")).toBeInTheDocument();
    });
  });

  describe("Auto-Expand", () => {
    // AC-5: Erstes Bild triggert Auto-Expand
    it("AC-5: should auto-expand when first image is added via add button", () => {
      /**
       * AC-5: GIVEN eine ReferenceBar im collapsed-empty-State
       * WHEN der User das erste Bild per [+ Add]-Button hochlaedt
       * THEN expandiert die Bar automatisch (auto-expand) und der neue Slot erhaelt die Position @1
       */
      const onAdd = vi.fn();
      render(<ReferenceBar slots={[]} onAdd={onAdd} />);

      // Verify initially collapsed
      const referenceBar = screen.getByTestId("reference-bar");
      expect(referenceBar).toHaveAttribute("data-state", "closed");

      // Simulate file selection via hidden input
      const fileInput = screen.getByTestId("add-file-input") as HTMLInputElement;
      const file = createTestFile("first-image.png", "image/png");

      fireEvent.change(fileInput, {
        target: { files: [file] },
      });

      // onAdd should be called with position @1 (lowest free)
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(file, 1);

      // Bar should now be expanded (auto-expand)
      expect(referenceBar).toHaveAttribute("data-state", "open");
    });
  });

  describe("Sparse Slot Numbering", () => {
    // AC-6: Neue Bilder fuellen niedrigste freie Nummer
    it("AC-6: should assign lowest free position number to new slot when gaps exist", () => {
      /**
       * AC-6: GIVEN eine ReferenceBar mit Slots an Positionen @1 und @3 (Position @2 frei)
       * WHEN ein neues Bild hinzugefuegt wird
       * THEN erhaelt der neue Slot die Position @2 (niedrigste freie Nummer)
       */
      const onAdd = vi.fn();
      const slots = createSlotsAtPositions([1, 3]);
      render(<ReferenceBar slots={slots} onAdd={onAdd} />);

      // Simulate file addition
      const fileInput = screen.getByTestId("add-file-input") as HTMLInputElement;
      const file = createTestFile("new-image.png", "image/png");

      fireEvent.change(fileInput, {
        target: { files: [file] },
      });

      // onAdd called with position @2 (lowest free)
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(file, 2);
    });

    // AC-7: Labels bleiben stabil bei Remove
    it("AC-7: should not renumber remaining slots when a slot is removed", async () => {
      /**
       * AC-7: GIVEN eine ReferenceBar mit 3 Slots (@1, @2, @3)
       * WHEN Slot @2 per Remove-Button entfernt wird
       * THEN bleiben die verbleibenden Slots bei @1 und @3 (kein Re-Numbering) und der Counter zeigt "[2/5]"
       */
      const user = userEvent.setup();
      const onRemove = vi.fn();

      // Start with 3 slots
      const initialSlots = createSlotsAtPositions([1, 2, 3]);
      const { rerender } = render(
        <ReferenceBar slots={initialSlots} onRemove={onRemove} />
      );

      // Counter should show [3/5]
      expect(screen.getByTestId("counter-badge")).toHaveTextContent("[3/5]");

      // Simulate removal of @2: parent calls onRemove, then rerenders with updated slots
      // (ReferenceBar is controlled -- it delegates via callback)
      const remainingSlots = createSlotsAtPositions([1, 3]);
      rerender(
        <ReferenceBar slots={remainingSlots} onRemove={onRemove} />
      );

      // Counter now shows [2/5]
      expect(screen.getByTestId("counter-badge")).toHaveTextContent("[2/5]");

      // Remaining labels are still @1 and @3 (no re-numbering)
      expect(screen.getByTestId("mini-label-1")).toHaveTextContent("@1");
      expect(screen.getByTestId("mini-label-3")).toHaveTextContent("@3");

      // @2 is gone
      expect(screen.queryByTestId("mini-label-2")).not.toBeInTheDocument();
    });

    // AC-10: Wiederverwendung freigewordener Positionen
    it("AC-10: should reuse freed position number for next added image", () => {
      /**
       * AC-10: GIVEN eine ReferenceBar
       * WHEN ein Slot per `onRemove` entfernt wird und danach ein neues Bild hinzugefuegt wird
       * THEN fuellt das neue Bild die niedrigste freie Position
       * (z.B. nach Entfernen von @2 aus @1,@2,@3 wird @2 wiederverwendet, nicht @4)
       */
      const onAdd = vi.fn();

      // After removing @2, remaining slots are @1 and @3
      const slotsAfterRemoval = createSlotsAtPositions([1, 3]);
      render(<ReferenceBar slots={slotsAfterRemoval} onAdd={onAdd} />);

      // Add a new image
      const fileInput = screen.getByTestId("add-file-input") as HTMLInputElement;
      const file = createTestFile("reuse-position.png", "image/png");

      fireEvent.change(fileInput, {
        target: { files: [file] },
      });

      // Should reuse position @2 (lowest free), not @4
      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith(file, 2);
    });
  });

  describe("Max 5 Slots", () => {
    // AC-8: Add-Button disabled und keine Trailing Dropzone bei 5/5
    it("AC-8: should disable add button and hide trailing dropzone when 5 slots are filled", async () => {
      /**
       * AC-8: GIVEN eine ReferenceBar mit exakt 5 Slots (@1 bis @5)
       * WHEN sie gerendert wird
       * THEN ist der [+ Add]-Button disabled und es wird keine Trailing Empty Dropzone angezeigt
       */
      const user = userEvent.setup();
      const slots = createSlotsAtPositions([1, 2, 3, 4, 5]);
      render(<ReferenceBar slots={slots} />);

      // Add button should be disabled
      const addButton = screen.getByTestId("add-reference-button");
      expect(addButton).toBeDisabled();

      // Expand the bar to check for trailing dropzone
      const header = screen.getByTestId("reference-bar-header");
      await user.click(header);

      // All 5 filled slots visible
      expect(screen.getByTestId("reference-slot-1")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-2")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-3")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-4")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-5")).toBeInTheDocument();

      // No trailing empty dropzone (it would have data-state="empty")
      const container = screen.getByTestId("reference-slots-container");
      const emptySlots = container.querySelectorAll('[data-state="empty"]');
      expect(emptySlots).toHaveLength(0);
    });
  });

  describe("Trailing Empty Dropzone", () => {
    // AC-9: Dropzone unterhalb letztem Slot bei < 5
    it("AC-9: should render trailing empty dropzone below last filled slot when under 5 slots", async () => {
      /**
       * AC-9: GIVEN eine ReferenceBar mit weniger als 5 Slots
       * WHEN sie im expanded-State gerendert wird
       * THEN erscheint unterhalb des letzten gefuellten Slots eine leere Dropzone (Trailing Empty Dropzone)
       * die als Upload-Target dient
       */
      const user = userEvent.setup();
      const slots = createSlotsAtPositions([1, 3]);
      render(<ReferenceBar slots={slots} />);

      // Expand the bar
      const header = screen.getByTestId("reference-bar-header");
      await user.click(header);

      const container = screen.getByTestId("reference-slots-container");

      // Filled slots present
      expect(screen.getByTestId("reference-slot-1")).toBeInTheDocument();
      expect(screen.getByTestId("reference-slot-3")).toBeInTheDocument();

      // Trailing empty dropzone present (lowest free = @2)
      const emptyDropzone = screen.getByTestId("reference-slot-empty-2");
      expect(emptyDropzone).toBeInTheDocument();
      expect(emptyDropzone).toHaveAttribute("data-state", "empty");

      // Dropzone is the last child in container
      const children = container.children;
      const lastChild = children[children.length - 1];
      expect(lastChild).toHaveAttribute("data-state", "empty");
    });
  });

  describe("Add Button", () => {
    // AC-11: Datei-Dialog oeffnen
    it("AC-11: should open native file dialog accepting png, jpeg, webp when add button is clicked", async () => {
      /**
       * AC-11: GIVEN eine ReferenceBar mit dem [+ Add]-Button
       * WHEN der User klickt
       * THEN oeffnet sich ein nativer Datei-Dialog (accept: image/png, image/jpeg, image/webp)
       */
      const user = userEvent.setup();
      render(<ReferenceBar slots={[]} />);

      // Verify hidden file input has correct accept attribute
      const fileInput = screen.getByTestId("add-file-input") as HTMLInputElement;
      expect(fileInput).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
      expect(fileInput.type).toBe("file");

      // Spy on the click method of the hidden file input
      const clickSpy = vi.spyOn(fileInput, "click");

      // Click the Add button
      const addButton = screen.getByTestId("add-reference-button");
      await user.click(addButton);

      // Hidden file input should have received click()
      expect(clickSpy).toHaveBeenCalled();
    });
  });
});
