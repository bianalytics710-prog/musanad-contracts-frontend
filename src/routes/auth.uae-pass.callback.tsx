/**
 * Public route — /auth/uae-pass/callback
 *
 * Receives the code/state from UAE Pass (or the mock provider) and
 * exchanges it for a Musanad JWT pair via POST /api/v1/auth/uae-pass/callback.
 * Stores tokens in the auth store on success then redirects into /_app.
 *
 * TODO[uae-pass-integration]: real callback must verify SAML / OIDC
 * id_token signature and PKCE code_verifier. M0 trusts the BE entirely.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth.store";
import type { LoginResponse } from "@/types/api.types";

interface CallbackSearch {
  code?: string;
  state?: string;
  error?: string;
}

export const Route = createFileRoute("/auth/uae-pass/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: UaePassCallbackRoute,
});

function UaePassCallbackRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/uae-pass/callback" });
  const applyLogin = useAuthStore((s) => s.applyLogin);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (search.error) {
      setErrorMessage(
        t("auth.uaePassCallbackError", {
          defaultValue: "UAE Pass returned an error. Please try again.",
        }),
      );
      return;
    }

    if (!search.code) {
      setErrorMessage(
        t("auth.uaePassCallbackMissingCode", {
          defaultValue: "Missing UAE Pass code. Please retry sign-in.",
        }),
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.post<LoginResponse>(
          "/api/v1/auth/uae-pass/callback",
          { code: search.code, state: search.state ?? null },
        );
        if (cancelled) return;
        applyLogin(data);
        navigate({ to: "/app" });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : t("auth.uaePassCallbackFailure", {
                defaultValue: "Sign-in could not be completed.",
              });
        setErrorMessage(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search.code, search.state, search.error, applyLogin, navigate, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t("auth.uaePassCallbackTitle", { defaultValue: "Completing UAE Pass sign-in" })}
        </h1>
        {!errorMessage && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm font-medium text-gold"
          >
            {t("common.loading", { defaultValue: "Loading…" })}
          </p>
        )}
        {errorMessage && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>
              {t("auth.uaePassErrorTitle", { defaultValue: "Sign-in problem" })}
            </AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-surface"
          >
            {t("auth.useEmail", { defaultValue: "Use email instead" })}
          </a>
        )}
      </div>
    </div>
  );
}
