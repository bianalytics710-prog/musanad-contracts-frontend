/**
 * Musanad — Auth store (Zustand).
 *
 * Holds the active user, access token, and refresh token. Persisted to
 * localStorage under `musanad_auth` so the session survives page reloads.
 *
 * SECURITY NOTES
 * - Tokens are persisted to localStorage. This is a deliberate trade-off
 *   for SPA-style refresh UX. CSP and HttpOnly cookies are stronger; we
 *   compensate by short-lived access tokens (15m) plus refresh-token
 *   rotation on every /auth/refresh call (api-contracts.json).
 * - Plaintext password is NEVER stored — only `LoginDto.password` ever
 *   touches memory transiently and is dropped after the mutation resolves.
 * - On every /auth/refresh, the BE returns a NEW refresh token along with
 *   a new access token. We OVERWRITE the stored refresh token with the
 *   new one. Reusing the old refresh token after rotation returns 401
 *   (per OWASP / RFC 6749 best practice).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser, LoginResponse } from "@/types/api.types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  /** Replace the entire auth slice from a successful login response. */
  applyLogin: (response: LoginResponse) => void;
  /**
   * Replace BOTH tokens after a successful /auth/refresh call.
   * MUST be called every refresh — old refresh token is invalid afterwards.
   */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  /** Update user profile (e.g. after a /me read or self-update). */
  setUser: (user: AuthUser) => void;
  /** Clear the session — used by logout and refresh failures. */
  logout: () => void;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
};

const STORAGE_KEY = "musanad_auth";

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      applyLogin: (response) => {
        set({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          isAuthenticated: true,
        });
      },

      setTokens: ({ accessToken, refreshToken }) => {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setUser: (user) => {
        set({ user });
      },

      logout: () => {
        set({ ...initialState });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist only what we need — never any transient password buffer.
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

/**
 * Plain-function selectors keep the auth slice tree-shakeable and avoid
 * subscribing components to fields they don't read.
 */
export const selectAccessToken = (s: AuthStore): string | null => s.accessToken;
export const selectRefreshToken = (s: AuthStore): string | null => s.refreshToken;
export const selectUser = (s: AuthStore): AuthUser | null => s.user;
export const selectIsAuthenticated = (s: AuthStore): boolean => s.isAuthenticated;

/**
 * Returns true when the active user has the named permission code
 * (e.g. "user.manage", "audit.read"). Matches BE authorise() middleware.
 */
export const selectHasPermission = (code: string) => (s: AuthStore): boolean => {
  if (!s.user) return false;
  return s.user.permissions.includes(code);
};

/**
 * Synchronous, race-proof read of the persisted auth slice straight from
 * localStorage.  Zustand's `persist` middleware rehydrates the in-memory
 * store via a microtask, so `useAuthStore.getState()` returns the initial
 * (unauthenticated) state on the very first synchronous tick after a cold
 * page load. TanStack Router's `beforeLoad` runs in that same tick, so the
 * /app/* gate would false-redirect to /auth/login.
 *
 * This helper bypasses Zustand and reads `localStorage[STORAGE_KEY]`
 * directly so guards can make a correct decision regardless of hydration
 * timing. Returns null on SSR, missing key, or parse failure.
 */
export function readPersistedAuthSnapshot(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<AuthState> } | null;
    const state = parsed?.state;
    if (!state) return null;
    return {
      user: state.user ?? null,
      accessToken: state.accessToken ?? null,
      refreshToken: state.refreshToken ?? null,
      isAuthenticated: !!state.isAuthenticated,
    };
  } catch {
    return null;
  }
}
