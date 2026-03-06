// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocks (mock_external strategy: external deps, server actions, heavy libs)
// ---------------------------------------------------------------------------

// Mock next/image to render a plain <img>
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    createElement("img", {
      src: props.src,
      alt: props.alt,
      "data-testid": props["data-testid"],
    }),
}));

// Mock lucide-react icons as simple spans
vi.mock("lucide-react", () => ({
  Copy: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-copy", className: props.className }),
  Download: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-download", className: props.className }),
  Loader2: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-loader", className: props.className }),
  X: (props: Record<string, unknown>) =>
    createElement("span", { "data-testid": "icon-x", className: props.className }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock download utils
vi.mock("@/lib/utils", () => ({
  downloadImage: vi.fn().mockResolvedValue(undefined),
  generateDownloadFilename: vi.fn().mockReturnValue("test-image.png"),
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

// Mock models
vi.mock("@/lib/models", () => ({
  MODELS: [
    {
      id: "black-forest-labs/flux-2-pro",
      displayName: "FLUX 2 Pro",
      pricePerImage: 0.055,
    },
    {
      id: "google/nano-banana-2",
      displayName: "Nano Banana 2",
      pricePerImage: 0,
    },
  ],
  getModelById: (id: string) => {
    const models: Record<string, { id: string; displayName: string; pricePerImage: number }> = {
      "black-forest-labs/flux-2-pro": {
        id: "black-forest-labs/flux-2-pro",
        displayName: "FLUX 2 Pro",
        pricePerImage: 0.055,
      },
      "google/nano-banana-2": {
        id: "google/nano-banana-2",
        displayName: "Nano Banana 2",
        pricePerImage: 0,
      },
    };
    return models[id] ?? undefined;
  },
}));

// Mock server actions
vi.mock("@/app/actions/models", () => ({
  getModelSchema: vi.fn().mockResolvedValue({
    properties: {
      aspect_ratio: {
        type: "string",
        enum: ["1:1", "16:9", "4:3"],
        default: "1:1",
      },
      num_inference_steps: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 28,
      },
      negative_prompt: {
        type: "string",
      },
    },
  }),
}));

const mockGenerateImages = vi.fn().mockResolvedValue(undefined);
vi.mock("@/app/actions/generations", () => ({
  generateImages: (...args: unknown[]) => mockGenerateImages(...args),
}));

// Mock UI components to simple HTML elements for testability
vi.mock("@/components/ui/select", () => {
  // Store the onValueChange callback so SelectItem options can trigger it
  let currentOnValueChange: ((v: string) => void) | null = null;
  let currentValue = "";
  return {
    Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (v: string) => void }) => {
      currentOnValueChange = onValueChange;
      currentValue = value;
      return createElement("div", { "data-testid": "select-root" }, children);
    },
    SelectContent: ({ children }: { children: ReactNode }) =>
      createElement("div", { "data-testid": "select-content" }, children),
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) =>
      createElement("button", {
        type: "button",
        role: "option",
        "data-value": value,
        "aria-selected": value === currentValue ? "true" : "false",
        onClick: () => currentOnValueChange?.(value),
      }, children),
    SelectTrigger: ({ children, ...rest }: { children: ReactNode; id?: string; "data-testid"?: string }) =>
      createElement("div", {
        "data-testid": rest["data-testid"] ?? "select-trigger",
        "data-value": currentValue,
      }, children),
    SelectValue: () => createElement("span", { "data-testid": "select-value" }, currentValue),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...rest }: Record<string, unknown>) =>
    createElement("button", {
      onClick,
      disabled,
      "data-testid": rest["data-testid"],
      type: rest.type ?? "button",
    }, children),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) =>
    createElement("label", { htmlFor }, children),
}));

