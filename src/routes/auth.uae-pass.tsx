/**
 * Public route — /auth/uae-pass
 *
 * UAE Pass federation entry point. In M0 the BE runs in mock mode
 * (UAE_PASS_PROVIDER=mock) and synthesises a fake identity payload.
 * The real OIDC/PKCE handshake will be implemented before go-live —
 * see docs/uae-pass-integration.md (BE).
 *
 * TODO[uae-pass-integration]: replace the mock initiate POST with the
 * real authorization-endpoint redirect once UAE_PASS_PROVIDER=live.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { apiClient, ApiError } from "@/lib/api-client";

interface InitiateResponse {
  redirectUrl: string | null;
  mockCallbackUrl: string | null;
  mode: "mock" | "live";
}

export const Route = createFileRoute("/auth/uae-pass")({
  component: UaePassRoute,
});

function UaePassRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiate = async () => {
    setPending(true);
    setError(null);
    try {
      // BE is expected to expose POST /api/v1/auth/uae-pass/initiate
      // returning either a redirectUrl (live) or a mockCallbackUrl (mock).
      // M0 uses the mock path; live will navigate the browser away.
      const { data } = await apiClient.post<InitiateResponse>(
        "/api/v1/auth/uae-pass/initiate",
        {},
      );
      if (data.mode === "live" && data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }
      if (data.mockCallbackUrl) {
        navigate({ to: "/auth/uae-pass/callback", search: { code: "mock" } });
        return;
      }
      setError(
        t("auth.uaePassNotConfigured", {
          defaultValue: "UAE Pass is not configured. Use email sign-in for now.",
        }),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : t("auth.uaePassError", {
              defaultValue: "UAE Pass sign-in failed. Try again or use email.",
            });
      setError(message);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    // Auto-initiate on mount so the page acts as a launcher.
    initiate();
    // We intentionally only initiate once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md space-y-4 text-center"
      >
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
          <span className="block h-1.5 w-1.5 rounded-full bg-gold" />
          {brand.region.country} &middot; UAE Pass
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("auth.uaePassTitle", { defaultValue: "Continuing with UAE Pass" })}
        </h1>
        <p className="text-sm text-ink-muted">
          {t("auth.uaePassSubtitle", {
            defaultValue:
              "We are preparing your UAE Pass session. You will be redirected automatically.",
          })}
        </p>

        {pending && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm font-medium text-gold"
          >
            {t("common.loading", { defaultValue: "Loading…" })}
          </p>
        )}

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>
              {t("auth.uaePassErrorTitle", { defaultValue: "Sign-in problem" })}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={initiate} disabled={pending} className="w-full">
            {t("auth.tryAgain", { defaultValue: "Try again" })}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="/auth/login">
              {t("auth.useEmail", { defaultValue: "Use email instead" })}
            </a>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
