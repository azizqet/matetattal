import { describe, expect, test } from '@jest/globals';
import { getLegalDoc, LEGAL_DOCS, legalDocToText } from '../../content/legal';
import { arabicError, hasLegalPlaceholders, parseTermsBody, timeAgoAr, vehicleCounts } from '../utils';

const now = new Date('2026-11-22T12:00:00Z');
const ago = (sec: number) => new Date(now.getTime() - sec * 1000).toISOString();

describe('الوقت النسبي بالعربي', () => {
  test.each([
    [10, 'الآن'], [60, 'منذ دقيقة'], [120, 'منذ دقيقتين'], [5 * 60, 'منذ 5 دقائق'], [25 * 60, 'منذ 25 دقيقة'],
    [3600, 'منذ ساعة'], [7200, 'منذ ساعتين'], [3 * 3600, 'منذ 3 ساعات'], [86400, 'منذ يوم'], [2 * 86400, 'منذ يومين'], [4 * 86400, 'منذ 4 أيام'],
  ])('%i ثانية → %s', (s, out) => expect(timeAgoAr(ago(s), now)).toBe(out));
  test('وقت في المستقبل (فرق ساعة الجهاز) يُعرض «الآن»', () => expect(timeAgoAr(ago(-90), now)).toBe('الآن'));
});

describe('عدّ السطحات', () => {
  test('يتجاهل الموقوفة ويعدّ كل حالة', () => {
    expect(vehicleCounts([
      { status: 'available' }, { status: 'available', is_active: true }, { status: 'busy' }, { status: 'offline' }, { status: 'available', is_active: false },
    ])).toEqual({ available: 2, busy: 1, offline: 1, total: 4 });
    expect(vehicleCounts(undefined)).toEqual({ available: 0, busy: 0, offline: 0, total: 0 });
  });
});

describe('نص الشروط للنشر', () => {
  test('المسودات الحالية تحتوي بيانات ناقصة فلا يمكن نشرها كما هي', () => {
    for (const d of LEGAL_DOCS) expect(hasLegalPlaceholders(legalDocToText(d))).toBe(true);
  });
  test('نص مكتمل يُسمح بنشره', () => expect(hasLegalPlaceholders('1. مقدمة\n• نص مكتمل')).toBe(false));
  test('التحويل ثم التحليل يحافظ على العناوين والبنود', () => {
    const d = getLegalDoc('customers')!;
    const parts = parseTermsBody(legalDocToText(d));
    expect(parts.filter((p) => p.heading).length).toBe(d.sections.length);
    expect(parts.filter((p) => !p.heading).length).toBe(d.sections.reduce((n, s) => n + s.body.length, 0));
    expect(parts[0]).toEqual({ heading: true, text: `1. ${d.sections[0].title}` });
  });
});

describe('رسائل الأخطاء الجديدة', () => {
  test('رفض الخادم لعدم الموافقة وربط سطحة خاطئة', () => {
    expect(arabicError(new Error('terms not accepted: providers, privacy'))).toBe('يلزم الموافقة على الشروط السارية أولاً');
    expect(arabicError(new Error('vehicle does not belong to company'))).toBe('السطحة غير تابعة لهذه الشركة');
    expect(arabicError(new Error('published terms are immutable; create a new version'))).toBe('لا يمكن تعديل نسخة شروط بعد نشرها');
  });
});
