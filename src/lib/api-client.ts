/**
 * Musanad — Axios HTTP client.
 *
 * Single shared axios instance used by every service module and React
 * Query hook. Never instantiate another axios.create() — feature
 * modules import this and only this.
 *
 * Behaviour:
 *  - Reads VITE_API_BASE_URL from import.meta.env (default localhost:4000).
 *  - Attaches `Authorization: Bearer <accessToken>` from the auth store
 *    on every outgoing request.
 *  - Generates an X-Request-ID per request (UUID v4 via crypto.randomUUID).
 *  - On 401: attempts a one-time silent refresh via POST /auth/refresh.
 *    Refresh-token rotation: BE returns BOTH tokens; we overwrite both.
 *    On refresh failure, clears the auth store and lets the caller
 *    handle the redirect to /auth/login (the ProtectedRoute does this).
 *  - Error normalisation: axios errors are wrapped into ApiError so
 *    callers always see the same shape regardless of network/HTTP/CORS.
 *
 * The refresh logic is queue-aware: concurrent 401s after token expiry
 * share a single refresh promise so we don't issue N refresh requests.
 */

import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ErrorResponse, RefreshResponse } from "@/types/api.types";
import { useAuthStore } from "@/store/auth.store";

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "http://localhost:4000";

function getBaseUrl(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return env && env.trim() !== "" ? env : DEFAULT_BASE_URL;
}

const REQUEST_TIMEOUT_MS = 30_000;

// Endpoints we never attempt to refresh against — refreshing on these
// would deadlock the queue and is never the right answer.
const SKIP_REFRESH_PATHS: readonly string[] = [
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/logout",
];

// ─── ApiError — normalised error shape ────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | null;
  readonly requestId: string | undefined;

  constructor(args: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
    requestId?: string;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details ?? null;
    this.requestId = args.requestId;
  }
}

function isErrorResponseBody(value: unknown): value is ErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.success === false && typeof v.error === "object" && v.error !== null;
}

function normaliseAxiosError(err: AxiosError): ApiError {
  const status = err.response?.status ?? 0;
  const requestId =
    (err.response?.headers as Record<string, string | undefined> | undefined)?.[
      "x-request-id"
    ];
  const body = err.response?.data;

  if (isErrorResponseBody(body)) {
    return new ApiError({
      status,
      code: body.error.code,
      message: body.error.message,
      details: body.error.details ?? null,
      requestId: body.requestId ?? requestId,
    });
  }

  if (err.code === "ECONNABORTED") {
    return new ApiError({
      status: 0,
      code: "TIMEOUT",
      message: "The request took too long to complete.",
    });
  }

  if (!err.response) {
    return new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Unable to reach the server. Check your connection.",
    });
  }

  return new ApiError({
    status,
    code: status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR",
    message: err.message || `Request failed with status ${status}.`,
    requestId,
  });
}

// ─── Axios instance ───────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── Request interceptor — Authorization + X-Request-ID ───────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers);

  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (!headers.get("X-Request-ID")) {
    headers.set("X-Request-ID", generateRequestId());
  }

  config.headers = headers;
  return config;
});

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Cryptographically-weak fallback for environments without crypto.randomUUID.
  return `req-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

// ─── Refresh queue ────────────────────────────────────────────────────────────

let inflightRefresh: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    throw new ApiError({
      status: 401,
      code: "NO_REFRESH_TOKEN",
      message: "No refresh token available; re-authentication required.",
    });
  }

  // We use a bare axios call (NOT the apiClient) to avoid recursive
  // interceptor logic on the refresh request itself.
  try {
    const { data } = await axios.post<RefreshResponse>(
      `${getBaseUrl()}/api/v1/auth/refresh`,
      { refreshToken },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Request-ID": generateRequestId(),
        },
      },
    );

    // Refresh-token rotation: overwrite BOTH tokens.
    useAuthStore.getState().setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  } catch (err) {
    // Refresh failed — clear the session and bubble up.
    useAuthStore.getState().logout();
    if (err instanceof AxiosError) {
      throw normaliseAxiosError(err);
    }
    throw err;
  }
}

function refreshOnce(): Promise<string> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = performRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

// ─── Response interceptor — error normalisation + silent refresh on 401 ───────

interface RetryableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (
      status === 401 &&
      config &&
      !config._retried &&
      !shouldSkipRefresh(config.url)
    ) {
      config._retried = true;
      try {
        const newAccess = await refreshOnce();
        const rawHeaders = config.headers as unknown;
        const headers =
          rawHeaders instanceof AxiosHeaders
            ? rawHeaders
            : AxiosHeaders.from(rawHeaders as Record<string, string> | undefined);
        headers.set("Authorization", `Bearer ${newAccess}`);
        config.headers = headers;
        return apiClient.request(config);
      } catch (refreshErr) {
        // Refresh failed; surface the original 401 to the caller normalised.
        return Promise.reject(
          refreshErr instanceof ApiError ? refreshErr : normaliseAxiosError(error),
        );
      }
    }

    return Promise.reject(normaliseAxiosError(error));
  },
);

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return SKIP_REFRESH_PATHS.some((p) => url.endsWith(p) || url.includes(p));
}

// ─── Convenience extractor ────────────────────────────────────────────────────

/**
 * Some BE endpoints wrap responses in `{ success: true, data: T }` while
 * others return T directly. This helper unwraps the envelope when present
 * and otherwise returns the raw body.
 */
export function unwrap<T>(body: unknown): T {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    "success" in body &&
    (body as { success: unknown }).success === true
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export default apiClient;
