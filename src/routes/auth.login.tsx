/**
 * Public route — /auth/login
 *
 * Renders the email/password login form. UAE Pass is exposed via a
 * separate route (auth.uae-pass.tsx). On successful authentication
 * the user is redirected to /_app (or back to ?redirect=... if
 * provided by ProtectedRoute).
 */
import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/LoginForm";

export const Route = createFileRoute("/auth/login")({
  component: LoginRoute,
});

function LoginRoute() {
  return <LoginForm />;
}
