// أرقام التواصل الرسمية لـ «ماتعطل» داخل تطبيق الجوال.
// مصدرها الوحيد هذا الملف (لا تُقرأ من قاعدة البيانات) حتى لا تتأثر بإعدادات الموقع.
//
// whatsapp: true فقط بعد تأكيد المالك أن الرقم مفعّل على واتساب.
// حتى يتم التأكيد يبقى false فيظهر زر الاتصال فقط.

export interface SupportContact {
  /** الرقم المحلي (8 أرقام) */
  phone: string;
  /** هل الرقم مفعّل على واتساب؟ (مؤكَّد من المالك) */
  whatsapp: boolean;
}

export const SUPPORT_CONTACTS: readonly SupportContact[] = [
  { phone: '97706792', whatsapp: false },
  { phone: '99225025', whatsapp: false },
] as const;

/** عرض الرقم بشكل مقروء: 9770 6792 */
export function formatLocalPhone(p: string): string {
  return p.length === 8 ? `${p.slice(0, 4)} ${p.slice(4)}` : p;
}

/** الرقم داخل نص عربي: عزل اتجاه (LTR isolate) حتى لا تنقلب مجموعتا الأرقام داخل الأزرار */
export function phoneInText(p: string): string {
  return `\u2066${formatLocalPhone(p)}\u2069`;
}

/** أول رقم مفعّل على واتساب (إن وجد) — لرسائل جاهزة مثل طلب التفعيل */
export function firstWhatsappContact(): SupportContact | undefined {
  return SUPPORT_CONTACTS.find((c) => c.whatsapp);
}
