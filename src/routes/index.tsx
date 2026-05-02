/**
 * Root index route — landing page.
 *
 * If the user is already authenticated, redirect into the app shell;
 * otherwise show a thin marketing/welcome panel that links to /auth/login.
 * The Welcome panel is intentionally minimal — feature modules will replace
 * it with a richer marketing surface or simply gate behind /_app.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { useAuthStore } from "@/store/auth.store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/app" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <nav className="flex items-center gap-3">
          <Link to="/auth/login">
            <Button size="sm" variant="ghost">
              {t("auth.signIn", { defaultValue: "Sign in" })}
            </Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1280px] flex-col items-start justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            <span className="block h-1.5 w-1.5 rounded-full bg-gold" />
            {brand.region.country} &middot; CLM workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {brand.name}
            <span className="ms-3 font-ceremonial text-3xl text-ink-muted">
              {brand.nameArabic}
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
            {isAr ? brand.taglineArabic : brand.tagline}.{" "}
            {brand.description}
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link to="/auth/login">
              <Button size="lg" className="bg-gold text-ink hover:bg-gold-hover">
                {t("auth.signIn", { defaultValue: "Sign in" })}
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
