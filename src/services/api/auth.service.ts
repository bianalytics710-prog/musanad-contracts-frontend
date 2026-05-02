/**
 * Musanad — Auth API service.
 *
 * Thin axios wrappers around the M0 /api/v1/auth/* endpoints. All
 * paths and shapes derived from `api-contracts.json` (Agent 5 output).
 *
 * The api-client interceptor handles JWT, X-Request-ID, refresh, and
 * error normalisation — these methods only care about the wire shapes.
 */

import { apiClient } from "@/lib/api-client";
import type {
  LoginDto,
  LoginResponse,
  LogoutDto,
  LogoutResponse,
  RefreshResponse,
  RefreshTokenDto,
} from "@/types/api.types";

export const authService = {
  /**
   * POST /api/v1/auth/login
   * Returns an access (15m) + refresh (7d) JWT pair plus the user profile.
   */
  login: async (payload: LoginDto): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>("/api/v1/auth/login", payload);
    return data;
  },

  /**
   * POST /api/v1/auth/logout
   * Blacklists the refresh token so future /auth/refresh calls fail.
   * The access token is checked for authentication only.
   */
  logout: async (payload: LogoutDto): Promise<LogoutResponse> => {
    const { data } = await apiClient.post<LogoutResponse>("/api/v1/auth/logout", payload);
    return data;
  },

  /**
   * POST /api/v1/auth/refresh
   * Exchanges a valid refresh token for a NEW pair (rotation).
   * Used directly only by api-client; UI code never calls this.
   */
  refresh: async (payload: RefreshTokenDto): Promise<RefreshResponse> => {
    const { data } = await apiClient.post<RefreshResponse>(
      "/api/v1/auth/refresh",
      payload,
    );
    return data;
  },
};

export default authService;
