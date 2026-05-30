/**
 * Authenticated app layout.
 *
 * All routes nested under `/app/*` require an authenticated session.
 * Redirects to /auth/login if the auth store is empty.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { readPersistedAuthSnapshot } from "@/store/auth.store";

export const Route = createFileRoute("/app")({
  beforeLoad: ({ location }) => {
    // SSR can't see auth state (no cookies/localStorage on the server side
    // of TanStack Start dev) — let the client run the guard on hydration.
    if (typeof window === "undefined") return;
    // Read straight from localStorage to avoid the Zustand persist-rehydration
    // microtask race on cold page loads (see auth.store.ts for details).
    const snap = readPersistedAuthSnapshot();
    if (!snap?.isAuthenticated || !snap.accessToken) {
      throw redirect({
        to: "/auth/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AppShellRoute,
});

function AppShellRoute() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
