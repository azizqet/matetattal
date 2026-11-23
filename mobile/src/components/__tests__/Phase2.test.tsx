import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }), SafeAreaView: ({ children }: { children: unknown }) => children }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/lib/queries', () => ({
  useServices: () => ({ data: [{ id: 'tow', name_ar: 'سطحات' }] }),
  useAreas: () => ({ data: [{ id: 1, name_ar: 'حولي' }] }),
  useServiceNames: () => ({ tow: 'سطحات' }),
}));
const mockSession = { current: null as null | { user: { id: string; phone?: string } } };
jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: mockSession.current, profile: mockSession.current ? { full_name: 'تجربة', phone: '97706792', role: 'customer' } : null, signOut: jest.fn(async () => {}) }),
  isAdmin: (p: { role?: string } | null) => p?.role === 'admin',
}));
jest.mock('@/lib/api', () => ({
  getCurrentTerms: jest.fn(async () => []),
  getMyAcceptedDocIds: jest.fn(async () => []),
  getNotifications: jest.fn(async () => []),
  getMyCompanies: jest.fn(async () => []),
  createAd: jest.fn(async (a: object) => ({ id: 1, status: 'pending', ...a })),
  sendPhoneOtp: jest.fn(async () => {}),
  verifyPhoneOtp: jest.fn(async () => ({})),
  deleteMyAccount: jest.fn(async () => {}),
}));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn(), signUp: jest.fn(), resetPasswordForEmail: jest.fn() } } }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => 'matetattal://' + p, useURL: () => null }));

/* eslint-disable import/first */
import Account from '../../app/(tabs)/account';
import AddAd from '../../app/(tabs)/add';
import Auth from '../../app/auth';
import { ToastProvider } from '../ui';
/* eslint-enable import/first */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('@/lib/api') as Record<string, jest.Mock>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sb = require("@/lib/supabase").supabase as { auth: Record<string, jest.Mock<(...a: unknown[]) => Promise<unknown>>> };

const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>;

describe('أضف إعلان', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });

  test('يطلب تسجيل الدخول لغير المسجّل', async () => {
    await render(wrap(<AddAd />));
    expect(screen.getByTestId('add-login')).toBeTruthy();
  });

  test('الإرسال لا يتضمن الحالة (الخادم يجعلها بانتظار الموافقة) والضغط المتكرر يرسل مرة واحدة', async () => {
    mockSession.current = { user: { id: 'u1' } };
    const user = userEvent.setup();
    await render(wrap(<AddAd />));
    await user.type(screen.getByTestId('ad-title'), 'سطحة متوفرة');
    await user.press(screen.getByText('سطحات'));
    await user.type(screen.getByTestId('ad-desc'), 'خدمة سحب داخل حولي على مدار الساعة');
    await user.press(screen.getByText('حولي'));
    expect(screen.getByTestId('ad-phone').props.value).toBe('97706792');
    const btn = screen.getByTestId('ad-submit');
    await act(async () => { fireEvent.press(btn); fireEvent.press(btn); });
    await waitFor(() => expect(api.createAd).toHaveBeenCalledTimes(1));
    const sent = api.createAd.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('status');
    expect(sent).toMatchObject({ title: 'سطحة متوفرة', service_id: 'tow', area_name: 'حولي', phone: '97706792', price: null, images: [] });
    await waitFor(() => expect(screen.getByText('وصل إعلانك')).toBeTruthy());
  });
});

describe('حسابي', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  test('لا يظهر «الشكاوى» أو «سجّل شركتك» أو «لوحة شركتي»، ويظهر الدعم الفني وإعلاناتي وحذف الحساب', async () => {
    mockSession.current = { user: { id: 'u1', phone: '96597706792' } };
    await render(wrap(<Account />));
    expect(screen.queryByText(/شكو|بلاغ|اقتراح|سجّل شركتك|لوحة شركتي/)).toBeNull();
    expect(screen.queryByText('لوحة الإدارة')).toBeNull(); // ليست للمستخدم العادي
    for (const id of ['acc-my-ads', 'acc-support', 'acc-logout', 'acc-delete']) expect(screen.getByTestId(id)).toBeTruthy();
  });
  test('حذف الحساب يحتاج تأكيداً', async () => {
    mockSession.current = { user: { id: 'u1' } };
    const user = userEvent.setup();
    await render(wrap(<Account />));
    await user.press(screen.getByTestId('acc-delete'));
    expect(api.deleteMyAccount).not.toHaveBeenCalled();
    await user.press(screen.getByTestId('acc-delete-confirm'));
    await waitFor(() => expect(api.deleteMyAccount).toHaveBeenCalledTimes(1));
  });
});

describe('الدخول برقم الجوال', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });

  test('+965 ثابت، يرفض رقماً غير كويتي، يرسل الرمز ثم يتحقق تلقائياً عند اكتمال 6 أرقام', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    expect(screen.getByText(/\+965/)).toBeTruthy();
    await user.type(screen.getByTestId('auth-phone'), '1234567');
    await user.press(screen.getByTestId('auth-send'));
    expect(api.sendPhoneOtp).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('auth-phone'));
    await user.type(screen.getByTestId('auth-phone'), '٩٧٧٠٦٧٩٢');
    expect(screen.getByTestId('auth-phone').props.value).toBe('97706792');
    await user.press(screen.getByTestId('auth-send'));
    await waitFor(() => expect(api.sendPhoneOtp).toHaveBeenCalledWith('97706792'));
    await waitFor(() => expect(screen.getByTestId('auth-code')).toBeTruthy());
    const codeField = screen.getByTestId('auth-code');
    expect(codeField.props.textContentType).toBe('oneTimeCode');
    expect(codeField.props.autoComplete).toBe('sms-otp');
    expect(screen.getByText(/إعادة الإرسال بعد/)).toBeTruthy();
    await user.type(codeField, '12345');
    expect(api.verifyPhoneOtp).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('auth-code'), '6');
    await waitFor(() => expect(api.verifyPhoneOtp).toHaveBeenCalledWith('97706792', '123456'));
    expect(api.verifyPhoneOtp).toHaveBeenCalledTimes(1);
  });

  test('الحسابات القديمة: الدخول بالبريد ما زال متاحاً (بدون تسجيل جديد بالبريد)', async () => {
    sb.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('auth-email-link'));
    expect(screen.queryByText('إنشاء حساب جديد')).toBeNull();
    await user.type(screen.getByTestId('email'), 'a@b.co');
    await user.type(screen.getByTestId('password'), 'abc12345');
    await user.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'abc12345' }));
  });
});
