/**
 * Root index route — marketing landing.
 *
 * Authenticated users are redirected to /app. Otherwise we render a
 * marketing-grade landing page (hero / stats / features / workflow /
 * testimonial / trust / CTA / footer) ported from Lovable.
 */
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  FileText,
  Scale,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Languages,
  Sparkles,
  Globe2,
  Lock,
  FileSignature,
  Workflow,
  Quote,
} from "lucide-react";
import { brand } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/patterns";
import { useAuthStore } from "@/store/auth.store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: "/app" });
    }
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: `${brand.name} — ${brand.tagline}` },
      { name: "description", content: brand.description },
      { property: "og:title", content: `${brand.name} — ${brand.tagline}` },
      { property: "og:description", content: brand.description },
    ],
  }),
});

function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
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
            <span className="ms-1 hidden font-mono text-[10px] uppercase tracking-wider text-ink-subtle md:inline">
              · CLM
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm text-ink-muted transition hover:text-ink">
              {isAr ? "المنتج" : "Product"}
            </a>
            <a href="#workflow" className="text-sm text-ink-muted transition hover:text-ink">
              {isAr ? "سير العمل" : "Workflow"}
            </a>
            <a href="#trust" className="text-sm text-ink-muted transition hover:text-ink">
              {isAr ? "الثقة" : "Trust"}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void i18n.changeLanguage(isAr ? "en" : "ar")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-xs text-ink-muted transition hover:border-gold hover:text-ink"
              aria-label="Toggle language"
            >
              <Languages className="h-3.5 w-3.5" />
              {isAr ? "EN" : "ع"}
            </button>
            <Link to="/auth/login">
              <Button variant="ghost" size="sm">
                {t("auth.signIn", { defaultValue: "Sign in" })}
              </Button>
            </Link>
            <Link to="/auth/uae-pass" className="hidden sm:block">
              <Button size="sm" className="bg-gold text-ink hover:bg-gold-hover">
                <span className="me-1.5 font-mono text-sm">🇦🇪</span>
                {isAr ? "ابدأ الآن" : "Get started"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in oklab, var(--color-gold) 10%, transparent), transparent 60%)",
          }}
        />

        <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-16 md:pb-32 md:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                <span className="block h-1.5 w-1.5 rounded-full bg-gold" />
                {t("landing.kicker", {
                  defaultValue: isAr
                    ? "إدارة دورة حياة العقود · للإمارات أولاً"
                    : "Contract lifecycle management · UAE-first",
                })}
              </div>

              <h1
                className="text-[40px] font-semibold tracking-tight text-ink md:text-[56px] lg:text-[64px] lg:leading-[1.02]"
                style={{ letterSpacing: "-0.02em" }}
              >
                {t("landing.headline", {
                  defaultValue: isAr
                    ? "العقود — مكتوبة. مَدعومة."
                    : "Contracts, drafted and supported.",
                })}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
                {t("landing.subhead", {
                  defaultValue: isAr
                    ? "صياغة، اعتماد، توقيع، وذكاء تنظيمي — ضمن مساحة عمل واحدة، ثنائية اللغة، تلتزم بسيادة البيانات في الإمارات."
                    : "Drafting, approval, signing, and regulatory intelligence in one bilingual workspace — built around UAE data sovereignty.",
                })}
              </p>

              <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link to="/auth/uae-pass">
                  <Button size="lg" className="w-full bg-gold text-ink hover:bg-gold-hover sm:w-auto">
                    <span className="me-2 font-mono text-base">🇦🇪</span>
                    {t("auth.uaePass", { defaultValue: "Sign in with UAE Pass" })}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <Mail className="me-2 h-4 w-4" />
                    {t("auth.signInWithEmail", { defaultValue: "Sign in with email" })}
                  </Button>
                </Link>
              </div>

              <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-ink-subtle">
                <Sparkles className="h-3 w-3 text-gold" />
                <span>
                  {isAr
                    ? "حسابات تجريبية مُهيّأة — جرّب بنقرة واحدة في صفحة الدخول."
                    : "Demo personas pre-seeded — one-click sign in on the login page."}
                </span>
              </div>
            </motion.div>

            {/* Floating contract card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative hidden lg:block"
            >
              <div
                aria-hidden
                className="absolute inset-y-8 -end-6 w-full rotate-2 rounded-2xl border border-border bg-card/40"
              />
              <div className="relative rounded-2xl border border-border bg-card p-7 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.18)]">
                <div className="absolute -end-3 -top-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-ink shadow-md ring-4 ring-background">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
                </div>

                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {isAr ? "اتفاقية خدمات رئيسية" : "Master Services Agreement"} · MUS-2026-0142
                </div>
                <div className="mt-2 text-base font-semibold text-ink">
                  {isAr
                    ? "أدنوك للخدمات الرئيسية — التجديد"
                    : "ADNOC Master Services — Renewal"}
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {isAr
                    ? "بين شركتنا و  أدنوك للتوزيع"
                    : "Between Our Company & ADNOC Distribution"}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge variant="signed" dot>
                    {isAr ? "مُوقَّع كاملاً" : "Fully signed"}
                  </StatusBadge>
                  <StatusBadge variant="regulatory">UAE · AED</StatusBadge>
                  <StatusBadge variant="action">v3</StatusBadge>
                </div>

                <div className="mt-6 space-y-2 border-t border-border pt-5">
                  <div className="h-1.5 w-full rounded bg-surface" />
                  <div className="h-1.5 w-5/6 rounded bg-surface" />
                  <div className="h-1.5 w-4/6 rounded bg-surface" />
                  <div className="h-1.5 w-3/4 rounded bg-surface" />
                  <div className="h-1.5 w-2/4 rounded bg-surface" />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
                  <div className="rounded-md border border-border bg-surface/60 p-3">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                      {isAr ? "الطرف الأول" : "Party A"}
                    </div>
                    <div className="mt-1 font-ceremonial text-base text-ink">F. Al Zaabi</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {isAr ? "هوية UAE Pass" : "UAE Pass verified"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-surface/60 p-3">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                      {isAr ? "الطرف الثاني" : "Party B"}
                    </div>
                    <div className="mt-1 font-ceremonial text-base text-ink">Y. Al Nuaimi</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {isAr ? "هوية UAE Pass" : "UAE Pass verified"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] text-ink-subtle">
                  <span>{isAr ? "وُقِّع · 2026-01-15" : "Signed · 2026-01-15"}</span>
                  <span>
                    {isAr ? "5 التزامات" : "5 obligations"} · {isAr ? "0 مخاطر" : "0 risks"}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4"
          >
            {[
              { v: "35+", l: isAr ? "عقد نموذجي" : "Sample contracts" },
              { v: "75", l: isAr ? "بند معتمد" : "Approved clauses" },
              { v: "14", l: isAr ? "تشريع متتبَّع" : "Regulations tracked" },
              { v: "AR · EN", l: isAr ? "ثنائي اللغة" : "Fully bilingual" },
            ].map((s) => (
              <div key={s.l} className="bg-card px-6 py-5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                  {s.l}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{s.v}</div>
              </div>
            ))}
          </motion.div>

          {/* Ceremonial Arabic mark */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-16 flex items-baseline gap-4 text-ink-subtle"
          >
            <span className="font-mono text-xs uppercase tracking-wider">{brand.region.country}</span>
            <span className="font-ceremonial text-3xl text-ink">{brand.nameArabic}</span>
            <span className="text-sm">— {brand.taglineArabic}</span>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-20 md:py-28">
          <div className="mb-12 flex items-end justify-between gap-8">
            <div>
              <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-subtle">
                {isAr ? "المنتج" : "Product"}
              </div>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                {isAr
                  ? "كل ما تحتاجه لإدارة العقود في الإمارات."
                  : "Everything you need to run contracts in the UAE."}
              </h2>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: FileText,
                title: isAr ? "صياغة + قوالب" : "Drafting + templates",
                body: isAr
                  ? "قوالب ثنائية اللغة، بنود معتمدة، ودعم AI لصياغة أسرع."
                  : "Bilingual templates, approved clauses, and AI-assisted drafting.",
              },
              {
                icon: Scale,
                title: isAr ? "ذكاء تنظيمي" : "Regulatory radar",
                body: isAr
                  ? "تتبَّع التشريعات الإماراتية والمناطق الحرة وتأثيرها المباشر على عقودك."
                  : "Track UAE federal + free-zone regulations and their direct impact on each contract.",
              },
              {
                icon: CheckCircle2,
                title: isAr ? "اعتماد + توقيع" : "Approve + sign",
                body: isAr
                  ? "سلالم اعتماد، تفويض، وتوقيع رسمي عبر UAE Pass."
                  : "Multi-step approvals, delegation, and audit-grade UAE Pass signing.",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="group relative rounded-xl border border-border bg-card p-7 transition hover:border-gold/40 hover:shadow-[0_20px_40px_-25px_rgb(0_0_0/0.15)]"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gold-tint text-gold transition group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="border-t border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-20 md:py-28">
          <div className="mb-14 max-w-2xl">
            <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-subtle">
              {isAr ? "سير عمل الفِرَق" : "Team workflow"}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">
              {isAr
                ? "من المسودة إلى التوقيع — بلا احتكاك."
                : "From draft to signature — without friction."}
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {[
              {
                n: "01",
                icon: FileText,
                t: isAr ? "صياغة" : "Draft",
                d: isAr ? "قوالب ثنائية اللغة وبنود معتمدة." : "Bilingual templates and approved clauses.",
              },
              {
                n: "02",
                icon: Workflow,
                t: isAr ? "مراجعة" : "Review",
                d: isAr ? "تعليقات داخل البنود مع الإسناد." : "Inline comments with role-based assignment.",
              },
              {
                n: "03",
                icon: CheckCircle2,
                t: isAr ? "اعتماد" : "Approve",
                d: isAr ? "سلالم اعتماد وتفويضات صلاحيات." : "Multi-step approvals and delegated authority.",
              },
              {
                n: "04",
                icon: FileSignature,
                t: isAr ? "توقيع" : "Sign",
                d: isAr ? "UAE Pass وتوقيع رسمي مدقَّق." : "UAE Pass and audit-grade signing.",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="bg-card p-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gold-tint text-gold">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[11px] text-ink-subtle">{s.n}</span>
                  </div>
                  <div className="mt-5 text-base font-semibold text-ink">{s.t}</div>
                  <div className="mt-1.5 text-xs leading-relaxed text-ink-muted">{s.d}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRUST / QUOTE */}
      <section id="trust" className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <motion.figure
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-border bg-card p-10"
            >
              <Quote className="h-7 w-7 text-gold" />
              <blockquote className="mt-5 text-xl leading-relaxed text-ink md:text-2xl">
                {isAr
                  ? "أخيراً، منصة عقود تفهم بأن الإمارات لا تعمل بنسخة مكتب فرعي من قانون أجنبي."
                  : "Finally, a contracts platform that understands the UAE isn't a branch-office of someone else's legal system."}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-tint font-mono text-xs font-semibold text-gold">
                  FZ
                </div>
                <div>
                  <div className="text-sm font-medium text-ink">
                    {isAr ? "فاطمة الزعابي" : "Fatima Al Zaabi"}
                  </div>
                  <div className="font-mono text-[11px] text-ink-subtle">
                    {isAr ? "مستشارة قانونية" : "Legal Counsel"} · {isAr ? "أبوظبي" : "Abu Dhabi"}
                  </div>
                </div>
              </figcaption>
            </motion.figure>

            <div className="space-y-6">
              <div className="mb-3 font-mono text-xs uppercase tracking-wider text-ink-subtle">
                {isAr ? "موثوق به في جميع أنحاء الإمارات" : "Trusted across the UAE"}
              </div>
              {[
                {
                  icon: Lock,
                  t: isAr ? "بيانات سيادية" : "Sovereign data",
                  d: isAr
                    ? "تخزين داخل دولة الإمارات. تشفير من الطرف للطرف."
                    : "Stored in-country. End-to-end encryption at rest and in transit.",
                },
                {
                  icon: ShieldCheck,
                  t: isAr ? "هوية UAE Pass" : "UAE Pass identity",
                  d: isAr
                    ? "موقّعون موثَّقون بمستوى متميّز ضمن سجل تدقيق غير قابل للتعديل."
                    : "Premium-level verified signers within an immutable audit trail.",
                },
                {
                  icon: Globe2,
                  t: isAr ? "تشريعات اتحادية ومناطق حرة" : "Federal & free-zone aware",
                  d: isAr
                    ? "ADGM، DIFC، تشريعات الإمارات السبع — كأنواع أصلية."
                    : "ADGM, DIFC, and all seven emirates — as first-class types.",
                },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.t} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold">
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-ink">{p.t}</div>
                      <div className="mt-1 text-xs leading-relaxed text-ink-muted">{p.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1280px] px-6 py-24 md:py-32">
          <div
            className="relative overflow-hidden rounded-3xl border border-border p-12 md:p-16"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--color-gold) 10%, var(--color-card)) 0%, var(--color-card) 60%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -end-20 -top-20 h-60 w-60 rounded-full bg-gold/10 blur-3xl"
            />
            <div className="relative max-w-2xl">
              <div className="mb-4 font-mono text-xs uppercase tracking-wider text-ink-subtle">
                {isAr ? "ابدأ خلال دقيقتين" : "Get started in 2 minutes"}
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">
                {t("landing.ctaReady", {
                  defaultValue: isAr
                    ? "جاهز لرؤية مُسَنَد قيد التشغيل؟"
                    : "Ready to see Musanad in action?",
                })}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted">
                {isAr
                  ? "ادخل بحساب تجريبي مُهيّأ مسبقاً واستكشف كل دور — من الصياغة إلى التوقيع."
                  : "Sign in with a pre-seeded persona and explore every role — from drafting to signature."}
              </p>
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Link to="/auth/uae-pass">
                  <Button size="lg" className="w-full bg-gold text-ink hover:bg-gold-hover sm:w-auto">
                    <span className="me-2 font-mono">🇦🇪</span>
                    {t("auth.uaePass", { defaultValue: "Sign in with UAE Pass" })}
                    <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </Link>
                <Link to="/auth/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    {isAr ? "جرّب حسابات تجريبية" : "Try demo personas"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="block rounded-full bg-gold"
                  style={{ width: brand.mark.size, height: brand.mark.size }}
                />
                <span className="text-base font-medium text-ink">{brand.name}</span>
              </div>
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-muted">
                {brand.description}
              </p>
              <div className="mt-5 flex items-baseline gap-2 text-ink-subtle">
                <span className="font-ceremonial text-xl text-ink">{brand.nameArabic}</span>
                <span className="text-[11px]">— {brand.taglineArabic}</span>
              </div>
            </div>

            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {isAr ? "المنتج" : "Product"}
              </div>
              <ul className="space-y-2 text-xs text-ink-muted">
                <li><a href="#features" className="hover:text-ink">{isAr ? "الميزات" : "Features"}</a></li>
                <li><a href="#workflow" className="hover:text-ink">{isAr ? "سير العمل" : "Workflow"}</a></li>
                <li><a href="#trust" className="hover:text-ink">{isAr ? "الأمان" : "Security"}</a></li>
              </ul>
            </div>

            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {isAr ? "الشركة" : "Company"}
              </div>
              <ul className="space-y-2 text-xs text-ink-muted">
                <li><a href="#" className="hover:text-ink">{isAr ? "عن مُسَنَد" : "About"}</a></li>
                <li>
                  <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink">
                    {isAr ? "تواصل" : "Contact"}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {isAr ? "قانوني" : "Legal"}
              </div>
              <ul className="space-y-2 text-xs text-ink-muted">
                <li><a href="#" className="hover:text-ink">{isAr ? "الخصوصية" : "Privacy"}</a></li>
                <li><a href="#" className="hover:text-ink">{isAr ? "الشروط" : "Terms"}</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-[11px] text-ink-subtle md:flex-row md:items-center">
            <div>© {new Date().getFullYear()} {brand.vendor}</div>
            <div className="font-mono">
              {brand.region.country} · {brand.region.timeZone} · {brand.region.currency}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
