// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  useAssistantRuntime,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type { AssistantAction } from "../assistant-context";

// ---------------------------------------------------------------------------
// Helpers: SSE stream simulation (mock_external strategy per spec)
// ---------------------------------------------------------------------------

/**
 * Creates a ReadableStream that emits SSE-formatted text in chunks.
 */
function createSSEStream(events: Array<{ event: string; data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map(
    (e) => `event: ${e.event}\ndata: ${e.data}\n\n`
  );

  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Creates a mock Response with an SSE stream body.
 */
function mockSSEResponse(
  events: Array<{ event: string; data: string }>,
  status = 200
): Response {
  const stream = createSSEStream(events);
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/**
 * Standard SSE response for message endpoint: single text-delta + text-done.
 */
function standardMessageResponse(): Response {
  return mockSSEResponse([
    { event: "text-delta", data: JSON.stringify({ content: "Response" }) },
    { event: "text-done", data: JSON.stringify({}) },
  ]);
}

/**
 * Default hook options with mocked dispatch and refs.
 */
function createHookOptions(
  overrides?: Partial<UseAssistantRuntimeOptions>
): UseAssistantRuntimeOptions {
  return {
    projectId: "test-project-id",
    dispatch: vi.fn(),
    sessionIdRef: { current: "test-session-id" },
    selectedModel: "anthropic/claude-sonnet-4.6",
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    imageModelIdRef: { current: null },
    generationModeRef: { current: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: sendMessageToSession with image_model_id + generation_mode
// ---------------------------------------------------------------------------

describe("sendMessageToSession with image_model_id + generation_mode", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // AC-1: GIVEN ein Workspace mit ausgewaehltem Bildmodell
  //       "black-forest-labs/flux-2-pro" und Modus "txt2img"
  //       WHEN der User eine Nachricht im Assistant sendet
  //       THEN enthaelt der POST-Body an
  //       /api/assistant/sessions/{id}/messages die Felder
  //       image_model_id: "black-forest-labs/flux-2-pro" und
  //       generation_mode: "txt2img" neben den bestehenden Feldern
  //       (content, model)
  // --------------------------------------------------------------------------
  it("should include image_model_id and generation_mode in POST body when workspace has model and mode", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac1" as string | null };
    const imageModelIdRef = { current: "black-forest-labs/flux-2-pro" as string | null };
    const generationModeRef = { current: "txt2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Describe a sunset");
    });

    // Assert: POST body contains all required fields
    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];
    expect(body).toMatchObject({
      content: "Describe a sunset",
      model: "anthropic/claude-sonnet-4.6",
      image_model_id: "black-forest-labs/flux-2-pro",
      generation_mode: "txt2img",
    });
  });

  // --------------------------------------------------------------------------
  // AC-2: GIVEN ein Workspace mit Bildmodell "google/seedream-5" und
  //       Modus "img2img"
  //       WHEN der User eine Nachricht sendet
  //       THEN enthaelt der POST-Body image_model_id: "google/seedream-5"
  //       und generation_mode: "img2img"
  // --------------------------------------------------------------------------
  it("should send generation_mode img2img when workspace mode is img2img", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac2" as string | null };
    const imageModelIdRef = { current: "google/seedream-5" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Transform this image");
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];
    expect(body.image_model_id).toBe("google/seedream-5");
    expect(body.generation_mode).toBe("img2img");
  });

  // --------------------------------------------------------------------------
  // AC-3: GIVEN kein Workspace-Kontext verfuegbar (z.B. variationData ist
  //       null oder modelId ist leer)
  //       WHEN der User eine Nachricht sendet
  //       THEN enthaelt der POST-Body KEINE Felder image_model_id und
  //       generation_mode (Backward-Kompatibilitaet, identisch mit
  //       pre-Slice-08 Verhalten)
  // --------------------------------------------------------------------------
  it("should not include image_model_id or generation_mode when no workspace context", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac3" as string | null };
    // No workspace context: refs are null
    const imageModelIdRef = { current: null as string | null };
    const generationModeRef = { current: null as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Hello assistant");
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];

    // Must contain base fields
    expect(body.content).toBe("Hello assistant");
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");

    // Must NOT contain workspace fields
    expect(body).not.toHaveProperty("image_model_id");
    expect(body).not.toHaveProperty("generation_mode");
  });

  // --------------------------------------------------------------------------
  // AC-3 (additional): When refs are not provided at all (undefined)
  // --------------------------------------------------------------------------
  it("should not include image_model_id or generation_mode when refs are undefined", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac3b" as string | null };
    // Explicitly do NOT provide imageModelIdRef and generationModeRef
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef: undefined,
      generationModeRef: undefined,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("No context message");
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];
    expect(body).not.toHaveProperty("image_model_id");
    expect(body).not.toHaveProperty("generation_mode");
  });

  // --------------------------------------------------------------------------
  // AC-3 (additional): When modelId is empty string (falsy)
  // --------------------------------------------------------------------------
  it("should not include image_model_id when modelId is empty string", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac3c" as string | null };
    const imageModelIdRef = { current: "" as string | null };
    const generationModeRef = { current: "txt2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Empty model id");
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];
    // Empty string is falsy, so image_model_id should NOT be included
    expect(body).not.toHaveProperty("image_model_id");
  });

  // --------------------------------------------------------------------------
  // AC-4: GIVEN der Workspace-Modus ist "upscale" (kein txt2img/img2img)
  //       WHEN der User eine Nachricht sendet
  //       THEN wird generation_mode NICHT mitgesendet (nur image_model_id
  //       wenn vorhanden), weil das Backend nur "txt2img" und "img2img"
  //       als Literal akzeptiert
  // --------------------------------------------------------------------------
  it("should omit generation_mode when workspace mode is upscale", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac4" as string | null };
    const imageModelIdRef = { current: "black-forest-labs/flux-2-pro" as string | null };
    const generationModeRef = { current: "upscale" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Upscale this image");
    });

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];

    // image_model_id should still be present (model is set)
    expect(body.image_model_id).toBe("black-forest-labs/flux-2-pro");

    // generation_mode should NOT be present (upscale is not a valid backend literal)
    expect(body).not.toHaveProperty("generation_mode");
  });

  // --------------------------------------------------------------------------
  // AC-4 (additional): Also validate other non-valid modes like inpaint/outpaint
  // --------------------------------------------------------------------------
  it("should omit generation_mode for inpaint and outpaint modes", async () => {
    const dispatch = vi.fn();

    for (const mode of ["inpaint", "outpaint"]) {
      const sessionIdRef = { current: `session-ac4-${mode}` as string | null };
      const imageModelIdRef = { current: "some-model" as string | null };
      const generationModeRef = { current: mode as string | null };
      const options = createHookOptions({
        dispatch,
        sessionIdRef,
        imageModelIdRef,
        generationModeRef,
      });

      const capturedBodies: Record<string, unknown>[] = [];

      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/messages") && init?.body) {
          capturedBodies.push(JSON.parse(String(init.body)));
          return standardMessageResponse();
        }

        return new Response("Not Found", { status: 404 });
      }) as typeof fetch;

      const { result } = renderHook(() => useAssistantRuntime(options));

      await act(async () => {
        await result.current.sendMessage(`Test ${mode}`);
      });

      expect(capturedBodies).toHaveLength(1);
      expect(capturedBodies[0]).not.toHaveProperty("generation_mode");
      expect(capturedBodies[0].image_model_id).toBe("some-model");
    }
  });

  // --------------------------------------------------------------------------
  // AC-5: GIVEN der User wechselt das Bildmodell im Workspace von
  //       "flux-2-pro" zu "seedream-5" waehrend einer laufenden
  //       Assistant-Session
  //       WHEN der User die naechste Nachricht sendet
  //       THEN enthaelt der POST-Body das AKTUELLE Modell
  //       image_model_id: "google/seedream-5" (nicht das vorherige)
  // --------------------------------------------------------------------------
  it("should send current model id after workspace model change", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac5" as string | null };
    // Start with flux-2-pro
    const imageModelIdRef = { current: "black-forest-labs/flux-2-pro" as string | null };
    const generationModeRef = { current: "txt2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    // First message with flux-2-pro
    await act(async () => {
      await result.current.sendMessage("First message");
    });

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0].image_model_id).toBe("black-forest-labs/flux-2-pro");

    // Simulate workspace model change (user switches model in workspace)
    imageModelIdRef.current = "google/seedream-5";

    // Second message should use the NEW model
    await act(async () => {
      await result.current.sendMessage("Second message after model switch");
    });

    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[1].image_model_id).toBe("google/seedream-5");
  });

  // --------------------------------------------------------------------------
  // AC-6: GIVEN assistant-context.tsx nutzt bereits useWorkspaceVariation
  //       WHEN der Workspace variationData.modelId einen Wert hat
  //       THEN ist dieser Wert fuer sendMessageToSession als image_model_id
  //       zugaenglich (bestehender Import wird wiederverwendet, KEIN neuer
  //       Context noetig)
  //
  //       This test validates that the imageModelIdRef mechanism works --
  //       the ref reads from variationData.modelId in the context and
  //       sendMessageToSession uses it.
  // --------------------------------------------------------------------------
  it("should read modelId from workspace variationData", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac6" as string | null };
    // Simulate variationData.modelId being set via the ref
    const imageModelIdRef = { current: "black-forest-labs/flux-2-pro" as string | null };
    const generationModeRef = { current: "txt2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Test workspace data access");
    });

    expect(capturedBodies).toHaveLength(1);
    // The imageModelIdRef value (sourced from variationData.modelId) is accessible
    expect(capturedBodies[0].image_model_id).toBe("black-forest-labs/flux-2-pro");
  });

  // --------------------------------------------------------------------------
  // AC-7: GIVEN currentMode (GenerationMode) lebt in prompt-area.tsx und
  //       ist NICHT im workspace-state Context
  //       WHEN assistant-context.tsx den aktuellen Modus fuer generation_mode
  //       benoetigt
  //       THEN wird der Modus ueber einen geeigneten Mechanismus zugaenglich
  //       gemacht (z.B. Prop, Ref-Forwarding, oder workspace-state
  //       Erweiterung) — die bestehende Signatur
  //       sendMessage(content, imageUrls?) aendert sich NICHT
  // --------------------------------------------------------------------------
  it("should access currentMode for generation_mode field", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac7" as string | null };
    const imageModelIdRef = { current: "some-model" as string | null };
    // generationModeRef is the mechanism to make currentMode accessible
    const generationModeRef = { current: "txt2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    const capturedBodies: Record<string, unknown>[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages") && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    // The sendMessage signature must remain (content, imageUrls?) -- no extra params
    await act(async () => {
      // Only content is passed; generation_mode comes from ref, not from call args
      await result.current.sendMessage("Test mode access");
    });

    expect(capturedBodies).toHaveLength(1);
    // generation_mode is accessible via the ref mechanism, not via sendMessage args
    expect(capturedBodies[0].generation_mode).toBe("txt2img");
    // Verify sendMessage signature is unchanged: it accepts (content, imageUrls?)
    // If it required a 3rd argument for mode, the call above would fail
    expect(capturedBodies[0].content).toBe("Test mode access");
  });

  // --------------------------------------------------------------------------
  // AC-7 (additional): Verify sendMessage signature has NOT changed
  // --------------------------------------------------------------------------
  it("should maintain sendMessage(content, imageUrls?) signature unchanged", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-ac7b" as string | null };
    const imageModelIdRef = { current: "model-x" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      imageModelIdRef,
      generationModeRef,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/messages")) {
        return standardMessageResponse();
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    // Call with both content and imageUrls (the existing signature)
    await act(async () => {
      await result.current.sendMessage("With images", ["https://img.example.com/1.png"]);
    });

    // Verify the function accepted both params without error
    // and that image_urls were also included in the body
    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const messageFetchCall = fetchCalls.find(
      (call: [RequestInfo | URL, RequestInit?]) => {
        const url = typeof call[0] === "string" ? call[0] : call[0].toString();
        return url.includes("/messages");
      }
    );

    expect(messageFetchCall).toBeDefined();
    const body = JSON.parse(String(messageFetchCall![1]?.body));
    expect(body.content).toBe("With images");
    expect(body.image_urls).toEqual(["https://img.example.com/1.png"]);
    expect(body.image_model_id).toBe("model-x");
    expect(body.generation_mode).toBe("img2img");
  });
});
