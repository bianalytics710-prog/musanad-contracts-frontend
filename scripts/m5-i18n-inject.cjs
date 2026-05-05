/**
 * One-shot Node script run by Agent 8 to inject M5 i18n keys into
 * en.json and ar.json with parity. Executed once and removed (or kept as
 * audit trail). Mirrors the M4 i18n-defect-patch precedent.
 *
 * Run: node scripts/m5-i18n-inject.cjs
 */
const fs = require("fs");
const path = require("path");

const EN_PATH = path.join(__dirname, "..", "src", "i18n", "en.json");
const AR_PATH = path.join(__dirname, "..", "src", "i18n", "ar.json");

const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
const ar = JSON.parse(fs.readFileSync(AR_PATH, "utf8"));

// ============================================================
// M5 — Regulatory Radar — namespace: `regulatory.*`
// ============================================================
// We namespace M5 strings under `regulatory.*` (rather than reuse Lovable's
// existing `regulations.*`) so the M5 v2.6 surface is fully self-contained
// and does not collide with the Lovable wireframes that may still reference
// the older keys during the harden-vs-regenerate cutover.
// ============================================================

const enRegulatory = {
  regulation: {
    list: {
      title: "Regulation Library",
      totalCount_one: "{{count}} regulation",
      totalCount_other: "{{count}} regulations",
      searchLabel: "Search regulations",
      searchPlaceholder: "Search by reference code or title…",
      allJurisdictions: "All jurisdictions",
      allTypes: "All types",
      allStatuses: "All statuses",
      empty: "No regulations match the current filters.",
      createButton: "New regulation",
      editAction: "Edit {{name}}",
      deleteAction: "Delete {{name}}",
      supersededBy: "Superseded by {{code}}",
    },
    detail: {
      loading: "Loading regulation…",
      supersededByChain: "Supersession chain",
      depthLabel: "Depth {{depth}}",
    },
    create: {
      title: "Create regulation",
      submit: "Create regulation",
    },
    edit: {
      title: "Edit regulation",
      submit: "Save changes",
    },
    delete: {
      title: "Delete regulation",
      confirmMessage:
        "Soft-delete regulation {{code}} — “{{title}}”? This is reversible by an admin.",
      activeImpactsWarning:
        "Regulations referenced by active impacts cannot be deleted until those impacts are resolved.",
      confirmAction: "Delete",
    },
    fields: {
      referenceCode: "Reference code",
      titleEn: "Title (English)",
      titleAr: "Title (Arabic)",
      issuer: "Issuer",
      regulationType: "Type",
      jurisdiction: "Jurisdiction",
      effectiveDate: "Effective date",
      summary: "Summary",
      summaryEn: "Summary (English)",
      summaryAr: "Summary (Arabic)",
      sourceUrl: "Source URL",
      tags: "Tags",
      status: "Status",
    },
    placeholders: {
      referenceCode: "FED-LAW-33-2021",
      selectIssuer: "Select an issuer",
      selectType: "Select a type",
      selectJurisdiction: "Select a jurisdiction",
    },
    helpText: {
      tagsCommaSeparated: "Comma-separated tags",
    },
    regulationType: {
      federal_decree_law: "Federal decree-law",
      cabinet_resolution: "Cabinet resolution",
      ministerial_decision: "Ministerial decision",
      free_zone_regulation: "Free-zone regulation",
      circular: "Circular",
      guideline: "Guideline",
    },
    jurisdiction: {
      uae_federal: "UAE Federal",
      dubai: "Dubai",
      abu_dhabi: "Abu Dhabi",
      sharjah: "Sharjah",
      difc: "DIFC",
      adgm: "ADGM",
      dmcc: "DMCC",
      other: "Other",
    },
    status: {
      active: "Active",
      superseded: "Superseded",
      repealed: "Repealed",
      draft: "Draft",
    },
    toast: {
      createSuccess: "Regulation created successfully.",
      updateSuccess: "Regulation updated successfully.",
      deleteSuccess: "Regulation deleted.",
    },
  },
  regulatoryUpdate: {
    list: {
      title: "Regulatory Updates",
      createButton: "Add regulatory update",
      empty: "No regulatory updates match the current filters.",
    },
    detail: {
      loading: "Loading update…",
      ariaLabel: "Regulatory update detail",
      bulkAmend: "Bulk amend impacts",
      impactSummary: "Impact summary",
      totalImpacts: "Total",
      pendingCount: "Pending",
      resolvedCount: "Resolved",
      avgImpactScore: "Avg score",
    },
    create: {
      title: "New regulatory update",
      submit: "Create",
    },
    edit: {
      title: "Edit regulatory update",
      submit: "Save changes",
    },
    delete: {
      title: "Delete regulatory update",
      confirmMessage:
        "Soft-delete this regulatory update? — “{{title}}”",
      cascadeWarning:
        "Associated impacts (where regulatory_update_id matches) will be soft-deleted in cascade. Structural impacts (no associated update) are not affected.",
      confirmAction: "Delete update",
    },
    fields: {
      regulator: "Regulator",
      titleEn: "Title (English)",
      titleAr: "Title (Arabic)",
      summary: "Summary",
      summaryEn: "Summary (English)",
      summaryAr: "Summary (Arabic)",
      referenceNumber: "Reference number",
      publishedDate: "Published date",
      effectiveDate: "Effective date",
      complianceDeadline: "Compliance deadline",
      severity: "Severity",
      sourceUrl: "Source URL",
      affectedClauseCategories: "Affected clause categories",
      category: "Impact category",
      subSource: "Sub-source",
    },
    placeholders: {
      selectRegulator: "Select a regulator",
      noCategory: "— No category —",
    },
    helpText: {
      affectedClauseCategoriesCommaSeparated: "Comma-separated categories",
    },
    severity: {
      low: "Low",
      medium: "Medium",
      high: "High",
      critical: "Critical",
    },
    openSource: "Open source",
    toast: {
      createSuccess: "Regulatory update created.",
      updateSuccess: "Regulatory update saved.",
      deleteSuccess: "Regulatory update deleted.",
    },
  },
  impact: {
    list: {
      empty: "No regulatory impacts in this scope.",
    },
    structuralBadge: "Structural",
    detectedAt: "Detected",
    score: "Score",
    actions: {
      resolve: "Resolve",
      update: "Update",
    },
    status: {
      pending: "Pending",
      resolved: "Resolved",
    },
    resolutionAction: {
      amended: "Amended",
      waived: "Waived",
      out_of_scope: "Out of scope",
      pending: "Pending",
    },
    resolutionActionHelp: {
      amended:
        "The contract was amended to comply with the new regulation.",
      waived:
        "The impact was reviewed and accepted as a known deviation; no contract change.",
      out_of_scope:
        "On further review the regulation does not apply to this contract.",
      pending: "Re-open this impact for further review (un-resolves).",
    },
    resolve: {
      title: "Resolve regulatory impact",
      actionLabel: "Resolution action",
      noteLabel: "Resolution note (optional)",
      notePlaceholder: "Brief context for auditors…",
      noteHelp: "Stored verbatim on the audit trail.",
      submit: "Save resolution",
    },
    toast: {
      bulkDetectSuccess:
        "{{created}} impacts created · {{skipped}} duplicates skipped.",
      resolveSuccess: "Impact resolved.",
    },
  },
  bulkAmend: {
    title: "Bulk amendment — detect impacts",
    empty: "No contracts in scope. Re-open from a regulation context.",
    selectColumn: "Select",
    selectRow: "Toggle row {{number}}",
    selectionCount: "{{selected}} of {{total}} contracts selected",
    submit: "Detect on {{count}} contracts",
    fields: {
      contract: "Contract",
      impactScore: "Impact score",
      noteEn: "Note (English)",
    },
    placeholders: {
      noteEn: "Short tag — radar tooltip",
    },
  },
  banner: {
    affected_one: "Affected by {{count}} pending regulation",
    affected_other: "Affected by {{count}} pending regulations",
    regulatoryUpdate: "Regulatory update",
    reviewAll: "Review all",
  },
  impactCategory: {
    list: {
      title: "Impact Categories",
      subtitle: "Configure the canonical categories used to group regulatory updates.",
      includeInactive: "Include inactive",
      empty: "No impact categories configured.",
      createButton: "New category",
      editAction: "Edit {{key}}",
    },
    create: {
      title: "Create impact category",
      submit: "Create category",
    },
    edit: {
      title: "Edit impact category",
      submit: "Save changes",
    },
    fields: {
      key: "Key",
      nameEn: "Name (English)",
      nameAr: "Name (Arabic)",
      descriptionEn: "Description (English)",
      descriptionAr: "Description (Arabic)",
      icon: "Icon",
      colour: "Colour",
      active: "Active",
      displayOrder: "Display order",
      sources: "Sources",
      severityScale: "Severity scale",
      defaultClauseCategories: "Default clause categories",
      aiPromptContext: "AI prompt context",
    },
    helpText: {
      severityScaleCommaSeparated: "Comma-separated; default low,medium,high,critical.",
      aiPromptContextHint:
        "Admin guidance text used by the AI prompt. Not user PII.",
    },
    activeBadge: "Active",
    inactiveBadge: "Inactive",
    picker: {
      ariaLabel: "Impact category",
      placeholderRequired: "Select a category",
      placeholderOptional: "— No category —",
    },
    toast: {
      createSuccess: "Category created.",
      updateSuccess: "Category saved.",
    },
  },
  radar: {
    title: "Regulatory Radar",
    subtitle_one: "{{count}} regulatory update visible",
    subtitle_other: "{{count}} regulatory updates visible",
    searchLabel: "Search regulatory updates",
    searchPlaceholder: "Search by title, regulator, or reference number…",
    allSeverities: "All severities",
    effectiveFrom: "Effective from",
    effectiveTo: "Effective to",
    empty: "No regulatory updates match the current filters.",
    selectHint: "Select a dot on the radar to see details.",
    centerLabel: "Today",
    rings: {
      today: "Today",
      week: "Week",
      month: "Month",
      quarter: "Quarter",
    },
    quadrants: {
      north: "Federal labour",
      east: "Tax & finance",
      south: "Free zones",
      west: "Sectoral",
    },
    tooltip: {
      regulator: "Regulator",
      published: "Published",
      impacts_one: "{{count}} impacted contract",
      impacts_other: "{{count}} impacted contracts",
    },
    controls: {
      panHint: "Shift+drag to pan · scroll to zoom",
    },
  },
  errors: {
    referenceCodeRequired: "Reference code is required.",
    referenceCodeTooLong: "Reference code is too long.",
    titleEnRequired: "English title is required.",
    titleEnTooLong: "English title is too long.",
    issuerRequired: "Issuer is required.",
    regulatorRequired: "Regulator is required.",
    publishedDateRequired: "Published date is required.",
    effectiveBeforePublished: "Effective date cannot be before published date.",
    deadlineBeforePublished: "Compliance deadline cannot be before published date.",
    invalidUrl: "Enter a valid URL.",
    keyRequired: "Key is required.",
    keyFormat:
      "Key must start with a letter and use only lowercase letters, digits, or underscores.",
    nameEnRequired: "English name is required.",
    nameArRequired: "Arabic name is required.",
  },
};

