import type { Lang } from '../i18n';
import { format } from '../i18n';
import ar from '../i18n/ar';
import en from '../i18n/en';

const dict = { ar, en };

/** Kuwaiti dinar: up to 3 decimals (fils), thousands separators, Latin digits. */
export function formatKwd(value: number | string | null | undefined, lang: Lang): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : value;
  const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n);
  return lang === 'ar' ? `${s} د.ك` : `KWD ${s}`;
}

export function priceLabel(
  ad: { price: number | string | null; price_type: 'fixed' | 'negotiable' | 'contact' | 'free' },
  lang: Lang,
): string {
  const d = dict[lang].ad;
  if (ad.price_type === 'contact') return d.contactForPrice;
  if (ad.price_type === 'free') return d.free;
  return formatKwd(ad.price, lang);
}

export function relativeTime(iso: string | Date, lang: Lang): string {
  const d = dict[lang].time;
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 86400) return format(d.inHours, { n: Math.max(1, Math.round(ahead / 3600)) });
    return format(d.inDays, { n: Math.round(ahead / 86400) });
  }
  if (diff < 60) return d.now;
  if (diff < 3600) return format(d.minutes, { n: Math.floor(diff / 60) });
  if (diff < 86400) return format(d.hours, { n: Math.floor(diff / 3600) });
  if (diff < 86400 * 30) return format(d.days, { n: Math.floor(diff / 86400) });
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric' });
}

export function clockTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Normalises Kuwaiti numbers to digits only (+965 optional), converting Arabic-Indic digits. */
export function normalizePhone(input: string): string {
  const latin = input.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  return latin.replace(/[^\d+]/g, '');
}

export function isValidKwPhone(p: string): boolean {
  return /^(\+?965)?[2569]\d{7}$/.test(normalizePhone(p)) || /^\+?\d{8,15}$/.test(normalizePhone(p));
}

export function whatsappNumber(p: string): string {
  const n = normalizePhone(p).replace(/^\+/, '');
  return /^[2569]\d{7}$/.test(n) ? `965${n}` : n;
}
