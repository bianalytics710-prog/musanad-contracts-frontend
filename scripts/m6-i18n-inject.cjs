/**
 * One-shot Node script run by Agent 8 (M6) to inject Dashboards & Reporting
 * i18n keys into en.json and ar.json with parity. Mirrors the M5 script.
 *
 * Run: node scripts/m6-i18n-inject.cjs
 */
const fs = require("fs");
const path = require("path");

const EN_PATH = path.join(__dirname, "..", "src", "i18n", "en.json");
const AR_PATH = path.join(__dirname, "..", "src", "i18n", "ar.json");

const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
const ar = JSON.parse(fs.readFileSync(AR_PATH, "utf8"));

// ============================================================
// M6 — Dashboards & Reporting — namespace: `dashboards.*`
// We namespace M6 strings under `dashboards.*` (rather than reuse the
// existing M0 `dashboard.*` welcome screen surface) to keep the M6
// surface fully self-contained.
// ============================================================

const enDashboards = {
  common: {
    timeRangeLabel: "Time range",
    range: {
      last_7d: "Last 7 days",
      last_30d: "Last 30 days",
      last_90d: "Last 90 days",
      custom: "Custom",
      customDaysLabel: "Days",
    },
    featurePending: "Feature pending — coming in a future module.",
    emptyList: "Nothing to show yet.",
    noDataDash: "—",
    hoursAbbrev: "h",
    updated: "Updated {{when}}",
    detected: "Detected",
    effective: "Effective",
    date: "Date",
    month: "Month",
    count: "Count",
    totalValue: "Total value",
    openContractAria: "Open contract {{number}} — {{title}}",
    severity: {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
      unknown: "Unknown",
    },
  },

  admin: {
    title: "Admin Dashboard",
    landingTitle: "Admin Landing",
    subtitle: "System-wide KPIs and recent activity.",
    kpiGroupLabel: "Admin key performance indicators",
    kpis: {
      totalContractsActive: "Active contracts",
      expiringWithin30d: "Expiring in 30 days",
      expiringWithin90d: "Expiring in 90 days",
      pendingApprovals: "Pending approvals",
      pendingSignatures: "Pending signatures",
      openRegulatoryImpacts: "Open regulatory impacts",
      recentAuditEvents: "Recent audit events",
      totalActiveUsers: "Active users",
    },
    contractsByStatus: {
      title: "Contracts by status",
      description: "Live distribution across all active contracts.",
    },
    trends: {
      contractsCreatedTitle: "Contracts created",
      contractsCreatedDescription: "Daily count over the selected window.",
      decisionsTitle: "Approval decisions",
      decisionsDescription: "Approve / reject counts per day.",
      created: "Created",
      approved: "Approved",
      rejected: "Rejected",
    },
    tileGrid: {
      quickActionsTitle: "Quick actions",
      contracts: "Contracts",
      approvals: "Approvals",
      regulatoryRadar: "Regulatory Radar",
      imports: "Imports",
      aiRequests: "AI requests",
      health: "System health",
      aiCosts: "AI costs",
    },
    errors: {
      loadFailed: "Could not load the admin dashboard.",
    },
  },

  drafter: {
    title: "Drafter Dashboard",
    subtitle: "Your drafts and what is awaiting your action.",
    kpiGroupLabel: "Drafter key performance indicators",
    kpis: {
      myDraftsCount: "My drafts",
      awaitingMyActionCount: "Awaiting my action",
      readyToSendCount: "Ready to send",
      myRecentlyApprovedCount: "Recently approved",
    },
    lists: {
      myDraftsTitle: "My drafts",
      myDraftsDescription: "Latest drafts you authored.",
      awaitingMyActionTitle: "Awaiting my action",
      awaitingMyActionDescription: "Items returned for revision.",
    },
    lastDecisionNote: "Last decision note",
    errors: {
      loadFailed: "Could not load the drafter dashboard.",
    },
  },

  approver: {
    title: "Approver Dashboard",
    subtitle: "Your queue and decision metrics.",
    kpiGroupLabel: "Approver key performance indicators",
    kpis: {
      pendingMyApprovalCount: "Pending my approval",
      pendingMyApprovalCountHelper: "Includes delegated and reassigned items.",
      decidedByMeCount: "Decided by me",
      averageDecisionHoursMine: "Avg. hours (mine)",
      averageDecisionHoursTeam: "Avg. hours (team)",
    },
    lists: {
      pendingQueueTitle: "Pending queue",
      pendingQueueDescription: "Top 5 contracts awaiting your decision.",
      contract: "Contract",
      value: "Value",
      requestedAt: "Requested",
      hoursWaiting: "Hours waiting",
    },
    errors: {
      loadFailed: "Could not load the approver dashboard.",
    },
  },

  legalCounsel: {
    title: "Legal Counsel Dashboard",
    subtitle: "Regulatory updates, impacts and audit visibility.",
    kpiGroupLabel: "Legal counsel key performance indicators",
    kpis: {
      regulatoryUpdatesThisWindow: "Regulatory updates",
      openRegulatoryImpacts: "Open impacts",
      criticalSeverityCount: "Critical severity",
      regulationCatalogSize: "Regulation catalogue size",
      templateUsageThisWindow: "Template usage",
      templateUsageHint:
        "Coming with the Templates module — this tile is intentionally disabled.",
      auditEventsLabel: "Audit events",
      auditSummaryDenied:
        "You don't have the audit.read permission to view this breakdown.",
    },
    auditSummary: {
      title: "Audit events by table",
      description: "Counts grouped by audited table name.",
    },
    lists: {
      recentRegulatoryUpdatesTitle: "Recent regulatory updates",
      recentRegulatoryUpdatesDescription: "Top 5 most recent updates.",
      openImpactsTitle: "Open impacts",
      openImpactsDescription: "Top 5 unresolved regulatory impacts.",
    },
    errors: {
      loadFailed: "Could not load the legal counsel dashboard.",
    },
  },

  recipient: {
    title: "Recipient Dashboard",
    subtitle: "Your contracts and signature inbox.",
    kpiGroupLabel: "Recipient key performance indicators",
    kpis: {
      myContractsCount: "My contracts",
      pendingMySignatureCount: "Pending my signature",
      signedByMeWindow: "Signed by me",
      signedByMeWindowHelper:
        "Counts internal signatures only — external invitation signers are not included.",
      myObligationsCount: "My obligations",
      myObligationsHint:
        "Coming with the Obligations module — this tile is intentionally disabled.",
    },
    lists: {
      myContractsTitle: "My contracts",
      myContractsDescription: "Contracts where you are listed as a signatory.",
      pendingSignaturesTitle: "Pending signatures",
      pendingSignaturesDescription: "Active invitations addressed to you.",
      counterpartyPending: "Counterparty details: pending",
      invitationSent: "Invitation sent",
      invitationExpires: "Expires",
    },
    errors: {
      loadFailed: "Could not load the recipient dashboard.",
    },
  },

  insightsRouter: {
    title: "Insights",
    detecting: "Detecting your dashboard…",
    redirecting: "Taking you to the {{dashboard}} dashboard…",
    target: {
      admin: "Admin",
      drafter: "Drafter",
      approver: "Approver",
      legal_counsel: "Legal Counsel",
      recipient: "Recipient",
      executive: "Executive",
    },
    errors: {
      loadFailed: "Could not detect your dashboard.",
    },
  },

  executive: {
    title: "Executive Dashboard",
    subtitle: "Enterprise-wide view of contract value and risk.",
    kpiGroupLabel: "Executive key performance indicators",
    kpis: {
      totalActiveValueAed: "Total active value",
      openRegulatoryImpactsCritical: "Critical regulatory impacts",
      aiCostUsdWindow: "AI cost (USD)",
      aiCostHelper: "Capped at the last 90 days.",
      aiCostDenied:
        "You don't have the ai.observability.read permission to view AI costs.",
      windowDays: "Window (days)",
      windowDaysHelper: "Default 90 days; up to 365.",
    },
    expiryCliffs: {
      title: "Expiry cliffs",
      description: "Contracts expiring in the next 30 / 60 / 90 days.",
      next30d: "Next 30 days",
      next60d: "Next 60 days",
      next90d: "Next 90 days",
    },
    contractsByStatus: {
      title: "Contracts by status",
    },
    valueDistribution: {
      title: "Value distribution",
      description: "Contract count by AED bucket.",
      bucket: {
        "<100k": "Below 100k",
        "100k-1M": "100k – 1M",
        "1M-10M": "1M – 10M",
        "10M+": "Above 10M",
      },
    },
    topCounterparties: {
      title: "Top counterparties",
      description: "By total active contract value (top 5).",
      counterparty: "Counterparty",
      totalValue: "Total value",
      contractCount: "Contracts",
      idLabel: "ID #{{id}}",
      namePending: "Name pending",
    },
    trends: {
      valueOverTimeTitle: "Value over time",
      contractsCreatedTitle: "Contracts created",
    },
    errors: {
      loadFailed: "Could not load the executive dashboard.",
    },
  },

  executiveAnomalies: {
    title: "Executive anomalies",
    subtitle: "AI-detected anomalies in your contract portfolio.",
    historyTitle: "Cached anomalies",
    historyDescription: "Most recent anomaly snapshots from the AI cache.",
    limitLabel: "Limit",
    refreshAria: "Refresh anomalies history",
    detectedAt: "Detected",
    unsummarized: "(no summary available)",
    emptyTitle: "No anomalies cached yet",
    emptyDescription:
      "Run the executive anomalies detection from the executive dashboard to populate this list.",
    errors: {
      loadFailed: "Could not load the anomalies history.",
    },
  },

  aiCost: {
    title: "AI cost summary",
    totalCostUsdWindow: "Total cost (USD)",
    totalRequestsWindow: "Total requests",
    cacheHitRatioOverall: "Cache hit ratio",
    noRequestsHelper: "No requests in this window.",
    topPromptsTitle: "Top prompts by cost",
    promptId: "Prompt",
    requestCount: "Requests",
    totalCostUsd: "Cost (USD)",
    cacheHitRatio: "Cache hits",
    noPrompts: "No prompt activity in this window.",
    errors: {
      loadFailed: "Could not load the AI cost summary.",
    },
  },

  adminHealth: {
    title: "System health",
    subtitle: "Live status of database and AI subsystems.",
    refreshAria: "Refresh health probe",
    overall: {
      ok: "All systems operational",
      degraded: "Degraded service",
      unhealthy: "Service unhealthy",
    },
    overallDescription:
      "Combined database and AI status. Auto-refreshes every 60 seconds.",
    db: {
      title: "Database",
      status: "Status",
      statusValue: {
        ok: "Healthy",
        degraded: "Degraded",
      },
      latestMigration: "Latest migration",
      latestMigrationNullHint:
        "schema_migrations is unreadable on this connection — verify migration 054 (schema_migrations_select_admin policy) was applied.",
      currentTimestamp: "Server time",
    },
    ai: {
      title: "AI subsystem",
      estimatedHealthy: "Estimated health",
      healthy: "Healthy",
      degraded: "Degraded",
      lastSuccessfulRequestAt: "Last successful request",
      lastFailureAt: "Last failure",
    },
    errors: {
      loadFailed: "Could not load the system health probe.",
    },
  },
};

