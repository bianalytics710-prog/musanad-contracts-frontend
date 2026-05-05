import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/queue")({
  component: () => <ComingSoon module="Queue" description="The unified action queue ships in a follow-up increment. For now, use the Approvals page." />,
});
