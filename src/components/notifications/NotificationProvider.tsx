/**
 * NotificationProvider — FE-only notification system stub.
 *
 * Until a real notification table + polling service exists, this provider
 * seeds notifications from contextually-relevant data (pending approvals,
 * regulatory updates, expiring contracts). Reads/writes localStorage so
 * "mark as read" persists across reloads.
 *
 * Replace with backend-driven notifications when the entity ships.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore, selectUser } from "@/store/auth.store";

export type NotificationSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  titleEn: string;
  titleAr: string;
  bodyEn?: string;
  bodyAr?: string;
  linkUrl?: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

const Ctx = createContext<NotificationContextValue | undefined>(undefined);

const STORAGE_KEY = "musanad_notifications_v1";

const SEED_NOTIFICATIONS: Omit<AppNotification, "createdAt" | "readAt">[] = [
  {
    id: "n1",
    severity: "critical",
    titleEn: "AML / CFT update — Cabinet Resolution 24/2026",
    titleAr: "تحديث مكافحة غسل الأموال — قرار مجلس الوزراء 24/2026",
    bodyEn: "Critical regulatory update affecting 3 of your contracts.",
    bodyAr: "تحديث تنظيمي حرج يؤثر على 3 من عقودك.",
    linkUrl: "/app/regulatory-radar",
  },
  {
    id: "n2",
    severity: "high",
    titleEn: "Contract expiring in 30 days: OQOOD-2026-007",
    titleAr: "عقد ينتهي خلال 30 يومًا: OQOOD-2026-007",
    bodyEn: "Trigger renewal-decision workflow with the line-of-business owner.",
    bodyAr: "ابدأ سير عمل قرار التجديد.",
    linkUrl: "/app/contracts/7",
  },
  {
    id: "n3",
    severity: "high",
    // L92 — was citing OQOOD-2026-027 while the actual Approvals queue
    // shows OQOOD-2026-003. Realign to the canonical pending row.
    titleEn: "OQOOD-2026-003 awaiting your approval (22h pending)",
    titleAr: "OQOOD-2026-003 بانتظار موافقتك (22 ساعة معلقة)",
    bodyEn: "Mubadala Investment Advisory, AED 950,000.",
    bodyAr: "استشارات مبادلة الاستثمارية، 950,000 درهم.",
    linkUrl: "/app/approvals",
  },
  {
    id: "n4",
    severity: "medium",
    titleEn: "VAT filing reminder — annual review due in 14 days",
    titleAr: "تذكير بإيداع ضريبة القيمة المضافة - المراجعة السنوية مستحقة",
    bodyEn: "Annual contract performance review for 6 active contracts.",
    bodyAr: "مراجعة الأداء السنوي لـ 6 عقود نشطة.",
    linkUrl: "/app/obligations",
  },
  {
    id: "n5",
    severity: "info",
    titleEn: "OQOOD-2026-005 fully signed",
    titleAr: "تم توقيع OQOOD-2026-005 بالكامل",
    bodyEn: "All required parties have signed the contract.",
    bodyAr: "وقع جميع الأطراف المطلوبين على العقد.",
    linkUrl: "/app/contracts/9",
  },
  {
    id: "n6",
    severity: "low",
    // L93 — was citing "35 contracts" while the seed has grown to ~325.
    // Drop the stale count and use a generic welcome message.
    titleEn: "Welcome — your ADNOC demo workspace is ready",
    titleAr: "مرحبًا — مساحة عمل تجريبية لأدنوك جاهزة",
    bodyEn: "Sign in as different personas to explore role-aware views.",
    bodyAr: "سجّل الدخول بشخصيات مختلفة لاستكشاف الواجهات المخصصة لكل دور.",
    linkUrl: "/app",
  },
];

// K45 fix — persona-aware notification seeds so a compliance lead doesn't
// see notifications meant for drafter / approver / finance personas. Keyed
// by role.name; falls back to the original generic seed when no role match.
const SEED_BY_ROLE: Record<string, typeof SEED_NOTIFICATIONS> = {
  compliance_esg: [
    {
      id: "k1",
      severity: "critical",
      titleEn: "Federal Decree-Law 9/2024 cascade completed — 132 contractors",
      titleAr: "اكتمل تطبيق المرسوم بقانون اتحادي 9/2024 — 132 مقاولاً",
      bodyEn: "Cascade run #6 dispatched. AED 12.8M total penalty exposure. 87.1% ICV at risk.",
      bodyAr: "تم إرسال التطبيق رقم 6. تعرض الغرامات الإجمالي 12.8 مليون درهم.",
      linkUrl: "/app/compliance/regulatory-cascade/6",
    },
    {
      id: "k2",
      severity: "critical",
      titleEn: "OFAC SDN list update — counterparty parent flagged",
      titleAr: "تحديث قائمة OFAC SDN — تم الإشارة إلى الشركة الأم للطرف المقابل",
      bodyEn: "Crescent Petroleum parent entity added to OFAC SDN list. Chain exposure review pending.",
      bodyAr: "تمت إضافة الشركة الأم لكريسنت إلى قائمة OFAC SDN.",
      linkUrl: "/app/risk-cases/8",
    },
    {
      id: "k3",
      severity: "high",
      titleEn: "Audit rights expiring within 90 days — 8 contracts",
      titleAr: "حقوق التدقيق تنتهي خلال 90 يومًا — 8 عقود",
      bodyEn: "Review upcoming audit windows on the compliance dashboard.",
      bodyAr: "راجع نوافذ التدقيق القادمة على لوحة الامتثال.",
      linkUrl: "/app/dashboards/compliance-esg",
    },
    {
      id: "k4",
      severity: "high",
      titleEn: "ESG advisory — high-emissions supplier flagged",
      titleAr: "استشارة ESG — تم الإشارة إلى مورد عالي الانبعاثات",
      bodyEn: "Crescent Petroleum flagged via social monitoring. Open ESG correlation.",
      bodyAr: "تم الإشارة إلى كريسنت بترليوم عبر المراقبة الاجتماعية.",
      linkUrl: "/app/dashboards/compliance-esg",
    },
    {
      id: "k5",
      severity: "medium",
      titleEn: "ICV downgrade alert — ADNOC Distribution PJSC",
      titleAr: "تنبيه تخفيض القيمة الإضافية المحلية — أدنوك للتوزيع",
      bodyEn: "Counterparty ICV score downgraded. Tender competitiveness review recommended.",
      bodyAr: "تم تخفيض درجة القيمة الإضافية المحلية للطرف المقابل.",
      linkUrl: "/app/dashboards/compliance-esg",
    },
    {
      id: "k6",
      severity: "info",
      titleEn: "ADNOC ICV Programme — Q3 audit schedule published",
      titleAr: "برنامج القيمة الإضافية المحلية في أدنوك — جدول تدقيق الربع الثالث منشور",
      bodyEn: "Tier-1 and Tier-2 ICV audits scheduled across 38 contractors.",
      bodyAr: "تم جدولة تدقيقات القيمة الإضافية المحلية لـ 38 مقاولاً.",
      linkUrl: "/app/regulations",
    },
  ],
  // O34/O36 — operations-scoped notifications so Omar sees SLA / vessel
  // routing / EPC milestone events, not generic AML/VAT/approval defaults.
  operations: [
    {
      id: "o1",
      severity: "critical",
      titleEn: "Hormuz Strait routing disruption — vessel transit hold",
      titleAr: "تعطل في مضيق هرمز — تعليق عبور السفينة",
      bodyEn: "ICS incident affecting active charter party contract. Operations to coordinate alternate routing decision.",
      bodyAr: "حادث في النظام التشغيلي يؤثر على عقد طرف الشحن النشط.",
      linkUrl: "/app/dashboards/operations",
    },
    {
      id: "o2",
      severity: "high",
      titleEn: "EPC milestone slippage — penalty window review (CRQ-ONS-023)",
      titleAr: "تأخر معلم EPC — مراجعة نافذة الغرامة",
      bodyEn: "Construction milestone Q2 missed by 11 days. LD-clause exposure AED 1.4M.",
      bodyAr: "فاتت معلم البناء Q2 بـ 11 يومًا.",
      linkUrl: "/app/risk-cases/12",
    },
    {
      id: "o3",
      severity: "high",
      titleEn: "Day-rate billing exceeded ceiling — 7 active contracts",
      titleAr: "تجاوز معدّل اليوم للسقف — 7 عقود نشطة",
      bodyEn: "AED 378.9M operational MaR exposure. Drill into SLA breaches table for detail.",
      bodyAr: "تعرض AED 378.9M MaR على العمليات.",
      linkUrl: "/app/dashboards/operations",
    },
    {
      id: "o4",
      severity: "high",
      titleEn: "North Star Shipping — vessel demurrage breach (3 shipments)",
      titleAr: "نورث ستار للشحن — خرق غرامة التأخر",
      bodyEn: "Combined demurrage exposure AED 6.2M. Port-rotation conflict at Jebel Ali.",
      bodyAr: "تعرض غرامة التأخر الإجمالي AED 6.2M.",
      linkUrl: "/app/risk-cases",
    },
    {
      id: "o5",
      severity: "medium",
      titleEn: "Vendor HSE incident — DEME Gulf",
      titleAr: "حادث HSE من المورد — DEME Gulf",
      bodyEn: "HSE incident affecting field operations. Investigation underway. Score 55 trending down.",
      bodyAr: "حادث HSE يؤثر على العمليات الميدانية.",
      linkUrl: "/app/dashboards/operations",
    },
    {
      id: "o6",
      severity: "info",
      titleEn: "Operations Risk-Board Snapshot generated weekly",
      titleAr: "لقطة لوحة المخاطر التشغيلية الأسبوعية",
      bodyEn: "Generate from /app/reports — covers SLA, delivery delays, vendor scorecards.",
      bodyAr: "أنشئ من /app/reports — يغطي SLA والتأخيرات.",
      linkUrl: "/app/reports",
    },
  ],
  // P46 — procurement-scoped notifications so Pari sees supplier-risk events,
  // not the generic AML/VAT/approval-queue defaults that don't apply to her role.
  procurement_supplier_risk: [
    {
      id: "p1",
      severity: "critical",
      titleEn: "Supplier SLA breach — Mubadala Investment Company (2 breaches in 180d)",
      titleAr: "خرق اتفاقية مستوى الخدمة — شركة مبادلة للاستثمار (خرقان خلال 180 يوم)",
      bodyEn: "Initiate cure-notice draft and review counterparty concentration on the procurement dashboard.",
      bodyAr: "ابدأ إعداد إشعار العلاج وراجع تركّز الطرف المقابل على لوحة المشتريات.",
      linkUrl: "/app/dashboards/procurement",
    },
    {
      id: "p2",
      severity: "high",
      titleEn: "ICV certificate missing — 166 counterparties non-compliant",
      titleAr: "شهادة ICV مفقودة — 166 طرفاً مقابلاً غير ملتزم",
      bodyEn: "Top exposure: Fujairah Port Logistics AED 22B. ICV remediation queue available.",
      bodyAr: "أكبر تعرض: ميناء الفجيرة للوجستيات 22 مليار درهم.",
      linkUrl: "/app/dashboards/procurement",
    },
    {
      id: "p3",
      severity: "high",
      titleEn: "Counterparty concentration — case CR-14 due in 4 days",
      titleAr: "تركّز الطرف المقابل — حالة CR-14 مستحقة خلال 4 أيام",
      bodyEn: "Single counterparty exposure exceeds 18% threshold. Diversification review snoozed.",
      bodyAr: "تعرض طرف مقابل واحد يتجاوز الحد 18%.",
      linkUrl: "/app/risk-cases/14",
    },
    {
      id: "p4",
      severity: "medium",
      titleEn: "Backup-supplier suggestion ready — DEWA score 0 → 3 alternates identified",
      titleAr: "اقتراح مورّد بديل جاهز — DEWA درجة 0 → تم تحديد 3 بدائل",
      bodyEn: "Gulf Petro Drilling Services (87), Al Noor Technical Consulting (77), Falcon Drilling Services (69).",
      bodyAr: "Gulf Petro / Al Noor / Falcon — مرتبة حسب صحة المورّد.",
      linkUrl: "/app/dashboards/procurement",
    },
    {
      id: "p5",
      severity: "medium",
      titleEn: "Supplier risk scorecard — 11 high-risk suppliers with composite score < 50",
      titleAr: "بطاقة تقييم مخاطر المورّدين — 11 مورّداً عالي المخاطر",
      bodyEn: "Sort by total contract value to prioritize remediation.",
      bodyAr: "رتّب حسب القيمة الإجمالية للعقود لتحديد الأولويات.",
      linkUrl: "/app/dashboards/procurement",
    },
    {
      id: "p6",
      severity: "info",
      titleEn: "Procurement weekly briefing template now available in Reports",
      titleAr: "نموذج موجز المشتريات الأسبوعي متاح الآن في التقارير",
      bodyEn: "Supplier Risk Scorecard / ICV Compliance / SLA Breach — generate from /app/reports.",
      bodyAr: "بطاقة تقييم المورّدين / امتثال ICV / خرق SLA — أنشئ من التقارير.",
      linkUrl: "/app/reports",
    },
  ],
  // R35/R36 — recipient-relevant seed. The generic default seed leaked
  // notifications for contracts outside the recipient's scope and for an
  // "awaiting your approval" event Rashid (a signer-only role) would never
  // receive. Replace with signer-facing notifications grounded in contracts
  // Rashid is actually a signature_party on (013, 019, 023, 028, 029) and
  // signer-appropriate event types (signing invitation, full execution,
  // regulatory updates affecting his contracts only).
  contract_recipient: [
    {
      id: "rr1",
      severity: "high",
      titleEn: "Signing invitation — OQOOD-2026-013 (Emaar Properties Lease MSA)",
      titleAr: "دعوة توقيع — OQOOD-2026-013 (اتفاقية إيجار إعمار العقارية الرئيسية)",
      bodyEn: "Counterparty Crescent Petroleum has requested your signature on this MSA. Open the contract to start the signing flow.",
      bodyAr: "طلبت كريسنت بتروليوم توقيعك على هذه الاتفاقية الرئيسية. افتح العقد لبدء التوقيع.",
      linkUrl: "/app/contracts/13",
    },
    {
      id: "rr2",
      severity: "info",
      titleEn: "OQOOD-2026-019 fully signed (ADCB Treasury Services Agreement)",
      titleAr: "تم توقيع OQOOD-2026-019 بالكامل (اتفاقية خدمات الخزانة لـ ADCB)",
      bodyEn: "All required parties have countersigned. A signed PDF copy is available from the contract detail page.",
      bodyAr: "وقّع جميع الأطراف على العقد. تتوفر نسخة PDF موقعة من صفحة تفاصيل العقد.",
      linkUrl: "/app/contracts/19",
    },
    {
      id: "rr3",
      severity: "medium",
      titleEn: "OQOOD-2026-028 expiring in 60 days (AWS Marketplace Reseller Agreement)",
      titleAr: "OQOOD-2026-028 ينتهي خلال 60 يومًا (اتفاقية AWS Marketplace)",
      bodyEn: "If you would like to renew, contact the counterparty's commercial team before expiry.",
      bodyAr: "إذا رغبت في التجديد، تواصل مع الفريق التجاري للطرف المقابل قبل انتهاء الصلاحية.",
      linkUrl: "/app/contracts/28",
    },
    {
      id: "rr4",
      severity: "info",
      titleEn: "OQOOD-2026-023 fully signed (Tabreed District Cooling Master Agreement)",
      titleAr: "تم توقيع OQOOD-2026-023 بالكامل (اتفاقية تبريد المناطق الرئيسية)",
      bodyEn: "Full execution recorded. Counter-signed PDF available on the contract detail.",
      bodyAr: "تم تسجيل التوقيع الكامل. نسخة PDF موقعة متاحة.",
      linkUrl: "/app/contracts/23",
    },
    {
      id: "rr5",
      severity: "info",
      titleEn: "Welcome — your OqoodAI signing workspace is ready",
      titleAr: "مرحبًا — مساحة العمل لتوقيع العقود جاهزة",
      bodyEn: "Open the My contracts page to see contracts where you are a signatory.",
      bodyAr: "افتح صفحة عقودي لعرض العقود التي أنت أحد موقعيها.",
      linkUrl: "/app/dashboards/recipient",
    },
  ],
  // D60 — drafter-relevant seed. Default seed sent Dana an approver
  // notification ("OQOOD-2026-003 awaiting your approval") which the
  // contract drafter persona would never receive in reality. Replaces with
  // drafter-actor notifications: revision returns, approvals on her drafts,
  // template updates, signature dispatches, draft-template recommendations.
  contract_drafter: [
    {
      id: "cd1",
      severity: "high",
      titleEn: "Draft returned for revision — OQOOD-2026-006 (DXB Airport Concession Renewal)",
      titleAr: "أُعيدت المسوّدة للمراجعة — OQOOD-2026-006 (تجديد امتياز مطار دبي)",
      bodyEn: "Approver requested wording change in Section 12 (Termination for Convenience). Update + resubmit.",
      bodyAr: "طلب المُعتمد تعديل صياغة في البند 12 (الإنهاء للملاءمة). حدّث وأعد الإرسال.",
      linkUrl: "/app/contracts/6",
    },
    {
      id: "cd2",
      severity: "high",
      titleEn: "Your draft was approved — OQOOD-2026-013 ready for signature dispatch",
      titleAr: "تمت الموافقة على مسوّدتك — OQOOD-2026-013 جاهزة لإرسال التوقيع",
      bodyEn: "Approver Aisha Approver signed off. Open contract and click Send for Signing.",
      bodyAr: "وقّع المُعتمِد عائشة. افتح العقد واضغط إرسال للتوقيع.",
      linkUrl: "/app/contracts/13",
    },
    {
      id: "cd3",
      severity: "medium",
      titleEn: "Template updated — Vendor Services Agreement v2.4 published",
      titleAr: "تم تحديث القالب — اتفاقية خدمات المورّد v2.4 منشورة",
      bodyEn: "Force-majeure language harmonised with ADNOC offshore standard. Existing drafts may need refresh.",
      bodyAr: "تمت مطابقة صياغة القوة القاهرة مع المعيار البحري لأدنوك.",
      linkUrl: "/app/templates",
    },
    {
      id: "cd4",
      severity: "high",
      titleEn: "Signature dispatched — OQOOD-2026-015 sent to counterparty",
      titleAr: "تم إرسال التوقيع — OQOOD-2026-015 أُرسلت للطرف المقابل",
      bodyEn: "Etisalat Group (e&) signing link generated; awaiting counterparty.",
      bodyAr: "تم إنشاء رابط توقيع لمجموعة اتصالات (e&)؛ في انتظار الطرف المقابل.",
      linkUrl: "/app/contracts/15",
    },
    {
      id: "cd5",
      severity: "medium",
      titleEn: "Clause library — UAE PDPL Compliance clause updated",
      titleAr: "مكتبة البنود — تم تحديث بند الامتثال لقانون حماية البيانات الإماراتي",
      bodyEn: "PDPL Article 24 amendment integrated. Re-insert in any active drafts.",
      bodyAr: "تم دمج تعديل المادة 24 من قانون حماية البيانات. أعد إدراج البند في أي مسوّدات قيد العمل.",
      linkUrl: "/app/clauses",
    },
    {
      id: "cd6",
      severity: "info",
      titleEn: "Weekly drafter briefing — 4 drafts in progress, average cycle 12.7 days",
      titleAr: "موجز المُحرّر الأسبوعي — 4 مسوّدات قيد العمل، متوسط الدورة 12.7 يوماً",
      bodyEn: "On-track for your monthly draft target. Open dashboard for pipeline view.",
      bodyAr: "ضمن المسار نحو هدف المسوّدات الشهري. افتح اللوحة لعرض سير العمل.",
      linkUrl: "/app/dashboards/drafter",
    },
  ],
};

function generateSeedFor(userId: number, roleName?: string | null): AppNotification[] {
  const now = Date.now();
  // K45 — prefer role-specific seed when available.
  const source = (roleName && SEED_BY_ROLE[roleName]) || SEED_NOTIFICATIONS;
  return source.map((n, i) => ({
    ...n,
    id: `${userId}-${n.id}`,
    createdAt: new Date(now - i * 1000 * 60 * 60 * 6).toISOString(),
    readAt: null,
  }));
}

function readFromStorage(userId: number): AppNotification[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return null;
  }
}

function writeToStorage(userId: number, notifications: AppNotification[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY}_${userId}`,
      JSON.stringify(notifications),
    );
  } catch {
    // best-effort
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore(selectUser);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    // K45 fix — read persona-aware seed when no stored notifications;
    // pass the actor's role.name so compliance_esg gets compliance seeds.
    const stored = readFromStorage(user.id);
    const desiredSeed = generateSeedFor(user.id, user.role?.name);
    // If stored seed matches the OLD generic ids (n1..n6) but the user has
    // a persona-specific seed available, replace the stored seed so the
    // upgrade lands on the next login without requiring a localStorage clear.
    const hasPersonaSeed = !!(user.role?.name && SEED_BY_ROLE[user.role.name]);
    const storedIsGeneric = stored?.every((n) => /-n\d$/.test(n.id)) ?? false;
    if (stored && stored.length > 0 && !(hasPersonaSeed && storedIsGeneric)) {
      setNotifications(stored);
    } else {
      writeToStorage(user.id, desiredSeed);
      setNotifications(desiredSeed);
    }
  }, [user]);

  const markAsRead = useCallback(
    (id: string) => {
      if (!user) return;
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === id && !n.readAt
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        );
        writeToStorage(user.id, next);
        return next;
      });
    },
    [user],
  );

  const markAllRead = useCallback(() => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifications((prev) => {
      const next = prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
      writeToStorage(user.id, next);
      return next;
    });
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const c = useContext(Ctx);
  if (!c) {
    return {
      notifications: [],
      unreadCount: 0,
      markAsRead: () => undefined,
      markAllRead: () => undefined,
    };
  }
  return c;
}
