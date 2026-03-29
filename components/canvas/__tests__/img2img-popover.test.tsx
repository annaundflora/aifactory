// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import type { ReferenceSlotData } from "@/lib/types/reference";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix uses ResizeObserver / DOMRect internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (!Element.prototype.getBoundingClientRect) {
    Element.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        top: 0,
        right: 100,
        bottom: 40,
        left: 0,
        toJSON() {},
      }) as DOMRect;
  }

  // Radix Popover uses scrollIntoView which jsdom does not implement
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock lucide-react icons used by the component and its transitive dependencies
// (img2img-popover uses ArrowRightLeft, Minus, Plus; parameter-panel uses ChevronDown)
vi.mock("lucide-react", () => ({
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right-left" {...props} />
  ),
  Minus: (props: Record<string, unknown>) => (
    <span data-testid="icon-minus" {...props} />
  ),
  Plus: (props: Record<string, unknown>) => (
    <span data-testid="icon-plus" {...props} />
  ),
  ChevronDown: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-chevron-up" {...props} />
  ),
  CheckIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
}));

// Track calls to ReferenceBar for assertions
const mockReferenceBarProps: {
  current: {
    slots: ReferenceSlotData[];
    onAdd?: (file: File, position: number) => void;
    onRemove?: (slotPosition: number) => void;
    onRoleChange?: (slotPosition: number, role: string) => void;
    onStrengthChange?: (slotPosition: number, strength: string) => void;
    onUpload?: (file: File, slotPosition: number) => void;
    onUploadUrl?: (url: string, slotPosition: number) => void;
  } | null;
} = { current: null };

vi.mock("@/components/workspace/reference-bar", () => ({
  ReferenceBar: (props: {
    slots: ReferenceSlotData[];
    onAdd?: (file: File, position: number) => void;
    onRemove?: (slotPosition: number) => void;
    onRoleChange?: (slotPosition: number, role: string) => void;
    onStrengthChange?: (slotPosition: number, strength: string) => void;
    onUpload?: (file: File, slotPosition: number) => void;
    onUploadUrl?: (url: string, slotPosition: number) => void;
  }) => {
    // Store latest props for test access
    mockReferenceBarProps.current = props;

    return (
      <div data-testid="reference-bar-mock">
        <span data-testid="reference-bar-slot-count">
          {props.slots.length}
        </span>
        {props.slots.map((slot) => (
          <div
            key={slot.id}
            data-testid={`mock-slot-${slot.slotPosition}`}
            data-role={slot.role}
            data-strength={slot.strength}
          >
            <span>{slot.originalFilename ?? slot.imageUrl}</span>
            <button
              data-testid={`mock-remove-${slot.slotPosition}`}
              onClick={() => props.onRemove?.(slot.slotPosition)}
            >
              x
            </button>
          </div>
        ))}
        {props.slots.length < 5 && (
          <div data-testid="mock-dropzone">
            <button
              data-testid="mock-add-file"
              onClick={() => {
                const file = new File(["test"], "test.png", {
                  type: "image/png",
                });
                const occupiedPositions = props.slots.map(
                  (s) => s.slotPosition
                );
                // Find lowest free position
                let pos = 1;
                while (occupiedPositions.includes(pos) && pos <= 5) pos++;
                props.onAdd?.(file, pos);
              }}
            >
              Add Image
            </button>
          </div>
        )}
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  Img2imgPopover,
  type Img2imgParams,
} from "@/components/canvas/popovers/img2img-popover";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-img2img-1",
    projectId: overrides.projectId ?? "project-1",
    prompt: overrides.prompt ?? "a test prompt",
    modelId: overrides.modelId ?? "model-1",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "completed",
    imageUrl: overrides.imageUrl ?? "https://r2.example.com/image.png",
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? 512,
    height: overrides.height ?? 512,
    seed: overrides.seed ?? null,
    createdAt: overrides.createdAt ?? new Date("2025-06-15T12:00:00Z"),
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  };
}

/**
 * Renders Img2imgPopover inside CanvasDetailProvider with optional active tool
 * dispatch on mount (same pattern as upscale-popover.test.tsx).
 */
function renderImg2imgPopover(
  overrides: Partial<{
    generation: Generation;
    onGenerate: (params: Img2imgParams) => void;
    initialActiveToolId: string | null;
  }> = {}
) {
  const generation = overrides.generation ?? makeGeneration();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const initialActiveToolId = overrides.initialActiveToolId ?? null;

  function SetupDispatcher({ children }: { children: ReactNode }) {
    const { dispatch } = useCanvasDetail();

    const ref = React.useRef(false);
    React.useEffect(() => {
      if (!ref.current && initialActiveToolId) {
        ref.current = true;
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: initialActiveToolId });
      }
    }, [dispatch]);

    return <>{children}</>;
  }

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <SetupDispatcher>
        <Img2imgPopover onGenerate={onGenerate} />
      </SetupDispatcher>
    </CanvasDetailProvider>
  );

  return { ...result, onGenerate, generation };
}

