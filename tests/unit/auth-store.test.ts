import { describe, expect, it, beforeEach } from "vitest";
import { useAuthStore } from "@/store/auth.store";
import type { LoginResponse } from "@/types/api.types";

const sampleUser: LoginResponse = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: {
    id: 1,
    email: "admin@musanad.local",
    firstName: "System",
    lastName: "Admin",
    role: { id: 1, name: "Super Admin" },
    permissions: ["user.manage", "user.read.all"],
  },
};

describe("auth.store", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it("starts unauthenticated", () => {
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it("applyLogin populates user + tokens + isAuthenticated", () => {
    useAuthStore.getState().applyLogin(sampleUser);
    const s = useAuthStore.getState();
    expect(s.user?.email).toBe("admin@musanad.local");
    expect(s.accessToken).toBe("access-1");
    expect(s.refreshToken).toBe("refresh-1");
    expect(s.isAuthenticated).toBe(true);
  });

  it("setTokens overwrites BOTH tokens (refresh-rotation safety)", () => {
    useAuthStore.getState().applyLogin(sampleUser);
    useAuthStore
      .getState()
      .setTokens({ accessToken: "access-2", refreshToken: "refresh-2" });
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("access-2");
    expect(s.refreshToken).toBe("refresh-2");
    // Refresh token rotation: old refresh token must be discarded.
    expect(s.refreshToken).not.toBe("refresh-1");
  });

  it("logout clears all auth fields", () => {
    useAuthStore.getState().applyLogin(sampleUser);
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });
});
