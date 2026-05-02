/**
 * Authenticated app layout.
 *
 * All routes nested under `/app/*` require an authenticated session.
 * Redirects to /auth/login if the auth store is empty.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/common/AppLayout";
import { useAuthStore } from "@/store/auth.store";

export const Route = createFileRoute("/app")({
  beforeLoad: ({ location }) => {
    const { isAuthenticated, accessToken } = useAuthStore.getState();
    if (!isAuthenticated || !accessToken) {
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
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
