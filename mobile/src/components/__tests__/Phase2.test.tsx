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
  signInWithEmail: jest.fn(async () => ({ id: 'u1' }) as unknown),
  signUpWithEmail: jest.fn(async () => ({ user: { id: 'u-new' }, exists: false, needsConfirm: true }) as unknown),
  sendPasswordReset: jest.fn(async () => {}),
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
    expect(sent).toMatchObject({ title: 'سطحة متوفرة', service_id: 'tow', area_name: 'حولي', phone: '97706792', whatsapp: null, price: null, images: [] });
    await waitFor(() => expect(screen.getByText('وصل إعلانك')).toBeTruthy());
  });

  test('رقم واتساب مختلف: يُتحقق أنه جوال من 8 أرقام ويُرسل مع الإعلان', async () => {
    mockSession.current = { user: { id: 'u1' } };
    const user = userEvent.setup();
    await render(wrap(<AddAd />));
    await user.type(screen.getByTestId('ad-title'), 'بنشر متنقل');
    await user.press(screen.getByText('سطحات'));
    await user.type(screen.getByTestId('ad-desc'), 'تبديل وإصلاح التواير في مكانك');
    await user.press(screen.getByText('حولي'));
    await user.clear(screen.getByTestId('ad-phone'));
    await user.type(screen.getByTestId('ad-phone'), '22223333'); // أرضي
    await user.press(screen.getByTestId('ad-submit'));
    expect(api.createAd).not.toHaveBeenCalled(); // الأرضي ما عليه واتساب
    await user.press(screen.getByText('رقم مختلف'));
    await user.type(screen.getByTestId('ad-whatsapp'), '5551234');
    await user.press(screen.getByTestId('ad-submit'));
    expect(api.createAd).not.toHaveBeenCalled(); // 7 أرقام فقط
    await user.type(screen.getByTestId('ad-whatsapp'), '5');
    await user.press(screen.getByTestId('ad-submit'));
    await waitFor(() => expect(api.createAd).toHaveBeenCalledTimes(1));
    expect(api.createAd.mock.calls[0][0]).toMatchObject({ phone: '22223333', whatsapp: '55512345' });
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

describe('الدخول بالإيميل وكلمة المرور (بدون رقم هاتف أو SMS)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });

  test('لا يوجد حقل رقم هاتف ولا رمز تحقق', async () => {
    await render(wrap(<Auth />));
    expect(screen.queryByTestId('phone')).toBeNull();
    expect(screen.queryByTestId('code')).toBeNull();
    expect(screen.queryByText(/\+965|رمز/)).toBeNull();
    expect(screen.getByTestId('email').props.keyboardType).toBe('email-address');
    expect(screen.getByTestId('password').props.secureTextEntry).toBe(true);
  });

  test('تسجيل الدخول: يتحقق من الإيميل ثم يدخل', async () => {
    api.getMyProfile.mockResolvedValueOnce({ id: 'u1', role: 'customer', full_name: 'عزيز' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('email'), 'غلط');
    await user.type(screen.getByTestId('password'), 'abc12345');
    await user.press(screen.getByTestId('submit'));
    expect(api.signInWithEmail).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('email'));
    await user.type(screen.getByTestId('email'), ' A@B.co ');
    await user.press(screen.getByTestId('submit'));
    await waitFor(() => expect(api.signInWithEmail).toHaveBeenCalledWith('a@b.co', 'abc12345'));
  });

  test('المدير: لوحة الإدارة تفتح تلقائياً (الصلاحية من قاعدة البيانات)', async () => {
    api.signInWithEmail.mockResolvedValueOnce({ id: 'owner' });
    api.getMyProfile.mockResolvedValueOnce({ id: 'owner', role: 'admin', full_name: 'المالك' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { router } = require('expo-router') as { router: { replace: jest.Mock } };
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('email'), 'owner@x.com');
    await user.type(screen.getByTestId('password'), 'secret123');
    await user.press(screen.getByTestId('submit'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
  });

  test('حساب جديد: كلمة مرور قوية ومتطابقة، ثم رسالة التفعيل', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('tab-register'));
    await user.type(screen.getByTestId('name'), 'شركة النجاح');
    await user.type(screen.getByTestId('email'), 'co@x.com');
    await user.type(screen.getByTestId('password'), 'abcdefgh'); // بدون أرقام
    await user.type(screen.getByTestId('confirm'), 'abcdefgh');
    await user.press(screen.getByTestId('submit'));
    expect(api.signUpWithEmail).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('password')); await user.clear(screen.getByTestId('confirm'));
    await user.type(screen.getByTestId('password'), 'abcd1234');
    await user.type(screen.getByTestId('confirm'), 'abcd1235');
    await user.press(screen.getByTestId('submit'));
    expect(api.signUpWithEmail).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('confirm'));
    await user.type(screen.getByTestId('confirm'), 'abcd1234');
    await user.press(screen.getByTestId('submit'));
    await waitFor(() => expect(api.signUpWithEmail).toHaveBeenCalledWith('co@x.com', 'abcd1234', 'شركة النجاح'));
    expect(await screen.findByTestId('auth-notice')).toBeTruthy();
  });

  test('نسيت كلمة المرور: يرسل رابط على الإيميل', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('forgot'));
    await user.type(screen.getByTestId('email'), 'a@b.co');
    await user.press(screen.getByTestId('submit'));
    await waitFor(() => expect(api.sendPasswordReset).toHaveBeenCalledWith('a@b.co'));
  });
});
