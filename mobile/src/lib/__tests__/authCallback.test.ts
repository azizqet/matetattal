import { describe, expect, jest, test } from '@jest/globals';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: {} } }));
jest.mock('expo-linking', () => ({ useURL: () => null }));
// eslint-disable-next-line import/first
import { parseAuthUrl } from '../../app/auth-callback';

describe('قراءة روابط البريد', () => {
  test('رابط إعادة تعيين كلمة المرور (بعد #)', () => {
    expect(parseAuthUrl('matetattal://auth-callback#access_token=a.b&refresh_token=r1&type=recovery')).toMatchObject({ access_token: 'a.b', refresh_token: 'r1', type: 'recovery' });
  });
  test('رابط Expo Go وخطأ انتهاء الصلاحية', () => {
    const q = parseAuthUrl('exp://u.expo.dev/x/--/auth-callback?foo=1#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    expect(q.error_description).toBe('Email link is invalid or has expired');
    expect(q.foo).toBe('1');
  });
  test('رابط بصيغة code', () => expect(parseAuthUrl('matetattal://auth-callback?code=xyz').code).toBe('xyz'));
});
