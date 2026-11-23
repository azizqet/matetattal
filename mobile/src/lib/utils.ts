// دوال منطقية خالصة (بدون React Native) — قابلة للاختبار التلقائي
import type { Company } from './types';

export const KUWAIT_CENTER = { lat: 29.3759, lng: 47.9774 };

/** إحداثيات تقريبية لمراكز المناطق (مطابقة للنسخة الويب) */
export const AREA_CENTERS: Record<string, [number, number]> = {
  'العاصمة': [29.37, 47.98], 'حولي': [29.33, 48.03], 'السالمية': [29.34, 48.07], 'الفروانية': [29.28, 47.96],
  'الجهراء': [29.35, 47.67], 'الأحمدي': [29.08, 48.08], 'الفحيحيل': [29.08, 48.13], 'مبارك الكبير': [29.21, 48.06],
};

export function digits(s: string | null | undefined): string {
  // يحوّل الأرقام العربية/الفارسية إلى إنجليزية ثم يحذف أي شيء غير رقم
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '');
}

/** رقم كويتي محلي صالح: 8 أرقام يبدأ بـ 5 أو 6 أو 9 (أو 2 للأرضي) */
export function isKuwaitPhone(s: string): boolean {
  return /^[2569]\d{7}$/.test(localPhone(s));
}

/** رقم الجوال المحلي (8 أرقام) — مطلوب لجداول تشترط ^[569][0-9]{7}$ */
export function isKuwaitMobile(s: string): boolean {
  return /^[569]\d{7}$/.test(localPhone(s));
}

export function localPhone(s: string | null | undefined): string {
  let p = digits(s);
  if (p.startsWith('00965')) p = p.slice(5);
  else if (p.startsWith('965') && p.length === 11) p = p.slice(3);
  return p;
}

/** صيغة دولية بدون + (للواتساب والاتصال) */
export function intlPhone(s: string | null | undefined): string {
  const p = digits(s);
  if (p.length === 8) return '965' + p;
  if (p.startsWith('00')) return p.slice(2);
  return p;
}

export function telUrl(s: string | null | undefined): string {
  return 'tel:+' + intlPhone(s);
}