const arRegulatory = {
  regulation: {
    list: {
      title: "مكتبة اللوائح",
      totalCount_one: "لائحة واحدة",
      totalCount_other: "{{count}} لائحة",
      searchLabel: "البحث في اللوائح",
      searchPlaceholder: "ابحث برقم المرجع أو العنوان…",
      allJurisdictions: "جميع الاختصاصات",
      allTypes: "جميع الأنواع",
      allStatuses: "جميع الحالات",
      empty: "لا توجد لوائح تطابق المرشحات الحالية.",
      createButton: "لائحة جديدة",
      editAction: "تعديل {{name}}",
      deleteAction: "حذف {{name}}",
      supersededBy: "مُلغاة بواسطة {{code}}",
    },
    detail: {
      loading: "جارٍ تحميل اللائحة…",
      supersededByChain: "سلسلة الإلغاء",
      depthLabel: "العمق {{depth}}",
    },
    create: {
      title: "إنشاء لائحة",
      submit: "إنشاء اللائحة",
    },
    edit: {
      title: "تعديل اللائحة",
      submit: "حفظ التغييرات",
    },
    delete: {
      title: "حذف اللائحة",
      confirmMessage:
        "حذف ناعم للائحة {{code}} — “{{title}}”؟ يمكن للمسؤول التراجع عن هذا الإجراء.",
      activeImpactsWarning:
        "لا يمكن حذف اللوائح المرتبطة بآثار نشطة حتى يتم حلّ تلك الآثار.",
      confirmAction: "حذف",
    },
    fields: {
      referenceCode: "رمز المرجع",
      titleEn: "العنوان (الإنجليزية)",
      titleAr: "العنوان (العربية)",
      issuer: "الجهة المصدرة",
      regulationType: "النوع",
      jurisdiction: "الاختصاص",
      effectiveDate: "تاريخ النفاذ",
      summary: "الملخص",
      summaryEn: "الملخص (الإنجليزية)",
      summaryAr: "الملخص (العربية)",
      sourceUrl: "رابط المصدر",
      tags: "الوسوم",
      status: "الحالة",
    },
    placeholders: {
      referenceCode: "FED-LAW-33-2021",
      selectIssuer: "اختر جهة مصدرة",
      selectType: "اختر نوعًا",
      selectJurisdiction: "اختر اختصاصًا",
    },
    helpText: {
      tagsCommaSeparated: "وسوم مفصولة بفواصل",
    },
    regulationType: {
      federal_decree_law: "قانون اتحادي بمرسوم",
      cabinet_resolution: "قرار مجلس الوزراء",
      ministerial_decision: "قرار وزاري",
      free_zone_regulation: "لائحة منطقة حرة",
      circular: "تعميم",
      guideline: "إرشادات",
    },
    jurisdiction: {
      uae_federal: "اتحادي — الإمارات",
      dubai: "دبي",
      abu_dhabi: "أبوظبي",
      sharjah: "الشارقة",
      difc: "DIFC",
      adgm: "ADGM",
      dmcc: "DMCC",
      other: "أخرى",
    },
    status: {
      active: "نشطة",
      superseded: "مُلغاة",
      repealed: "ملغاة كليًا",
      draft: "مسودة",
    },
    toast: {
      createSuccess: "تم إنشاء اللائحة بنجاح.",
      updateSuccess: "تم حفظ اللائحة بنجاح.",
      deleteSuccess: "تم حذف اللائحة.",
    },
  },
  regulatoryUpdate: {
    list: {
      title: "التحديثات التنظيمية",
      createButton: "إضافة تحديث تنظيمي",
      empty: "لا توجد تحديثات تنظيمية تطابق المرشحات الحالية.",
    },
    detail: {
      loading: "جارٍ تحميل التحديث…",
      ariaLabel: "تفاصيل التحديث التنظيمي",
      bulkAmend: "تعديل جماعي للآثار",
      impactSummary: "ملخص الأثر",
      totalImpacts: "الإجمالي",
      pendingCount: "قيد الانتظار",
      resolvedCount: "تم الحل",
      avgImpactScore: "متوسط الدرجة",
    },
    create: {
      title: "تحديث تنظيمي جديد",
      submit: "إنشاء",
    },
    edit: {
      title: "تعديل التحديث التنظيمي",
      submit: "حفظ التغييرات",
    },
    delete: {
      title: "حذف التحديث التنظيمي",
      confirmMessage: "حذف ناعم لهذا التحديث التنظيمي؟ — “{{title}}”",
      cascadeWarning:
        "ستُحذف الآثار المرتبطة (حيث يتطابق regulatory_update_id) بالتسلسل. الآثار البنيوية (دون تحديث مرتبط) لن تتأثر.",
      confirmAction: "حذف التحديث",
    },
    fields: {
      regulator: "المنظِّم",
      titleEn: "العنوان (الإنجليزية)",
      titleAr: "العنوان (العربية)",
      summary: "الملخص",
      summaryEn: "الملخص (الإنجليزية)",
      summaryAr: "الملخص (العربية)",
      referenceNumber: "الرقم المرجعي",
      publishedDate: "تاريخ النشر",
      effectiveDate: "تاريخ النفاذ",
      complianceDeadline: "موعد الامتثال",
      severity: "الشدة",
      sourceUrl: "رابط المصدر",
      affectedClauseCategories: "فئات البنود المتأثرة",
      category: "فئة الأثر",
      subSource: "المصدر الفرعي",
    },
    placeholders: {
      selectRegulator: "اختر منظِّمًا",
      noCategory: "— لا توجد فئة —",
    },
    helpText: {
      affectedClauseCategoriesCommaSeparated: "فئات مفصولة بفواصل",
    },
    severity: {
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
      critical: "حرجة",
    },
    openSource: "فتح المصدر",
    toast: {
      createSuccess: "تم إنشاء التحديث التنظيمي.",
      updateSuccess: "تم حفظ التحديث التنظيمي.",
      deleteSuccess: "تم حذف التحديث التنظيمي.",
    },
  },
  impact: {
    list: {
      empty: "لا توجد آثار تنظيمية في هذا النطاق.",
    },
    structuralBadge: "بنيوي",
    detectedAt: "تم الاكتشاف",
    score: "الدرجة",
    actions: {
      resolve: "حل",
      update: "تحديث",
    },
    status: {
      pending: "قيد الانتظار",
      resolved: "تم الحل",
    },
    resolutionAction: {
      amended: "تم التعديل",
      waived: "تم التجاوز",
      out_of_scope: "خارج النطاق",
      pending: "قيد الانتظار",
    },
    resolutionActionHelp: {
      amended: "تم تعديل العقد ليتوافق مع اللائحة الجديدة.",
      waived: "تمت مراجعة الأثر وقبوله كانحراف معروف؛ دون تعديل العقد.",
      out_of_scope: "بعد المراجعة، اللائحة لا تنطبق على هذا العقد.",
      pending: "أعد فتح هذا الأثر لمزيد من المراجعة (إلغاء الحل).",
    },
    resolve: {
      title: "حل الأثر التنظيمي",
      actionLabel: "إجراء الحل",
      noteLabel: "ملاحظة الحل (اختياري)",
      notePlaceholder: "سياق موجز للمدققين…",
      noteHelp: "تُحفظ حرفيًا في سجل التدقيق.",
      submit: "حفظ الحل",
    },
    toast: {
      bulkDetectSuccess:
        "تم إنشاء {{created}} أثرًا · تم تخطي {{skipped}} مكررًا.",
      resolveSuccess: "تم حل الأثر.",
    },
  },
  bulkAmend: {
    title: "تعديل جماعي — اكتشاف الآثار",
    empty: "لا توجد عقود في النطاق. أعد الفتح من سياق لائحة.",
    selectColumn: "تحديد",
    selectRow: "تبديل الصف {{number}}",
    selectionCount: "{{selected}} من {{total}} عقد محددًا",
    submit: "اكتشاف على {{count}} عقد",
    fields: {
      contract: "العقد",
      impactScore: "درجة الأثر",
      noteEn: "ملاحظة (الإنجليزية)",
    },
    placeholders: {
      noteEn: "وسم قصير — تلميح الرادار",
    },
  },
  banner: {
    affected_one: "متأثر بلائحة واحدة قيد الانتظار",
    affected_other: "متأثر بـ {{count}} لائحة قيد الانتظار",
    regulatoryUpdate: "تحديث تنظيمي",
    reviewAll: "مراجعة الكل",
  },
  impactCategory: {
    list: {
      title: "فئات الأثر",
      subtitle: "تكوين الفئات المعيارية المستخدمة لتجميع التحديثات التنظيمية.",
      includeInactive: "تضمين غير النشطة",
      empty: "لا توجد فئات أثر مكوّنة.",
      createButton: "فئة جديدة",
      editAction: "تعديل {{key}}",
    },
    create: {
      title: "إنشاء فئة أثر",
      submit: "إنشاء الفئة",
    },
    edit: {
      title: "تعديل فئة الأثر",
      submit: "حفظ التغييرات",
    },
    fields: {
      key: "المفتاح",
      nameEn: "الاسم (الإنجليزية)",
      nameAr: "الاسم (العربية)",
      descriptionEn: "الوصف (الإنجليزية)",
      descriptionAr: "الوصف (العربية)",
      icon: "الأيقونة",
      colour: "اللون",
      active: "نشط",
      displayOrder: "ترتيب العرض",
      sources: "المصادر",
      severityScale: "مقياس الشدة",
      defaultClauseCategories: "فئات البنود الافتراضية",
      aiPromptContext: "سياق موجِّه الذكاء الاصطناعي",
    },
    helpText: {
      severityScaleCommaSeparated: "مفصولة بفواصل؛ افتراضي low,medium,high,critical.",
      aiPromptContextHint:
        "نص توجيهي للمسؤول يستخدمه موجِّه الذكاء الاصطناعي. ليس بيانات شخصية.",
    },
    activeBadge: "نشط",
    inactiveBadge: "غير نشط",
    picker: {
      ariaLabel: "فئة الأثر",
      placeholderRequired: "اختر فئة",
      placeholderOptional: "— لا توجد فئة —",
    },
    toast: {
      createSuccess: "تم إنشاء الفئة.",
      updateSuccess: "تم حفظ الفئة.",
    },
  },
  radar: {
    title: "الرادار التنظيمي",
    subtitle_one: "تحديث تنظيمي واحد ظاهر",
    subtitle_other: "{{count}} تحديث تنظيمي ظاهر",
    searchLabel: "البحث في التحديثات التنظيمية",
    searchPlaceholder: "ابحث بالعنوان أو المنظِّم أو الرقم المرجعي…",
    allSeverities: "جميع الشدات",
    effectiveFrom: "نافذ من",
    effectiveTo: "نافذ حتى",
    empty: "لا توجد تحديثات تنظيمية تطابق المرشحات الحالية.",
    selectHint: "حدد نقطة على الرادار لرؤية التفاصيل.",
    centerLabel: "اليوم",
    rings: {
      today: "اليوم",
      week: "أسبوع",
      month: "شهر",
      quarter: "ربع سنة",
    },
    quadrants: {
      north: "العمل الاتحادي",
      east: "الضرائب والمالية",
      south: "المناطق الحرة",
      west: "قطاعي",
    },
    tooltip: {
      regulator: "المنظِّم",
      published: "نُشر",
      impacts_one: "عقد واحد متأثر",
      impacts_other: "{{count}} عقد متأثر",
    },
    controls: {
      panHint: "Shift+سحب للتحريك · العجلة للتكبير",
    },
  },
  errors: {
    referenceCodeRequired: "رمز المرجع مطلوب.",
    referenceCodeTooLong: "رمز المرجع طويل جدًا.",
    titleEnRequired: "العنوان الإنجليزي مطلوب.",
    titleEnTooLong: "العنوان الإنجليزي طويل جدًا.",
    issuerRequired: "الجهة المصدرة مطلوبة.",
    regulatorRequired: "المنظِّم مطلوب.",
    publishedDateRequired: "تاريخ النشر مطلوب.",
    effectiveBeforePublished: "تاريخ النفاذ لا يمكن أن يسبق تاريخ النشر.",
    deadlineBeforePublished: "موعد الامتثال لا يمكن أن يسبق تاريخ النشر.",
    invalidUrl: "أدخل رابطًا صالحًا.",
    keyRequired: "المفتاح مطلوب.",
    keyFormat:
      "يجب أن يبدأ المفتاح بحرف ويحتوي فقط على أحرف صغيرة وأرقام وشرطات سفلية.",
    nameEnRequired: "الاسم الإنجليزي مطلوب.",
    nameArRequired: "الاسم العربي مطلوب.",
  },
};

