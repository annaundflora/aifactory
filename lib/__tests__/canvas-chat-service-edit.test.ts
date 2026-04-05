// @vitest-environment node
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Import the function under test (no mocks needed for pure parsing logic)
// ---------------------------------------------------------------------------

import { parseSSEEvent } from "@/lib/canvas-chat-service";

// ---------------------------------------------------------------------------
// Tests: SSE Event Parsing for Edit Actions (Slice 07)
// ---------------------------------------------------------------------------

describe("parseSSEEvent — Edit Actions (Slice 07)", () => {
  /**
   * AC-1: GIVEN `SSECanvasGenerateEvent` in `canvas-chat-service.ts`
   *       WHEN ein SSE-Event mit `action: "inpaint"` und `mask_url: "https://r2.example.com/mask.png"` geparsed wird
   *       THEN gibt `parseSSEEvent` ein Objekt zurueck mit `action: "inpaint"` und `mask_url: "https://r2.example.com/mask.png"`
   */
  it("AC-1: should parse SSE event with action inpaint and mask_url", () => {
    const rawData = JSON.stringify({
      action: "inpaint",
      prompt: "remove background",
      model_id: "flux-2-max",
      params: { strength: 0.8 },
      mask_url: "https://r2.example.com/mask.png",
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      type: "canvas-generate",
      action: "inpaint",
      prompt: "remove background",
      model_id: "flux-2-max",
      params: { strength: 0.8 },
      mask_url: "https://r2.example.com/mask.png",
    });
  });

  /**
   * AC-2: GIVEN `SSECanvasGenerateEvent` in `canvas-chat-service.ts`
   *       WHEN ein SSE-Event mit `action: "outpaint"`, `outpaint_directions: ["top","right"]`, `outpaint_size: 50` geparsed wird
   *       THEN gibt `parseSSEEvent` ein Objekt zurueck mit allen drei Feldern korrekt gemappt
   */
  it("AC-2: should parse SSE event with action outpaint including outpaint_directions and outpaint_size", () => {
    const rawData = JSON.stringify({
      action: "outpaint",
      prompt: "extend landscape",
      model_id: "flux-2-max",
      params: {},
      outpaint_directions: ["top", "right"],
      outpaint_size: 50,
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      type: "canvas-generate",
      action: "outpaint",
      prompt: "extend landscape",
      model_id: "flux-2-max",
      params: {},
      outpaint_directions: ["top", "right"],
      outpaint_size: 50,
    });
  });

  // ---------------------------------------------------------------------------
  // Additional edge-case coverage for new fields
  // ---------------------------------------------------------------------------

  it("AC-1 edge: inpaint event without mask_url should not include mask_url field", () => {
    const rawData = JSON.stringify({
      action: "inpaint",
      prompt: "fix area",
      model_id: "model-x",
      params: {},
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      type: "canvas-generate",
      action: "inpaint",
      prompt: "fix area",
      model_id: "model-x",
      params: {},
    });
    // mask_url should not be present at all (not even undefined)
    expect(result).not.toHaveProperty("mask_url");
  });

  it("AC-2 edge: erase event with mask_url should include mask_url", () => {
    const rawData = JSON.stringify({
      action: "erase",
      prompt: "remove object",
      model_id: "model-y",
      params: {},
      mask_url: "https://r2.example.com/erase-mask.png",
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      type: "canvas-generate",
      action: "erase",
      prompt: "remove object",
      model_id: "model-y",
      params: {},
      mask_url: "https://r2.example.com/erase-mask.png",
    });
  });

  it("backward-compat: existing variation event still parses correctly", () => {
    const rawData = JSON.stringify({
      action: "variation",
      prompt: "blue sky",
      model_id: "flux-2-max",
      params: { steps: 30 },
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).toEqual({
      type: "canvas-generate",
      action: "variation",
      prompt: "blue sky",
      model_id: "flux-2-max",
      params: { steps: 30 },
    });
  });

  it("backward-compat: existing img2img event still parses correctly", () => {
    const rawData = JSON.stringify({
      action: "img2img",
      prompt: "oil painting style",
      model_id: "model-z",
      params: { strength: 0.7 },
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).toEqual({
      type: "canvas-generate",
      action: "img2img",
      prompt: "oil painting style",
      model_id: "model-z",
      params: { strength: 0.7 },
    });
  });

  it("AC-2 edge: outpaint with single direction should parse correctly", () => {
    const rawData = JSON.stringify({
      action: "outpaint",
      prompt: "expand",
      model_id: "model-a",
      params: {},
      outpaint_directions: ["bottom"],
      outpaint_size: 25,
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).toEqual({
      type: "canvas-generate",
      action: "outpaint",
      prompt: "expand",
      model_id: "model-a",
      params: {},
      outpaint_directions: ["bottom"],
      outpaint_size: 25,
    });
  });

  it("AC-2 edge: outpaint_size of 0 should still be included", () => {
    const rawData = JSON.stringify({
      action: "outpaint",
      prompt: "expand",
      model_id: "model-a",
      params: {},
      outpaint_directions: ["left"],
      outpaint_size: 0,
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).not.toBeNull();
    // outpaint_size: 0 should be present since the code checks !== undefined
    expect(result).toHaveProperty("outpaint_size", 0);
  });

  it("instruction action should parse correctly", () => {
    const rawData = JSON.stringify({
      action: "instruction",
      prompt: "make it brighter",
      model_id: "model-inst",
      params: { guidance: 7.5 },
    });

    const result = parseSSEEvent("canvas-generate", rawData);

    expect(result).toEqual({
      type: "canvas-generate",
      action: "instruction",
      prompt: "make it brighter",
      model_id: "model-inst",
      params: { guidance: 7.5 },
    });
  });
});
