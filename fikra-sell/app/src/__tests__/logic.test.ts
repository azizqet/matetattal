import { describe, expect, it } from '@jest/globals';
import ar from '../i18n/ar';
import en from '../i18n/en';
import { format } from '../i18n';
import { toAppError } from '../lib/errors';
import { formatKwd, isValidKwPhone, normalizePhone, priceLabel, relativeTime, whatsappNumber } from '../lib/format';
import { contrast, mix, onColor } from '../theme/color';
import { dark, light } from '../theme/tokens';

function keys(o: object, p = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${p}${k}`] : keys(v as object, `${p}${k}.`)));
}

describe('i18n', () => {
  it('Arabic and English dictionaries have identical keys', () => {
    expect(keys(en).sort()).toEqual(keys(ar).sort());
  });
  it('placeholders match between languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    const flat = (o: object) => Object.fromEntries(keys(o).map((k) => [k, k.split('.').reduce<any>((x, y) => x[y], o)]));
    const a = flat(ar); const e = flat(en);
    for (const k of Object.keys(a)) expect([k, vars(e[k])]).toEqual([k, vars(a[k])]);
  });
  it('no empty strings', () => {
    for (const k of keys(ar)) expect(k.split('.').reduce<any>((x, y) => x[y], ar)).not.toBe('');
  });
  it('formats variables', () => {
    expect(format('أهلاً {name}', { name: 'سارة' })).toBe('أهلاً سارة');
    expect(format('{a}/{b}', { a: 1 })).toBe('1/{b}');
  });
});

describe('prices & numbers', () => {
  it('formats KWD with fils precision', () => {
    expect(formatKwd(4500.5, 'ar')).toBe('4,500.5 د.ك');
    expect(formatKwd('1250.125', 'en')).toBe('KWD 1,250.125');
    expect(formatKwd(null, 'ar')).toBe('');
  });
  it('labels non-numeric price types', () => {
    expect(priceLabel({ price: null, price_type: 'contact' }, 'ar')).toBe('تواصل لمعرفة السعر');
    expect(priceLabel({ price: null, price_type: 'free' }, 'en')).toBe('Free');
    expect(priceLabel({ price: 30, price_type: 'negotiable' }, 'ar')).toBe('30 د.ك');
  });
  it('normalises Arabic-Indic digits in phones', () => {
    expect(normalizePhone('٩٩٨٨ ٧٧٦٦')).toBe('99887766');
    expect(isValidKwPhone('99887766')).toBe(true);
    expect(isValidKwPhone('+96599887766')).toBe(true);
    expect(isValidKwPhone('123')).toBe(false);
    expect(whatsappNumber('99887766')).toBe('96599887766');
    expect(whatsappNumber('+96599887766')).toBe('96599887766');
  });
  it('relative time', () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString(), 'en')).toBe('5m ago');
    expect(relativeTime(new Date(Date.now() - 3 * 3600_000).toISOString(), 'ar')).toBe('منذ 3 س');
    expect(relativeTime(new Date(Date.now() + 3 * 86400_000 + 60_000).toISOString(), 'en')).toBe('in 3 days');
  });
});

describe('error mapping', () => {
  it('maps server error codes to Arabic messages', () => {
    expect(toAppError({ message: 'duplicate_ad' }).key).toBe('errors.duplicate_ad');
    expect(toAppError({ message: 'missing_field:make' })).toEqual({ key: 'errors.missing_field', vars: { field: 'make' } });
    expect(toAppError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).key).toBe('errors.invalid_credentials');
    expect(toAppError({ code: 'user_already_exists', message: 'User already registered' }).key).toBe('errors.email_exists');
    expect(toAppError({ message: 'Database error saving new user' }).key).toBe('errors.disposable_email');
    expect(toAppError(new TypeError('Network request failed')).key).toBe('errors.network');
    expect(toAppError({ message: 'new row violates row-level security policy' }).key).toBe('errors.forbidden');
    expect(toAppError({ message: 'something odd' }).key).toBe('errors.generic');
  });
  it('every mapped key exists in the dictionary', () => {
    const all = new Set(keys(ar));
    for (const m of ['duplicate_ad', 'daily_ad_limit', 'blocked', 'bump_cooldown', 'account_banned', 'payments_disabled'])
      expect(all.has(toAppError({ message: m }).key)).toBe(true);
  });
});

describe('design tokens', () => {
  it('text on backgrounds meets WCAG AA in both themes', () => {
    for (const p of [light, dark]) {
      expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.textMuted, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(3);
    }
  });
  it('colour helpers', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(onColor('#FFFFFF')).toBe('#15161C');
    expect(onColor('#1D3FA6')).toBe('#FFFFFF');
  });
});