/**
 * Helper component that dispatches an action from within the provider context.
 * Used to change activeToolId after initial render (for AC-12).
 */
let dispatchFromOutside: ((action: { type: string; toolId: string }) => void) | null = null;

function DispatchExposer({ children }: { children: ReactNode }) {
  const { dispatch } = useCanvasDetail();
  dispatchFromOutside = dispatch as typeof dispatchFromOutside;
  return <>{children}</>;
}

function renderImg2imgPopoverWithDispatchAccess(
  overrides: Partial<{
    generation: Generation;
    onGenerate: (params: Img2imgParams) => void;
    initialActiveToolId: string | null;
  }> = {}
) {
  const generation = overrides.generation ?? makeGeneration();
  const onGenerate = overrides.onGenerate ?? vi.fn();
  const initialActiveToolId = overrides.initialActiveToolId ?? null;

  function SetupDispatcher({ children }: { children: ReactNode }) {
    const { dispatch } = useCanvasDetail();

    const ref = React.useRef(false);
    React.useEffect(() => {
      if (!ref.current && initialActiveToolId) {
        ref.current = true;
        dispatch({ type: "SET_ACTIVE_TOOL", toolId: initialActiveToolId });
      }
    }, [dispatch]);

    return <>{children}</>;
  }

  const result = render(
    <CanvasDetailProvider initialGenerationId={generation.id}>
      <DispatchExposer>
        <SetupDispatcher>
          <Img2imgPopover onGenerate={onGenerate} />
        </SetupDispatcher>
      </DispatchExposer>
    </CanvasDetailProvider>
  );

  return { ...result, onGenerate, generation };
}

// ---------------------------------------------------------------------------
// Tests: Img2imgPopover Acceptance
// ---------------------------------------------------------------------------

