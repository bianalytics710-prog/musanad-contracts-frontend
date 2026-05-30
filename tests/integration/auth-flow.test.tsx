/**
 * Integration test: LoginForm submission updates the auth store.
 *
 * We mock the auth service so this test does not hit the BE. The router
 * is mocked too — TanStack Router's full Outlet machinery is overkill
 * here; we only care that on success, `applyLogin` populates the store.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/i18n"; // initialise i18n side-effect for the tests

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    Link: ({ children, ...rest }: { children: React.ReactNode; to?: string; className?: string }) => (
      <a {...rest}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("@/services/api/auth.service", () => {
  const stub = {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  };
  return { authService: stub, default: stub };
});

import { LoginForm } from "@/components/auth/LoginForm";
import { authService } from "@/services/api/auth.service";
import { useAuthStore } from "@/store/auth.store";

function renderForm() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
    vi.clearAllMocks();
  });

  it("renders email + password labels and a submit button", () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    // The form-submit button is the second button labelled "Sign in"
    // (the first is the UAE Pass CTA). Pick the submit by type.
    const submit = screen
      .getAllByRole("button")
      .find((b) => (b as HTMLButtonElement).type === "submit");
    expect(submit).toBeTruthy();
  });

  it("calls authService.login on submit and populates the auth store", async () => {
    const user = userEvent.setup();
    const loginMock = vi
      .mocked(authService.login)
      .mockResolvedValueOnce({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
          id: 7,
          email: "admin@musanad.local",
          firstName: "System",
          lastName: "Admin",
          role: { id: 1, name: "Super Admin" },
          permissions: ["user.manage"],
          effectiveModules: ["admin", "contracts.browse", "insights_hub"],
        },
      });

    const { container } = renderForm();

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    await user.type(emailInput, "admin@musanad.local");
    await user.type(passwordInput, "ChangeMe@123");

    expect(emailInput.value).toBe("admin@musanad.local");
    expect(passwordInput.value).toBe("ChangeMe@123");

    // Click the submit button via userEvent — this drives the native click
    // → submit chain and is the closest to a real browser interaction.
    const submitButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[type='submit']"),
    )[0];
    expect(submitButton).toBeTruthy();
    await user.click(submitButton);

    await waitFor(
      () => {
        // React Query v5 passes (variables, context) — we only assert on the
        // first argument (the form values).
        expect(loginMock).toHaveBeenCalled();
        expect(loginMock.mock.calls[0][0]).toEqual({
          email: "admin@musanad.local",
          password: "ChangeMe@123",
        });
      },
      { timeout: 3000 },
    );

    await waitFor(() => {
      const s = useAuthStore.getState();
      expect(s.isAuthenticated).toBe(true);
      expect(s.accessToken).toBe("access-token");
      expect(s.refreshToken).toBe("refresh-token");
      expect(s.user?.email).toBe("admin@musanad.local");
    });
  });
});