const arDashboards = {
  common: {
    timeRangeLabel: "النطاق الزمني",
    range: {
      last_7d: "آخر 7 أيام",
      last_30d: "آخر 30 يومًا",
      last_90d: "آخر 90 يومًا",
      custom: "مخصص",
      customDaysLabel: "أيام",
    },
    featurePending: "الميزة قيد التطوير — قادمة في وحدة لاحقة.",
    emptyList: "لا توجد بيانات لعرضها بعد.",
    noDataDash: "—",
    hoursAbbrev: "س",
    updated: "تم التحديث {{when}}",
    detected: "تم الاكتشاف",
    effective: "سارٍ",
    date: "التاريخ",
    month: "الشهر",
    count: "العدد",
    totalValue: "إجمالي القيمة",
    openContractAria: "فتح العقد {{number}} — {{title}}",
    severity: {
      critical: "حرجة",
      high: "عالية",
      medium: "متوسطة",
      low: "منخفضة",
      unknown: "غير معروفة",
    },
  },

  admin: {
    title: "لوحة المسؤول",
    landingTitle: "صفحة المسؤول الرئيسية",
    subtitle: "مؤشرات الأداء الرئيسية على مستوى النظام والنشاط الأخير.",
    kpiGroupLabel: "مؤشرات أداء المسؤول",
    kpis: {
      totalContractsActive: "العقود النشطة",
      expiringWithin30d: "تنتهي خلال 30 يومًا",
      expiringWithin90d: "تنتهي خلال 90 يومًا",
      pendingApprovals: "موافقات معلقة",
      pendingSignatures: "توقيعات معلقة",
      openRegulatoryImpacts: "تأثيرات تنظيمية مفتوحة",
      recentAuditEvents: "أحداث التدقيق الأخيرة",
      totalActiveUsers: "المستخدمون النشطون",
    },
    contractsByStatus: {
      title: "العقود حسب الحالة",
      description: "التوزيع المباشر عبر جميع العقود النشطة.",
    },
    trends: {
      contractsCreatedTitle: "العقود التي تم إنشاؤها",
      contractsCreatedDescription: "العدد اليومي خلال النطاق المحدد.",
      decisionsTitle: "قرارات الموافقة",
      decisionsDescription: "أعداد الموافقة / الرفض لكل يوم.",
      created: "تم الإنشاء",
      approved: "تمت الموافقة",
      rejected: "تم الرفض",
    },
    tileGrid: {
      quickActionsTitle: "إجراءات سريعة",
      contracts: "العقود",
      approvals: "الموافقات",
      regulatoryRadar: "رادار التنظيم",
      imports: "الاستيراد",
      aiRequests: "طلبات الذكاء الاصطناعي",
      health: "صحة النظام",
      aiCosts: "تكاليف الذكاء الاصطناعي",
    },
    errors: {
      loadFailed: "تعذر تحميل لوحة المسؤول.",
    },
  },

  drafter: {
    title: "لوحة المُحرّر",
    subtitle: "مسوّداتك وما ينتظر تصرفك.",
    kpiGroupLabel: "مؤشرات أداء المُحرّر",
    kpis: {
      myDraftsCount: "مسوّداتي",
      awaitingMyActionCount: "بانتظار إجرائي",
      readyToSendCount: "جاهز للإرسال",
      myRecentlyApprovedCount: "تمت الموافقة مؤخرًا",
    },
    lists: {
      myDraftsTitle: "مسوّداتي",
      myDraftsDescription: "أحدث المسوّدات التي قمت بإنشائها.",
      awaitingMyActionTitle: "بانتظار إجرائي",
      awaitingMyActionDescription: "العناصر التي أُعيدت للمراجعة.",
    },
    lastDecisionNote: "ملاحظة آخر قرار",
    errors: {
      loadFailed: "تعذر تحميل لوحة المُحرّر.",
    },
  },

  approver: {
    title: "لوحة المعتمد",
    subtitle: "قائمة الانتظار ومؤشرات اتخاذ القرار الخاصة بك.",
    kpiGroupLabel: "مؤشرات أداء المعتمد",
    kpis: {
      pendingMyApprovalCount: "بانتظار موافقتي",
      pendingMyApprovalCountHelper: "تشمل العناصر المُفوّضة والمُعاد إسنادها.",
      decidedByMeCount: "تم البت من قبلي",
      averageDecisionHoursMine: "متوسط الساعات (لي)",
      averageDecisionHoursTeam: "متوسط الساعات (الفريق)",
    },
    lists: {
      pendingQueueTitle: "قائمة الانتظار",
      pendingQueueDescription: "أعلى 5 عقود بانتظار قرارك.",
      contract: "العقد",
      value: "القيمة",
      requestedAt: "طُلب في",
      hoursWaiting: "ساعات الانتظار",
    },
    errors: {
      loadFailed: "تعذر تحميل لوحة المعتمد.",
    },
  },

  legalCounsel: {
    title: "لوحة المستشار القانوني",
    subtitle: "التحديثات التنظيمية والتأثيرات ورؤية التدقيق.",
    kpiGroupLabel: "مؤشرات أداء المستشار القانوني",
    kpis: {
      regulatoryUpdatesThisWindow: "التحديثات التنظيمية",
      openRegulatoryImpacts: "التأثيرات المفتوحة",
      criticalSeverityCount: "ذات خطورة حرجة",
      regulationCatalogSize: "حجم كتالوج اللوائح",
      templateUsageThisWindow: "استخدام القوالب",
      templateUsageHint: "قادمة مع وحدة القوالب — هذه البلاطة معطلة عمدًا.",
      auditEventsLabel: "أحداث التدقيق",
      auditSummaryDenied: "ليس لديك صلاحية audit.read لعرض هذا التفصيل.",
    },
    auditSummary: {
      title: "أحداث التدقيق حسب الجدول",
      description: "الأعداد مجمّعة حسب اسم الجدول المُدقّق.",
    },
    lists: {
      recentRegulatoryUpdatesTitle: "أحدث التحديثات التنظيمية",
      recentRegulatoryUpdatesDescription: "أحدث 5 تحديثات.",
      openImpactsTitle: "التأثيرات المفتوحة",
      openImpactsDescription: "أعلى 5 تأثيرات تنظيمية لم تُحل.",
    },
    errors: {
      loadFailed: "تعذر تحميل لوحة المستشار القانوني.",
    },
  },

  recipient: {
    title: "لوحة المستلم",
    subtitle: "عقودك وصندوق التوقيع الخاص بك.",
    kpiGroupLabel: "مؤشرات أداء المستلم",
    kpis: {
      myContractsCount: "عقودي",
      pendingMySignatureCount: "بانتظار توقيعي",
      signedByMeWindow: "وقّعتُ",
      signedByMeWindowHelper:
        "تُحسب التواقيع الداخلية فقط — لا تُشمل تواقيع المدعوين الخارجيين.",
      myObligationsCount: "التزاماتي",
      myObligationsHint: "قادمة مع وحدة الالتزامات — هذه البلاطة معطلة عمدًا.",
    },
    lists: {
      myContractsTitle: "عقودي",
      myContractsDescription: "العقود التي تظهر فيها كموقّع.",
      pendingSignaturesTitle: "تواقيع معلقة",
      pendingSignaturesDescription: "الدعوات النشطة الموجهة إليك.",
      counterpartyPending: "تفاصيل الطرف المقابل: قيد التحضير",
      invitationSent: "أُرسلت الدعوة",
      invitationExpires: "تنتهي",
    },
    errors: {
      loadFailed: "تعذر تحميل لوحة المستلم.",
    },
  },

  insightsRouter: {
    title: "الرؤى",
    detecting: "نحدد لوحة التحكم المناسبة لك…",
    redirecting: "نوجهك إلى لوحة {{dashboard}}…",
    target: {
      admin: "المسؤول",
      drafter: "المُحرّر",
      approver: "المعتمد",
      legal_counsel: "المستشار القانوني",
      recipient: "المستلم",
      executive: "التنفيذية",
    },
    errors: {
      loadFailed: "تعذر تحديد لوحة التحكم الخاصة بك.",
    },
  },

  executive: {
    title: "اللوحة التنفيذية",
    subtitle: "نظرة شاملة على قيمة العقود ومخاطرها.",
    kpiGroupLabel: "مؤشرات الأداء التنفيذية",
    kpis: {
      totalActiveValueAed: "إجمالي القيمة النشطة",
      openRegulatoryImpactsCritical: "تأثيرات تنظيمية حرجة",
      aiCostUsdWindow: "تكلفة الذكاء الاصطناعي (دولار)",
      aiCostHelper: "محدد بآخر 90 يومًا.",
      aiCostDenied: "ليس لديك صلاحية ai.observability.read لعرض تكاليف الذكاء الاصطناعي.",
      windowDays: "النطاق (أيام)",
      windowDaysHelper: "افتراضيًا 90 يومًا؛ حتى 365.",
    },
    expiryCliffs: {
      title: "حواف الانتهاء",
      description: "العقود التي تنتهي خلال 30 / 60 / 90 يومًا التالية.",
      next30d: "خلال 30 يومًا",
      next60d: "خلال 60 يومًا",
      next90d: "خلال 90 يومًا",
    },
    contractsByStatus: {
      title: "العقود حسب الحالة",
    },
    valueDistribution: {
      title: "توزيع القيم",
      description: "عدد العقود حسب فئة القيمة بالدرهم.",
      bucket: {
        "<100k": "أقل من 100 ألف",
        "100k-1M": "100 ألف – 1 مليون",
        "1M-10M": "1 – 10 ملايين",
        "10M+": "أكثر من 10 ملايين",
      },
    },
    topCounterparties: {
      title: "أعلى الأطراف المقابلة",
      description: "حسب إجمالي قيمة العقود النشطة (أعلى 5).",
      counterparty: "الطرف المقابل",
      totalValue: "إجمالي القيمة",
      contractCount: "عدد العقود",
      idLabel: "المعرف #{{id}}",
      namePending: "الاسم قيد التحضير",
    },
    trends: {
      valueOverTimeTitle: "القيمة عبر الزمن",
      contractsCreatedTitle: "العقود التي تم إنشاؤها",
    },
    errors: {
      loadFailed: "تعذر تحميل اللوحة التنفيذية.",
    },
  },

  executiveAnomalies: {
    title: "الشذوذات التنفيذية",
    subtitle: "شذوذات اكتشفها الذكاء الاصطناعي في محفظة عقودك.",
    historyTitle: "الشذوذات المخزنة",
    historyDescription: "أحدث لقطات الشذوذ من ذاكرة الذكاء الاصطناعي.",
    limitLabel: "الحد",
    refreshAria: "تحديث سجل الشذوذات",
    detectedAt: "تم الاكتشاف",
    unsummarized: "(لا يوجد ملخص متاح)",
    emptyTitle: "لا توجد شذوذات مخزنة بعد",
    emptyDescription:
      "قم بتشغيل اكتشاف الشذوذات التنفيذية من اللوحة التنفيذية لملء هذه القائمة.",
    errors: {
      loadFailed: "تعذر تحميل سجل الشذوذات.",
    },
  },

  aiCost: {
    title: "ملخص تكاليف الذكاء الاصطناعي",
    totalCostUsdWindow: "إجمالي التكلفة (دولار)",
    totalRequestsWindow: "إجمالي الطلبات",
    cacheHitRatioOverall: "نسبة الإصابة في الذاكرة المؤقتة",
    noRequestsHelper: "لا توجد طلبات في هذا النطاق.",
    topPromptsTitle: "أعلى التلميحات تكلفة",
    promptId: "التلميح",
    requestCount: "الطلبات",
    totalCostUsd: "التكلفة (دولار)",
    cacheHitRatio: "إصابات الذاكرة",
    noPrompts: "لا يوجد نشاط للتلميحات في هذا النطاق.",
    errors: {
      loadFailed: "تعذر تحميل ملخص تكاليف الذكاء الاصطناعي.",
    },
  },

  adminHealth: {
    title: "صحة النظام",
    subtitle: "الحالة المباشرة لأنظمة قاعدة البيانات والذكاء الاصطناعي.",
    refreshAria: "تحديث فحص الصحة",
    overall: {
      ok: "جميع الأنظمة تعمل",
      degraded: "أداء متدنٍ",
      unhealthy: "الخدمة غير سليمة",
    },
    overallDescription:
      "حالة قاعدة البيانات والذكاء الاصطناعي مجتمعة. يتم التحديث التلقائي كل 60 ثانية.",
    db: {
      title: "قاعدة البيانات",
      status: "الحالة",
      statusValue: {
        ok: "سليمة",
        degraded: "متدنية",
      },
      latestMigration: "أحدث ترحيل",
      latestMigrationNullHint:
        "تعذرت قراءة جدول schema_migrations على هذا الاتصال — تحقق من تطبيق الترحيل 054 (سياسة schema_migrations_select_admin).",
      currentTimestamp: "وقت الخادم",
    },
    ai: {
      title: "نظام الذكاء الاصطناعي",
      estimatedHealthy: "الصحة المقدرة",
      healthy: "سليم",
      degraded: "متدنٍ",
      lastSuccessfulRequestAt: "آخر طلب ناجح",
      lastFailureAt: "آخر فشل",
    },
    errors: {
      loadFailed: "تعذر تحميل فحص صحة النظام.",
    },
  },
};

