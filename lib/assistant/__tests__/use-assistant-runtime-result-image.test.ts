// @vitest-environment jsdom
/**
 * Tests for Slice 18: ``useAssistantRuntime`` -- Result-Image Multimodal.
 *
 * Tests derived 1:1 from GIVEN/WHEN/THEN Acceptance Criteria:
 *   AC-1: Auto-Apply-Settle path dispatches
 *         ``SET_LAST_RESULT_IMAGE_URL`` exactly once with the imageUrl of
 *         the newest succeeded generation when a generation transitions
 *         to ``status === "completed"`` with a populated ``imageUrl``.
 *   AC-2: ``sendMessage`` POST body includes ``last_result_image_url``
 *         when ``lastResultImageUrlRef`` carries a string URL; the field
 *         is OMITTED entirely when the ref is ``null``/empty (chosen
 *         pattern per spec).
 *
 * Mocking Strategy: ``mock_external`` (per slice spec). ``fetch`` is
 * stubbed to capture the POST body for ``/messages`` (AC-2) and SSE
 * streams are produced by an in-memory ``ReadableStream`` (no network).
 * AC-1 exercises the auto-apply-settle ``useEffect`` directly via the
 * ``generations`` option so we never have to mock the polling pipeline.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  useAssistantRuntime,
  type UseAssistantRuntimeOptions,
} from "../use-assistant-runtime";
import type { AssistantAction } from "../assistant-context";
import type { Generation } from "@/lib/db/queries";

// ---------------------------------------------------------------------------
// SSE stream helper (mock_external — same shape used by the existing test
// file ``use-assistant-runtime.test.ts``).
// ---------------------------------------------------------------------------

function createSSEStream(events: Array<{ event: string; data: string }>) {
  const encoder = new TextEncoder();
  const chunks = events.map(
    (e) => `event: ${e.event}\ndata: ${e.data}\n\n`
  );
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
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

// ---------------------------------------------------------------------------
// Generation factory — minimal valid row shape (per ``lib/db/schema.ts``).
// We only populate the fields the settle effect actually reads.
// ---------------------------------------------------------------------------

function makeGen(overrides: Partial<Generation> & Pick<Generation, "id">): Generation {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? "test-project-id",
    prompt: overrides.prompt ?? "",
    modelId: overrides.modelId ?? "test-model",
    modelParams: overrides.modelParams ?? {},
    status: overrides.status ?? "pending",
    imageUrl: overrides.imageUrl ?? null,
    replicatePredictionId: overrides.replicatePredictionId ?? null,
    errorMessage: overrides.errorMessage ?? null,
    width: overrides.width ?? null,
    height: overrides.height ?? null,
    seed: overrides.seed ?? null,
    promptMotiv: overrides.promptMotiv ?? "",
    isFavorite: overrides.isFavorite ?? false,
    createdAt: overrides.createdAt ?? new Date(),
    generationMode: overrides.generationMode ?? "txt2img",
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceGenerationId: overrides.sourceGenerationId ?? null,
    batchId: overrides.batchId ?? null,
  } as Generation;
}

// ---------------------------------------------------------------------------
// Default hook options (mirrors the helper from
// ``use-assistant-runtime.test.ts``).
// ---------------------------------------------------------------------------

function createOptions(
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

// ---------------------------------------------------------------------------
// AC-1 -- Auto-Apply-Settle dispatch
// ---------------------------------------------------------------------------

describe("Slice 18: useAssistantRuntime auto-apply-settle (AC-1)", () => {
  it("AC-1: dispatches SET_LAST_RESULT_IMAGE_URL exactly once with imageUrl of newest succeeded generation", () => {
    /**
     * AC-1: GIVEN a generations array containing one row that just
     *             transitioned to ``status === "completed"`` with a
     *             populated ``imageUrl``
     *       WHEN  the settle effect re-runs
     *       THEN  it dispatches ``SET_LAST_RESULT_IMAGE_URL`` exactly
     *             once with the imageUrl + generationId of that row.
     */
    const dispatch = vi.fn();
    const completedRow = makeGen({
      id: "gen-1",
      status: "completed",
      imageUrl: "https://example.com/result.png",
      createdAt: new Date("2026-05-01T10:00:00Z"),
    });

    const { rerender } = renderHook(
      (props: { generations: Generation[] }) =>
        useAssistantRuntime(
          createOptions({ dispatch, generations: props.generations })
        ),
      { initialProps: { generations: [] } }
    );

    // Initially no completed row → no dispatch.
    expect(
      dispatch.mock.calls
        .map(([action]: [AssistantAction]) => action)
        .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL")
    ).toHaveLength(0);

    // Settle: pending → completed.
    rerender({ generations: [completedRow] });

    const setActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL");

    expect(setActions).toHaveLength(1);
    expect(setActions[0]).toEqual({
      type: "SET_LAST_RESULT_IMAGE_URL",
      url: "https://example.com/result.png",
      generationId: "gen-1",
    });
  });

  it("AC-1: dispatches the URL of the NEWEST completed row when multiple settle in the same poll-window", () => {
    /**
     * AC-1: When a poll surfaces multiple freshly-completed rows (e.g. a
     * 4-variant batch), the dispatch carries only the URL of the newest
     * (latest createdAt). Older siblings are still marked consumed so a
     * later poll doesn't re-dispatch for them.
     */
    const dispatch = vi.fn();
    const oldRow = makeGen({
      id: "gen-old",
      status: "completed",
      imageUrl: "https://example.com/old.png",
      createdAt: new Date("2026-05-01T09:00:00Z"),
    });
    const newRow = makeGen({
      id: "gen-new",
      status: "completed",
      imageUrl: "https://example.com/new.png",
      createdAt: new Date("2026-05-01T10:00:00Z"),
    });

    renderHook(() =>
      useAssistantRuntime(
        createOptions({ dispatch, generations: [oldRow, newRow] })
      )
    );

    const setActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL");

    expect(setActions).toHaveLength(1);
    expect(setActions[0]).toMatchObject({
      type: "SET_LAST_RESULT_IMAGE_URL",
      url: "https://example.com/new.png",
      generationId: "gen-new",
    });
  });

  it("AC-1: does NOT dispatch for pending generations (only completed-with-imageUrl trigger the settle)", () => {
    const dispatch = vi.fn();
    const pendingRow = makeGen({
      id: "gen-pending",
      status: "pending",
      imageUrl: null,
    });

    renderHook(() =>
      useAssistantRuntime(
        createOptions({ dispatch, generations: [pendingRow] })
      )
    );

    expect(
      dispatch.mock.calls
        .map(([action]: [AssistantAction]) => action)
        .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL")
    ).toHaveLength(0);
  });

  it("AC-1: does NOT dispatch for completed generations without an imageUrl", () => {
    /**
     * Defensive: a row with ``status === "completed"`` but a null/empty
     * ``imageUrl`` is treated as not-yet-settled (the Replicate webhook
     * may have flipped status before the URL was written). The settle
     * effect must not dispatch for that intermediate state.
     */
    const dispatch = vi.fn();
    const noUrlRow = makeGen({
      id: "gen-nourl",
      status: "completed",
      imageUrl: null,
    });

    renderHook(() =>
      useAssistantRuntime(
        createOptions({ dispatch, generations: [noUrlRow] })
      )
    );

    expect(
      dispatch.mock.calls
        .map(([action]: [AssistantAction]) => action)
        .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL")
    ).toHaveLength(0);
  });

  it("AC-1: does NOT re-dispatch when the same completed row is re-presented on a subsequent poll", () => {
    /**
     * Idempotency: the consumed-set ref prevents a second dispatch even
     * when a later render passes the same row again (e.g. the polling
     * pipeline returns the same array on every tick). The spec says
     * EXACTLY ONCE — we prove that by re-rendering with the same row.
     */
    const dispatch = vi.fn();
    const row = makeGen({
      id: "gen-once",
      status: "completed",
      imageUrl: "https://example.com/once.png",
      createdAt: new Date("2026-05-02T08:00:00Z"),
    });

    const { rerender } = renderHook(
      (props: { generations: Generation[] }) =>
        useAssistantRuntime(
          createOptions({ dispatch, generations: props.generations })
        ),
      { initialProps: { generations: [row] } }
    );

    // First render dispatches once.
    let setActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL");
    expect(setActions).toHaveLength(1);

    // Re-render with a NEW reference but identical row contents — the
    // consumed-set ref still recognises ``gen-once`` and short-circuits.
    rerender({
      generations: [
        makeGen({
          id: "gen-once",
          status: "completed",
          imageUrl: "https://example.com/once.png",
          createdAt: new Date("2026-05-02T08:00:00Z"),
        }),
      ],
    });

    setActions = dispatch.mock.calls
      .map(([action]: [AssistantAction]) => action)
      .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL");
    expect(setActions).toHaveLength(1);
  });

  it("AC-1: settle path is a no-op when generations is null/empty (presentational tests, sheets outside WorkspaceContent)", () => {
    const dispatch = vi.fn();

    // null source.
    renderHook(() =>
      useAssistantRuntime(createOptions({ dispatch, generations: null }))
    );
    expect(
      dispatch.mock.calls
        .map(([action]: [AssistantAction]) => action)
        .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL")
    ).toHaveLength(0);

    // Empty array source.
    const dispatch2 = vi.fn();
    renderHook(() =>
      useAssistantRuntime(createOptions({ dispatch: dispatch2, generations: [] }))
    );
    expect(
      dispatch2.mock.calls
        .map(([action]: [AssistantAction]) => action)
        .filter((a: AssistantAction) => a.type === "SET_LAST_RESULT_IMAGE_URL")
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2 -- POST body builder includes ``last_result_image_url``
// ---------------------------------------------------------------------------

describe("Slice 18: useAssistantRuntime sendMessage body (AC-2)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("AC-2: sendMessage POST body includes last_result_image_url when lastResultImageUrlRef carries a URL", async () => {
    /**
     * AC-2: GIVEN ``lastResultImageUrlRef.current`` is set to a string URL
     *             AND ``usePromptAssistant().sendMessage(...)`` is invoked
     *             via the runtime hook
     *       WHEN  the POST body is built for
     *             POST /api/assistant/sessions/{id}/messages
     *       THEN  the body contains the field ``last_result_image_url``
     *             with the current ref value (snake_case to match the
     *             backend Pydantic-DTO style).
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-with-result" as string | null };
    const lastResultImageUrlRef = {
      current: "https://example.com/seed.png" as string | null,
    };

    const fetchCalls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const body = init?.body ? String(init.body) : "";
        fetchCalls.push({ url, body });

        if (url.includes("/messages")) {
          return mockSSEResponse([
            {
              event: "text-delta",
              data: JSON.stringify({ content: "Hi" }),
            },
            { event: "text-done", data: JSON.stringify({}) },
          ]);
        }
        return new Response("Not Found", { status: 404 });
      }
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useAssistantRuntime(
        createOptions({
          dispatch,
          sessionIdRef,
          lastResultImageUrlRef,
        })
      )
    );

    await act(async () => {
      await result.current.sendMessage("Was hältst du davon?");
    });

    const messageCall = fetchCalls.find((c) => c.url.includes("/messages"));
    expect(messageCall).toBeDefined();

    const parsed = JSON.parse(messageCall!.body);
    expect(parsed.last_result_image_url).toBe("https://example.com/seed.png");
    expect(parsed.content).toBe("Was hältst du davon?");
  });

  it("AC-2: sendMessage POST body OMITS last_result_image_url when ref is null", async () => {
    /**
     * AC-2: GIVEN ``lastResultImageUrlRef.current === null``
     *       WHEN  the POST body is built
     *       THEN  the field ``last_result_image_url`` is OMITTED entirely
     *             (chosen pattern per spec, mirroring existing
     *             ``project_id`` / ``image_urls`` / ``image_model_id``
     *             optionality).
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-no-result" as string | null };
    const lastResultImageUrlRef = { current: null as string | null };

    const fetchCalls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const body = init?.body ? String(init.body) : "";
        fetchCalls.push({ url, body });

        if (url.includes("/messages")) {
          return mockSSEResponse([
            { event: "text-done", data: JSON.stringify({}) },
          ]);
        }
        return new Response("Not Found", { status: 404 });
      }
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useAssistantRuntime(
        createOptions({
          dispatch,
          sessionIdRef,
          lastResultImageUrlRef,
        })
      )
    );

    await act(async () => {
      await result.current.sendMessage("Hallo");
    });

    const messageCall = fetchCalls.find((c) => c.url.includes("/messages"));
    expect(messageCall).toBeDefined();
    const parsed = JSON.parse(messageCall!.body);

    // Field MUST be absent (chosen pattern: omit when null/empty).
    expect(parsed).not.toHaveProperty("last_result_image_url");
    expect(parsed.content).toBe("Hallo");
  });

  it("AC-2: sendMessage POST body OMITS last_result_image_url when ref is undefined / not provided", async () => {
    /**
     * Defensive: when the consumer omits ``lastResultImageUrlRef`` (e.g.
     * presentational tests) the body builder must not crash and the
     * field must not appear.
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-no-ref" as string | null };

    const fetchCalls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const body = init?.body ? String(init.body) : "";
        fetchCalls.push({ url, body });

        if (url.includes("/messages")) {
          return mockSSEResponse([
            { event: "text-done", data: JSON.stringify({}) },
          ]);
        }
        return new Response("Not Found", { status: 404 });
      }
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useAssistantRuntime(
        createOptions({ dispatch, sessionIdRef })
        // no lastResultImageUrlRef
      )
    );

    await act(async () => {
      await result.current.sendMessage("Test");
    });

    const messageCall = fetchCalls.find((c) => c.url.includes("/messages"));
    expect(messageCall).toBeDefined();
    const parsed = JSON.parse(messageCall!.body);
    expect(parsed).not.toHaveProperty("last_result_image_url");
  });

  it("AC-2: sendMessage POST body picks up the LATEST ref value at request-build time (ref-pattern)", async () => {
    /**
     * AC-2 (ref-pattern intent): the runtime reads the ref at
     * request-build time, not at hook-mount time. We prove this by
     * mounting the hook with a null ref, mutating the ref BEFORE
     * sendMessage is called, and asserting the body carries the new
     * URL.
     */
    const dispatch = vi.fn();
    const sessionIdRef = { current: "session-late-ref" as string | null };
    const lastResultImageUrlRef = { current: null as string | null };

    const fetchCalls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const body = init?.body ? String(init.body) : "";
        fetchCalls.push({ url, body });
        if (url.includes("/messages")) {
          return mockSSEResponse([
            { event: "text-done", data: JSON.stringify({}) },
          ]);
        }
        return new Response("Not Found", { status: 404 });
      }
    ) as typeof fetch;

    const { result } = renderHook(() =>
      useAssistantRuntime(
        createOptions({
          dispatch,
          sessionIdRef,
          lastResultImageUrlRef,
        })
      )
    );

    // Mutate the ref AFTER mount but BEFORE sendMessage — this is what
    // the production assistant-context provider does on every render
    // pass when ``state.lastResultImageUrl`` updates.
    lastResultImageUrlRef.current = "https://example.com/late.png";

    await act(async () => {
      await result.current.sendMessage("Refine bitte");
    });

    const messageCall = fetchCalls.find((c) => c.url.includes("/messages"));
    expect(messageCall).toBeDefined();
    const parsed = JSON.parse(messageCall!.body);
    expect(parsed.last_result_image_url).toBe("https://example.com/late.png");
  });
});
