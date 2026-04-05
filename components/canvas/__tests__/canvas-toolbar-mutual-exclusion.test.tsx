// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ---------------------------------------------------------------------------
// Polyfills for jsdom (Radix Slider/Tooltip use these internally)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof globalThis.ResizeObserver;
  }

  if (typeof globalThis.PointerEvent === "undefined") {
    globalThis.PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number = 0;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    } as unknown as typeof globalThis.PointerEvent;
  }

  if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
    HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
  if (typeof HTMLElement.prototype.scrollIntoView === "undefined") {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy — CanvasDetailContext gemockt)
// ---------------------------------------------------------------------------

// Mock lucide-react icons used by toolbar, MaskCanvas, FloatingBrushToolbar
vi.mock("lucide-react", () => ({
  Copy: (props: Record<string, unknown>) => (
    <span data-testid="icon-copy" {...props} />
  ),
  ArrowRightLeft: (props: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right-left" {...props} />
  ),
  ZoomIn: (props: Record<string, unknown>) => (
    <span data-testid="icon-zoom-in" {...props} />
  ),
  Download: (props: Record<string, unknown>) => (
    <span data-testid="icon-download" {...props} />
  ),
  Trash2: (props: Record<string, unknown>) => (
    <span data-testid="icon-trash2" {...props} />
  ),
  Info: (props: Record<string, unknown>) => (
    <span data-testid="icon-info" {...props} />
  ),
  PanelLeftIcon: (props: Record<string, unknown>) => (
    <span data-testid="icon-panel-left" {...props} />
  ),
  Paintbrush: (props: Record<string, unknown>) => (
    <span data-testid="icon-paintbrush" {...props} />
  ),
  Eraser: (props: Record<string, unknown>) => (
    <span data-testid="icon-eraser" {...props} />
  ),
  MousePointerClick: (props: Record<string, unknown>) => (
    <span data-testid="icon-mouse-pointer-click" {...props} />
  ),
  Expand: (props: Record<string, unknown>) => (
    <span data-testid="icon-expand" {...props} />
  ),
  Sparkles: (props: Record<string, unknown>) => (
    <span data-testid="icon-sparkles" {...props} />
  ),
}));

