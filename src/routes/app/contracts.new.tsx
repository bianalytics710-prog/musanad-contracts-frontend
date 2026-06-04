/**
 * Authenticated route — /app/contracts/new.
 *
 * Legacy basic-form route. The proper drafting flow is the four-step
 * Compose Wizard at /app/contracts/compose. We redirect here so any
 * old bookmarks or hand-typed URLs land in the right place.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/contracts/new")({
  beforeLoad: () => {
    throw redirect({ to: "/app/contracts/compose" });
  },
});
