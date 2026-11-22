import { describe, expect, test } from '@jest/globals';
import { getLegalDoc, LEGAL_DOCS } from '../legal';

const text = (id: string) => getLegalDoc(id)!.sections.flatMap((s) => [s.title, ...s.body]).join('\n');

describe('وثائق الشروط والسياسات', () => {
  test('خمس وثائق مستقلة بالمعرفات المطلوبة', () => {
    expect(LEGAL_DOCS.map((d) => d.id).sort()).toEqual(['ads', 'customers', 'privacy', 'providers', 'subscriptions']);
  });
  test('كل وثيقة لها عنوان وإصدار وأقسام غير فارغة', () => {
    for (const d of LEGAL_DOCS) {
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.version).toMatch(/^\d+\.\d+$/);
      expect(d.sections.length).toBeGreaterThan(2);
      for (const s of d.sections) expect(s.body.length).toBeGreaterThan(0);
    }
  });
  test('مسودات غير نافذة حتى الاعتماد (لا تاريخ سريان)', () => {
    for (const d of LEGAL_DOCS) { expect(d.status).toBe('draft'); expect(d.effectiveDate).toBeNull(); }
  });
  test.each(['customers', 'providers', 'subscriptions', 'ads'])('%s: يوضح الوساطة التقنية ومسؤولية الأطراف ولا يلغي مسؤولية المنصة القانونية', (id) => {
    const t = text(id);
    expect(t).toContain('منصة تقنية وسيطة');
    expect(t).toContain('يتحمل كل طرف');
    expect(t).toContain('لا يُفسَّر أي نص');
    expect(t).toContain('دولة الكويت');
  });
  test('الإعلانات توضح أنها ممولة', () => expect(text('ads')).toContain('إعلان ممول'));
  test('لا أرقام قديمة ولا بيانات تشغيل مخترعة', () => {
    const all = LEGAL_DOCS.map((d) => text(d.id)).join('\n');
    expect(all).not.toContain('65755222');
    expect(all).toContain('97706792');
    expect(all).toContain('[يُستكمل:'); // بيانات الجهة المشغلة تنتظر المالك
  });
});
