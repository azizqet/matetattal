import { describe, expect, test } from '@jest/globals';
import type { Company } from '../types';
import {
  addDaysISO, arabicError, daysLeft, digits, distanceKm, formatKm, formatKwd, intlPhone, isKuwaitMobile, isKuwaitPhone,
  isVisible, localPhone, nearestArea, normalizeAr, searchCompanies, telUrl, whatsappUrl,
} from '../utils';

const base: Company = {
  id: 1, service_id: 'tow', name: 'ونش', phone: '96550000000', whatsapp: '96550000000', price_text: null, rating: 0, rating_count: 0,
  logo_url: null, cover_url: null, photos: [], description: null, address: null, lat: null, lng: null, is_24h: false, is_available: true,
  is_active: true, is_sample: false, status: 'approved', sub_start: '2026-01-01', sub_end: '2099-01-01', owner_id: null,
  visits: 0, calls: 0, wa_taps: 0, created_at: '2026-11-01', company_areas: [], company_services: [],
};
const co = (o: Partial<Company> & { areas?: string[] }): Company => ({
  ...base, ...o, company_areas: (o.areas ?? []).map((n, i) => ({ area_id: i, areas: { name_ar: n } })),
});

describe('الهواتف', () => {
  test('تحويل الأرقام العربية', () => expect(digits('٩٩٨٨٧٧٦٦')).toBe('99887766'));
  test('رقم محلي من صيغ مختلفة', () => {
    expect(localPhone('+965 9988 7766')).toBe('99887766');
    expect(localPhone('0096599887766')).toBe('99887766');
    expect(localPhone('96599887766')).toBe('99887766');
  });
  test('التحقق من الرقم الكويتي', () => {
    expect(isKuwaitPhone('99887766')).toBe(true);
    expect(isKuwaitPhone('22223333')).toBe(true);
    expect(isKuwaitMobile('22223333')).toBe(false);
    expect(isKuwaitPhone('1234567')).toBe(false);
    expect(isKuwaitPhone('39887766')).toBe(false);
  });
  test('صيغة دولية وروابط', () => {
    expect(intlPhone('51234567')).toBe('96551234567');
    expect(intlPhone('96551234567')).toBe('96551234567');
    expect(telUrl('51234567')).toBe('tel:+96551234567');
    expect(whatsappUrl('51234567', 'مرحبا')).toBe('https://wa.me/96551234567?text=' + encodeURIComponent('مرحبا'));
  });
});

describe('المسافة والمناطق', () => {
  test('المسافة بين نقطتين معروفتين تقريباً', () => {
    const d = distanceKm({ lat: 29.37, lng: 47.98 }, { lat: 29.08, lng: 48.13 }); // العاصمة ← الفحيحيل
    expect(d).toBeGreaterThan(30); expect(d).toBeLessThan(40);
  });
  test('أقرب منطقة', () => {
    expect(nearestArea(29.34, 48.075)).toBe('السالمية');
    expect(nearestArea(29.35, 47.66)).toBe('الجهراء');
  });
  test('تنسيق المسافة والسعر', () => {
    expect(formatKm(0.45)).toBe('450 م');
    expect(formatKm(3.21)).toBe('3.2 كم');
    expect(formatKm(42.6)).toBe('43 كم');
    expect(formatKwd(10)).toBe('10 د.ك');
    expect(formatKwd(12.5)).toBe('12.5 د.ك');
  });
});

describe('التواريخ والظهور', () => {
  test('إضافة أيام', () => expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02'));
  test('الأيام المتبقية', () => expect(daysLeft('2026-12-01', '2026-11-22')).toBe(9));
  test('ظهور الشركة', () => {
    expect(isVisible({ is_active: true, status: 'approved', sub_end: '2026-11-22' }, '2026-11-22')).toBe(true);
    expect(isVisible({ is_active: true, status: 'approved', sub_end: '2026-11-21' }, '2026-11-22')).toBe(false);
    expect(isVisible({ is_active: true, status: 'pending', sub_end: '2099-01-01' }, '2026-11-22')).toBe(false);
    expect(isVisible({ is_active: false, status: 'approved', sub_end: '2099-01-01' }, '2026-11-22')).toBe(false);
  });
});

describe('البحث', () => {
  test('تطبيع العربي', () => {
    expect(normalizeAr('إصلاحُ السيّارة')).toBe('اصلاح السياره');
    expect(normalizeAr('ونش || كويتي')).toBe('ونش كويتي');
  });
  const list = [
    co({ id: 1, name: 'ونش الفزعة', service_id: 'tow', rating: 4.5, rating_count: 10, areas: ['حولي'], lat: 29.33, lng: 48.03, is_24h: true }),
    co({ id: 2, name: 'بنشر السالمية', service_id: 'tire', rating: 5, rating_count: 2, areas: ['السالمية'] }),
    co({ id: 3, name: 'ونش الجهراء', service_id: 'tow', rating: 3, rating_count: 1, areas: ['الجهراء'], lat: 29.35, lng: 47.67 }),
    co({ id: 4, name: 'شركة متعددة', service_id: 'wash', company_services: [{ id: 1, company_id: 4, service_id: 'tow', title: 'سحب سيارات', price_from: 10, price_note: null }] }),
  ];
  test('فلترة حسب الخدمة تشمل الخدمات الإضافية', () => {
    expect(searchCompanies(list, { serviceId: 'tow' }).map((r) => r.company.id).sort()).toEqual([1, 3, 4]);
  });
  test('بحث نصي مع التطبيع', () => {
    expect(searchCompanies(list, { q: 'ونش جهراء' }).map((r) => r.company.id)).toEqual([3]);
    expect(searchCompanies(list, { q: 'سحب' }).map((r) => r.company.id)).toEqual([4]);
    expect(searchCompanies(list, { q: 'بنشر' }, { tire: 'البنشر المتنقل' }).map((r) => r.company.id)).toEqual([2]);
  });
  test('الترتيب حسب المسافة عند وجود موقع', () => {
    const r = searchCompanies(list, { serviceId: 'tow', origin: { lat: 29.35, lng: 47.68 } });
    expect(r[0].company.id).toBe(3);
    expect(r[0].distanceKm!).toBeLessThan(2);
  });
  test('شركات منطقتك أولاً', () => {
    const r = searchCompanies(list, { area: 'الجهراء' });
    expect(r[0].company.id).toBe(3);
    expect(r[0].inArea).toBe(true);
    expect(r[1].inArea).toBe(false);
  });
  test('الترتيب حسب التقييم افتراضياً', () => {
    expect(searchCompanies(list, {}).map((r) => r.company.id).slice(0, 2)).toEqual([2, 1]);
  });
  test('فلتر 24 ساعة', () => {
    expect(searchCompanies(list, { only24h: true }).map((r) => r.company.id)).toEqual([1]);
  });
});

describe('رسائل الأخطاء', () => {
  test('ترجمة أخطاء الخادم', () => {
    expect(arabicError(new Error('Invalid login credentials'))).toBe('رقم التلفون أو كلمة المرور غير صحيحة');
    expect(arabicError(new Error('protected fields'))).toBe('ليس لديك صلاحية لهذا الإجراء');
    expect(arabicError(new Error('rate limit: too many'))).toBe('محاولات كثيرة، حاول بعد قليل');
    expect(arabicError(new Error('TypeError: Network request failed'))).toBe('تعذر الاتصال. تأكد من الإنترنت');
  });
});
