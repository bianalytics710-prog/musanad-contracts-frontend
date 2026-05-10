#!/usr/bin/env node
/**
 * M10 i18n key addition script.
 * Adds all new keys for M10 (CR-C) to both en.json and ar.json.
 * Run from repo root: node scripts/add-m10-i18n.js
 */
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/i18n/en.json');
const arPath = path.join(__dirname, '../src/i18n/ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// ── Helper: deep merge (target wins on conflict, source fills gaps) ─────────
function merge(target, source) {
  for (const k of Object.keys(source)) {
    if (
      k in target &&
      typeof target[k] === 'object' &&
      target[k] !== null &&
      typeof source[k] === 'object' &&
      source[k] !== null
    ) {
      merge(target[k], source[k]);
    } else if (!(k in target)) {
      target[k] = source[k];
    }
  }
}

// ── English additions ────────────────────────────────────────────────────────

const enAdditions = {
  nav: {
    adminAuditVerify: 'Audit verify',
    adminBranding: 'Branding',
    adminEmailTemplates: 'Email templates',
    adminEmailConfig: 'Email server',
    adminTenants: 'Tenants',
    adminDemoPurge: 'Demo purge',
    adminMatrix: 'Approval matrix',
    adminChains: 'Approval chains',
    adminRegs: 'Regulations',
    adminImpacts: 'Impact cats',
    adminAiCost: 'AI cost',
    adminAiPrompts: 'AI prompts',
    adminAiReqs: 'AI requests',
    adminHealth: 'Health',
  },
  common: {
    creating: 'Creating…',
    saving: 'Saving…',
    pageOf: 'Page {{page}} of {{total}}',
    active: 'Active',
    inactive: 'Inactive',
    errorLoading: 'Failed to load. Please try again.',
    forbidden: 'You do not have permission to access this page.',
    unknown: 'Unknown',
    builtInRole: {
      badge: 'System role',
      tooltip: 'Built-in roles cannot be deleted. Permissions can still be adjusted.',
      cannotDelete: 'System roles cannot be deleted.',
    },
  },
  admin: {
    systemSettings: {
      tabs: {
        security: 'Security',
        email: 'Email',
        calendar: 'Calendar',
        auditRetention: 'Audit Retention',
      },
    },
    config: {
      branding: {
        editLink: 'Open Branding editor',
      },
    },
    roles: {
      addRole: 'Add role',
      editRole: 'Edit {{name}}',
      edit: {
        title: 'Edit role',
        backToRoles: 'Roles',
        systemRole: 'System role',
        notFound: 'Role not found.',
        confirmDelete: 'Delete this role? This cannot be undone.',
        headers: {
          module: 'Module',
          permission: 'Permission',
          granted: 'Granted',
        },
        toast: {
          granted: 'Permission granted.',
          revoked: 'Permission revoked.',
          deleted: 'Role deleted.',
          permissionFailed: 'Could not update permission.',
        },
        errors: {
          deleteFailed: 'Could not delete role.',
        },
      },
    },
    auditVerify: {
      title: 'Audit chain verify',
      subtitle: 'Verify the cryptographic hash chain integrity of the audit log.',
      run: 'Run verification',
      running: 'Verifying…',
      resultTitle: 'Verification result',
      verified: 'Chain intact',
      broken: 'Chain broken',
      rowsWalked: 'Rows verified',
      elapsedMs: 'Duration (ms)',
      brokenAt: 'Broken at sequence',
      neverRun: 'No verification has been run yet.',
      errors: {
        failed: 'Verification failed unexpectedly.',
      },
    },
    demoPurge: {
      title: 'Demo data purge',
      subtitle: 'Permanently remove all demo and pilot seed data from this workspace.',
      summaryTitle: 'Data classification summary',
      classificationCol: 'Classification',
      countCol: 'Record count',
      totalRow: 'Total',
      dryRunBtn: 'Dry-run',
      purgeBtn: 'Purge demo data',
      purging: 'Purging…',
      dryRunTitle: 'Dry-run result',
      dryRunHint: 'No data was deleted. Review the counts below before confirming.',
      confirmTitle: 'Confirm purge',
      confirmBody: 'This will permanently delete all demo and pilot data. This action cannot be undone.',
      tokenLabel: 'Type the confirmation token to proceed:',
      tokenPlaceholder: 'PURGE_DEMO_DATA_{{date}}',
      tokenHint: 'The token is: PURGE_DEMO_DATA_{{date}}',
      tokenMismatch: 'Token does not match. Please type the exact token shown.',
      confirmBtn: 'Delete permanently',
      successTitle: 'Purge complete',
      successBody: 'Deleted {{count}} records in {{ms}} ms.',
      superAdminOnly: 'Demo purge is restricted to Super Admin.',
      errors: {
        dryRunFailed: 'Dry-run failed.',
        purgeFailed: 'Purge failed.',
        summaryFailed: 'Could not load data classification summary.',
      },
    },
    tenants: {
      title: 'Tenants',
      subtitle: 'All tenants registered in this platform instance.',
      searchPlaceholder: 'Search tenants…',
      headers: {
        name: 'Name',
        slug: 'Slug',
        plan: 'Plan',
        riskAppetite: 'Risk appetite',
        status: 'Status',
        createdAt: 'Created',
      },
      empty: 'No tenants found.',
      errors: {
        loadFailed: 'Could not load tenants.',
      },
    },
    branding: {
      title: 'Branding',
      subtitle: 'Customize logo, colors, and footer text for this workspace.',
      logoSection: 'Logo',
      logoHint: 'PNG or SVG, max 2 MB.',
      dropzone: 'Drag and drop a logo here, or click to browse',
      dropzoneActive: 'Drop to upload',
      colorSection: 'Colors',
      primaryColor: 'Primary color',
      accentColor: 'Accent color',
      footerSection: 'Footer text',
      footerEn: 'Footer text (English)',
      footerAr: 'Footer text (Arabic)',
      preview: 'Preview',
      save: 'Save branding',
      saving: 'Saving…',
      uploadSuccess: 'Logo uploaded.',
      saveSuccess: 'Branding saved.',
      errors: {
        uploadFailed: 'Logo upload failed.',
        saveFailed: 'Could not save branding.',
        fileTooLarge: 'File exceeds 2 MB limit.',
        invalidType: 'Only PNG and SVG files are accepted.',
        loadFailed: 'Could not load branding configuration.',
      },
    },
    emailTemplates: {
      title: 'Email templates',
      subtitle: 'Manage notification templates for all channels.',
      searchPlaceholder: 'Search templates…',
      channelFilter: 'Filter by channel',
      allChannels: 'All channels',
      headers: {
        name: 'Template name',
        channel: 'Channel',
        locale: 'Locale',
        updatedAt: 'Last updated',
      },
      empty: 'No templates found.',
      edit: 'Edit',
      editTitle: 'Edit template',
      editSubtitle: 'Edit subject and body for English and Arabic locales.',
      subjectEn: 'Subject (English)',
      subjectAr: 'Subject (Arabic)',
      bodyEn: 'Body (English)',
      bodyAr: 'Body (Arabic)',
      parameters: 'Available parameters',
      previewBtn: 'Preview',
      previewTitle: 'Rendered preview',
      previewLocale: 'Preview locale',
      saveSuccess: 'Template saved.',
      errors: {
        loadFailed: 'Could not load template.',
        saveFailed: 'Could not save template.',
        previewFailed: 'Preview generation failed.',
      },
    },
    emailConfig: {
      title: 'Email server',
      subtitle: 'Configure SMTP server settings for outbound email notifications.',
      sections: {
        connection: 'Connection',
        auth: 'Authentication',
        sender: 'Sender',
        limits: 'Sending limits',
      },
      fields: {
        host: 'SMTP host',
        port: 'Port',
        encryption: 'Encryption',
        authUser: 'Username',
        authPassRef: 'Password',
        authPassRefSet: 'Password is set (leave blank to keep)',
        fromAddress: 'From address',
        fromName: 'From name',
        dailyLimit: 'Daily limit',
        enabled: 'Enabled',
      },
      testSend: {
        btn: 'Send test email',
        sending: 'Sending…',
        recipientLabel: 'Recipient override (optional)',
        recipientHint: 'Leave blank to send to your account email.',
        success: 'Test email sent.',
        failed: 'Test email failed.',
      },
      save: 'Save configuration',
      saveSuccess: 'Email configuration saved.',
      errors: {
        loadFailed: 'Could not load email configuration.',
        saveFailed: 'Could not save email configuration.',
      },
    },
  },
};

// ── Arabic additions ─────────────────────────────────────────────────────────

const arAdditions = {
  nav: {
    adminAuditVerify: 'التحقق من سجل المراجعة',
    adminBranding: 'العلامة التجارية',
    adminEmailTemplates: 'قوالب البريد الإلكتروني',
    adminEmailConfig: 'خادم البريد الإلكتروني',
    adminTenants: 'المستأجرون',
    adminDemoPurge: 'حذف البيانات التجريبية',
    adminMatrix: 'مصفوفة الموافقات',
    adminChains: 'سلاسل الموافقات',
    adminRegs: 'اللوائح',
    adminImpacts: 'فئات التأثير',
    adminAiCost: 'تكلفة الذكاء الاصطناعي',
    adminAiPrompts: 'موجّهات الذكاء الاصطناعي',
    adminAiReqs: 'طلبات الذكاء الاصطناعي',
    adminHealth: 'الحالة الصحية',
  },
  common: {
    creating: 'جارٍ الإنشاء…',
    saving: 'جارٍ الحفظ…',
    pageOf: 'الصفحة {{page}} من {{total}}',
    active: 'نشط',
    inactive: 'غير نشط',
    errorLoading: 'فشل التحميل. يرجى المحاولة مرة أخرى.',
    forbidden: 'ليس لديك صلاحية الوصول إلى هذه الصفحة.',
    unknown: 'غير معروف',
    builtInRole: {
      badge: 'دور النظام',
      tooltip: 'لا يمكن حذف الأدوار المضمّنة. يمكن تعديل الصلاحيات.',
      cannotDelete: 'لا يمكن حذف أدوار النظام.',
    },
  },
  admin: {
    systemSettings: {
      tabs: {
        security: 'الأمان',
        email: 'البريد الإلكتروني',
        calendar: 'التقويم',
        auditRetention: 'الاحتفاظ بسجل المراجعة',
      },
    },
    config: {
      branding: {
        editLink: 'فتح محرر العلامة التجارية',
      },
    },
    roles: {
      addRole: 'إضافة دور',
      editRole: 'تعديل {{name}}',
      edit: {
        title: 'تعديل الدور',
        backToRoles: 'الأدوار',
        systemRole: 'دور النظام',
        notFound: 'الدور غير موجود.',
        confirmDelete: 'هل تريد حذف هذا الدور؟ لا يمكن التراجع عن هذا الإجراء.',
        headers: {
          module: 'الوحدة',
          permission: 'الصلاحية',
          granted: 'ممنوحة',
        },
        toast: {
          granted: 'تم منح الصلاحية.',
          revoked: 'تم سحب الصلاحية.',
          deleted: 'تم حذف الدور.',
          permissionFailed: 'تعذّر تحديث الصلاحية.',
        },
        errors: {
          deleteFailed: 'تعذّر حذف الدور.',
        },
      },
    },
    auditVerify: {
      title: 'التحقق من سلسلة المراجعة',
      subtitle: 'التحقق من سلامة سلسلة التجزئة المشفرة لسجل المراجعة.',
      run: 'تشغيل التحقق',
      running: 'جارٍ التحقق…',
      resultTitle: 'نتيجة التحقق',
      verified: 'السلسلة سليمة',
      broken: 'السلسلة مكسورة',
      rowsWalked: 'الصفوف التي تم التحقق منها',
      elapsedMs: 'المدة (مللي ثانية)',
      brokenAt: 'مكسورة عند التسلسل',
      neverRun: 'لم يتم إجراء أي تحقق بعد.',
      errors: {
        failed: 'فشل التحقق بشكل غير متوقع.',
      },
    },
    demoPurge: {
      title: 'حذف البيانات التجريبية',
      subtitle: 'إزالة جميع البيانات التجريبية والتجريبية الأولية بشكل دائم من هذا الفضاء.',
      summaryTitle: 'ملخص تصنيف البيانات',
      classificationCol: 'التصنيف',
      countCol: 'عدد السجلات',
      totalRow: 'المجموع',
      dryRunBtn: 'تشغيل تجريبي',
      purgeBtn: 'حذف البيانات التجريبية',
      purging: 'جارٍ الحذف…',
      dryRunTitle: 'نتيجة التشغيل التجريبي',
      dryRunHint: 'لم يتم حذف أي بيانات. راجع الأعداد أدناه قبل التأكيد.',
      confirmTitle: 'تأكيد الحذف',
      confirmBody: 'سيؤدي هذا إلى حذف جميع البيانات التجريبية والتجريبية الأولية بشكل دائم. لا يمكن التراجع عن هذا الإجراء.',
      tokenLabel: 'اكتب رمز التأكيد للمتابعة:',
      tokenPlaceholder: 'PURGE_DEMO_DATA_{{date}}',
      tokenHint: 'الرمز هو: PURGE_DEMO_DATA_{{date}}',
      tokenMismatch: 'الرمز غير مطابق. يرجى كتابة الرمز المحدد بدقة.',
      confirmBtn: 'حذف بشكل دائم',
      successTitle: 'اكتمل الحذف',
      successBody: 'تم حذف {{count}} سجل في {{ms}} مللي ثانية.',
      superAdminOnly: 'حذف البيانات التجريبية مقتصر على المشرف الرئيسي.',
      errors: {
        dryRunFailed: 'فشل التشغيل التجريبي.',
        purgeFailed: 'فشل الحذف.',
        summaryFailed: 'تعذّر تحميل ملخص تصنيف البيانات.',
      },
    },
    tenants: {
      title: 'المستأجرون',
      subtitle: 'جميع المستأجرين المسجلين في هذا النظام.',
      searchPlaceholder: 'البحث في المستأجرين…',
      headers: {
        name: 'الاسم',
        slug: 'المعرّف',
        plan: 'الخطة',
        riskAppetite: 'الشهية للمخاطر',
        status: 'الحالة',
        createdAt: 'تاريخ الإنشاء',
      },
      empty: 'لا يوجد مستأجرون.',
      errors: {
        loadFailed: 'تعذّر تحميل المستأجرين.',
      },
    },
    branding: {
      title: 'العلامة التجارية',
      subtitle: 'تخصيص الشعار والألوان ونص التذييل لهذا الفضاء.',
      logoSection: 'الشعار',
      logoHint: 'PNG أو SVG، الحد الأقصى 2 ميجابايت.',
      dropzone: 'اسحب وأفلت الشعار هنا، أو انقر للتصفح',
      dropzoneActive: 'أفلت للرفع',
      colorSection: 'الألوان',
      primaryColor: 'اللون الأساسي',
      accentColor: 'لون التمييز',
      footerSection: 'نص التذييل',
      footerEn: 'نص التذييل (الإنجليزية)',
      footerAr: 'نص التذييل (العربية)',
      preview: 'معاينة',
      save: 'حفظ العلامة التجارية',
      saving: 'جارٍ الحفظ…',
      uploadSuccess: 'تم رفع الشعار.',
      saveSuccess: 'تم حفظ العلامة التجارية.',
      errors: {
        uploadFailed: 'فشل رفع الشعار.',
        saveFailed: 'تعذّر حفظ العلامة التجارية.',
        fileTooLarge: 'يتجاوز الملف حد 2 ميجابايت.',
        invalidType: 'يُقبل فقط ملفات PNG وSVG.',
        loadFailed: 'تعذّر تحميل إعدادات العلامة التجارية.',
      },
    },
    emailTemplates: {
      title: 'قوالب البريد الإلكتروني',
      subtitle: 'إدارة قوالب الإشعارات لجميع القنوات.',
      searchPlaceholder: 'البحث في القوالب…',
      channelFilter: 'تصفية حسب القناة',
      allChannels: 'جميع القنوات',
      headers: {
        name: 'اسم القالب',
        channel: 'القناة',
        locale: 'اللغة',
        updatedAt: 'آخر تحديث',
      },
      empty: 'لا توجد قوالب.',
      edit: 'تعديل',
      editTitle: 'تعديل القالب',
      editSubtitle: 'تعديل الموضوع والمحتوى للغتين الإنجليزية والعربية.',
      subjectEn: 'الموضوع (الإنجليزية)',
      subjectAr: 'الموضوع (العربية)',
      bodyEn: 'المحتوى (الإنجليزية)',
      bodyAr: 'المحتوى (العربية)',
      parameters: 'المعاملات المتاحة',
      previewBtn: 'معاينة',
      previewTitle: 'معاينة مُصيَّرة',
      previewLocale: 'لغة المعاينة',
      saveSuccess: 'تم حفظ القالب.',
      errors: {
        loadFailed: 'تعذّر تحميل القالب.',
        saveFailed: 'تعذّر حفظ القالب.',
        previewFailed: 'فشل توليد المعاينة.',
      },
    },
    emailConfig: {
      title: 'خادم البريد الإلكتروني',
      subtitle: 'تكوين إعدادات خادم SMTP لإشعارات البريد الإلكتروني الصادرة.',
      sections: {
        connection: 'الاتصال',
        auth: 'المصادقة',
        sender: 'المرسل',
        limits: 'حدود الإرسال',
      },
      fields: {
        host: 'مضيف SMTP',
        port: 'المنفذ',
        encryption: 'التشفير',
        authUser: 'اسم المستخدم',
        authPassRef: 'كلمة المرور',
        authPassRefSet: 'كلمة المرور محددة (اتركها فارغة للاحتفاظ بالحالية)',
        fromAddress: 'عنوان المرسل',
        fromName: 'اسم المرسل',
        dailyLimit: 'الحد اليومي',
        enabled: 'مُفعَّل',
      },
      testSend: {
        btn: 'إرسال بريد اختباري',
        sending: 'جارٍ الإرسال…',
        recipientLabel: 'تجاوز المستلم (اختياري)',
        recipientHint: 'اتركه فارغاً للإرسال إلى بريدك الإلكتروني.',
        success: 'تم إرسال البريد الاختباري.',
        failed: 'فشل إرسال البريد الاختباري.',
      },
      save: 'حفظ الإعدادات',
      saveSuccess: 'تم حفظ إعدادات البريد الإلكتروني.',
      errors: {
        loadFailed: 'تعذّر تحميل إعدادات البريد الإلكتروني.',
        saveFailed: 'تعذّر حفظ إعدادات البريد الإلكتروني.',
      },
    },
  },
};

// ── Apply merges ─────────────────────────────────────────────────────────────
merge(en, enAdditions);
merge(ar, arAdditions);

// ── Write back ───────────────────────────────────────────────────────────────
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n', 'utf8');

// ── Count and report ─────────────────────────────────────────────────────────
function countKeys(obj) {
  let c = 0;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'object' && obj[k] !== null) c += countKeys(obj[k]);
    else c++;
  }
  return c;
}

const enFinal = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const arFinal = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const enCount = countKeys(enFinal);
const arCount = countKeys(arFinal);

console.log(`en.json: ${enCount} keys`);
console.log(`ar.json: ${arCount} keys`);
console.log(`Parity: ${enCount === arCount ? 'OK' : 'MISMATCH'}`);
console.log(`New keys added: ${enCount - 4765}`);
