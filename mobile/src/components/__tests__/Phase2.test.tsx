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
  sendPhoneCode: jest.fn(async () => {}),
  verifyPhoneCode: jest.fn(async () => ({ id: 'u1' }) as unknown),
  signInLegacyEmail: jest.fn(async () => ({ id: 'old', phone: '', phone_confirmed_at: null }) as unknown),
  sendLinkPhoneCode: jest.fn(async () => {}),
  verifyLinkPhoneCode: jest.fn(async () => ({ id: 'old' }) as unknown),
  hasConfirmedPhone: (u: { phone?: string; phone_confirmed_at?: string | null } | null) => !!u?.phone && !!u?.phone_confirmed_at,
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

describe('الدخول برقم التلفون (صفحة جديدة)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSession.current = null; });

  test('الرقم: +965 منفصل، لوحة أرقام، بدون maxLength، تنقية الكتابة واللصق والحذف', async () => {
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    expect(screen.getByText(/\+965/)).toBeTruthy();
    const ph = () => screen.getByTestId('phone');
    expect(ph().props.keyboardType).toBe('number-pad');
    expect(ph().props.maxLength).toBeUndefined();
    expect(ph().props.editable).not.toBe(false);
    await user.type(ph(), '٩٩٩١');
    expect(ph().props.value).toBe('9991');
    await user.type(ph(), '231399'); // الزائد يُتجاهل
    expect(ph().props.value).toBe('99912313');
    await user.type(ph(), '{Backspace}');
    expect(ph().props.value).toBe('9991231');
    await user.clear(ph());
    await user.paste(ph(), '+965 9991 2313');
    expect(ph().props.value).toBe('99912313');
  });

  test('متابعة ← رمز SMS ← تحقق تلقائي عند 6 أرقام ← حساب جديد يطلب الاسم', async () => {
    api.verifyPhoneCode.mockResolvedValueOnce({ id: 'u-new' });
    api.getMyProfile.mockResolvedValueOnce({ id: 'u-new', role: 'customer', full_name: '' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '1234567');
    await user.press(screen.getByTestId('send'));
    expect(api.sendPhoneCode).not.toHaveBeenCalled();
    await user.clear(screen.getByTestId('phone'));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.press(screen.getByTestId('send'));
    await waitFor(() => expect(api.sendPhoneCode).toHaveBeenCalledWith('99912313'));
    const code = await screen.findByTestId('code');
    expect(code.props.textContentType).toBe('oneTimeCode');
    expect(code.props.autoComplete).toBe('sms-otp');
    expect(code.props.maxLength).toBeUndefined();
    expect(screen.getByText(/تقدر تطلب رمز جديد بعد/)).toBeTruthy();
    await user.type(screen.getByTestId('code'), '12345');
    expect(api.verifyPhoneCode).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('code'), '6');
    await waitFor(() => expect(api.verifyPhoneCode).toHaveBeenCalledWith('99912313', '123456'));
    expect(api.verifyPhoneCode).toHaveBeenCalledTimes(1);
    const nameField = await screen.findByTestId('name');
    await user.type(nameField, 'عزيز');
    await user.press(screen.getByTestId('save-name'));
    await waitFor(() => expect(api.updateMyProfile).toHaveBeenCalledWith('u-new', { full_name: 'عزيز' }));
  });

  test('لصق الرمز من الرسالة يُنقّى ويُتحقق منه', async () => {
    api.verifyPhoneCode.mockResolvedValueOnce({ id: 'u1' });
    api.getMyProfile.mockResolvedValueOnce({ id: 'u1', role: 'customer', full_name: 'عزيز' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.press(screen.getByTestId('send'));
    await screen.findByTestId('code');
    await user.paste(screen.getByTestId('code'), 'رمزك: 654 321');
    await waitFor(() => expect(api.verifyPhoneCode).toHaveBeenCalledWith('99912313', '654321'));
  });

  test('المدير: بعد التحقق تفتح لوحة الإدارة تلقائياً (الصلاحية من قاعدة البيانات)', async () => {
    api.verifyPhoneCode.mockResolvedValueOnce({ id: 'owner' });
    api.getMyProfile.mockResolvedValueOnce({ id: 'owner', role: 'admin', full_name: 'المالك' });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { router } = require('expo-router') as { router: { replace: jest.Mock } };
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.type(screen.getByTestId('phone'), '99912313');
    await user.press(screen.getByTestId('send'));
    await screen.findByTestId('code');
    await user.type(screen.getByTestId('code'), '111222');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
  });

  test('حساب قديم بالإيميل: دخول مرة واحدة ثم ربط الرقم برمز SMS (نفس الحساب)', async () => {
    api.getMyProfile.mockResolvedValueOnce({ id: 'old', role: 'customer', full_name: 'عميل قديم' });
    const user = userEvent.setup();
    await render(wrap(<Auth />));
    await user.press(screen.getByTestId('legacy-link'));
    await user.type(screen.getByTestId('legacy-email'), 'old@x.com');
    await user.type(screen.getByTestId('legacy-password'), 'pass1234');
    await user.press(screen.getByTestId('legacy-login'));
    await waitFor(() => expect(api.signInLegacyEmail).toHaveBeenCalledWith('old@x.com', 'pass1234'));
    await user.type(await screen.findByTestId('phone'), '55512345');
    await user.press(screen.getByTestId('send'));
    await waitFor(() => expect(api.sendLinkPhoneCode).toHaveBeenCalledWith('55512345'));
    expect(api.sendPhoneCode).not.toHaveBeenCalled(); // لا حساب جديد
    await user.type(await screen.findByTestId('code'), '246810');
    await waitFor(() => expect(api.verifyLinkPhoneCode).toHaveBeenCalledWith('55512345', '246810'));
    expect(api.verifyPhoneCode).not.toHaveBeenCalled();
  });
});
