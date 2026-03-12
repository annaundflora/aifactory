// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { LightboxNavigation } from "@/components/lightbox/lightbox-navigation";
import { type Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy per slice spec)
// ---------------------------------------------------------------------------

// Mock deleteGeneration server action
vi.mock("@/app/actions/generations", () => ({
  deleteGeneration: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ChevronLeft: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-left-icon" {...props} />
  ),
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right-icon" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => (
    <svg data-testid="trash2-icon" {...props} />
  ),
}));

// Mock ConfirmDialog to make it testable without full Radix portals
vi.mock("@/components/shared/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <button data-testid="confirm-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button data-testid="confirm-delete" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

import { deleteGeneration } from "@/app/actions/generations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-001",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a sunset",
    negativePrompt: overrides.negativePrompt ?? null,
    modelId: overrides.modelId ?? "black-forest-labs/flux-2-pro",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 1024,
    height: overrides.height ?? 768,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-03-01T14:30:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    promptStyle: overrides.promptStyle ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
  };
}

function makeFiveGenerations(): Generation[] {
  return [
    makeGeneration({ id: "gen-1" }),
    makeGeneration({ id: "gen-2" }),
    makeGeneration({ id: "gen-3" }),
    makeGeneration({ id: "gen-4" }),
    makeGeneration({ id: "gen-5" }),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LightboxNavigation", () => {
  let onNavigate: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onNavigate = vi.fn();
    onDelete = vi.fn();
  });

  /**
   * AC-1: GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   * WHEN der User auf den Next-Chevron-Button klickt
   * THEN wird die 4. Generation angezeigt
   */
  it("AC-1: should show next generation when next chevron button is clicked", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={2}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    const nextButton = screen.getByTestId("lightbox-next");
    await user.click(nextButton);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  /**
   * AC-2: GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   * WHEN der User die rechte Pfeiltaste drueckt
   * THEN wird die 4. Generation angezeigt
   */
  it("AC-2: should show next generation when right arrow key is pressed", () => {
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={2}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(3);
  });

  /**
   * AC-3: GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   * WHEN der User auf den Prev-Chevron-Button klickt
   * THEN wird die 2. Generation angezeigt
   */
  it("AC-3: should show previous generation when prev chevron button is clicked", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={2}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    const prevButton = screen.getByTestId("lightbox-prev");
    await user.click(prevButton);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  /**
   * AC-4: GIVEN eine Lightbox mit 5 Generierungen und die 3. Generation ist ausgewaehlt
   * WHEN der User die linke Pfeiltaste drueckt
   * THEN wird die 2. Generation angezeigt
   */
  it("AC-4: should show previous generation when left arrow key is pressed", () => {
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={2}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  /**
   * AC-5: GIVEN eine Lightbox mit 5 Generierungen und die letzte (5.) Generation ist ausgewaehlt
   * WHEN der User auf Next klickt oder die rechte Pfeiltaste drueckt
   * THEN wird die 1. Generation angezeigt (Wrap-Around)
   */
  it("AC-5: should wrap to first generation when pressing next on last generation", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={4}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    // Test via button click
    const nextButton = screen.getByTestId("lightbox-next");
    await user.click(nextButton);

    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("AC-5 (keyboard): should wrap to first generation when pressing right arrow on last generation", () => {
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={4}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowRight" });

    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  /**
   * AC-6: GIVEN eine Lightbox mit 5 Generierungen und die erste (1.) Generation ist ausgewaehlt
   * WHEN der User auf Prev klickt oder die linke Pfeiltaste drueckt
   * THEN wird die 5. Generation angezeigt (Wrap-Around)
   */
  it("AC-6: should wrap to last generation when pressing prev on first generation", async () => {
    const user = userEvent.setup();
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={0}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    const prevButton = screen.getByTestId("lightbox-prev");
    await user.click(prevButton);

    expect(onNavigate).toHaveBeenCalledWith(4);
  });

  it("AC-6 (keyboard): should wrap to last generation when pressing left arrow on first generation", () => {
    const generations = makeFiveGenerations();

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={0}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    fireEvent.keyDown(document, { key: "ArrowLeft" });

    expect(onNavigate).toHaveBeenCalledWith(4);
  });

  /**
   * AC-7: GIVEN eine Lightbox mit nur 1 Generation
   * WHEN die Navigation gerendert wird
   * THEN sind die Prev/Next-Buttons NICHT sichtbar oder disabled
   */
  it("AC-7: should hide or disable navigation buttons when only one generation exists", () => {
    const generations = [makeGeneration({ id: "gen-solo" })];

    render(
      <LightboxNavigation
        generations={generations}
        currentIndex={0}
        onNavigate={onNavigate}
        onDelete={onDelete}
      />
    );

    const prevButton = screen.queryByTestId("lightbox-prev");
    const nextButton = screen.queryByTestId("lightbox-next");

    // Buttons should not be rendered at all
    expect(prevButton).not.toBeInTheDocument();
    expect(nextButton).not.toBeInTheDocument();
  });

  // NOTE: AC-8, AC-9, AC-10 (delete functionality) were removed from
  // LightboxNavigation and moved to LightboxModal. Those tests now live in
  // lightbox-modal.test.tsx.
});