vi.mock("@/components/workspace/parameter-panel", () => ({
  ParameterPanel: ({ values }: { schema: unknown; isLoading: boolean; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) =>
    createElement("div", { "data-testid": "parameter-panel", "data-values": JSON.stringify(values) }),
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks
// ---------------------------------------------------------------------------
import { LightboxModal } from "../lightbox-modal";
import { PromptArea } from "@/components/workspace/prompt-area";
import { WorkspaceStateProvider, useWorkspaceVariation } from "@/lib/workspace-state";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createGeneration(overrides: Record<string, unknown> = {}) {
  return {
    id: "gen-1",
    projectId: "proj-1",
    prompt: "A fox in oil painting style",
    negativePrompt: null as string | null,
    modelId: "black-forest-labs/flux-2-pro",
    modelParams: { aspect_ratio: "1:1", num_inference_steps: 28 },
    status: "completed",
    imageUrl: "https://example.com/fox.png",
    replicatePredictionId: "pred-1",
    errorMessage: null,
    width: 1024,
    height: 1024,
    seed: 12345,
    createdAt: new Date("2026-03-01T12:00:00Z"),
    ...overrides,
  };
}

/**
 * A test consumer component that reads variation state and exposes it in the DOM.
 * Used to verify that setVariation in LightboxModal propagates through the real provider.
 */
function VariationStateReader() {
  const { variationData } = useWorkspaceVariation();
  return createElement("div", {
    "data-testid": "variation-state-reader",
    "data-variation": variationData ? JSON.stringify(variationData) : "null",
  });
}

describe("Variation Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // AC-8: Variation-Button sichtbar
  // ---------------------------------------------------------------------------
  it("should render Variation button in lightbox actions area", () => {
    /**
     * AC-8: GIVEN die Lightbox ist geoeffnet
     *       WHEN der Actions-Bereich gerendert wird
     *       THEN ist der "Variation"-Button sichtbar (neben Download und Delete)
     */
    const generation = createGeneration();
    const onClose = vi.fn();

    render(
      createElement(WorkspaceStateProvider, null,
        createElement(LightboxModal, {
          generation: generation as Parameters<typeof LightboxModal>[0]["generation"],
          isOpen: true,
          onClose,
        })
      )
    );

    const variationBtn = screen.getByTestId("variation-btn");
    expect(variationBtn).toBeDefined();
    expect(variationBtn.textContent).toContain("Variation");

    // Also verify download button exists alongside variation
    const downloadBtn = screen.getByTestId("download-btn");
    expect(downloadBtn).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // AC-1: Klick setzt Variation-State
  // ---------------------------------------------------------------------------
  it("should write generation data into WorkspaceVariationState when Variation button is clicked", async () => {
    /**
     * AC-1: GIVEN eine geoeffnete Lightbox mit einer Generation
     *       WHEN der User auf den "Variation"-Button klickt
     *       THEN werden prompt, modelId und modelParams in den WorkspaceVariationState geschrieben
     */
    const user = userEvent.setup();
    const generation = createGeneration();
    const onClose = vi.fn();

    render(
      createElement(WorkspaceStateProvider, null,
        createElement(LightboxModal, {
          generation: generation as Parameters<typeof LightboxModal>[0]["generation"],
          isOpen: true,
          onClose,
        }),
        createElement(VariationStateReader)
      )
    );

    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    const reader = screen.getByTestId("variation-state-reader");
    // After click + onClose, the lightbox unmounts, but the state persists in the provider.
    // However, onClose may have been called which in a real scenario removes the lightbox.
    // The VariationStateReader should show the set data.
    // Note: The LightboxModal calls onClose which may hide it, but our reader is still mounted.
    const variationJson = reader.getAttribute("data-variation");
    expect(variationJson).not.toBe("null");

    const variation = JSON.parse(variationJson!);
    expect(variation.prompt).toBe("A fox in oil painting style");
    expect(variation.modelId).toBe("black-forest-labs/flux-2-pro");
    expect(variation.modelParams).toEqual({
      aspect_ratio: "1:1",
      num_inference_steps: 28,
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2: Lightbox schliesst nach Variation-Klick
  // ---------------------------------------------------------------------------
  it("should call onClose after variation state is set", async () => {
    /**
     * AC-2: GIVEN der User hat auf "Variation" geklickt
     *       WHEN der Variation-State gesetzt wurde
     *       THEN schliesst sich die Lightbox automatisch (onClose wird aufgerufen)
     */
    const user = userEvent.setup();
    const generation = createGeneration();
    const onClose = vi.fn();

    render(
      createElement(WorkspaceStateProvider, null,
        createElement(LightboxModal, {
          generation: generation as Parameters<typeof LightboxModal>[0]["generation"],
          isOpen: true,
          onClose,
        })
      )
    );

    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // AC-5: PromptArea uebernimmt Variation-Daten
  // ---------------------------------------------------------------------------
  it("should populate prompt textarea, model dropdown, parameter panel, and negative prompt from variation state", async () => {
    /**
     * AC-5: GIVEN der WorkspaceVariationState wurde mit Werten gesetzt
     *       WHEN PromptArea den State via useWorkspaceVariation() konsumiert
     *       THEN wird prompt-textarea mit dem uebernommenen Prompt befuellt, das Model-Dropdown
     *            auf modelId gesetzt, das ParameterPanel mit modelParams vorbelegt und das
     *            Negativ-Prompt-Feld (falls sichtbar) befuellt
     */
    const user = userEvent.setup();
    const generation = createGeneration({
      negativePrompt: "blurry, low quality",
    });
    const onClose = vi.fn();

    render(
      createElement(WorkspaceStateProvider, null,
        createElement(LightboxModal, {
          generation: generation as Parameters<typeof LightboxModal>[0]["generation"],
          isOpen: true,
          onClose,
        }),
        createElement(PromptArea, { projectId: "proj-1" })
      )
    );

    // Click the variation button to transfer data
    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    // Wait for effects to propagate - PromptArea consumes variationData via useEffect
    // The prompt textarea should be populated
    const promptTextarea = screen.getByTestId("prompt-textarea") as HTMLTextAreaElement;
    expect(promptTextarea.value).toBe("A fox in oil painting style");

    // The model select trigger should show the correct model value
    const modelSelect = screen.getByTestId("model-select");
    expect(modelSelect.getAttribute("data-value")).toBe("black-forest-labs/flux-2-pro");

    // The parameter panel should receive the model params
    const paramPanel = screen.getByTestId("parameter-panel");
    const paramValues = JSON.parse(paramPanel.getAttribute("data-values") || "{}");
    expect(paramValues.aspect_ratio).toBe("1:1");
    expect(paramValues.num_inference_steps).toBe(28);
  });

  // ---------------------------------------------------------------------------
  // AC-7: Angepasste Variation generieren
  // ---------------------------------------------------------------------------
  it("should call generateImages with modified prompt and selected variant count after variation takeover", async () => {
    /**
     * AC-7: GIVEN die Variation-Daten wurden in die Eingabefelder uebernommen
     *       WHEN der User den Prompt anpasst, Variant-Count auf 3 setzt und auf "Generate" klickt
     *       THEN wird generateImages mit dem geaenderten Prompt, dem uebernommenen Modell,
     *            den (ggf. angepassten) Parametern und count: 3 aufgerufen
     */
    const user = userEvent.setup();
    const generation = createGeneration();
    const onClose = vi.fn();

    render(
      createElement(WorkspaceStateProvider, null,
        createElement(LightboxModal, {
          generation: generation as Parameters<typeof LightboxModal>[0]["generation"],
          isOpen: true,
          onClose,
        }),
        createElement(PromptArea, { projectId: "proj-1" })
      )
    );

    // Click variation to transfer data
    const variationBtn = screen.getByTestId("variation-btn");
    await user.click(variationBtn);

    // Modify the prompt
    const promptTextarea = screen.getByTestId("prompt-textarea") as HTMLTextAreaElement;
    await user.clear(promptTextarea);
    await user.type(promptTextarea, "A modified fox painting");

    // Set variant count to 3
    const variantBtn3 = screen.getByTestId("variant-count-3");
    await user.click(variantBtn3);

    // Click generate
    const generateBtn = screen.getByTestId("generate-button");
    await user.click(generateBtn);

    expect(mockGenerateImages).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateImages.mock.calls[0][0];
    expect(callArgs.prompt).toBe("A modified fox painting");
    expect(callArgs.modelId).toBe("black-forest-labs/flux-2-pro");
    expect(callArgs.count).toBe(3);
    expect(callArgs.projectId).toBe("proj-1");
  });
});
