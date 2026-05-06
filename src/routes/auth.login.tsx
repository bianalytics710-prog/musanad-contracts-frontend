/**
 * Public route — /auth/login
 *
 * Renders the email/password login form. UAE Pass is exposed via a
 * separate route (auth.uae-pass.tsx). On successful authentication
 * the user is redirected to /app (or back to ?redirect=... if provided
 * by the /app guard, validated as a same-origin relative path).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginForm } from "@/components/auth/LoginForm";

const loginSearchSchema = z
  .object({
    redirect: z.string().optional(),
  })
  .partial();

export const Route = createFileRoute("/auth/login")({
  validateSearch: (s) => loginSearchSchema.parse(s),
  component: LoginRoute,
});

function LoginRoute() {
  return <LoginForm />;
}
