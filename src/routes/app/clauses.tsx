import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/common/ComingSoon";

export const Route = createFileRoute("/app/clauses")({
  component: () => <ComingSoon module="Clauses" />,
});
