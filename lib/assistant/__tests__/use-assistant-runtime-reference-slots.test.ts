// @vitest-environment jsdom
/**
 * Acceptance tests for Slice 19: ReferenceSlot-DTO + SendMessageRequest extension
 * (Frontend-side -- body-builder and ref snapshots).
 *
 * Tests are derived 1:1 from the GIVEN/WHEN/THEN Acceptance Criteria in
 * specs/2026-04-19-29-interactive-prompt-refinement-project-context/slices/
 * slice-19-reference-slots-dto.md.
 *
 * Mocking Strategy: ``no_mocks`` for runtime logic; per Slice-Spec: "Frontend-
 * Body-Build mit gemocktem `fetch`". Network is mocked at the boundary so we
 * can inspect the body the runtime emits; the hook itself runs unaltered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
  type ReferenceSlotSnapshot,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type { AssistantAction } from "../assistant-context";

// ---------------------------------------------------------------------------
// Helpers (mirrors helpers used in use-assistant-runtime.test.ts)
// ---------------------------------------------------------------------------

function createSSEStream(events: Array<{ event: string; data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`);

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

interface FetchCall {
  url: string;
  body: string;
}

/**
 * Build a fetch stub that records every outbound call and replies with a minimal
 * successful SSE stream for /messages. Session creation always succeeds with
 * the configured session id.
 */