// Mock downloadImage utility
const mockDownloadImage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    downloadImage: (...args: unknown[]) => mockDownloadImage(...args),
  };
});

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { MaskCanvas } from "@/components/canvas/mask-canvas";
import { FloatingBrushToolbar } from "@/components/canvas/floating-brush-toolbar";
import {
  CanvasDetailProvider,
  useCanvasDetail,
} from "@/lib/canvas-detail-context";
import type { EditMode } from "@/lib/canvas-detail-context";
import type { Generation } from "@/lib/db/queries";
import React, { useEffect } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGeneration(overrides: Partial<Generation> = {}): Generation {
  return {
    id: overrides.id ?? "gen-mutual-1",
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
 * Spy component that captures editMode, activeToolId, and maskData from context.
 */
interface StateCapture {
  editMode: EditMode | null;
  activeToolId: string | null;
  maskData: ImageData | null;
}

function StateSpy({ onState }: { onState: (s: StateCapture) => void }) {
  const { state } = useCanvasDetail();
  useEffect(() => {
    onState({
      editMode: state.editMode,
      activeToolId: state.activeToolId,
      maskData: state.maskData,
    });
  });
  return null;
}

/**
 * Helper component that pre-sets editMode and maskData on mount
 * so we can test starting from a specific state.
 */
function StatePreset({
  editMode,
  maskData,
  activeToolId,
}: {
  editMode?: EditMode | null;
  maskData?: ImageData | null;
  activeToolId?: string;
}) {
  const { dispatch } = useCanvasDetail();
  useEffect(() => {
    if (editMode !== undefined) {
      dispatch({ type: "SET_EDIT_MODE", editMode });
    }
    if (maskData !== undefined) {
      dispatch({ type: "SET_MASK_DATA", maskData });
    }
    if (activeToolId !== undefined) {
      dispatch({ type: "SET_ACTIVE_TOOL", toolId: activeToolId });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * Minimal mock ImageData for testing — jsdom does not support ImageData natively.
 */
function createMockImageData(): ImageData {
  // ImageData is not available in jsdom; create a minimal stand-in
  const data = new Uint8ClampedArray(4 * 10 * 10); // 10x10 pixels
  // Paint some red pixels to simulate a mask
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    data[i + 3] = 128; // A
  }
  return { data, width: 10, height: 10, colorSpace: "srgb" } as ImageData;
}

function renderToolbarWithState(options: {
  generation?: Generation;
  onDelete?: () => void;
  onState?: (s: StateCapture) => void;
  presetEditMode?: EditMode | null;
  presetMaskData?: ImageData | null;
  presetActiveToolId?: string;
}) {
  const generation = options.generation ?? makeGeneration();
  const onDelete = options.onDelete ?? vi.fn();
  const onState = options.onState ?? vi.fn();

  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        {(options.presetEditMode !== undefined ||
          options.presetMaskData !== undefined ||
          options.presetActiveToolId !== undefined) && (
          <StatePreset
            editMode={options.presetEditMode}
            maskData={options.presetMaskData}
            activeToolId={options.presetActiveToolId}
          />
        )}
        <StateSpy onState={onState} />
        <CanvasToolbar generation={generation} onDelete={onDelete} />
      </CanvasDetailProvider>
    ),
    onDelete,
    generation,
    onState,
  };
}

/**
 * Renders MaskCanvas and FloatingBrushToolbar with state preset
 * for testing visibility (AC-6, AC-7).
 */
function renderVisibilityTest(options: {
  presetEditMode?: EditMode | null;
  presetMaskData?: ImageData | null;
  onState?: (s: StateCapture) => void;
}) {
  const generation = makeGeneration();
  const onState = options.onState ?? vi.fn();

  // Create a ref-like object for MaskCanvas imageRef prop
  const imageRef = { current: null };

  return {
    ...render(
      <CanvasDetailProvider initialGenerationId={generation.id}>
        {(options.presetEditMode !== undefined ||
          options.presetMaskData !== undefined) && (
          <StatePreset
            editMode={options.presetEditMode}
            maskData={options.presetMaskData}
          />
        )}
        <StateSpy onState={onState} />
        <FloatingBrushToolbar onEraseAction={vi.fn()} />
        <MaskCanvas imageRef={imageRef} />
      </CanvasDetailProvider>
    ),
    onState,
  };
}

// ---------------------------------------------------------------------------
// Tests — Slice 15: Toolbar Mutual Exclusion & Visibility
// ---------------------------------------------------------------------------

describe("CanvasToolbar — Mutual Exclusion (Slice 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-3: GIVEN `editMode` ist `"inpaint"` (Brush Edit aktiv, Mask-Canvas sichtbar)
   *       WHEN der User auf den Toggle-Button `variation` in der Toolbar klickt
   *       THEN wird `SET_ACTIVE_TOOL` mit `"variation"` dispatched
   *       AND `editMode` wird auf `null` gesetzt (Edit-Modus deaktiviert)
   *       AND `maskData` bleibt unveraendert im State (Maske NICHT geloescht)
   */
  it('AC-3: should deactivate editMode and keep maskData when clicking variation during inpaint mode', async () => {
    const user = userEvent.setup();
    const stateCaptures: StateCapture[] = [];
    const mockMaskData = createMockImageData();

    renderToolbarWithState({
      presetEditMode: "inpaint",
      presetMaskData: mockMaskData,
      presetActiveToolId: "brush-edit",
      onState: (s) => stateCaptures.push(s),
    });

    // Verify initial state: editMode is inpaint, maskData exists
    const initialState = stateCaptures.find((s) => s.editMode === "inpaint");
    expect(initialState).toBeTruthy();
    expect(initialState!.maskData).not.toBeNull();

    // Click the variation button (non-edit tool)
    const variationBtn = screen.getByTestId("toolbar-variation");
    await user.click(variationBtn);

    // After click: editMode should be null, activeToolId should be variation
    const lastState = stateCaptures[stateCaptures.length - 1];
    expect(lastState.editMode).toBeNull();
    expect(lastState.activeToolId).toBe("variation");

    // maskData should still exist (NOT cleared)
    expect(lastState.maskData).not.toBeNull();
    expect(lastState.maskData).toBe(mockMaskData);
  });

  /**
   * AC-4: GIVEN `editMode` ist `"erase"` (Erase-Modus aktiv)
   *       WHEN der User auf den Toggle-Button `details` klickt
   *       THEN wird `editMode` auf `null` gesetzt
   *       AND `activeToolId` wechselt auf `"details"`
   *       AND `maskData` bleibt im State erhalten
   */
  it('AC-4: should deactivate editMode and switch to details tool when clicking details during erase mode', async () => {
    const user = userEvent.setup();
    const stateCaptures: StateCapture[] = [];
    const mockMaskData = createMockImageData();

    renderToolbarWithState({
      presetEditMode: "erase",
      presetMaskData: mockMaskData,
      presetActiveToolId: "erase",
      onState: (s) => stateCaptures.push(s),
    });

    // Verify initial state: editMode is erase, maskData exists
    const initialState = stateCaptures.find((s) => s.editMode === "erase");
    expect(initialState).toBeTruthy();
    expect(initialState!.maskData).not.toBeNull();

    // Click the details button (non-edit tool)
    const detailsBtn = screen.getByTestId("toolbar-details");
    await user.click(detailsBtn);

    // After click: editMode should be null, activeToolId should be details
    const lastState = stateCaptures[stateCaptures.length - 1];
    expect(lastState.editMode).toBeNull();
    expect(lastState.activeToolId).toBe("details");

    // maskData should still exist (NOT cleared)
    expect(lastState.maskData).not.toBeNull();
    expect(lastState.maskData).toBe(mockMaskData);
  });

  /**
   * AC-5: GIVEN `editMode` war `"inpaint"`, User hat zu `variation` gewechselt (AC-3), Maske existiert noch im State
   *       WHEN der User zurueck auf `brush-edit` klickt
   *       THEN wird `editMode` auf `"inpaint"` gesetzt
   *       AND Mask-Canvas wird wieder sichtbar (da `editMode !== null` und maskData vorhanden)
   *       AND die zuvor gemalte Maske ist vollstaendig erhalten
   */
  it('AC-5: should restore mask visibility when switching back to brush-edit after tool switch', async () => {
    const user = userEvent.setup();
    const stateCaptures: StateCapture[] = [];
    const mockMaskData = createMockImageData();

    renderToolbarWithState({
      presetEditMode: "inpaint",
      presetMaskData: mockMaskData,
      presetActiveToolId: "brush-edit",
      onState: (s) => stateCaptures.push(s),
    });

    // Step 1: Click variation (switches away from edit mode, per AC-3)
    const variationBtn = screen.getByTestId("toolbar-variation");
    await user.click(variationBtn);

    // Verify editMode is null after switching to variation
    const afterVariation = stateCaptures[stateCaptures.length - 1];
    expect(afterVariation.editMode).toBeNull();
    expect(afterVariation.maskData).not.toBeNull();

    // Step 2: Click brush-edit to go back to inpaint mode
    const brushEditBtn = screen.getByTestId("toolbar-brush-edit");
    await user.click(brushEditBtn);

    // After clicking brush-edit: editMode should be "inpaint" again
    const afterBrushEdit = stateCaptures[stateCaptures.length - 1];
    expect(afterBrushEdit.editMode).toBe("inpaint");

    // maskData should still be the same object (mask preserved)
    expect(afterBrushEdit.maskData).not.toBeNull();
    expect(afterBrushEdit.maskData).toBe(mockMaskData);
  });
});

describe("MaskCanvas & FloatingBrushToolbar — Visibility (Slice 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * AC-6: GIVEN `editMode` ist `null` (kein Edit-Modus aktiv)
   *       WHEN die `canvas-detail-view` rendert
   *       THEN ist das Mask-Canvas-Element nicht sichtbar (`display: none` oder nicht gemountet)
   *       AND die Floating Brush Toolbar ist nicht sichtbar
   */
  it('AC-6: should hide mask canvas and floating brush toolbar when editMode is null', () => {
    renderVisibilityTest({
      presetEditMode: null,
    });

    // MaskCanvas should not be in the DOM (returns null when editMode is not inpaint/erase)
    expect(screen.queryByTestId("mask-canvas")).not.toBeInTheDocument();

    // FloatingBrushToolbar should not be in the DOM (returns null when not visible)
    expect(screen.queryByTestId("floating-brush-toolbar")).not.toBeInTheDocument();
  });

  /**
   * AC-7: GIVEN `editMode` ist `"inpaint"` oder `"erase"`
   *       WHEN die `canvas-detail-view` rendert
   *       THEN ist das Mask-Canvas-Element sichtbar
   *       AND die Floating Brush Toolbar ist sichtbar
   */
  it('AC-7: should show mask canvas and floating brush toolbar when editMode is inpaint', () => {
    renderVisibilityTest({
      presetEditMode: "inpaint",
    });

    // MaskCanvas should be in the DOM
    expect(screen.queryByTestId("mask-canvas")).toBeInTheDocument();

    // FloatingBrushToolbar should be in the DOM
    expect(screen.queryByTestId("floating-brush-toolbar")).toBeInTheDocument();
  });

  it('AC-7 (erase): should show mask canvas and floating brush toolbar when editMode is erase', () => {
    renderVisibilityTest({
      presetEditMode: "erase",
    });

    // MaskCanvas should be in the DOM
    expect(screen.queryByTestId("mask-canvas")).toBeInTheDocument();

    // FloatingBrushToolbar should be in the DOM
    expect(screen.queryByTestId("floating-brush-toolbar")).toBeInTheDocument();
  });
});