export function whatsappUrl(s: string | null | undefined, text?: string): string {
  const base = 'https://wa.me/' + intlPhone(s);
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * أرقام تواصل المعلن: الاتصال (8 أرقام) + الواتساب (نفس الرقم أو رقم جوال مختلف).
 * يرجع رسالة خطأ بالعربي، أو الأرقام بالصيغة المحلية (whatsapp = null يعني نفس رقم الاتصال).
 */
export function checkContactNumbers(phone: string, sameWhatsapp: boolean, whatsapp: string):
  { ok: false; error: string } | { ok: true; phone: string; whatsapp: string | null } {
  const p = localPhone(phone);
  if (p.length !== 8) return { ok: false, error: 'رقم الاتصال لازم يكون 8 أرقام' };
  if (!isKuwaitPhone(p)) return { ok: false, error: 'رقم الاتصال لازم يبدأ بـ 2 أو 5 أو 6 أو 9' };
  if (sameWhatsapp) {
    if (!isKuwaitMobile(p)) return { ok: false, error: 'رقم الأرضي ما عليه واتساب. اختر «رقم مختلف» واكتب رقم الواتساب' };
    return { ok: true, phone: p, whatsapp: null };
  }
  const w = localPhone(whatsapp);
  if (w.length !== 8) return { ok: false, error: 'رقم الواتساب لازم يكون 8 أرقام' };
  if (!isKuwaitMobile(w)) return { ok: false, error: 'رقم الواتساب لازم يكون جوال يبدأ بـ 5 أو 6 أو 9' };
  return { ok: true, phone: p, whatsapp: w === p ? null : w };
}

/** الرقم اللي يفتح عليه زر الواتساب: رقم الواتساب إن وُجد، وإلا رقم الاتصال إذا كان جوالاً. null = لا واتساب */
export function whatsappNumber(phone: string | null | undefined, whatsapp?: string | null): string | null {
  if (whatsapp && isKuwaitMobile(whatsapp)) return localPhone(whatsapp);
  if (phone && isKuwaitMobile(phone)) return localPhone(phone);
  return null;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** المسافة بالكيلومتر (Haversine) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestArea(lat: number, lng: number): string {
  let best = 'العاصمة', bd = Infinity;
  for (const [name, [la, ln]] of Object.entries(AREA_CENTERS)) {
    const d = distanceKm({ lat, lng }, { lat: la, lng: ln });
    if (d < bd) { bd = d; best = name; }
  }
  return best;
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} كم`;
}

export function formatKwd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} د.ك`;
}

export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isVisible(c: Pick<Company, 'is_active' | 'status' | 'sub_end'>, today = todayISO()): boolean {
  return !!c.is_active && c.status === 'approved' && c.sub_end >= today;
}

export function daysLeft(subEnd: string, today = todayISO()): number {
  return Math.round((Date.parse(subEnd + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
}

export function companyAreas(c: Company): string[] {
  return (c.company_areas ?? []).map((x) => x.areas?.name_ar).filter((x): x is string => !!x);
}

/** تطبيع النص العربي للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
export function normalizeAr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[|_\-–—+/\\.,،]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchFilters {
  q?: string;
  serviceId?: string | null;
  area?: string | null;
  only24h?: boolean;
  origin?: { lat: number; lng: number } | null;
  sort?: 'distance' | 'rating' | 'newest';
}

export interface RankedCompany { company: Company; distanceKm: number | null; inArea: boolean }

/** البحث والترتيب على جهة العميل (عدد الشركات صغير؛ يمكن نقله للخادم لاحقاً) */
export function searchCompanies(list: Company[], f: SearchFilters, serviceNames: Record<string, string> = {}): RankedCompany[] {
  const q = f.q ? normalizeAr(f.q) : '';
  const terms = q ? q.split(' ') : [];
  const out: RankedCompany[] = [];
  for (const c of list) {
    const extraServices = (c.company_services ?? []).map((s) => s.service_id);
    if (f.serviceId && c.service_id !== f.serviceId && !extraServices.includes(f.serviceId)) continue;
    if (f.only24h && !c.is_24h) continue;
    const areas = companyAreas(c);
    if (terms.length) {
      const hay = normalizeAr([c.name, c.description ?? '', c.price_text ?? '', serviceNames[c.service_id ?? ''] ?? '', areas.join(' '),
        ...(c.company_services ?? []).map((s) => s.title)].join(' '));
      if (!terms.every((t) => hay.includes(t))) continue;
    }
    let dist: number | null = null;
    if (f.origin) {
      if (c.lat != null && c.lng != null) dist = distanceKm(f.origin, { lat: c.lat, lng: c.lng });
      else if (areas.length) {
        dist = Math.min(...areas.filter((a) => AREA_CENTERS[a]).map((a) => distanceKm(f.origin!, { lat: AREA_CENTERS[a][0], lng: AREA_CENTERS[a][1] })), Infinity);
        if (!isFinite(dist)) dist = null;
      }
    }
    out.push({ company: c, distanceKm: dist, inArea: !f.area || areas.includes(f.area) });
  }
  const sort = f.sort ?? (f.origin ? 'distance' : 'rating');
  out.sort((a, b) => {
    if (f.area && a.inArea !== b.inArea) return a.inArea ? -1 : 1; // شركات منطقتك أولاً
    if (sort === 'distance') {
      const da = a.distanceKm ?? Infinity, db = b.distanceKm ?? Infinity;
      if (da !== db) return da - db;
    }
    if (sort === 'newest') return (b.company.created_at ?? '').localeCompare(a.company.created_at ?? '');
    const ra = Number(a.company.rating ?? 0), rb = Number(b.company.rating ?? 0);
    if (rb !== ra) return rb - ra;
    return b.company.rating_count - a.company.rating_count;
  });
  return out;
}

export const REQUEST_STATUS_AR: Record<string, string> = {
  new: 'جديد', accepted: 'مقبول', on_way: 'في الطريق', done: 'منجز', rejected: 'مرفوض', cancelled: 'ملغي',
};
export const COMPANY_STATUS_AR: Record<string, string> = {
  pending: 'بانتظار المراجعة', approved: 'معتمدة', rejected: 'مرفوضة', suspended: 'موقوفة',
};
export const SUB_STATUS_AR: Record<string, string> = {
  pending: 'بانتظار الدفع', active: 'فعّال', expired: 'منتهي', cancelled: 'ملغي',
};

/** تحويل رسائل أخطاء الخادم إلى عربية مفهومة */
export function arabicError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? '');
  if (/Invalid login credentials/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
  if (/Phone not confirmed/i.test(m)) return 'الحساب غير مفعّل بعد. أكمل التحقق برمز الرسالة';
  if (/Signups not allowed for otp|otp_disabled|user not found/i.test(m)) return 'ما لقينا حساب بهذا الرقم';
  if (/phone_exists|Phone number already|A user with this phone/i.test(m)) return 'هذا الرقم مربوط بحساب ثاني. ادخل برقمك مباشرة أو تواصل مع الدعم';
  if (/Phone signups are disabled|phone_provider_disabled|Unsupported phone provider|phone.*(not enabled)/i.test(m)) return 'التسجيل برقم التلفون غير مفعّل حالياً. تواصل مع الدعم الفني';
  if (/sms_send_failed|Error sending sms|sms provider error|sms hook not configured|hook/i.test(m)) return 'تعذّر إرسال رسالة التحقق الآن. حاول لاحقاً أو تواصل مع الدعم';
  if (/over_sms_send_rate_limit|sms.*rate limit|you can only request this after/i.test(m)) return 'انتظر قليلاً قبل طلب رمز جديد';
  if (/only Kuwaiti mobile numbers/i.test(m)) return 'الرقم لازم يكون جوال كويتي';
  if (/Token has expired or is invalid|otp_expired|invalid.*otp/i.test(m)) return 'رمز التحقق غير صحيح أو انتهت صلاحيته';
  if (/Email not confirmed/i.test(m)) return 'فعّل حسابك من الرابط المرسل إلى بريدك أولاً';
  if (/User already registered|phone_exists|already been registered/i.test(m)) return 'هذا البريد مسجل عندنا، سجّل دخولك';
  if (/Password should be at least/i.test(m)) return 'كلمة المرور قصيرة. اكتب 8 خانات على الأقل';
  if (/too many requests for this phone/i.test(m)) return 'وصلنا أكثر من طلب لهذا الرقم اليوم. بنتواصل معك قريباً';
  if (/rate limit/i.test(m)) return 'محاولات كثيرة، حاول بعد قليل';
  if (/duplicate key|unique/i.test(m)) return 'موجود مسبقاً';
  if (/protected fields|forbidden|permission denied|row-level security/i.test(m)) return 'ليس لديك صلاحية لهذا الإجراء';
  if (/cannot review own company/i.test(m)) return 'لا يمكنك تقييم شركتك';
  if (/plan not found/i.test(m)) return 'الخطة غير متوفرة';
  if (/Network request failed|Failed to fetch|fetch failed/i.test(m)) return 'تعذر الاتصال. تأكد من الإنترنت';
  if (/Token has expired or is invalid|otp_expired|invalid.*otp|Email link is invalid/i.test(m)) return 'الرابط غير صالح أو انتهت صلاحيته. اطلب رابطاً جديداً';
  if (/For security purposes, you can only request this|over_email_send_rate_limit|email rate limit/i.test(m)) return 'طلبات كثيرة، انتظر قليلاً ثم حاول مرة أخرى';
  if (/Password should|weak.?password|password.*(short|weak|pwned|leaked)/i.test(m)) return 'كلمة المرور ضعيفة. اختر كلمة أقوى (8 أحرف على الأقل مع أرقام)';
  if (/New password should be different/i.test(m)) return 'اختر كلمة مرور مختلفة عن القديمة';
  if (/Email address .* is invalid|email_address_invalid|Unable to validate email/i.test(m)) return 'البريد الإلكتروني غير صحيح';
  if (/Signups not allowed|signup_disabled/i.test(m)) return 'التسجيل متوقف مؤقتاً';
  if (/Error sending (confirmation|recovery) email|error sending/i.test(m)) return 'تعذّر إرسال البريد الآن، حاول لاحقاً';
  if (/relation .*(ads|support_tickets|support_messages).* does not exist|Could not find the table 'public\.(ads|support_tickets|support_messages)'|function public\.delete_my_account/i.test(m)) return 'هذه الخدمة بانتظار التفعيل من الإدارة';
  if (/reject reason required/i.test(m)) return 'اكتب سبب الرفض';
  if (/rate limit: too many ads/i.test(m)) return 'وصلت للحد اليومي من الإعلانات';
  if (/rate limit: too many (tickets|messages)/i.test(m)) return 'رسائل كثيرة، حاول بعد قليل';
  if (/owner account cannot be deleted/i.test(m)) return 'لا يمكن حذف حساب المالك من التطبيق';
  if (/terms not accepted/i.test(m)) return 'يلزم الموافقة على الشروط السارية أولاً';
  if (/vehicle does not belong|only the company can assign/i.test(m)) return 'السطحة غير تابعة لهذه الشركة';
  if (/terms .*immutable|cannot be modified/i.test(m)) return 'لا يمكن تعديل نسخة شروط بعد نشرها';
  if (/phone_check|phone ~/i.test(m)) return 'رقم الهاتف غير صحيح (8 أرقام يبدأ بـ 5 أو 6 أو 9)';
  return m || 'حدث خطأ غير متوقع';
}

// ===== السطحات: الحالات والوقت =====
export const VEHICLE_STATUS_AR: Record<string, string> = { available: 'متاح', busy: 'مشغول', offline: 'غير متصل' };
export const VEHICLE_KIND_AR: Record<string, string> = { flatbed: 'سطحة', wrecker: 'ونش', other: 'أخرى' };

/** وقت نسبي بالعربي: «الآن»، «منذ 5 دقائق»، «منذ ساعتين»، «منذ 3 أيام» */
export function timeAgoAr(iso: string, now: Date = new Date()): string {
  const sec = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return 'الآن';
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? 'منذ دقيقة' : min === 2 ? 'منذ دقيقتين' : min <= 10 ? `منذ ${min} دقائق` : `منذ ${min} دقيقة`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'منذ ساعة' : h === 2 ? 'منذ ساعتين' : h <= 10 ? `منذ ${h} ساعات` : `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'منذ يوم' : d === 2 ? 'منذ يومين' : d <= 10 ? `منذ ${d} أيام` : `منذ ${d} يوماً`;
}

/** ملخص حالات السطحات النشطة لشركة */
export function vehicleCounts(vs: { status: string; is_active?: boolean }[] | undefined) {
  const out = { available: 0, busy: 0, offline: 0, total: 0 };
  for (const v of vs ?? []) {
    if (v.is_active === false) continue;
    out.total++;
    if (v.status === 'available' || v.status === 'busy' || v.status === 'offline') out[v.status]++;
  }
  return out;
}

// ===== الشروط =====
/** هل النص ما زال يحتوي بيانات ناقصة؟ (يمنع نشر مسودة غير مكتملة) */
export function hasLegalPlaceholders(text: string): boolean {
  return /\[يُستكمل/.test(text);
}

/** يحوّل نص الشروط المنشور إلى فقرات وعناوين للعرض (العنوان: سطر يبدأ برقم ثم نقطة) */
export function parseTermsBody(body: string): { heading: boolean; text: string }[] {
  return body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => ({ heading: /^\d+\.\s/.test(l), text: l }));
}

export const AD_STATUS_AR: Record<string, string> = { pending: 'بانتظار الموافقة', approved: 'منشور', rejected: 'مرفوض', paused: 'موقوف' };
export const TICKET_STATUS_AR: Record<string, string> = { new: 'جديد', in_progress: 'قيد المعالجة', resolved: 'تم الحل' };
