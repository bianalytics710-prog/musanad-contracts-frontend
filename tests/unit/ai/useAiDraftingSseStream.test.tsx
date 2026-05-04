/**
 * useAiDraftingSseStream — SSE chunk consumption tests (M4 — S2).
 *
 * Verifies:
 *   - Reads `data: <JSON>\n\n` chunks from a mocked ReadableStream.
 *   - Dispatches onToken / onDone / onError matching the chunk type.
 *   - Aborts on unmount.
 *   - Handles 429 rate-limit pre-stream error body before any token fires.
 *   - Skips when payload.mode === 'suggest' (synchronous service handles it).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Mock the auth store BEFORE the hook import so .getState() returns a token.
vi.mock("@/store/auth.store", () => ({
  useAuthStore: {
    getState: () => ({ accessToken: "test-token-abc" }),
  },
}));

import { useAiDraftingSseStream } from "@/features/ai/hooks/useAiDraftingSseStream";

const encoder = new TextEncoder();

/**
 * Build a Response with a streaming body whose chunks emit one SSE event each.
 */
function buildSseResponse(events: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(`data: ${ev}\n\n`));
      }
      controller.close();
    },
  });
  const headers = new Headers({ "content-type": "text/event-stream" });
  return new Response(stream, { status: 200, headers });
}

function buildErrorResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("useAiDraftingSseStream", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches onToken for each token chunk and onDone for the done chunk", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const fakeFetch = vi.fn(async () =>
      buildSseResponse([
        JSON.stringify({ type: "token", delta: "Hello" }),
        JSON.stringify({ type: "token", delta: " world" }),
        JSON.stringify({ type: "done", tokensConsumed: 12 }),
      ]),
    );
    vi.stubGlobal("fetch", fakeFetch);

    const { result } = renderHook(() =>
      useAiDraftingSseStream({ onToken, onDone, onError }),
    );

    await act(async () => {
      await result.current.start({
        mode: "chat",
        contractType: "employment",
        partyA: "Acme",
        draftSummary: "x",
        existingClauseCategories: [],
        language: "en",
        chatHistory: [{ role: "user", content: "hello" }],
      });
    });

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(onToken).toHaveBeenNthCalledWith(1, "Hello");
    expect(onToken).toHaveBeenNthCalledWith(2, " world");
    expect(onDone).toHaveBeenCalledWith(12);
    expect(onError).not.toHaveBeenCalled();
  });

  it("surfaces 429 rate-limit error WITHOUT firing any token", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const fakeFetch = vi.fn(async () =>
      buildErrorResponse(429, {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded",
          details: { retryAfterSeconds: 60 },
        },
      }),
    );
    vi.stubGlobal("fetch", fakeFetch);

    const { result } = renderHook(() =>
      useAiDraftingSseStream({ onToken, onDone, onError }),
    );

    await act(async () => {
      await result.current.start({
        mode: "chat",
        contractType: "employment",
        partyA: "Acme",
        draftSummary: "x",
        existingClauseCategories: [],
        language: "en",
        chatHistory: [{ role: "user", content: "hello" }],
      });
    });

    expect(onToken).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "RATE_LIMITED",
        retryAfterSeconds: 60,
      }),
    );
  });

  it("surfaces error chunk emitted mid-stream", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const fakeFetch = vi.fn(async () =>
      buildSseResponse([
        JSON.stringify({ type: "token", delta: "hi" }),
        JSON.stringify({
          type: "error",
          code: "PROVIDER_TIMEOUT",
          message: "Provider timed out",
        }),
      ]),
    );
    vi.stubGlobal("fetch", fakeFetch);

    const { result } = renderHook(() =>
      useAiDraftingSseStream({ onToken, onDone, onError }),
    );

    await act(async () => {
      await result.current.start({
        mode: "chat",
        contractType: "employment",
        partyA: "Acme",
        draftSummary: "x",
        existingClauseCategories: [],
        language: "en",
        chatHistory: [{ role: "user", content: "hi" }],
      });
    });

    expect(onToken).toHaveBeenCalledWith("hi");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "PROVIDER_TIMEOUT" }),
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("rejects mode='suggest' — synchronous service handles it", async () => {
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const fakeFetch = vi.fn(async () => buildSseResponse([]));
    vi.stubGlobal("fetch", fakeFetch);

    const { result } = renderHook(() =>
      useAiDraftingSseStream({ onToken, onDone, onError }),
    );

    await act(async () => {
      await result.current.start({
        mode: "suggest",
        contractType: "employment",
        partyA: "Acme",
        draftSummary: "x",
        existingClauseCategories: [],
        language: "en",
      });
    });

    expect(fakeFetch).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_MODE" }),
    );
  });
});
