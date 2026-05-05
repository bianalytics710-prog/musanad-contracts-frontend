import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/patterns";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface Props {
  module: string;
  description?: string;
}

export function ComingSoon({ module, description }: Props) {
  const { t } = useTranslation();
  return (
    <PageLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex max-w-md flex-col items-center justify-center py-24 text-center"
      >
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold-tint text-gold">
          <Construction className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-ink-subtle">
          {t("comingSoon.kicker", { defaultValue: "Coming soon" })}
        </div>
        <h1 className="mb-3 font-sans text-2xl font-semibold tracking-tight text-ink">
          {module}
        </h1>
        <p className="mb-8 text-sm text-ink-muted">
          {description ??
            t("comingSoon.body", {
              defaultValue:
                "This module is on the roadmap. The data layer and design system are ready; the UI ships in a future increment.",
            })}
        </p>
        <Button asChild variant="outline">
          <Link to="/app">{t("comingSoon.back", { defaultValue: "Back to dashboard" })}</Link>
        </Button>
      </motion.div>
    </PageLayout>
  );
}
