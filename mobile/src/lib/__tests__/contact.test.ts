import { describe, expect, test } from '@jest/globals';
import { firstWhatsappContact, formatLocalPhone, phoneInText, SUPPORT_CONTACTS } from '../contact';
import { isKuwaitPhone, telUrl, whatsappUrl } from '../utils';

describe('أرقام التواصل', () => {
  test('الرقمان المعتمدان فقط بالترتيب', () => {
    expect(SUPPORT_CONTACTS.map((c) => c.phone)).toEqual(['97706792', '99225025']);
  });
  test('الرقم القديم محذوف', () => {
    expect(SUPPORT_CONTACTS.some((c) => c.phone.includes('65755222'))).toBe(false);
  });
  test('أرقام كويتية صحيحة وروابط اتصال سليمة', () => {
    for (const c of SUPPORT_CONTACTS) expect(isKuwaitPhone(c.phone)).toBe(true);
    expect(telUrl('97706792')).toBe('tel:+96597706792');
    expect(telUrl('99225025')).toBe('tel:+96599225025');
  });
  test('واتساب مفعّل للرقمين (مؤكد من المالك)', () => {
    expect(SUPPORT_CONTACTS.every((c) => c.whatsapp === true)).toBe(true);
    expect(firstWhatsappContact()?.phone).toBe('97706792');
  });
  test('روابط واتساب والاتصال بمفتاح الكويت 965', () => {
    expect(whatsappUrl('97706792')).toBe('https://wa.me/96597706792');
    expect(whatsappUrl('99225025')).toBe('https://wa.me/96599225025');
    expect(telUrl('97706792').startsWith('tel:+965')).toBe(true);
  });
  test('عرض الرقم', () => expect(formatLocalPhone('97706792')).toBe('9770 6792'));
  test('الرقم داخل نص عربي معزول الاتجاه', () => expect(phoneInText('97706792')).toBe('\u20669770 6792\u2069'));
});
