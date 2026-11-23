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
  signUpWithPhone: jest.fn(async () => ({ session: null, user: {} })),
  verifyPhoneOtp: jest.fn(async () => ({})),
  resendSignupOtp: jest.fn(async () => {}),
  sendLoginOtp: jest.fn(async () => {}),
  signInWithPassword: jest.fn(async () => {}),
  setNewPassword: jest.fn(async () => {}),
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

describe('التسجيل والدخول', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });

  test('حساب جديد: يتحقق من الحقول، يرسل التلفون +965 والاسم والبريد، ثم شاشة الرمز ويتحقق تلقائياً عند 6 أرقام', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    expect(screen.getByText('+965')).toBeTruthy();
    await user.type(screen.getByTestId('reg-phone'), '1234567');
    await user.press(screen.getByTestId('reg-submit'));
    expect(api.signUpWithPhone).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('reg-phone'));
    await user.type(screen.getByTestId('reg-phone'), '٩٧٧٠٦٧٩٢');
    expect(screen.getByTestId('reg-phone').props.value).toBe('97706792');
    await user.type(screen.getByTestId('reg-name'), 'عزيز');
    await user.type(screen.getByTestId('reg-email'), 'aziz@example.com');
    await user.type(screen.getByTestId('reg-password'), 'abcdefgh');
    await user.press(screen.getByTestId('reg-submit'));
    expect(api.signUpWithPhone).not.toHaveBeenCalled(); // كلمة مرور بدون أرقام
    await user.type(screen.getByTestId('reg-password'), '12');
    await user.press(screen.getByTestId('reg-submit'));
    await waitFor(() => expect(api.signUpWithPhone).toHaveBeenCalledWith({ phone: '97706792', password: 'abcdefgh12', name: 'عزيز', email: 'aziz@example.com' }));
    await waitFor(() => expect(screen.getByTestId('otp')).toBeTruthy());
    expect(screen.getByTestId('otp').props.textContentType).toBe('oneTimeCode');
    expect(screen.getByTestId('otp').props.autoComplete).toBe('sms-otp');
    expect(screen.getByText(/تقدر تطلب رمز جديد بعد/)).toBeTruthy();
    await user.type(screen.getByTestId('otp'), '12345');
    expect(api.verifyPhoneOtp).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('otp'), '6');
    await waitFor(() => expect(api.verifyPhoneOtp).toHaveBeenCalledWith('97706792', '123456'));
    expect(api.verifyPhoneOtp).toHaveBeenCalledTimes(1);
  });

  test('التبويبات منفصلة: حساب جديد بلا زر «سجّل دخولي»، وتسجيل الدخول بخانتين فقط، وزر إظهار كلمة المرور يعمل', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    for (const id of ['reg-name', 'reg-phone', 'reg-email', 'reg-password', 'reg-submit']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(screen.queryByTestId('login-submit')).toBeNull();
    expect(screen.queryByText('سجّل دخولي')).toBeNull();
    expect(screen.queryByText(/حساب قديم|بالإيميل/)).toBeNull();
    expect(screen.getByTestId('reg-password').props.secureTextEntry).toBe(true);
    await user.press(screen.getByTestId('reg-password-eye'));
    expect(screen.getByTestId('reg-password').props.secureTextEntry).toBe(false);
    await user.press(screen.getByTestId('tab-login'));
    expect(screen.getByTestId('login-id')).toBeTruthy();
    expect(screen.getByTestId('login-password')).toBeTruthy();
    for (const id of ['reg-name', 'reg-email', 'reg-submit']) expect(screen.queryByTestId(id)).toBeNull();
    expect(screen.getByTestId('tab-login').props.accessibilityState).toMatchObject({ selected: true });
  });

  test('عندك حساب؟ سجّل دخولك — بالتلفون، ويقبل البريد للحسابات القديمة بدون رابط منفصل', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    expect(screen.queryByText(/حساب قديم/)).toBeNull();
    await user.press(screen.getByTestId('to-login'));
    await user.type(screen.getByTestId('login-id'), '97706792');
    await user.type(screen.getByTestId('login-password'), 'abc12345');
    await user.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(api.signInWithPassword).toHaveBeenCalledWith('97706792', 'abc12345'));
    await user.clear(screen.getByTestId('login-id'));
    await user.type(screen.getByTestId('login-id'), 'owner@example.com');
    await user.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(api.signInWithPassword).toHaveBeenLastCalledWith('owner@example.com', 'abc12345'));
  });

  test('نسيت كلمة المرور: رمز SMS ثم كلمة مرور جديدة', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('to-login'));
    await user.type(screen.getByTestId('login-id'), '97706792');
    await user.press(screen.getByTestId('login-forgot'));
    await user.press(screen.getByTestId('forgot-submit'));
    await waitFor(() => expect(api.sendLoginOtp).toHaveBeenCalledWith('97706792'));
    await user.type(screen.getByTestId('otp'), '654321');
    await waitFor(() => expect(api.verifyPhoneOtp).toHaveBeenCalledWith('97706792', '654321'));
    await waitFor(() => expect(screen.getByTestId('new-password')).toBeTruthy());
    await user.type(screen.getByTestId('new-password'), 'newpass99');
    await user.press(screen.getByTestId('new-password-save'));
    await waitFor(() => expect(api.setNewPassword).toHaveBeenCalledWith('newpass99'));
  });
});
