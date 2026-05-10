/**
 * One-shot Node script run by Agent 8 (M8 / CR-A2) to inject Internal Signal
 * Kinds catalogue i18n keys into en.json and ar.json with parity. Mirrors
 * the m6-i18n-inject.cjs pattern.
 *
 * Run: node scripts/m8-i18n-inject.cjs
 */
const fs = require("fs");
const path = require("path");

const EN_PATH = path.join(__dirname, "..", "src", "i18n", "en.json");
const AR_PATH = path.join(__dirname, "..", "src", "i18n", "ar.json");

const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
const ar = JSON.parse(fs.readFileSync(AR_PATH, "utf8"));

// ============================================================
// 1. Sidebar / nav label
// ============================================================
en.nav = en.nav ?? {};
ar.nav = ar.nav ?? {};
en.nav.adminInternalSignalKinds = "Internal signal kinds";
ar.nav.adminInternalSignalKinds = "أنواع الإشارات الداخلية";

// ============================================================
// 2. admin.internalSignalKinds.* sub-namespace
// ============================================================
en.admin = en.admin ?? {};
ar.admin = ar.admin ?? {};

const enInternal = {
  title: "Internal Signal Kinds",
  subtitle:
    "Catalogue of operational risk signals ingested via the harness API and consumed by dashboards.",
  loading: "Loading internal signal kinds…",
  empty: {
    title: "No internal signal kinds configured",
    body:
      "The catalogue is seeded by the M8 migration. If this list is empty the seed has not run for this tenant.",
  },
  error: {
    fetch: "Could not load internal signal kinds.",
    retry: "Retry",
  },
  columns: {
    signalType: "Signal type",
    displayName: "Display name",
    defaultSeverity: "Default severity",
    description: "Description",
    parameterSchema: "Parameter schema",
  },
  schema: {
    summary: "{{req}} required · {{opt}} optional",
    required: "Required",
    optional: "Optional",
  },
  actions: {
    showSchema: "Show parameter schema",
    hideSchema: "Hide parameter schema",
  },
  severity: {
    informational: "Informational",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  },
  signalType: {
    milestone_slippage: "Milestone slippage",
    sla_breach: "SLA breach",
    payment_delay: "Payment delay",
    invoice_dispute: "Invoice dispute",
    vendor_incident: "Vendor incident",
    ics_incident: "ICS incident",
    icv_status_change: "ICV status change",
    certificate_expiry: "Certificate expiry",
  },
};

const arInternal = {
  title: "أنواع الإشارات الداخلية",
  subtitle:
    "كتالوج إشارات المخاطر التشغيلية التي تُستوعَب عبر واجهة المحاكاة وتظهر في لوحات المعلومات.",
  loading: "جارٍ تحميل أنواع الإشارات الداخلية…",
  empty: {
    title: "لا توجد أنواع إشارات داخلية مُهيَّأة",
    body:
      "يُعبَّأ الكتالوج من خلال ترحيل M8. إذا كانت القائمة فارغة فلم يُشغَّل البذر لهذا المستأجر.",
  },
  error: {
    fetch: "تعذَّر تحميل أنواع الإشارات الداخلية.",
    retry: "إعادة المحاولة",
  },
  columns: {
    signalType: "نوع الإشارة",
    displayName: "الاسم المعروض",
    defaultSeverity: "الخطورة الافتراضية",
    description: "الوصف",
    parameterSchema: "مخطَّط المعاملات",
  },
  schema: {
    summary: "{{req}} مطلوب · {{opt}} اختياري",
    required: "مطلوب",
    optional: "اختياري",
  },
  actions: {
    showSchema: "إظهار مخطَّط المعاملات",
    hideSchema: "إخفاء مخطَّط المعاملات",
  },
  severity: {
    informational: "إعلامي",
    low: "منخفض",
    medium: "متوسط",
    high: "مرتفع",
    critical: "حرج",
  },
  signalType: {
    milestone_slippage: "تأخُّر معلَم زمني",
    sla_breach: "خرق اتفاقية مستوى الخدمة",
    payment_delay: "تأخُّر السداد",
    invoice_dispute: "نزاع على فاتورة",
    vendor_incident: "حادث مورِّد",
    ics_incident: "حادث أنظمة تحكُّم صناعية",
    icv_status_change: "تغيُّر حالة القيمة المضافة داخل الدولة",
    certificate_expiry: "انتهاء صلاحية شهادة",
  },
};

en.admin.internalSignalKinds = enInternal;
ar.admin.internalSignalKinds = arInternal;

// ============================================================
// 3. Parity check — every leaf key in en MUST exist in ar
// ============================================================
function leafKeys(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...leafKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

const enLeaves = leafKeys(en, "");
const arLeaves = leafKeys(ar, "");
const enSet = new Set(enLeaves);
const arSet = new Set(arLeaves);

const missingInAr = enLeaves.filter((k) => !arSet.has(k));
const missingInEn = arLeaves.filter((k) => !enSet.has(k));

if (missingInAr.length > 0 || missingInEn.length > 0) {
  console.error("PARITY FAIL");
  if (missingInAr.length > 0) {
    console.error("  missing in ar:", missingInAr.slice(0, 10));
  }
  if (missingInEn.length > 0) {
    console.error("  missing in en:", missingInEn.slice(0, 10));
  }
  process.exit(1);
}

// ============================================================
// 4. Write back
// ============================================================
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + "\n", "utf8");
fs.writeFileSync(AR_PATH, JSON.stringify(ar, null, 2) + "\n", "utf8");

console.log(
  `M8 i18n inject OK — en leaves: ${enLeaves.length}, ar leaves: ${arLeaves.length}`,
);
