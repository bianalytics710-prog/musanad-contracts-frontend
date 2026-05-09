/**
 * TestPullButton — calls POST /api/v1/admin/sources/:id/test-pull and surfaces
 * a result toast. Polling for delta signals_24h is delegated to the parent
 * (it owns the source-detail React Query cache).
 */
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminSourcesService } from "@/services/api/admin-sources.service";
import { translateApiError } from "@/lib/translate-api-error";

interface TestPullButtonProps {
  sourceId: number;
  /** Disable when source.enabled === false (per AC-S10-04). */
  disabled?: boolean;
  /** Optional callback fired right after the BE returns 202 (queued). */
  onQueued?: () => void;
  size?: "sm" | "default";
}

export function TestPullButton({
  sourceId,
  disabled,
  onQueued,
  size = "default",
}: TestPullButtonProps) {
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: () => adminSourcesService.testPull(sourceId),
    onSuccess: () => {
      toast.success(
        t("admin.sources.testPull.queued", {
          defaultValue: "Test pull queued — fetching latest signals.",
        }),
      );
      onQueued?.();
    },
    onError: (err: unknown) =>
      toast.error(translateApiError(err, t, "admin.sources.testPull.failed")),
  });

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={() => mutation.mutate()}
      disabled={disabled || mutation.isPending}
    >
      <Play className="me-2 h-3.5 w-3.5" />
      {mutation.isPending
        ? t("admin.sources.testPull.running", {
            defaultValue: "Queueing…",
          })
        : t("admin.sources.testPull.button", {
            defaultValue: "Test pull",
          })}
    </Button>
  );
}
