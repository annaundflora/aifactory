// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { ModelCard } from "@/components/models/model-card";
import { type Model } from "@/lib/services/model-catalog-service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createModel(overrides: Partial<Model> = {}): Model {
  return {
    id: "uuid-test-1",
    replicateId: "acme/test-model",
    owner: "acme",
    name: "test-model",
    description: "A short description of the model for testing purposes.",
    coverImageUrl: "https://example.com/cover.jpg",
    runCount: 1_500_000,
    collections: ["text-to-image"],
    capabilities: { txt2img: true, img2img: false, upscale: false, inpaint: false, outpaint: false },
    inputSchema: null,
    versionHash: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date("2025-01-15T00:00:00Z"),
    updatedAt: new Date("2025-01-15T00:00:00Z"),
    ...overrides,
  };
}

const noop = () => {};

// ---------------------------------------------------------------------------
// AC-1: Vollstaendige Karte mit allen Feldern rendern
// ---------------------------------------------------------------------------
describe("AC-1: Full card with all fields", () => {
  it("should render cover image, name, owner, description and run count badge", () => {
    /**
     * AC-1: GIVEN ein CollectionModel-Objekt mit allen Feldern (inkl. cover_image_url)
     *       WHEN ModelCard gerendert wird
     *       THEN wird ein <img>-Tag mit src={cover_image_url} im 16:9-Seitenverhaeltnis angezeigt
     *       AND der Model-Name wird bold und einzeilig truncated angezeigt
     *       AND der Owner-Name wird in muted-Farbe angezeigt
     *       AND die Description wird auf maximal 2 Zeilen begrenzt (CSS line-clamp)
     *       AND der Run-Count wird als Badge-Komponente aus components/ui/badge.tsx angezeigt
     */
    const model = createModel();
    render(
      <ModelCard model={model} selected={false} disabled={false} onSelect={noop} />
    );

    // Cover image with correct src
    const img = screen.getByRole("img", { name: model.name });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", model.coverImageUrl);
    expect(img).toHaveAttribute("loading", "lazy");

    // Image wrapper has aspect-video for 16:9
    const imgWrapper = img.closest("div");
    expect(imgWrapper).toHaveClass("aspect-video");

    // Model name - bold and truncated
    const nameEl = screen.getByText(model.name);
    expect(nameEl).toBeInTheDocument();
    expect(nameEl).toHaveClass("font-bold");
    expect(nameEl).toHaveClass("truncate");

    // Owner name - muted color
    const ownerEl = screen.getByText(model.owner);
    expect(ownerEl).toBeInTheDocument();
    expect(ownerEl).toHaveClass("text-muted-foreground");

    // Description - line-clamp-2
    const descEl = screen.getByText(model.description!);
    expect(descEl).toBeInTheDocument();
    expect(descEl).toHaveClass("line-clamp-2");

    // Run count badge (formatted via formatRunCount: 1_500_000 => "1.5M runs")
    const badge = screen.getByText("1.5M runs");
    expect(badge).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Fallback-Gradient wenn cover_image_url null ist
// ---------------------------------------------------------------------------
describe("AC-2: Fallback gradient when cover_image_url is null", () => {
  it("should render fallback gradient div instead of img when cover_image_url is null", () => {
    /**
     * AC-2: GIVEN ein CollectionModel-Objekt mit cover_image_url: null
     *       WHEN ModelCard gerendert wird
     *       THEN wird statt eines <img>-Tags ein Fallback-Gradient-Div mit fester 16:9-Hoehe angezeigt
     *       AND kein <img>-Tag ist im DOM vorhanden
     */
    const model = createModel({ coverImageUrl: null });
    const { container } = render(
      <ModelCard model={model} selected={false} disabled={false} onSelect={noop} />
    );

    // No img tag in DOM
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(0);

    // Fallback gradient div with aspect-video and gradient class
    const gradientDiv = container.querySelector(".bg-gradient-to-br");
    expect(gradientDiv).toBeInTheDocument();
    expect(gradientDiv).toHaveClass("aspect-video");
  });
});

// ---------------------------------------------------------------------------
// AC-3: Selected-State zeigt Ring und Checkmark
// ---------------------------------------------------------------------------
describe("AC-3: Selected state shows ring and checkmark", () => {
  it("should show ring and checkmark when selected is true", () => {
    /**
     * AC-3: GIVEN eine ModelCard mit selected={true}
     *       WHEN die Komponente gerendert wird
     *       THEN hat die Karte einen sichtbaren Ring (CSS ring-Klasse oder gleichwertig)
     *       AND ein Checkmark-Icon ist im Checkbox-Overlay oben rechts sichtbar
     *       AND der Checkbox-Bereich zeigt einen gefuellten/aktiven Zustand
     */
    const model = createModel();
    const { container } = render(
      <ModelCard model={model} selected={true} disabled={false} onSelect={noop} />
    );

    // Card has ring-2 class for selected state
    const card = screen.getByRole("button");
    expect(card).toHaveClass("ring-2");
    expect(card).toHaveClass("ring-primary");

    // Checkmark icon is present (lucide Check renders an SVG)
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Checkbox overlay has active/filled state (bg-primary)
    const checkboxOverlay = svg!.closest("div");
    expect(checkboxOverlay).toHaveClass("bg-primary");
    expect(checkboxOverlay).toHaveClass("border-primary");
  });
});

// ---------------------------------------------------------------------------
// AC-4: Disabled-State reduziert Opacity und blockiert Klick
// ---------------------------------------------------------------------------
describe("AC-4: Disabled state reduces opacity and blocks click", () => {
  it("should show reduced opacity and not call onSelect when disabled", async () => {
    /**
     * AC-4: GIVEN eine ModelCard mit selected={false} und disabled={true}
     *       WHEN die Komponente gerendert wird
     *       THEN hat die Karte reduzierte Opacity (CSS opacity-50 oder gleichwertig)
     *       AND ein Klick auf die Karte loest onSelect NICHT aus
     *       AND kein Ring oder Checkmark ist sichtbar
     */
    const model = createModel();
    const onSelect = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ModelCard model={model} selected={false} disabled={true} onSelect={onSelect} />
    );

    const card = screen.getByRole("button");

    // Reduced opacity
    expect(card).toHaveClass("opacity-50");

    // pointer-events-none blocks clicks at CSS level, but we also test the JS guard
    expect(card).toHaveClass("pointer-events-none");

    // No ring classes
    expect(card).not.toHaveClass("ring-2");
    expect(card).not.toHaveClass("ring-primary");

    // No checkmark SVG (selected is false)
    const svg = container.querySelector("svg");
    expect(svg).not.toBeInTheDocument();

    // Click does not invoke onSelect (test the JS handler guard)
    // pointer-events-none prevents userEvent click, so we call the handler directly
    card.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Klick ruft onSelect mit CollectionModel auf
// ---------------------------------------------------------------------------
describe("AC-5: Click calls onSelect with model", () => {
  it("should call onSelect with the model when card is clicked and not disabled", async () => {
    /**
     * AC-5: GIVEN eine ModelCard mit selected={false} und disabled={false}
     *       WHEN der Nutzer auf die Karte klickt
     *       THEN wird onSelect(model) mit dem uebergebenen CollectionModel aufgerufen
     */
    const model = createModel();
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ModelCard model={model} selected={false} disabled={false} onSelect={onSelect} />
    );

    const card = screen.getByRole("button");
    await user.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(model);
  });
});

// ---------------------------------------------------------------------------
// Favorite star icon
// ---------------------------------------------------------------------------
describe("Favorite star icon", () => {
  it("should render star icon when onFavoriteToggle is provided", () => {
    const model = createModel();
    render(
      <ModelCard
        model={model}
        selected={false}
        disabled={false}
        onSelect={noop}
        isFavorite={false}
        onFavoriteToggle={noop}
      />
    );

    const star = screen.getByTestId("favorite-star");
    expect(star).toBeInTheDocument();
    expect(star).toHaveAttribute("aria-label", "Add to favorites");
  });

  it("should not render star icon when onFavoriteToggle is not provided", () => {
    const model = createModel();
    render(
      <ModelCard model={model} selected={false} disabled={false} onSelect={noop} />
    );

    expect(screen.queryByTestId("favorite-star")).not.toBeInTheDocument();
  });

  it("should show filled star when isFavorite is true", () => {
    const model = createModel();
    render(
      <ModelCard
        model={model}
        selected={false}
        disabled={false}
        onSelect={noop}
        isFavorite={true}
        onFavoriteToggle={noop}
      />
    );

    const star = screen.getByTestId("favorite-star");
    expect(star).toHaveAttribute("aria-label", "Remove from favorites");
  });

  it("should call onFavoriteToggle and NOT onSelect when star is clicked", async () => {
    const model = createModel();
    const onSelect = vi.fn();
    const onFavoriteToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <ModelCard
        model={model}
        selected={false}
        disabled={false}
        onSelect={onSelect}
        isFavorite={false}
        onFavoriteToggle={onFavoriteToggle}
      />
    );

    const star = screen.getByTestId("favorite-star");
    await user.click(star);

    expect(onFavoriteToggle).toHaveBeenCalledTimes(1);
    expect(onFavoriteToggle).toHaveBeenCalledWith(model);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Description-Truncation mit Tooltip fuer vollen Text
// ---------------------------------------------------------------------------
describe("AC-6: Description truncation with tooltip for full text", () => {
  it("should truncate description to 2 lines and provide full text in tooltip", () => {
    /**
     * AC-6: GIVEN ein CollectionModel mit einer langen Description (mehr als 2 Zeilen)
     *       WHEN ModelCard gerendert wird
     *       THEN ist die Description auf 2 Zeilen begrenzt
     *       AND das Tooltip-Attribut (title) oder ein Tooltip-Wrapper zeigt den vollstaendigen Beschreibungstext
     */
    const longDescription =
      "This is a very long description that would definitely span more than two lines " +
      "in a typical card layout. It contains enough text to overflow and demonstrate " +
      "the line-clamp-2 CSS truncation behavior that limits visible content to exactly " +
      "two lines while hiding the rest with an ellipsis or similar visual indicator.";

    const model = createModel({ description: longDescription });

    render(
      <ModelCard model={model} selected={false} disabled={false} onSelect={noop} />
    );

    const descEl = screen.getByText(longDescription);

    // CSS line-clamp-2 limits to 2 lines
    expect(descEl).toHaveClass("line-clamp-2");

    // title attribute provides full text on hover
    expect(descEl).toHaveAttribute("title", longDescription);
  });
});