describe("Img2imgPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReferenceBarProps.current = null;
    dispatchFromOutside = null;
  });

  // -------------------------------------------------------------------------
  // AC-1: Popover erscheint bei activeToolId "img2img"
  // -------------------------------------------------------------------------
  it('AC-1: GIVEN activeToolId is "img2img" WHEN the component renders THEN a Radix Popover appears with sections References, Prompt, Variants, and Generate button', async () => {
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    // Popover content should appear
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // References section
    const refsSection = within(popover).getByTestId("references-section");
    expect(refsSection).toBeInTheDocument();

    // Prompt section
    const promptSection = within(popover).getByTestId("prompt-section");
    expect(promptSection).toBeInTheDocument();

    // Variants section
    const variantsSection = within(popover).getByTestId("variants-section");
    expect(variantsSection).toBeInTheDocument();

    // Generate button
    const generateBtn = within(popover).getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();
    expect(generateBtn).toHaveTextContent("Generate");
  });

  // -------------------------------------------------------------------------
  // AC-2: Reference-Counter zeigt n/5
  // -------------------------------------------------------------------------
  it('AC-2: GIVEN the img2img popover is visible WHEN the user looks at the references area THEN the header shows "REFERENCES" with a counter [n/5] where n is the number of occupied slots', async () => {
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    const popover = await screen.findByTestId("img2img-popover");
    const header = within(popover).getByTestId("references-header");
    expect(header).toBeInTheDocument();

    // Initially 0 slots occupied
    expect(header).toHaveTextContent("References [0/5]");
  });

  // -------------------------------------------------------------------------
  // AC-3: Referenz hinzufuegen erzeugt Slot mit Role/Strength
  // -------------------------------------------------------------------------
  it("AC-3: GIVEN the img2img popover is visible and fewer than 5 references are occupied WHEN the user adds an image THEN a new ReferenceSlot with default role and strength dropdowns is displayed", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    // Initially 0 slots
    const header = screen.getByTestId("references-header");
    expect(header).toHaveTextContent("References [0/5]");

    // Click the mock add button to simulate adding a file
    const addBtn = screen.getByTestId("mock-add-file");
    await user.click(addBtn);

    // Counter should update to 1/5
    expect(header).toHaveTextContent("References [1/5]");

    // A mock slot should be rendered with default role "general" and strength "moderate"
    const slot = screen.getByTestId("mock-slot-1");
    expect(slot).toBeInTheDocument();
    expect(slot).toHaveAttribute("data-role", "general");
    expect(slot).toHaveAttribute("data-strength", "moderate");
  });

  // -------------------------------------------------------------------------
  // AC-4: Referenz entfernen aktualisiert Counter
  // -------------------------------------------------------------------------
  it("AC-4: GIVEN a ReferenceSlot is occupied WHEN the user clicks the remove button (x) THEN the slot is removed and the counter updates", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    // Add a reference first
    const addBtn = screen.getByTestId("mock-add-file");
    await user.click(addBtn);

    const header = screen.getByTestId("references-header");
    expect(header).toHaveTextContent("References [1/5]");

    // Now remove it
    const removeBtn = screen.getByTestId("mock-remove-1");
    await user.click(removeBtn);

    // Counter should be back to 0/5
    expect(header).toHaveTextContent("References [0/5]");
    expect(screen.queryByTestId("mock-slot-1")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-5: Maximum 5 Referenzen
  // -------------------------------------------------------------------------
  it("AC-5: GIVEN 5 reference slots are occupied WHEN the user tries to add another reference THEN the dropzone is not visible or disabled", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    // Add 5 references
    for (let i = 0; i < 5; i++) {
      const addBtn = screen.getByTestId("mock-add-file");
      await user.click(addBtn);
    }

    const header = screen.getByTestId("references-header");
    expect(header).toHaveTextContent("References [5/5]");

    // The mock dropzone should not be rendered when 5 slots are full
    expect(screen.queryByTestId("mock-dropzone")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-6: Zwei Prompt-Felder sichtbar
  // -------------------------------------------------------------------------
  it('AC-6: GIVEN the img2img popover is visible WHEN the user looks at the prompt fields THEN two textareas are visible: "Motiv" (required, with star marker) and "Style / Modifier" (optional)', async () => {
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    // Motiv textarea should be present and required
    const motivTextarea = screen.getByTestId("motiv-textarea");
    expect(motivTextarea).toBeInTheDocument();
    expect(motivTextarea).toHaveAttribute("required");

    // Motiv label should have a star (*) marker
    const motivLabel = screen.getByText("*");
    expect(motivLabel).toBeInTheDocument();
    expect(motivLabel.closest("[data-slot='label']")).toHaveTextContent(
      "Motiv"
    );

    // Style / Modifier textarea should be present and NOT required
    const styleTextarea = screen.getByTestId("style-textarea");
    expect(styleTextarea).toBeInTheDocument();
    expect(styleTextarea).not.toHaveAttribute("required");

    // Style / Modifier label
    expect(screen.getByText("Style / Modifier")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // AC-7: Motiv-Feld editierbar
  // -------------------------------------------------------------------------
  it("AC-7: GIVEN the img2img popover is visible WHEN the user types text into the Motiv field THEN the entered text is stored in internal state and is editable", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    const motivTextarea = screen.getByTestId("motiv-textarea");

    // Type text into the Motiv field
    await user.click(motivTextarea);
    await user.type(motivTextarea, "A beautiful sunset over the ocean");

    // The value should be reflected in the textarea
    expect(motivTextarea).toHaveValue("A beautiful sunset over the ocean");
  });

  // -------------------------------------------------------------------------
  // AC-8: Variants-Counter mit +/- Buttons, Default 1
  // -------------------------------------------------------------------------
  it("AC-8: GIVEN the img2img popover is visible WHEN the user views the variants counter THEN it shows a numeric value with [-] and [+] buttons, range 1-4, default 1", async () => {
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    // Variants section should exist
    const variantsSection = screen.getByTestId("variants-section");
    expect(variantsSection).toBeInTheDocument();

    // Minus button
    const minusBtn = within(variantsSection).getByTestId("variants-minus");
    expect(minusBtn).toBeInTheDocument();
    expect(minusBtn).toHaveAttribute("aria-label", "Decrease variants");

    // Plus button
    const plusBtn = within(variantsSection).getByTestId("variants-plus");
    expect(plusBtn).toBeInTheDocument();
    expect(plusBtn).toHaveAttribute("aria-label", "Increase variants");

    // Default value should be 1
    const valueDisplay = within(variantsSection).getByTestId("variants-value");
    expect(valueDisplay).toHaveTextContent("1");
  });

  // -------------------------------------------------------------------------
  // AC-9: Variants-Minimum bei 1
  // -------------------------------------------------------------------------
  it("AC-9: GIVEN the variants counter is at 1 WHEN the user clicks [-] THEN the value stays at 1 (minimum)", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    const minusBtn = screen.getByTestId("variants-minus");
    const valueDisplay = screen.getByTestId("variants-value");

    // Default is 1
    expect(valueDisplay).toHaveTextContent("1");

    // Click minus -- should stay at 1
    await user.click(minusBtn);
    expect(valueDisplay).toHaveTextContent("1");

    // Minus button should be disabled at minimum
    expect(minusBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // AC-10: Variants-Maximum bei 4
  // -------------------------------------------------------------------------
  it("AC-10: GIVEN the variants counter is at 4 WHEN the user clicks [+] THEN the value stays at 4 (maximum)", async () => {
    const user = userEvent.setup();
    renderImg2imgPopover({ initialActiveToolId: "img2img" });

    await screen.findByTestId("img2img-popover");

    const plusBtn = screen.getByTestId("variants-plus");
    const valueDisplay = screen.getByTestId("variants-value");

    // Increment to 4 (3 clicks from default of 1)
    await user.click(plusBtn);
    expect(valueDisplay).toHaveTextContent("2");
    await user.click(plusBtn);
    expect(valueDisplay).toHaveTextContent("3");
    await user.click(plusBtn);
    expect(valueDisplay).toHaveTextContent("4");

    // Plus button should be disabled at maximum
    expect(plusBtn).toBeDisabled();

    // Click plus again -- should stay at 4
    await user.click(plusBtn);
    expect(valueDisplay).toHaveTextContent("4");
  });

  // -------------------------------------------------------------------------
  // AC-11: Generate-Button vorhanden
  // -------------------------------------------------------------------------
  it("AC-11: GIVEN the img2img popover is visible WHEN the user views the Generate button THEN a button with label 'Generate' is visible and it calls the onGenerate callback when clicked", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    const generateBtn = screen.getByTestId("generate-button");
    expect(generateBtn).toBeInTheDocument();
    expect(generateBtn).toHaveTextContent("Generate");

    // Click Generate
    await user.click(generateBtn);

    // onGenerate should have been called with the current params
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith({
      references: [],
      motiv: "",
      style: "",
      variants: 1,
      tier: "draft",
      imageParams: {},
    });
  });

  // -------------------------------------------------------------------------
  // AC-12: Popover schliesst bei Deaktivierung
  // -------------------------------------------------------------------------
  it('AC-12: GIVEN activeToolId changes from "img2img" to null WHEN the popover state changes THEN the popover closes', async () => {
    renderImg2imgPopoverWithDispatchAccess({
      initialActiveToolId: "img2img",
    });

    // Popover should be open
    const popover = await screen.findByTestId("img2img-popover");
    expect(popover).toBeInTheDocument();

    // Dispatch SET_ACTIVE_TOOL with "img2img" again to toggle it off (reducer toggles)
    act(() => {
      dispatchFromOutside!({ type: "SET_ACTIVE_TOOL", toolId: "img2img" });
    });

    // Popover should be gone
    expect(screen.queryByTestId("img2img-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Additional: Popover not visible when activeToolId is null
  // -------------------------------------------------------------------------
  it('should not render popover content when activeToolId is null', () => {
    renderImg2imgPopover({ initialActiveToolId: null });

    expect(screen.queryByTestId("img2img-popover")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Additional: Generate button sends correct params after user edits
  // -------------------------------------------------------------------------
  it("should include typed motiv and style in onGenerate params", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    renderImg2imgPopover({
      initialActiveToolId: "img2img",
      onGenerate,
    });

    await screen.findByTestId("img2img-popover");

    // Type into Motiv
    const motivTextarea = screen.getByTestId("motiv-textarea");
    await user.click(motivTextarea);
    await user.type(motivTextarea, "sunflowers");

    // Type into Style
    const styleTextarea = screen.getByTestId("style-textarea");
    await user.click(styleTextarea);
    await user.type(styleTextarea, "oil painting");

    // Increment variants to 2
    const plusBtn = screen.getByTestId("variants-plus");
    await user.click(plusBtn);

    // Click Generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith({
      references: [],
      motiv: "sunflowers",
      style: "oil painting",
      variants: 2,
      tier: "draft",
      imageParams: {},
    });
  });
});
