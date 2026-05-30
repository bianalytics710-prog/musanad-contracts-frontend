/**
 * Unit test — F-FE-001: contract-export.service routes through apiClient
 * and benefits from the 401 → refresh → retry rotation pipeline.
 *
 * Before F-FE-001 the export service called `fetch()` directly with a
 * manually-attached Authorization header, completely bypassing the shared
 * apiClient response interceptor. A 401 mid-export silently failed instead
 * of triggering the silent refresh that every other authenticated call
 * relies on.
 *
 * This test verifies the post-fix contract:
 *   - exportPdf() / exportXlsx() go through the shared apiClient.
 *   - When the BE returns 401, the bare `axios.post('/auth/refresh')` is
 *     invoked exactly once (interceptor refresh).
 *   - The original GET is retried with the rotated access token.
 *   - The Blob is delivered to the caller.
 *
 * Strategy mirrors api-client.test.ts (CRX-9): install a custom adapter on
 * the apiClient that returns 401 first, then 200 with a Blob; stub
 * axios.post so the refresh resolves with rotated tokens.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from "axios";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import { contractExportService } from "@/services/api/contract-export.service";

const NEW_ACCESS = "rotated-access-token-export";
const NEW_REFRESH = "rotated-refresh-token-export";

describe("contractExportService — F-FE-001 401-then-refresh-then-retry via apiClient", () => {
  let originalAdapter: AxiosAdapter | undefined;

  beforeEach(() => {
    useAuthStore.getState().applyLogin({
      accessToken: "stale-access-token",
      refreshToken: "stale-refresh-token",
      user: {
        id: 1,
        email: "admin@musanad.local",
        firstName: "System",
        lastName: "Admin",
        role: { id: 1, name: "Super Admin" },
        permissions: ["contract.export"],
        effectiveModules: ["admin", "contracts.browse", "insights_hub"],
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

  it("exportPdf: handles 401 by refreshing and retrying with the new token", async () => {
    const callCount = new Map<string, number>();
    const adapter: AxiosAdapter = (config) => {
      const url = config.url ?? "";
      const n = (callCount.get(url) ?? 0) + 1;
      callCount.set(url, n);

      const auth =
        config.headers && typeof (config.headers as Record<string, unknown>).get === "function"
          ? (config.headers as { get: (k: string) => string | null }).get("Authorization")
          : ((config.headers as Record<string, string>)?.Authorization ?? null);

      if (n === 1) {
        // First attempt → 401.
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

      // Retry → 200 with a Blob payload + Content-Disposition + Content-Type.
      const blob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], {
        type: "application/pdf",
      });
      return Promise.resolve<AxiosResponse>({
        status: 200,
        statusText: "OK",
        data: blob,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="contract-42.pdf"',
          "x-auth-seen": auth ?? "",
        },
        config,
      } as AxiosResponse);
    };
    apiClient.defaults.adapter = adapter;

    const postSpy = vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      statusText: "OK",
      data: { accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH },
      headers: {},
      config: {} as never,
    } as AxiosResponse);

    const { blob, headers } = await contractExportService.exportPdf(42, { language: "bilingual" });

    // Refresh fired exactly once (the dedup pipeline).
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0]?.[0]).toContain("/api/v1/auth/refresh");

    // Original GET was retried after refresh (n === 2 in the adapter).
    const exportUrl = Array.from(callCount.keys()).find((u) =>
      u.includes("/contracts/42/export.pdf"),
    );
    expect(exportUrl).toBeDefined();
    expect(callCount.get(exportUrl as string)).toBe(2);

    // The retry carried the rotated access token.
    expect(headers.get("x-auth-seen")).toBe(`Bearer ${NEW_ACCESS}`);

    // Blob made it back to the caller intact.
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");

    // Auth store now holds the rotated pair.
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe(NEW_ACCESS);
    expect(s.refreshToken).toBe(NEW_REFRESH);
  });

  it("exportXlsx: same 401 → refresh → retry path, preserves responseType:blob", async () => {
    const callCount = new Map<string, number>();
    const adapter: AxiosAdapter = (config) => {
      const url = config.url ?? "";
      const n = (callCount.get(url) ?? 0) + 1;
      callCount.set(url, n);

      if (n === 1) {
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

      // The retry MUST still carry responseType:'blob' — otherwise axios
      // would JSON-parse the response and corrupt the workbook bytes.
      // Assert that explicitly: response config preserves responseType.
      expect(config.responseType).toBe("blob");

      const xlsxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP magic.
      const blob = new Blob([xlsxBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      return Promise.resolve<AxiosResponse>({
        status: 200,
        statusText: "OK",
        data: blob,
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": 'attachment; filename="contracts.xlsx"',
        },
        config,
      } as AxiosResponse);
    };
    apiClient.defaults.adapter = adapter;

    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      statusText: "OK",
      data: { accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH },
      headers: {},
      config: {} as never,
    } as AxiosResponse);

    const { blob } = await contractExportService.exportXlsx({ search: "test" });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const xlsxUrl = Array.from(callCount.keys()).find((u) => u.includes("/contracts/export.xlsx"));
    expect(xlsxUrl).toBeDefined();
    expect(callCount.get(xlsxUrl as string)).toBe(2);
  });
});