// ─── Inject under top-level `dashboards` namespace ──────────────────────────

if (en.dashboards) {
  console.error("FAIL: en.dashboards already exists. Refusing to overwrite.");
  process.exit(1);
}
if (ar.dashboards) {
  console.error("FAIL: ar.dashboards already exists. Refusing to overwrite.");
  process.exit(1);
}

en.dashboards = enDashboards;
ar.dashboards = arDashboards;

// ─── Deep-leaf parity check ────────────────────────────────────────────────

function leafCount(obj) {
  if (obj == null) return 0;
  if (typeof obj !== "object") return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item) => sum + leafCount(item), 0);
  }
  return Object.values(obj).reduce((sum, v) => sum + leafCount(v), 0);
}

const enLeaves = leafCount(en);
const arLeaves = leafCount(ar);

console.log(`EN leaves: ${enLeaves}`);
console.log(`AR leaves: ${arLeaves}`);
console.log(`Parity: ${enLeaves === arLeaves ? "OK" : "FAIL"}`);

if (enLeaves !== arLeaves) {
  console.error(
    `FAIL: i18n parity broken — EN ${enLeaves} vs AR ${arLeaves}. Aborting.`,
  );
  process.exit(1);
}

const dashLeavesEn = leafCount(enDashboards);
const dashLeavesAr = leafCount(arDashboards);
console.log(`M6 added EN leaves: ${dashLeavesEn}`);
console.log(`M6 added AR leaves: ${dashLeavesAr}`);

if (dashLeavesEn !== dashLeavesAr) {
  console.error(
    `FAIL: M6 dashboards parity broken — EN ${dashLeavesEn} vs AR ${dashLeavesAr}. Aborting.`,
  );
  process.exit(1);
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + "\n", "utf8");
fs.writeFileSync(AR_PATH, JSON.stringify(ar, null, 2) + "\n", "utf8");

console.log("Wrote en.json + ar.json with M6 dashboards keys.");
