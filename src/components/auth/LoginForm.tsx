/**
 * LoginForm — email/password form for /auth/login.
 *
 * - react-hook-form + zod for validation (mirrors workspace/schemas.ts loginSchema).
 * - React Query mutation for the POST /auth/login call.
 * - Three data states surfaced: idle/error (no list to show empty for).
 * - Accessibility: labelled inputs, aria-invalid + aria-describedby on errors,
 *   live region for the form-level error, autoComplete hints, required attrs.
 * - Sensitive fields (password) never hit the auth-store persist payload —
 *   they live only inside the form state for the lifetime of the mutation.
 * - 429 (rate limit) handled gracefully with a dedicated message.
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Languages } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { authService } from "@/services/api/auth.service";
import { brand } from "@/config/brand";
import { useAuthStore } from "@/store/auth.store";

// Mirrors workspace/schemas.ts loginSchema. We keep a local copy so the
// FE can validate without crossing a bundle boundary, and so future
// tweaks (e.g. UAE-specific email rules) live close to the form.
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "auth.errors.emailRequired" })
    .max(255, { message: "auth.errors.emailTooLong" })
    .email({ message: "auth.errors.emailInvalid" }),
  password: z
    .string()
    .min(1, { message: "auth.errors.passwordRequired" })
    .max(128, { message: "auth.errors.passwordTooLong" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith("ar");
  const applyLogin = useAuthStore((s) => s.applyLogin);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (response) => {
      applyLogin(response);
      toast.success(
        t("auth.signInSuccess", { defaultValue: "Welcome back, {{name}}", name: response.user.firstName }),
      );
      navigate({ to: "/app" });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setFormError(
            t("auth.errors.rateLimited", {
              defaultValue: "Too many sign-in attempts. Please wait a few minutes and try again.",
            }),
          );
          return;
        }
        if (err.status === 423) {
          setFormError(
            t("auth.errors.accountLocked", {
              defaultValue: "Your account is temporarily locked. Please try again later.",
            }),
          );
          return;
        }
        if (err.status === 401) {
          setFormError(
            t("auth.errors.invalidCredentials", {
              defaultValue: "Email or password is incorrect.",
            }),
          );
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError(
        t("auth.errors.unknown", {
          defaultValue: "Sign-in failed. Please try again.",
        }),
      );
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  // Dev convenience — one-click sign-in for each seeded persona.
  // All seeded users share the bootstrap admin's bcrypt hash (ChangeMe@123).
  // Hidden in production builds via import.meta.env.PROD guard.
  const personas: Array<{ key: string; label: string; sub: string; email: string }> = [
    { key: "super",     label: "Super Admin",      sub: "All access",                      email: "admin@musanad.local"     },
    { key: "platform",  label: "Platform Admin",   sub: "Admin observability",             email: "platform@musanad.local"  },
    { key: "legal",     label: "Legal Counsel",    sub: "Regulatory + audit",              email: "legal@musanad.local"     },
    { key: "drafter",   label: "Drafter",          sub: "Author contracts",                email: "drafter@musanad.local"   },
    { key: "approver",  label: "Approver",         sub: "Approval queue",                  email: "approver@musanad.local"  },
    { key: "recipient", label: "Recipient",        sub: "Sign assigned contracts",         email: "recipient@musanad.local" },
    { key: "executive", label: "Executive",        sub: "KPIs + AI anomalies",             email: "executive@musanad.local" },
  ];

  const signInAs = (email: string) => {
    setFormError(null);
    mutation.mutate({ email, password: "ChangeMe@123" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <span
            className="block rounded-full bg-gold"
            style={{ width: brand.mark.size, height: brand.mark.size }}
          />
          <span
            className="text-[18px] font-medium tracking-tight text-ink"
            style={{ letterSpacing: "-0.3px" }}
          >
            {brand.name}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-ink-muted transition hover:border-gold hover:text-ink"
          aria-label={t("common.toggleLanguage", { defaultValue: "Toggle language" })}
        >
          <Languages className="h-3.5 w-3.5" />
          {isAr ? "EN" : "ع"}
        </button>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-6 pb-16 pt-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-2xl">
                {t("auth.signInTitle", { defaultValue: "Sign in to Musanad" })}
              </CardTitle>
              <p className="text-sm text-ink-muted">
                {t("auth.signInSubtitle", {
                  defaultValue: "Enter your work email and password to continue.",
                })}
              </p>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <Link to="/auth/uae-pass" className="block">
                  <Button
                    size="lg"
                    type="button"
                    className="w-full bg-gold text-ink hover:bg-gold-hover"
                  >
                    <span className="me-2 inline-flex items-center font-mono text-base">
                      🇦🇪
                    </span>
                    {t("auth.uaePass", { defaultValue: "Continue with UAE Pass" })}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </Link>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                    {t("auth.or", { defaultValue: "or" })}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {formError && (
                  <Alert variant="destructive" role="alert" aria-live="assertive">
                    <AlertTitle>
                      {t("auth.errors.title", { defaultValue: "Sign-in problem" })}
                    </AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  className="space-y-3"
                  aria-busy={isSubmitting || mutation.isPending}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      {t("auth.email", { defaultValue: "Email" })}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      placeholder={t("auth.emailPlaceholder", {
                        defaultValue: "you@company.ae",
                      })}
                      {...register("email")}
                    />
                    {errors.email?.message && (
                      <p
                        id="email-error"
                        role="alert"
                        className="text-xs font-medium text-destructive"
                      >
                        {t(errors.email.message, { defaultValue: errors.email.message })}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">
                      {t("auth.password", { defaultValue: "Password" })}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      {...register("password")}
                    />
                    {errors.password?.message && (
                      <p
                        id="password-error"
                        role="alert"
                        className="text-xs font-medium text-destructive"
                      >
                        {t(errors.password.message, { defaultValue: errors.password.message })}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting || mutation.isPending}
                  >
                    {mutation.isPending
                      ? t("common.signingIn", { defaultValue: "Signing in…" })
                      : t("auth.signInWithEmail", { defaultValue: "Sign in" })}
                  </Button>
                </form>

                {!import.meta.env.PROD && (
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                        Dev quick sign-in
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {personas.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => signInAs(p.email)}
                          disabled={mutation.isPending}
                          aria-label={`Sign in as ${p.label}`}
                          className="group flex flex-col items-start gap-0.5 rounded-md border border-border bg-card px-3 py-2 text-start transition hover:border-gold hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="text-xs font-medium text-ink group-hover:text-ink">
                            {p.label}
                          </span>
                          <span className="text-[10px] text-ink-subtle">{p.sub}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-ink-subtle">
                      All personas share password <span className="font-mono">ChangeMe@123</span> — dev only.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-ink-subtle">
            {brand.vendor} &middot;{" "}
            <a
              href={brand.website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {brand.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

export default LoginForm;
