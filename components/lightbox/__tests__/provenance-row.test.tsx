// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import type { ProvenanceItem } from "@/app/actions/references";

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------
const { mockGetProvenanceData } = vi.hoisted(() => {
  return {
    mockGetProvenanceData: vi.fn<(id: string) => Promise<ProvenanceItem[]>>(),
  };
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock next/image as plain img element
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const rest = Object.fromEntries(
      Object.entries(props).filter(([k]) => k !== "priority" && k !== "fill")
    );
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Mock server action getProvenanceData
vi.mock("@/app/actions/references", () => ({
  getProvenanceData: (...args: unknown[]) => mockGetProvenanceData(...(args as [string])),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------
import { ProvenanceRow } from "@/components/lightbox/provenance-row";

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const THREE_REFERENCES: ProvenanceItem[] = [
  {
    id: "ref-1",
    slotPosition: 1,
    role: "style",
    strength: "strong",
    imageUrl: "https://example.com/ref1.png",
    referenceImageId: "img-1",
  },
  {
    id: "ref-2",
    slotPosition: 3,
    role: "content",
    strength: "moderate",
    imageUrl: "https://example.com/ref3.png",
    referenceImageId: "img-3",
  },
  {
    id: "ref-3",
    slotPosition: 5,
    role: "structure",
    strength: "subtle",
    imageUrl: "https://example.com/ref5.png",
    referenceImageId: "img-5",
  },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetProvenanceData.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProvenanceRow", () => {
  /**
   * AC-1: GIVEN eine Generation mit id = "gen-A" die 3 generation_references-Records hat
   * (slotPosition 1/style/strong, slotPosition 3/content/moderate, slotPosition 5/structure/subtle)
   * WHEN die Lightbox fuer diese Generation geoeffnet wird
   * THEN zeigt die ProvenanceRow genau 3 Thumbnails in der Reihenfolge slotPosition 1, 3, 5 an
   */
  it("AC-1: should render thumbnails for each generation reference sorted by slotPosition", async () => {
    mockGetProvenanceData.mockResolvedValue(THREE_REFERENCES);

    render(<ProvenanceRow generationId="gen-A" />);

    await waitFor(() => {
      expect(screen.getByTestId("provenance-row")).toBeInTheDocument();
    });

    // Exactly 3 thumbnails
    const items = [
      screen.getByTestId("provenance-item-1"),
      screen.getByTestId("provenance-item-3"),
      screen.getByTestId("provenance-item-5"),
    ];
    expect(items).toHaveLength(3);

    // Verify order: slotPosition 1 appears before 3, 3 before 5 in the DOM
    const container = screen.getByTestId("provenance-row");
    const allItems = container.querySelectorAll("[data-testid^='provenance-item-']");
    expect(allItems).toHaveLength(3);
    expect(allItems[0]).toHaveAttribute("data-testid", "provenance-item-1");
    expect(allItems[1]).toHaveAttribute("data-testid", "provenance-item-3");
    expect(allItems[2]).toHaveAttribute("data-testid", "provenance-item-5");

    // Verify getProvenanceData was called with the correct generationId
    expect(mockGetProvenanceData).toHaveBeenCalledWith("gen-A");
  });

  /**
   * AC-2: GIVEN die ProvenanceRow zeigt 3 Referenzen an
   * WHEN der Nutzer die Thumbnails betrachtet
   * THEN traegt jedes Thumbnail ein Label mit: @-Nummer (z.B. "@1"), Rollen-Name (z.B. "Style")
   * und Strength-Stufe (z.B. "Strong") — farbkodiert gemaess Rollen-Farbschema
   */
  it("AC-2: should display @-number, role name, and strength level for each thumbnail with role color coding", async () => {
    mockGetProvenanceData.mockResolvedValue(THREE_REFERENCES);

    render(<ProvenanceRow generationId="gen-A" />);

    await waitFor(() => {
      expect(screen.getByTestId("provenance-row")).toBeInTheDocument();
    });

    // --- Slot 1: style/strong ---
    const item1 = screen.getByTestId("provenance-item-1");
    expect(item1).toHaveTextContent("@1");
    expect(item1).toHaveTextContent("Style");
    expect(item1).toHaveTextContent("Strong");

    // Verify color coding for "style" role (Violet: bg #F3E8FF / rgb(243,232,255), text #9333EA / rgb(147,51,234))
    const styleBadge = item1.querySelector("span[style]");
    expect(styleBadge).not.toBeNull();
    const styleAttr1 = styleBadge!.getAttribute("style")!;
    expect(styleAttr1).toMatch(/background-color:\s*(#F3E8FF|rgb\(243,\s*232,\s*255\))/i);
    expect(styleAttr1).toMatch(/color:\s*(#9333EA|rgb\(147,\s*51,\s*234\))/i);

    // --- Slot 3: content/moderate ---
    const item3 = screen.getByTestId("provenance-item-3");
    expect(item3).toHaveTextContent("@3");
    expect(item3).toHaveTextContent("Content");
    expect(item3).toHaveTextContent("Moderate");

    // Verify color coding for "content" role (Blue: bg #DBEAFE / rgb(219,234,254), text #3B82F6 / rgb(59,130,246))
    const contentBadge = item3.querySelector("span[style]");
    expect(contentBadge).not.toBeNull();
    const styleAttr3 = contentBadge!.getAttribute("style")!;
    expect(styleAttr3).toMatch(/background-color:\s*(#DBEAFE|rgb\(219,\s*234,\s*254\))/i);
    expect(styleAttr3).toMatch(/color:\s*(#3B82F6|rgb\(59,\s*130,\s*246\))/i);

    // --- Slot 5: structure/subtle ---
    const item5 = screen.getByTestId("provenance-item-5");
    expect(item5).toHaveTextContent("@5");
    expect(item5).toHaveTextContent("Structure");
    expect(item5).toHaveTextContent("Subtle");

    // Verify color coding for "structure" role (Green: bg #D1FAE5 / rgb(209,250,229), text #059669 / rgb(5,150,105))
    const structureBadge = item5.querySelector("span[style]");
    expect(structureBadge).not.toBeNull();
    const styleAttr5 = structureBadge!.getAttribute("style")!;
    expect(styleAttr5).toMatch(/background-color:\s*(#D1FAE5|rgb\(209,\s*250,\s*229\))/i);
    expect(styleAttr5).toMatch(/color:\s*(#059669|rgb\(5,\s*150,\s*105\))/i);
  });

  /**
   * AC-3: GIVEN eine Generation OHNE generation_references-Records (z.B. eine txt2img-Generation)
   * WHEN die Lightbox fuer diese Generation geoeffnet wird
   * THEN ist die ProvenanceRow-Section komplett unsichtbar
   * (kein Header, kein Platzhalter, data-testid="provenance-row" nicht im DOM)
   */
  it("AC-3: should not render when references array is empty", async () => {
    mockGetProvenanceData.mockResolvedValue([]);

    render(<ProvenanceRow generationId="gen-no-refs" />);

    // Wait a tick for the useEffect to resolve
    await waitFor(() => {
      expect(mockGetProvenanceData).toHaveBeenCalledWith("gen-no-refs");
    });

    // provenance-row should not be in the DOM at all
    expect(screen.queryByTestId("provenance-row")).not.toBeInTheDocument();
  });

  /**
   * AC-4: GIVEN die ProvenanceRow wird gerendert mit Referenzen
   * WHEN die Thumbnails angezeigt werden
   * THEN hat jedes Thumbnail ein <img>-Element mit der imageUrl aus dem zugehoerigen
   * reference_images-Record (via Join mit referenceImageId) und eine feste Groesse von ca. 48x48px
   */
  it("AC-4: should render thumbnail images with correct imageUrl and approximately 48x48px size", async () => {
    mockGetProvenanceData.mockResolvedValue(THREE_REFERENCES);

    render(<ProvenanceRow generationId="gen-A" />);

    await waitFor(() => {
      expect(screen.getByTestId("provenance-row")).toBeInTheDocument();
    });

    // Check all three thumbnail images
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    // Verify imageUrls match the reference data
    expect(images[0]).toHaveAttribute("src", "https://example.com/ref1.png");
    expect(images[1]).toHaveAttribute("src", "https://example.com/ref3.png");
    expect(images[2]).toHaveAttribute("src", "https://example.com/ref5.png");

    // Verify 48x48 size attributes
    images.forEach((img) => {
      expect(img).toHaveAttribute("width", "48");
      expect(img).toHaveAttribute("height", "48");
    });

    // Verify alt text includes the @-number
    expect(images[0]).toHaveAttribute("alt", "Reference @1");
    expect(images[1]).toHaveAttribute("alt", "Reference @3");
    expect(images[2]).toHaveAttribute("alt", "Reference @5");
  });
});
