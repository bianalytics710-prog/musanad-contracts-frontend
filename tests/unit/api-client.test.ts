/**
 * Unit test — concurrent-401 in-flight refresh dedup (CRX-9).
 *
 * The api-client uses a single shared `inflightRefresh` promise so that when
 * multiple authenticated requests fail with 401 simultaneously (e.g. several
 * panels on the dashboard fetch in parallel right when the access token
 * expires), only ONE call hits POST /auth/refresh. Every queued request then
 * retries with the rotated access token.
 *
 * This test verifies that contract:
 *  - 3 concurrent GETs return 401 within the same tick.
 *  - The bare axios.post('/auth/refresh') is invoked exactly ONCE.
 *  - All 3 original requests are retried with the NEW access token.
 *  - The auth store ends up with the rotated (access, refresh) pair.
 *
 * Strategy: install a tiny custom adapter on the `apiClient` instance to
 * simulate 401-then-200 per request, and stub `axios.post` so the refresh
 * call resolves after a 50ms delay (long enough to ensure all three 401s
 * land before the refresh resolves).
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";

const NEW_ACCESS = "rotated-access-token";
const NEW_REFRESH = "rotated-refresh-token";

describe("apiClient — concurrent-401 in-flight refresh dedup (CRX-9)", () => {
  let originalAdapter: AxiosAdapter | undefined;

  beforeEach(() => {
    // Seed the store with an initial token pair so the request interceptor
    // attaches Authorization, and so we can assert rotation afterwards.
    useAuthStore.getState().applyLogin({
      accessToken: "stale-access-token",
      refreshToken: "stale-refresh-token",
      user: {
        id: 1,
        email: "admin@musanad.local",
        firstName: "System",
        lastName: "Admin",
        role: { id: 1, name: "Super Admin" },
        permissions: ["user.manage"],
      },
    });
    originalAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it("dedups concurrent 401s: only ONE refresh request, all originals retried with new token", async () => {
    // Track per-URL retry count: first call → 401, subsequent → 200.
    const callsByUrl = new Map<string, number>();
    const adapter: AxiosAdapter = (config) => {
      const url = config.url ?? "";
      const n = (callsByUrl.get(url) ?? 0) + 1;
      callsByUrl.set(url, n);

      // Read the Authorization header off the request so we can assert
      // retries went out with the rotated token.
      const auth =
        config.headers && typeof (config.headers as Record<string, unknown>).get === "function"
          ? (config.headers as { get: (k: string) => string | null }).get("Authorization")
          : ((config.headers as Record<string, string>)?.Authorization ?? null);

      if (n === 1) {
        // First attempt → 401. Build a real-shaped AxiosError.
        const err = new AxiosError(
          "Request failed with status code 401",
          "ERR_BAD_REQUEST",
          config,
          null,
          {
            status: 401,
            statusText: "Unauthorized",
            data: { success: false, error: { code: "TOKEN_EXPIRED", message: "expired" } },
            headers: {},
            config,
          } as AxiosResponse,
        );
        return Promise.reject(err);
      }

      // Retry attempt → 200, echo back the auth header so the test can assert.
      return Promise.resolve<AxiosResponse>({
        status: 200,
        statusText: "OK",
        data: { ok: true, urlSeen: url, authSeen: auth },
        headers: {},
        config,
      } as AxiosResponse);
    };
    apiClient.defaults.adapter = adapter;

    // Spy on axios.post — the bare axios call performRefresh() makes — and
    // resolve after a 50ms delay so the 3 concurrent 401s all queue up
    // behind the same in-flight promise.
    const postSpy = vi.spyOn(axios, "post").mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 200,
              statusText: "OK",
              data: { accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH },
              headers: {},
              config: {} as never,
            } as AxiosResponse);
          }, 50);
        }),
    );

    // Fire 3 concurrent requests. Each hits a different URL so we can prove
    // each one was retried independently.
    const [r1, r2, r3] = await Promise.all([
      apiClient.get<{ ok: boolean; urlSeen: string; authSeen: string | null }>("/api/v1/users"),
      apiClient.get<{ ok: boolean; urlSeen: string; authSeen: string | null }>("/api/v1/roles"),
      apiClient.get<{ ok: boolean; urlSeen: string; authSeen: string | null }>("/api/v1/me"),
    ]);

    // Exactly ONE call to /auth/refresh — the dedup contract.
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0]?.[0]).toContain("/api/v1/auth/refresh");
    expect(postSpy.mock.calls[0]?.[1]).toEqual({ refreshToken: "stale-refresh-token" });

    // All 3 original requests succeeded on retry.
    expect(r1.data.ok).toBe(true);
    expect(r2.data.ok).toBe(true);
    expect(r3.data.ok).toBe(true);

    // Each was retried (n === 2 on the adapter).
    expect(callsByUrl.get("/api/v1/users")).toBe(2);
    expect(callsByUrl.get("/api/v1/roles")).toBe(2);
    expect(callsByUrl.get("/api/v1/me")).toBe(2);

    // Each retry carried the ROTATED access token in Authorization.
    expect(r1.data.authSeen).toBe(`Bearer ${NEW_ACCESS}`);
    expect(r2.data.authSeen).toBe(`Bearer ${NEW_ACCESS}`);
    expect(r3.data.authSeen).toBe(`Bearer ${NEW_ACCESS}`);

    // Auth store is now holding the new pair (rotation persisted).
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe(NEW_ACCESS);
    expect(s.refreshToken).toBe(NEW_REFRESH);
    expect(s.refreshToken).not.toBe("stale-refresh-token");
  });
});
