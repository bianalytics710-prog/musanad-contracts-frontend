/**
 * Musanad — Contract Export API service (M1b S4 PDF, S5 XLSX).
 *
 * Both endpoints return binary streams (application/pdf and
 * application/vnd.openxmlformats…sheet). This service routes through the
 * shared apiClient so every export benefits from:
 *   - Authorization header + X-Request-ID injection
 *   - 401 → silent refresh-token rotation → retry (api-client.ts response
 *     interceptor). Previously this service used `fetch()` directly, which
 *     bypassed the rotation pipeline (Codex F-FE-001 — HIGH).
 *   - Normalised ApiError shape on failure, identical to every other service.
 *
 * Binary handling: axios `responseType: 'blob'` returns a Blob in
 * `response.data`. The `transformResponse: []` override prevents axios from
 * attempting JSON.parse on the blob (which would mangle PDF/XLSX bytes).
 *
 * On a 4xx error with `responseType: 'blob'`, axios still wraps the response
 * with the body as a Blob. The api-client interceptor normalises that into an
 * `ApiError`; if the BE included a JSON `{success:false,error:{...}}`
 * envelope as the body it will be visible via the AxiosError, but not parsed
 * automatically. That's acceptable — the dialog/button onError handlers run
 * `translateApiError(err, t, 'errors.export.<code>')` which maps the HTTP
 * status to a user-facing string regardless of whether the JSON envelope was
 * surfaced.
 *
 * Returns a tuple of `(Blob, ResponseHeaders)` so the caller (the dialog or
 * button component) can derive the filename from Content-Disposition via
 * `format-blob-download.ts`.
 *
 * Caveat — refresh-token rotation with responseType:'blob': verified that
 * api-client.ts re-issues `apiClient.request(config)` with the original
 * config, including responseType. As of M0 the interceptor preserves the
 * config verbatim on retry, so the rotation works for blobs. If the
 * interceptor is later refactored, add an integration test for this path.
 */

import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import { apiClient } from "@/lib/api-client";
import type {
  ContractExportPdfQuery,
  ContractExportXlsxQueryParams,
} from "@/types/entities/payment-schedule.types";

/**
 * Public surface for an export error — kept for backwards compatibility with
 * components that already check `instanceof ExportError`. After the F-FE-001
 * migration to apiClient, errors thrown by this service are `ApiError`
 * instances (from `@/lib/api-client`), not `ExportError`. The class is
 * retained so existing imports compile, but new code should rely on
 * `translateApiError(err, t, ...)` which understands both shapes.
 *
 * @deprecated Errors from this service are now `ApiError` (api-client.ts).
 */
export class ExportError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  }) {
    super(args.message);
    this.name = "ExportError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details ?? null;
  }
}

/** Convert axios's header dictionary to a Web `Headers` instance — keeps the
 * `format-blob-download.ts` helper unchanged (it expects `Headers`). */
function headersToWeb(
  axiosHeaders: AxiosResponseHeaders | RawAxiosResponseHeaders | undefined,
): Headers {
  const out = new Headers();
  if (!axiosHeaders) return out;
  // AxiosResponseHeaders is iterable via Object.entries when raw; for the
  // rich AxiosHeaders class it exposes `.toJSON()`. Defensively flatten both.
  const maybeToJson = (axiosHeaders as { toJSON?: () => Record<string, unknown> }).toJSON;
  const dict =
    typeof maybeToJson === "function"
      ? maybeToJson.call(axiosHeaders)
      : (axiosHeaders as Record<string, unknown>);
  for (const [k, v] of Object.entries(dict)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        out.append(k, String(item));
      }
      continue;
    }
    out.set(k, String(v));
  }
  return out;
}

/**
 * Append a search-params object as `?key=value&...`. Handles arrays
 * (`tags=a&tags=b`) and skips undefined / null / empty-string values.
 */
function buildSearchParams(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        params.append(k, String(item));
      }
      continue;
    }
    params.append(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Common request lifecycle for both PDF + XLSX endpoints. Goes through the
 * shared apiClient so 401 → refresh → retry works (F-FE-001).
 */
async function fetchBinary(
  url: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; headers: Headers }> {
  // `responseType: 'blob'` makes axios deliver the body as a Blob.
  // `transformResponse: []` prevents the default JSON.parse pipeline from
  // running against the Blob (which would corrupt binary data).
  // `Accept` overrides the JSON default so the BE can negotiate the right
  // Content-Type for PDF / XLSX endpoints.
  const response = await apiClient.get<Blob>(url, {
    responseType: "blob",
    transformResponse: [],
    signal,
    headers: {
      Accept:
        "application/octet-stream, application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
  return {
    blob: response.data,
    headers: headersToWeb(response.headers),
  };
}

export const contractExportService = {
  /**
   * S4 — GET /api/v1/contracts/:id/export.pdf
   * Returns the rendered PDF as a Blob plus the response headers (so the
   * caller can read Content-Disposition for the filename).
   */
  exportPdf: async (
    contractId: number,
    query: ContractExportPdfQuery = {},
    signal?: AbortSignal,
  ): Promise<{ blob: Blob; headers: Headers }> => {
    const url = `/api/v1/contracts/${contractId}/export.pdf${buildSearchParams(query as Record<string, unknown>)}`;
    return fetchBinary(url, signal);
  },

  /**
   * S5 — GET /api/v1/contracts/export.xlsx
   * Returns the rendered XLSX as a Blob plus the response headers. The
   * caller passes the same filter set that's currently active on the
   * ContractListView. Header `X-Export-Truncated: true` may appear when the
   * filter would have yielded more than maxRows — the caller can show a
   * banner.
   */
  exportXlsx: async (
    query: ContractExportXlsxQueryParams = {},
    signal?: AbortSignal,
  ): Promise<{ blob: Blob; headers: Headers }> => {
    const url = `/api/v1/contracts/export.xlsx${buildSearchParams(query as Record<string, unknown>)}`;
    return fetchBinary(url, signal);
  },
};

export default contractExportService;
