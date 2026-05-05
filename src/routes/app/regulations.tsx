import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/regulations")({
  component: () => <ComingSoon module="Regulations" description="A read-only register of regulations is available via the Regulatory Radar. The full regulations browser ships in a follow-up increment." />,
});