// ─── common keys (already partially exist — only add missing) ───────────
const commonAdds = {
  en: {
    deleting: "Deleting…",
    processing: "Processing…",
    actions: "Actions",
    pagination: {
      showing: "Page {{current}} of {{total}}",
      previous: "Previous",
      next: "Next",
    },
  },
  ar: {
    deleting: "جارٍ الحذف…",
    processing: "جارٍ المعالجة…",
    actions: "الإجراءات",
    pagination: {
      showing: "الصفحة {{current}} من {{total}}",
      previous: "السابق",
      next: "التالي",
    },
  },
};

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    if (
      typeof source[k] === "object" &&
      source[k] !== null &&
      !Array.isArray(source[k]) &&
      typeof target[k] === "object" &&
      target[k] !== null &&
      !Array.isArray(target[k])
    ) {
      deepMerge(target[k], source[k]);
    } else if (target[k] === undefined) {
      target[k] = source[k];
    }
    // do not overwrite existing keys
  }
}

// Merge common additions (non-destructive; only fills gaps)
en.common = en.common ?? {};
ar.common = ar.common ?? {};
deepMerge(en.common, commonAdds.en);
deepMerge(ar.common, commonAdds.ar);

// Add the regulatory namespace (fully new)
en.regulatory = enRegulatory;
ar.regulatory = arRegulatory;

// ── Count helper (mirrors the pre/post checks in the M4 archive) ──
function countLeaves(obj) {
  let n = 0;
  for (const k of Object.keys(obj)) {
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Array.isArray(obj[k])
    ) {
      n += countLeaves(obj[k]);
    } else {
      n++;
    }
  }
  return n;
}

const enCount = countLeaves(en);
const arCount = countLeaves(ar);
console.log(`EN leaves: ${enCount}`);
console.log(`AR leaves: ${arCount}`);
console.log(`Parity: ${enCount === arCount ? "OK" : "MISMATCH"}`);

if (enCount !== arCount) {
  // Fail loudly — the orchestrator's checklist requires parity.
  console.error(
    `i18n parity broken: EN=${enCount} vs AR=${arCount}. NOT writing files.`,
  );
  process.exit(1);
}

fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + "\n", "utf8");
fs.writeFileSync(AR_PATH, JSON.stringify(ar, null, 2) + "\n", "utf8");
console.log("Wrote en.json + ar.json with M5 keys.");
