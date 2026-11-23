import { describe, expect, test } from '@jest/globals';
import { checkContactNumbers, telUrl, whatsappNumber, whatsappUrl } from '../utils';

describe('أرقام تواصل المعلن', () => {
  test('رقم الاتصال لازم 8 أرقام', () => {
    expect(checkContactNumbers('9999123', true, '')).toMatchObject({ ok: false });
    expect(checkContactNumbers('999912345', true, '')).toMatchObject({ ok: false });
    expect(checkContactNumbers('12345678', true, '')).toMatchObject({ ok: false });
    expect(checkContactNumbers('٩٩٩١٢٣١٣', true, '')).toEqual({ ok: true, phone: '99912313', whatsapp: null });
  });
  test('الواتساب: نفس الرقم، أو رقم جوال مختلف', () => {
    expect(checkContactNumbers('22223333', true, '')).toMatchObject({ ok: false }); // أرضي
    expect(checkContactNumbers('22223333', false, '2222444')).toMatchObject({ ok: false });
    expect(checkContactNumbers('22223333', false, '22224444')).toMatchObject({ ok: false });
    expect(checkContactNumbers('22223333', false, '55512345')).toEqual({ ok: true, phone: '22223333', whatsapp: '55512345' });
    expect(checkContactNumbers('99912313', false, '99912313')).toEqual({ ok: true, phone: '99912313', whatsapp: null });
  });
});

describe('زرّا الاتصال والواتساب', () => {
  test('الاتصال يفتح تطبيق الهاتف برقم دولي', () => {
    expect(telUrl('99912313')).toBe('tel:+96599912313');
    expect(telUrl('96599912313')).toBe('tel:+96599912313');
  });
  test('الواتساب يفتح محادثة مباشرة مع رقم الواتساب (أو رقم الاتصال إذا كان جوالاً)', () => {
    expect(whatsappUrl(whatsappNumber('22223333', '55512345'))).toBe('https://wa.me/96555512345');
    expect(whatsappUrl(whatsappNumber('96599912313', null))).toBe('https://wa.me/96599912313');
    expect(whatsappNumber('22223333', null)).toBeNull(); // أرضي بدون واتساب ← الزر معطّل
    expect(whatsappUrl('99912313', 'السلام عليكم')).toBe('https://wa.me/96599912313?text=' + encodeURIComponent('السلام عليكم'));
  });
});
