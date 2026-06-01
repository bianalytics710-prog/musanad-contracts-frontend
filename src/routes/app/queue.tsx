import { createFileRoute, redirect } from "@tanstack/react-router";

// A2 (Aisha audit fix 2026-06-01) — Queue placeholder was reachable from
// the approver sidebar and rendered as "Coming soon". Sidebar entry removed
// in mig 427 (queue.default_role_codes -= contract_approver(_2)). Keep this
// route so direct-URL hits don't 404; redirect to /app/approvals (the only
// workflow this entry pointed at conceptually).
export const Route = createFileRoute("/app/queue")({
  beforeLoad: () => {
    throw redirect({ to: "/app/approvals" });
  },
  component: () => null,
});