function buildFetchStub(sessionId: string): {
  stub: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? String(init.body) : "";
    calls.push({ url, body });

    if (url === "/api/assistant/sessions") {
      return new Response(JSON.stringify({ id: sessionId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/messages")) {
      return mockSSEResponse([
        { event: "text-delta", data: JSON.stringify({ content: "ok" }) },
        { event: "text-done", data: JSON.stringify({}) },
      ]);
    }

    return new Response("Not Found", { status: 404 });
  }) as unknown as typeof fetch;

  return { stub, calls };
}

function createHookOptions(
  overrides?: Partial<UseAssistantRuntimeOptions>
): UseAssistantRuntimeOptions {
  return {
    projectId: "test-project-id",
    dispatch: vi.fn(),
    sessionIdRef: { current: null },
    selectedModel: "anthropic/claude-sonnet-4.6",
    sendMessageRef: { current: null },
    cancelStreamRef: { current: null },
    ...overrides,
  };
}

/**
 * Find the JSON body of the request to /messages and parse it. Asserts that
 * exactly one /messages call was issued; fails the test otherwise.
 */
function getMessagesBody(calls: FetchCall[]): Record<string, unknown> {
  const messageCalls = calls.filter((c) => c.url.includes("/messages"));
  expect(messageCalls).toHaveLength(1);
  return JSON.parse(messageCalls[0].body) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAssistantRuntime -- Slice 19 reference slots body builder", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC-8: GIVEN frontend runtime hook with new refs (referenceSlotsRef,
  //        projectIdRef, pattern as existing refs lines 104-107)
  //       WHEN sendMessage is called with generationModeRef.current === "img2img"
  //            and 2 active slots
  //       THEN request body contains a reference_slots array with 2 snapshot
  //            entries (slot_index, image_url, role, strength) AND project_id.
  // -------------------------------------------------------------------------
  it("AC-8: sends reference_slots and project_id when generation mode is img2img", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-img2img" as string | null };

    const generationModeRef = { current: "img2img" as string | null };
    const projectIdRef = {
      current: "11111111-1111-4111-8111-111111111111" as string | null,
    };
    const slots: ReferenceSlotSnapshot[] = [
      {
        slot_index: 0,
        image_url: "https://example.com/a.png",
        role: "subject",
        strength: 0.7,
      },
      {
        slot_index: 1,
        image_url: "https://example.com/b.png",
        role: "style",
        strength: 0.4,
      },
    ];
    const referenceSlotsRef = {
      current: slots as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub, calls } = buildFetchStub("session-img2img");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Build me an image with these refs");
    });

    const body = getMessagesBody(calls);

    // project_id is sent on every turn when set
    expect(body.project_id).toBe("11111111-1111-4111-8111-111111111111");

    // reference_slots present with 2 snapshot entries
    expect(Array.isArray(body.reference_slots)).toBe(true);
    const refSlots = body.reference_slots as Array<Record<string, unknown>>;
    expect(refSlots).toHaveLength(2);

    expect(refSlots[0]).toEqual({
      slot_index: 0,
      image_url: "https://example.com/a.png",
      role: "subject",
      strength: 0.7,
    });
    expect(refSlots[1]).toEqual({
      slot_index: 1,
      image_url: "https://example.com/b.png",
      role: "style",
      strength: 0.4,
    });

    // generation_mode passed through
    expect(body.generation_mode).toBe("img2img");
  });

  // -------------------------------------------------------------------------
  // AC-9: GIVEN modus gate on generationModeRef.current === "img2img"
  //       WHEN sendMessage is called with generationModeRef.current === "txt2img"
  //            and 2 active slots
  //       THEN request body contains NO reference_slots field (or empty array
  //            per DTO default None); project_id is sent regardless.
  // -------------------------------------------------------------------------
  it("AC-9: omits reference_slots when generation mode is not img2img but keeps project_id", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-txt2img" as string | null };

    const generationModeRef = { current: "txt2img" as string | null };
    const projectIdRef = {
      current: "22222222-2222-4222-8222-222222222222" as string | null,
    };
    const slots: ReferenceSlotSnapshot[] = [
      {
        slot_index: 0,
        image_url: "https://example.com/a.png",
        role: "subject",
        strength: 0.5,
      },
      {
        slot_index: 1,
        image_url: "https://example.com/b.png",
        role: "style",
        strength: 0.5,
      },
    ];
    const referenceSlotsRef = {
      current: slots as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub, calls } = buildFetchStub("session-txt2img");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("Plain text-to-image please");
    });

    const body = getMessagesBody(calls);

    // project_id MUST be sent regardless of mode
    expect(body.project_id).toBe("22222222-2222-4222-8222-222222222222");

    // reference_slots is either absent OR an empty array per the slice constraint:
    // "wird weggelassen (nicht null gesetzt) wenn Modus != img2img"
    if ("reference_slots" in body) {
      expect(body.reference_slots).toEqual([]);
    } else {
      expect(body.reference_slots).toBeUndefined();
    }

    // generation_mode is forwarded
    expect(body.generation_mode).toBe("txt2img");
  });

  // -------------------------------------------------------------------------
  // AC-9 (supplement): same as AC-9 but ensure that generation_mode missing
  // (e.g. mode-cleared) also omits reference_slots.
  // -------------------------------------------------------------------------
  it("AC-9: omits reference_slots when generation mode is null", async () => {
    const sessionIdRef = { current: "session-no-mode" as string | null };
    const generationModeRef = { current: null as string | null };
    const projectIdRef = {
      current: "33333333-3333-4333-8333-333333333333" as string | null,
    };
    const referenceSlotsRef = {
      current: [
        {
          slot_index: 0,
          image_url: "https://example.com/a.png",
          role: "subject",
          strength: 0.5,
        },
      ] as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub, calls } = buildFetchStub("session-no-mode");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("no-mode call");
    });

    const body = getMessagesBody(calls);
    expect(body.project_id).toBe("33333333-3333-4333-8333-333333333333");
    if ("reference_slots" in body) {
      expect(body.reference_slots).toEqual([]);
    } else {
      expect(body.reference_slots).toBeUndefined();
    }
  });

  // -------------------------------------------------------------------------
  // AC-9 (supplement): when img2img is active but the slot snapshot is empty,
  // reference_slots is omitted (per Slice constraint: "weggelassen [...] wenn
  // [...] Snapshot leer ist").
  // -------------------------------------------------------------------------
  it("AC-9: omits reference_slots when img2img mode but snapshot is empty", async () => {
    const sessionIdRef = { current: "session-empty" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const projectIdRef = {
      current: "44444444-4444-4444-8444-444444444444" as string | null,
    };
    const referenceSlotsRef = {
      current: [] as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub, calls } = buildFetchStub("session-empty");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("img2img with no slots yet");
    });

    const body = getMessagesBody(calls);
    expect(body.project_id).toBe("44444444-4444-4444-8444-444444444444");
    expect("reference_slots" in body).toBe(false);
  });

  // -------------------------------------------------------------------------
  // AC-10: GIVEN snapshot semantics (slot list is read from ref at send time)
  //        WHEN slot state changes between two consecutive sendMessage calls
  //        THEN each call sends the respective current snapshot; no caching.
  // -------------------------------------------------------------------------
  it("AC-10: each sendMessage reads the current ref snapshot, no caching", async () => {
    const sessionIdRef = { current: "session-snap" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const projectIdRef = {
      current: "55555555-5555-4555-8555-555555555555" as string | null,
    };

    // Initial snapshot has 1 slot
    const initialSlots: ReferenceSlotSnapshot[] = [
      {
        slot_index: 0,
        image_url: "https://example.com/first.png",
        role: "subject",
        strength: 0.6,
      },
    ];
    const referenceSlotsRef = {
      current: initialSlots as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const calls: FetchCall[] = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const body = init?.body ? String(init.body) : "";
        calls.push({ url, body });

        if (url === "/api/assistant/sessions") {
          return new Response(JSON.stringify({ id: "session-snap" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/messages")) {
          return mockSSEResponse([
            { event: "text-delta", data: JSON.stringify({ content: "ok" }) },
            { event: "text-done", data: JSON.stringify({}) },
          ]);
        }
        return new Response("Not Found", { status: 404 });
      }
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useAssistantRuntime(options));

    // First call -- 1 slot
    await act(async () => {
      await result.current.sendMessage("first call");
    });

    // Mutate ref BEFORE the second call (mirrors how the parent component
    // would update slots between turns).
    referenceSlotsRef.current = [
      {
        slot_index: 0,
        image_url: "https://example.com/first.png",
        role: "subject",
        strength: 0.6,
      },
      {
        slot_index: 1,
        image_url: "https://example.com/second.png",
        role: "composition",
        strength: 0.3,
      },
    ];

    // Second call -- 2 slots (reflects current ref)
    await act(async () => {
      await result.current.sendMessage("second call");
    });

    const messageCalls = calls.filter((c) => c.url.includes("/messages"));
    expect(messageCalls).toHaveLength(2);

    const firstBody = JSON.parse(messageCalls[0].body) as Record<
      string,
      unknown
    >;
    const secondBody = JSON.parse(messageCalls[1].body) as Record<
      string,
      unknown
    >;

    const firstSlots = firstBody.reference_slots as Array<unknown>;
    const secondSlots = secondBody.reference_slots as Array<unknown>;

    expect(Array.isArray(firstSlots)).toBe(true);
    expect(firstSlots).toHaveLength(1);
    expect((firstSlots[0] as { slot_index: number }).slot_index).toBe(0);
    expect(
      (firstSlots[0] as { image_url: string }).image_url
    ).toBe("https://example.com/first.png");

    expect(Array.isArray(secondSlots)).toBe(true);
    expect(secondSlots).toHaveLength(2);
    expect((secondSlots[1] as { slot_index: number }).slot_index).toBe(1);
    expect(
      (secondSlots[1] as { image_url: string }).image_url
    ).toBe("https://example.com/second.png");
  });

  // -------------------------------------------------------------------------
  // Negative-path: AC-8 supplement -- omitted role/strength serialise to null
  // (the body builder must not introduce undefined into JSON).
  // -------------------------------------------------------------------------
  it("AC-8: snapshot entries with undefined role/strength serialise to null", async () => {
    const sessionIdRef = { current: "session-nulls" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const projectIdRef = {
      current: "66666666-6666-4666-8666-666666666666" as string | null,
    };
    const referenceSlotsRef = {
      current: [
        {
          slot_index: 0,
          image_url: "https://example.com/x.png",
          // role and strength intentionally omitted (Optional)
        } as ReferenceSlotSnapshot,
      ] as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub, calls } = buildFetchStub("session-nulls");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("optional fields omitted");
    });

    const body = getMessagesBody(calls);
    const refSlots = body.reference_slots as Array<Record<string, unknown>>;
    expect(refSlots).toHaveLength(1);
    expect(refSlots[0]).toEqual({
      slot_index: 0,
      image_url: "https://example.com/x.png",
      role: null,
      strength: null,
    });
  });

  // -------------------------------------------------------------------------
  // Backward-compat: when neither projectIdRef nor referenceSlotsRef are
  // provided, the body must remain shaped exactly like before this slice.
  // -------------------------------------------------------------------------
  it("body builder backward-compat: omits new fields when refs are not provided", async () => {
    const sessionIdRef = { current: "session-bc" as string | null };
    const options = createHookOptions({ sessionIdRef });

    const { stub, calls } = buildFetchStub("session-bc");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("legacy call");
    });

    const body = getMessagesBody(calls);
    expect(body.content).toBe("legacy call");
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");
    expect("project_id" in body).toBe(false);
    expect("reference_slots" in body).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Smoke / unit-style sanity check: dispatch contract is preserved across the
// new body-builder path. We assert the ADD_USER_MESSAGE action is still emitted
// once per sendMessage even when the new refs are populated.
// ---------------------------------------------------------------------------
describe("useAssistantRuntime -- Slice 19 dispatch contract preserved", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("dispatches ADD_USER_MESSAGE exactly once when reference slots are present", async () => {
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-dispatch" as string | null };
    const generationModeRef = { current: "img2img" as string | null };
    const projectIdRef = {
      current: "77777777-7777-4777-8777-777777777777" as string | null,
    };
    const referenceSlotsRef = {
      current: [
        {
          slot_index: 0,
          image_url: "https://example.com/x.png",
          role: "subject",
          strength: 0.5,
        },
      ] as ReferenceSlotSnapshot[] | null,
    };

    const options = createHookOptions({
      dispatch,
      sessionIdRef,
      generationModeRef,
      projectIdRef,
      referenceSlotsRef,
    });

    const { stub } = buildFetchStub("session-dispatch");
    globalThis.fetch = stub;

    const { result } = renderHook(() => useAssistantRuntime(options));

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    const userMsgActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "ADD_USER_MESSAGE");

    expect(userMsgActions).toHaveLength(1);
  });
});
