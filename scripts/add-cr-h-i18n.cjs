/**
 * One-time script: inject CR-H / M16 i18n keys into en.json + ar.json.
 * Run: node scripts/add-cr-h-i18n.js
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '../src/i18n/locales');
const enPath = path.join(__dirname, '../src/i18n/en.json');
const arPath = path.join(__dirname, '../src/i18n/ar.json');

// Read existing
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// ─── Nav additions ─────────────────────────────────────────────────────────
const NAV_EN = {
  legalAdvisoryQueue: 'Advisory Queue',
  adminAdvisoryTemplates: 'Advisory templates',
  adminNotifications: 'Notifications',
  profileNotificationPreferences: 'Notification preferences',
};
const NAV_AR = {
  legalAdvisoryQueue: 'قائمة الاستشارات',
  adminAdvisoryTemplates: 'قوالب الاستشارات',
  adminNotifications: 'الإشعارات',
  profileNotificationPreferences: 'تفضيلات الإشعارات',
};
Object.assign(en.nav, NAV_EN);
Object.assign(ar.nav, NAV_AR);

// ─── legal.advisoryQueue ───────────────────────────────────────────────────
const LEGAL_ADVISORY_QUEUE_EN = {
  title: 'Advisory Queue',
  subtitle: 'Review, approve, and dispatch AI-generated advisory drafts.',
  backToList: 'Back to Advisory Queue',
  emptyState: 'No advisory drafts found.',
  detailTitle: 'Advisory Draft #{{id}}',
  selfApprovalNotice: 'You created this draft — you cannot approve your own advisory (separation of duties).',
  bodyEn: 'Draft (English)',
  bodyAr: 'Draft (Arabic)',
  columns: {
    contract: 'Contract',
    counterparty: 'Counterparty',
    draftType: 'Type',
    generatedAt: 'Generated',
    status: 'Status',
  },
  fields: {
    approvalStatus: 'Status',
    generatedAt: 'Generated at',
    approvedAt: 'Approved at',
    rejectionReason: 'Rejection reason',
  },
  filters: {
    allStatuses: 'All statuses',
    status: 'Filter by status',
    myQueue: 'My queue only',
  },
  status: {
    unapproved: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    modified: 'Modified',
  },
  actions: {
    view: 'View',
    modify: 'Edit/Modify',
    approve: 'Approve',
    reject: 'Reject',
    dispatch: 'Dispatch',
  },
  toast: {
    approved: 'Draft approved.',
    rejected: 'Draft rejected.',
    modified: 'Draft modified.',
    dispatched: 'Advisory dispatched successfully.',
  },
  errors: {
    approveFailed: 'Failed to approve draft.',
    rejectFailed: 'Failed to reject draft.',
    modifyFailed: 'Failed to modify draft.',
    dispatchFailed: 'Failed to dispatch advisory.',
  },
  modifyDialog: {
    title: 'Modify Advisory Draft',
    description: 'Edit the English and Arabic text. Both fields are required. After saving, re-approval will be required.',
    submit: 'Save changes',
  },
  rejectDialog: {
    title: 'Reject Advisory Draft',
    description: 'Provide a reason for rejection. The draft author will be notified.',
    reasonLabel: 'Rejection reason',
    reasonPlaceholder: 'Describe why this draft is being rejected (min. 10 characters)...',
    submit: 'Reject draft',
  },
  dispatchPanel: {
    title: 'Dispatch Advisory',
    description: 'Enter recipient details to dispatch this approved advisory.',
    emailLabel: 'Recipient email',
    emailPlaceholder: 'name@example.com',
    nameLabel: 'Recipient name',
    namePlaceholder: 'Full name',
    confirm: 'Dispatch now',
  },
  traceability: {
    title: 'Source traceability',
    correlation: 'Correlation',
    clause: 'Matched clause(s)',
    signal: 'Matched signal',
    riskScore: 'Risk score',
  },
};

const LEGAL_ADVISORY_QUEUE_AR = {
  title: 'قائمة الاستشارات',
  subtitle: 'مراجعة واعتماد وإرسال مسودات الاستشارات المولّدة بالذكاء الاصطناعي.',
  backToList: 'العودة إلى القائمة',
  emptyState: 'لا توجد مسودات استشارات.',
  detailTitle: 'مسودة استشارة #{{id}}',
  selfApprovalNotice: 'أنت أنشأت هذه المسودة — لا يمكنك اعتماد استشارتك الخاصة (مبدأ الفصل بين المهام).',
  bodyEn: 'المسودة (إنجليزي)',
  bodyAr: 'المسودة (عربي)',
  columns: {
    contract: 'العقد',
    counterparty: 'الطرف المقابل',
    draftType: 'النوع',
    generatedAt: 'تاريخ التوليد',
    status: 'الحالة',
  },
  fields: {
    approvalStatus: 'الحالة',
    generatedAt: 'وقت التوليد',
    approvedAt: 'وقت الاعتماد',
    rejectionReason: 'سبب الرفض',
  },
  filters: {
    allStatuses: 'جميع الحالات',
    status: 'تصفية حسب الحالة',
    myQueue: 'قائمتي فقط',
  },
  status: {
    unapproved: 'قيد المراجعة',
    approved: 'معتمد',
    rejected: 'مرفوض',
    modified: 'معدّل',
  },
  actions: {
    view: 'عرض',
    modify: 'تعديل',
    approve: 'اعتماد',
    reject: 'رفض',
    dispatch: 'إرسال',
  },
  toast: {
    approved: 'تمّ اعتماد المسودة.',
    rejected: 'تمّ رفض المسودة.',
    modified: 'تمّ تعديل المسودة.',
    dispatched: 'تمّ إرسال الاستشارة بنجاح.',
  },
  errors: {
    approveFailed: 'فشل اعتماد المسودة.',
    rejectFailed: 'فشل رفض المسودة.',
    modifyFailed: 'فشل تعديل المسودة.',
    dispatchFailed: 'فشل إرسال الاستشارة.',
  },
  modifyDialog: {
    title: 'تعديل مسودة الاستشارة',
    description: 'تعديل النص الإنجليزي والعربي. كلا الحقلين مطلوبان. بعد الحفظ، يلزم إعادة الاعتماد.',
    submit: 'حفظ التعديلات',
  },
  rejectDialog: {
    title: 'رفض مسودة الاستشارة',
    description: 'أدخل سبب الرفض. سيتمّ إشعار مُنشئ المسودة.',
    reasonLabel: 'سبب الرفض',
    reasonPlaceholder: 'صِف سبب رفض هذه المسودة (10 أحرف على الأقل)...',
    submit: 'رفض المسودة',
  },
  dispatchPanel: {
    title: 'إرسال الاستشارة',
    description: 'أدخل بيانات المستلم لإرسال الاستشارة المعتمدة.',
    emailLabel: 'البريد الإلكتروني للمستلم',
    emailPlaceholder: 'name@example.com',
    nameLabel: 'اسم المستلم',
    namePlaceholder: 'الاسم الكامل',
    confirm: 'إرسال الآن',
  },
  traceability: {
    title: 'إمكانية التتبع',
    correlation: 'الارتباط',
    clause: 'البند/البنود المطابق(ة)',
    signal: 'الإشارة المطابقة',
    riskScore: 'درجة المخاطرة',
  },
};

en.legal = { advisoryQueue: LEGAL_ADVISORY_QUEUE_EN };
ar.legal = { advisoryQueue: LEGAL_ADVISORY_QUEUE_AR };

// ─── profile.notificationPreferences ──────────────────────────────────────
const PROFILE_NOTIF_PREF_EN = {
  title: 'Notification Preferences',
  subtitle: 'Choose which notifications you receive and on which channels.',
  description: 'Toggle each cell to enable or disable notifications. Set a minimum priority to suppress low-priority notifications.',
  columns: { kind: 'Notification type' },
  channels: { email: 'Email', in_app: 'In-app', teams_capture: 'Teams', slack_capture: 'Slack' },
  kinds: {
    alert: 'Alerts',
    advisory: 'Advisory drafts',
    approval_request: 'Approval requests',
    signature_request: 'Signature requests',
    system: 'System',
    risk_case: 'Risk cases',
    report: 'Reports',
  },
  priorities: { low: 'Low+', medium: 'Med+', high: 'High+', critical: 'Crit' },
  toggleLabel: 'Toggle {{kind}} via {{channel}}',
  priorityMinLabel: 'Minimum priority',
  priorityNote: 'Priority min = only deliver notifications at this priority or above.',
  toast: { saved: 'Preference saved.' },
  errors: { saveFailed: 'Failed to save preference.' },
};

const PROFILE_NOTIF_PREF_AR = {
  title: 'تفضيلات الإشعارات',
  subtitle: 'اختر الإشعارات التي تريد استقبالها والقنوات المفضّلة.',
  description: 'فعّل أو عطّل كل خلية. حدّد أدنى أولوية لتجاهل الإشعارات المنخفضة الأولوية.',
  columns: { kind: 'نوع الإشعار' },
  channels: { email: 'البريد الإلكتروني', in_app: 'داخل التطبيق', teams_capture: 'Teams', slack_capture: 'Slack' },
  kinds: {
    alert: 'التنبيهات',
    advisory: 'مسودات الاستشارات',
    approval_request: 'طلبات الاعتماد',
    signature_request: 'طلبات التوقيع',
    system: 'إشعارات النظام',
    risk_case: 'حالات المخاطر',
    report: 'التقارير',
  },
  priorities: { low: 'منخفض+', medium: 'متوسط+', high: 'مرتفع+', critical: 'حرج' },
  toggleLabel: 'تبديل {{kind}} عبر {{channel}}',
  priorityMinLabel: 'الأولوية الدنيا',
  priorityNote: 'الأولوية الدنيا = إرسال الإشعارات بهذه الأولوية أو أعلى فقط.',
  toast: { saved: 'تمّ حفظ التفضيل.' },
  errors: { saveFailed: 'فشل حفظ التفضيل.' },
};

en.profile = { notificationPreferences: PROFILE_NOTIF_PREF_EN };
ar.profile = { notificationPreferences: PROFILE_NOTIF_PREF_AR };

// ─── admin.advisoryTemplates ───────────────────────────────────────────────
const ADMIN_ADV_TMPL_EN = {
  title: 'Advisory Templates',
  subtitle: 'Manage EN/AR advisory template body templates, approver roles, and dispatch channels.',
  backToList: 'Back to Templates',
  editTitle: 'Edit Advisory Template',
  searchPlaceholder: 'Search templates...',
  searchLabel: 'Search advisory templates',
  emptyState: 'No advisory templates found.',
  columns: {
    templateId: 'Template ID',
    displayName: 'Display name',
    draftType: 'Type',
    version: 'Version',
    approverRole: 'Approver role',
    channels: 'Channels',
    lastModified: 'Last modified',
  },
  fields: {
    displayNameEn: 'Display name (EN)',
    displayNameAr: 'Display name (AR)',
    description: 'Description (optional)',
    draftType: 'Draft type',
    version: 'Version',
    templateId: 'Template ID',
    bodyTemplateEn: 'Body template (EN)',
    bodyTemplateAr: 'Body template (AR)',
    assignedApproverRole: 'Assigned approver role',
    dispatchChannels: 'Dispatch channels',
    parameters: 'Template parameters (read-only)',
  },
  filters: { draftType: 'Filter by type', allTypes: 'All types' },
  draftTypes: {
    fm_invocation: 'FM Invocation',
    cure_notice: 'Cure Notice',
    sanctions_hold: 'Sanctions Hold',
    price_review: 'Price Review',
    icv_rectification: 'ICV Rectification',
    insurance_renewal: 'Insurance Renewal',
    esg_concern: 'ESG Concern',
    custom: 'Custom',
  },
  channels: { email: 'Email', teams_capture: 'Teams', slack_capture: 'Slack' },
  actions: { edit: 'Edit' },
  toast: { saved: 'Template saved.' },
  errors: { saveFailed: 'Failed to save template.', channelsRequired: 'At least one dispatch channel is required.' },
};

const ADMIN_ADV_TMPL_AR = {
  title: 'قوالب الاستشارات',
  subtitle: 'إدارة قوالب الاستشارات بالإنجليزية والعربية وأدوار المعتمدين وقنوات الإرسال.',
  backToList: 'العودة إلى القوالب',
  editTitle: 'تعديل قالب الاستشارة',
  searchPlaceholder: 'بحث في القوالب...',
  searchLabel: 'البحث في قوالب الاستشارات',
  emptyState: 'لا توجد قوالب استشارات.',
  columns: {
    templateId: 'معرّف القالب',
    displayName: 'الاسم المعروض',
    draftType: 'النوع',
    version: 'الإصدار',
    approverRole: 'دور المعتمِد',
    channels: 'القنوات',
    lastModified: 'آخر تعديل',
  },
  fields: {
    displayNameEn: 'الاسم المعروض (إنجليزي)',
    displayNameAr: 'الاسم المعروض (عربي)',
    description: 'الوصف (اختياري)',
    draftType: 'نوع المسودة',
    version: 'الإصدار',
    templateId: 'معرّف القالب',
    bodyTemplateEn: 'نص القالب (إنجليزي)',
    bodyTemplateAr: 'نص القالب (عربي)',
    assignedApproverRole: 'دور المعتمِد المخصّص',
    dispatchChannels: 'قنوات الإرسال',
    parameters: 'معاملات القالب (للقراءة فقط)',
  },
  filters: { draftType: 'تصفية حسب النوع', allTypes: 'جميع الأنواع' },
  draftTypes: {
    fm_invocation: 'استدعاء قوة قاهرة',
    cure_notice: 'إشعار علاج الإخلال',
    sanctions_hold: 'تجميد بسبب العقوبات',
    price_review: 'مراجعة السعر',
    icv_rectification: 'تصحيح شهادة القيمة المضافة',
    insurance_renewal: 'تجديد التأمين',
    esg_concern: 'مخاوف ESG',
    custom: 'مخصّص',
  },
  channels: { email: 'البريد الإلكتروني', teams_capture: 'Teams', slack_capture: 'Slack' },
  actions: { edit: 'تعديل' },
  toast: { saved: 'تمّ حفظ القالب.' },
  errors: { saveFailed: 'فشل حفظ القالب.', channelsRequired: 'يجب اختيار قناة إرسال واحدة على الأقل.' },
};

en.admin.advisoryTemplates = ADMIN_ADV_TMPL_EN;
ar.admin.advisoryTemplates = ADMIN_ADV_TMPL_AR;

// ─── admin.notifications ───────────────────────────────────────────────────
const ADMIN_NOTIF_EN = {
  title: 'Notification Dispatch Log',
  subtitle: 'View all notification dispatch attempts across channels.',
  emptyState: 'No notifications found for the selected filters.',
  columns: {
    id: 'ID',
    channel: 'Channel',
    kind: 'Kind',
    priority: 'Priority',
    status: 'Status',
    attemptedAt: 'Attempted at',
    preview: 'Payload',
  },
  filters: {
    allChannels: 'All channels',
    allStatuses: 'All statuses',
    channel: 'Filter by channel',
    status: 'Filter by status',
    from: 'From',
    to: 'To',
  },
  channels: {
    email: 'Email',
    in_app: 'In-app',
    teams_capture: 'Teams (captured)',
    slack_capture: 'Slack (captured)',
  },
  kinds: {
    alert: 'Alert',
    advisory: 'Advisory',
    approval_request: 'Approval request',
    signature_request: 'Signature request',
    system: 'System',
    risk_case: 'Risk case',
    report: 'Report',
  },
  statuses: {
    sent: 'Sent',
    failed: 'Failed',
    captured_only: 'Captured',
    pending_retry: 'Pending retry',
    final_failed: 'Final failed',
    suppressed_by_preference: 'Suppressed',
  },
  previewPayload: 'Preview payload',
  payloadPreview: {
    title: 'Payload Preview',
    captureNote: 'This is the {{channel}} payload that would have been delivered.',
    empty: '(No payload captured)',
    loadError: 'Failed to load payload details.',
  },
};

const ADMIN_NOTIF_AR = {
  title: 'سجل إرسال الإشعارات',
  subtitle: 'عرض جميع محاولات إرسال الإشعارات عبر القنوات المختلفة.',
  emptyState: 'لا توجد إشعارات تطابق المرشّحات المحددة.',
  columns: {
    id: 'الرقم',
    channel: 'القناة',
    kind: 'النوع',
    priority: 'الأولوية',
    status: 'الحالة',
    attemptedAt: 'وقت المحاولة',
    preview: 'الحمولة',
  },
  filters: {
    allChannels: 'جميع القنوات',
    allStatuses: 'جميع الحالات',
    channel: 'تصفية حسب القناة',
    status: 'تصفية حسب الحالة',
    from: 'من',
    to: 'إلى',
  },
  channels: {
    email: 'البريد الإلكتروني',
    in_app: 'داخل التطبيق',
    teams_capture: 'Teams (مسجَّل)',
    slack_capture: 'Slack (مسجَّل)',
  },
  kinds: {
    alert: 'تنبيه',
    advisory: 'استشارة',
    approval_request: 'طلب اعتماد',
    signature_request: 'طلب توقيع',
    system: 'نظام',
    risk_case: 'حالة مخاطرة',
    report: 'تقرير',
  },
  statuses: {
    sent: 'مُرسَل',
    failed: 'فشل',
    captured_only: 'مسجَّل',
    pending_retry: 'قيد إعادة المحاولة',
    final_failed: 'فشل نهائي',
    suppressed_by_preference: 'مكتوم',
  },
  previewPayload: 'معاينة الحمولة',
  payloadPreview: {
    title: 'معاينة الحمولة',
    captureNote: 'هذه هي حمولة {{channel}} التي كانت ستُرسَل.',
    empty: '(لا توجد حمولة مسجَّلة)',
    loadError: 'فشل تحميل تفاصيل الحمولة.',
  },
};

en.admin.notifications = ADMIN_NOTIF_EN;
ar.admin.notifications = ADMIN_NOTIF_AR;

// ─── Write ─────────────────────────────────────────────────────────────────
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');
console.log('Done. EN and AR updated.');
