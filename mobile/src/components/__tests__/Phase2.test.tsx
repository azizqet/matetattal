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
  useSession: () => ({ refreshProfile: jest.fn(async () => {}), session: mockSession.current, profile: mockSession.current ? { full_name: 'تجربة', phone: '97706792', role: 'customer' } : null, signOut: jest.fn(async () => {}) }),
  isAdmin: (p: { role?: string } | null) => p?.role === 'admin',
}));
jest.mock('@/lib/api', () => ({
  getCurrentTerms: jest.fn(async () => []),
  getMyAcceptedDocIds: jest.fn(async () => []),
  getNotifications: jest.fn(async () => []),
  getMyCompanies: jest.fn(async () => []),
  createAd: jest.fn(async (a: object) => ({ id: 1, status: 'pending', ...a })),
  signUpWithPhonePassword: jest.fn(async () => ({ id: 'u-new' }) as unknown),
  signInWithPhonePassword: jest.fn(async () => ({ id: 'u1' }) as unknown),
  signInWithEmailPassword: jest.fn(async () => ({ id: 'u-old' }) as unknown),
  createRecoveryCode: jest.fn(async () => 'A1B2C3-D4E5F6-0A1B2C' as unknown),
  resetPasswordWithRecovery: jest.fn(async () => true as unknown),
  loginPhoneOf: (e?: string | null) => /^965(\d{8})@users\.matattal\.invalid$/.exec(e ?? '')?.[1] ?? null,
  getMyProfile: jest.fn(async () => null as unknown),
  updateMyProfile: jest.fn(async () => {}),
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
const api = require('@/lib/api') as Record<string, jest.Mock<(...a: unknown[]) => Promise<unknown>>>;

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

describe('التسجيل والدخول برقم التلفون + كلمة السر', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const router = () => (require('expo-router') as { router: { replace: jest.Mock } }).router;

  test('الرقم: +965 منفصل، لوحة أرقام، بدون maxLength، تنقية الكتابة واللصق والحذف', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    expect(screen.getByText(/\+965/)).toBeTruthy();
    const ph = () => screen.getByTestId('phone');
    expect(ph().props.keyboardType).toBe('number-pad');
    expect(ph().props.maxLength).toBeUndefined();
    await user.type(ph(), '٩٩٩١');
    expect(ph().props.value).toBe('9991');
    await user.type(ph(), '231399');
    expect(ph().props.value).toBe('99912313');
    await user.type(ph(), '{Backspace}');
    expect(ph().props.value).toBe('9991231');
    await user.clear(ph());
    await user.paste(ph(), '+965 9991 2313');
    expect(ph().props.value).toBe('99912313');
  });

  test('حقل كلمة السر: مخفي، قابل للكتابة، بدون newPassword (يمنع الكتابة على iOS)، وزر إظهار', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    const pw = () => screen.getByTestId('password');
    expect(pw().props.secureTextEntry).toBe(true);
    expect(pw().props.textContentType).not.toBe('newPassword');
    expect(pw().props.maxLength).toBeUndefined();
    await user.type(pw(), 'abc12345');
    expect(pw().props.value).toBe('abc12345');
    await user.press(screen.getByTestId('password-eye'));
    expect(pw().props.secureTextEntry).toBe(false);
  });

  test('دخول برقم + كلمة سر، ولا يُرسل برقم ناقص', async () => {
    api.getMyProfile.mockResolvedValueOnce({ id: 'u1', role: 'customer', full_name: 'عزيز' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '9991231');
    await user.type(screen.getByTestId('password'), 'abc12345');
    await user.press(screen.getByTestId('login'));
    expect(api.signInWithPhonePassword).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('phone'), '3');
    await user.press(screen.getByTestId('login'));
    await waitFor(() => expect(api.signInWithPhonePassword).toHaveBeenCalledWith('99912313', 'abc12345'));
    await waitFor(() => expect(router().replace).toHaveBeenCalledWith('/'));
  });

  test('المدير: بعد الدخول تفتح لوحة الإدارة (الصلاحية من قاعدة البيانات لا من الرقم)', async () => {
    api.signInWithPhonePassword.mockResolvedValueOnce({ id: 'owner' });
    api.getMyProfile.mockResolvedValueOnce({ id: 'owner', role: 'admin', full_name: 'المالك' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.type(screen.getByTestId('password'), 'secret123');
    await user.press(screen.getByTestId('login'));
    await waitFor(() => expect(router().replace).toHaveBeenCalledWith('/admin'));
  });

  test('نفس الرقم برقم 99912313 بدون دور admin في القاعدة لا يفتح لوحة الإدارة', async () => {
    api.getMyProfile.mockResolvedValueOnce({ id: 'u1', role: 'customer', full_name: 'س' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.type(screen.getByTestId('password'), 'secret123');
    await user.press(screen.getByTestId('login'));
    await waitFor(() => expect(router().replace).toHaveBeenCalledWith('/'));
    expect(router().replace).not.toHaveBeenCalledWith('/admin');
  });

  test('حساب جديد: يرفض كلمة سر ضعيفة وعدم التطابق، ثم ينشئ الحساب ويعرض رمز الاستعادة مرة واحدة', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('tab-signup'));
    await user.type(screen.getByTestId('name'), 'عزيز');
    await user.type(screen.getByTestId('phone'), '55512345');
    await user.type(screen.getByTestId('password'), 'abcdefgh');
    await user.type(screen.getByTestId('password2'), 'abcdefgh');
    await user.press(screen.getByTestId('signup'));
    expect(api.signUpWithPhonePassword).not.toHaveBeenCalled();
    expect(await screen.findByText('كلمة السر لازم تحتوي حروفاً وأرقاماً')).toBeTruthy();
    await user.clear(screen.getByTestId('password'));
    await user.type(screen.getByTestId('password'), 'abcd1234');
    await user.press(screen.getByTestId('signup'));
    expect(api.signUpWithPhonePassword).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('password2'));
    await user.type(screen.getByTestId('password2'), 'abcd1234');
    await user.press(screen.getByTestId('signup'));
    await waitFor(() => expect(api.signUpWithPhonePassword).toHaveBeenCalledWith('55512345', 'abcd1234', 'عزيز'));
    expect(await screen.findByTestId('recovery-code')).toBeTruthy();
    expect(screen.getByText('A1B2C3-D4E5F6-0A1B2C')).toBeTruthy();
    await user.press(screen.getByTestId('code-done'));
    expect(router().replace).not.toHaveBeenCalled(); // لازم يؤكد أنه حفظ الرمز
    await user.press(screen.getByTestId('saved-check'));
    await user.press(screen.getByTestId('code-done'));
    await waitFor(() => expect(router().replace).toHaveBeenCalledWith('/'));
  });

  test('نسيت كلمة السر: الرقم وحده لا يكفي، ويلزم رمز الاستعادة كاملاً', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('to-forgot'));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.type(screen.getByTestId('password'), 'newpass12');
    await user.type(screen.getByTestId('password2'), 'newpass12');
    await user.press(screen.getByTestId('reset'));
    expect(api.resetPasswordWithRecovery).not.toHaveBeenCalled();
    await user.paste(screen.getByTestId('recovery'), 'a1b2c3 d4e5f6 0a1b2c');
    expect(screen.getByTestId('recovery').props.value).toBe('A1B2C3-D4E5F6-0A1B2C');
    api.resetPasswordWithRecovery.mockResolvedValueOnce(false);
    await user.press(screen.getByTestId('reset'));
    expect(await screen.findByText('رقم التلفون أو رمز الاستعادة غير صحيح')).toBeTruthy();
    await user.press(screen.getByTestId('reset'));
    await waitFor(() => expect(api.resetPasswordWithRecovery).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('login')).toBeTruthy(); // يرجع لشاشة الدخول
  });

  test('الحسابات القديمة بالبريد تقدر تدخل', async () => {
    api.getMyProfile.mockResolvedValueOnce({ id: 'u-old', role: 'customer', full_name: 'قديم' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('to-email'));
    await user.type(screen.getByTestId('email'), 'old@example.com');
    await user.type(screen.getByTestId('password'), 'oldpass1');
    await user.press(screen.getByTestId('login-email'));
    await waitFor(() => expect(api.signInWithEmailPassword).toHaveBeenCalledWith('old@example.com', 'oldpass1'));
  });
});
