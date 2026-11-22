import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: null }) }));
jest.mock('@/lib/queries', () => ({
  useServices: () => ({ data: [{ id: 'tow', name_ar: 'سطحات' }] }),
  useAreas: () => ({ data: [{ id: 1, name_ar: 'العاصمة' }] }),
}));
jest.mock('@/lib/api', () => ({
  // طلب بطيء قليلاً حتى نختبر الضغط المتكرر أثناء الإرسال
  sendJoinRequest: jest.fn(() => new Promise((r) => setTimeout(r, 50))),
}));

// eslint-disable-next-line import/first
import Join from '../../app/join';
// eslint-disable-next-line import/first
import { phoneInput } from '../ui';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('@/lib/api') as { sendJoinRequest: jest.Mock };

describe('تنظيف إدخال الهاتف', () => {
  test.each([
    ['97706792', '97706792'], ['٩٧٧٠٦٧٩٢', '97706792'], ['۹۷۷۰۶۷۹۲', '97706792'],
    ['9770 6792', '97706792'], ['+965-9770', '9659770'], ['977067921234', '97706792'], ['abc', ''],
  ])('%s → %s', (inp, out) => expect(phoneInput(inp)).toBe(out));
});

describe('نموذج الانضمام', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('خانة الهاتف: أرقام سوداء، اتجاه LTR، لوحة أرقام، 8 أرقام', async () => {
    await render(<Join />);
    const f = screen.getByTestId('join-phone');
    const st = StyleSheet.flatten(f.props.style);
    expect(st.color).toBe('#000000');
    expect(st.writingDirection).toBe('ltr');
    expect(st.textAlign).toBe('left');
    expect(st.backgroundColor).toBe('#FFFFFF');
    expect(f.props.keyboardType).toBe('number-pad');
    expect(f.props.maxLength).toBe(8);
  });

  test('الأرقام تظهر أثناء الكتابة ولا تُمسح (حتى الأرقام العربية)', async () => {
    const user = userEvent.setup();
    await render(<Join />);
    await user.type(screen.getByTestId('join-phone'), '٩٧٧٠');
    expect(screen.getByTestId('join-phone').props.value).toBe('9770');
    await user.type(screen.getByTestId('join-phone'), '6792');
    expect(screen.getByTestId('join-phone').props.value).toBe('97706792');
  });

  test('يرفض رقماً غير كويتي ولا يرسل', async () => {
    const user = userEvent.setup();
    await render(<Join />);
    await user.type(screen.getByTestId('join-name'), 'شركة تجربة');
    await user.type(screen.getByTestId('join-phone'), '1234567');
    await user.press(screen.getByTestId('join-submit'));
    expect(api.sendJoinRequest).not.toHaveBeenCalled();
    expect(screen.getByText('رقم كويتي من 8 أرقام يبدأ بـ 2 أو 5 أو 6 أو 9')).toBeTruthy();
  });

  test('الضغط المتكرر يرسل طلباً واحداً فقط', async () => {
    const user = userEvent.setup();
    await render(<Join />);
    await user.type(screen.getByTestId('join-name'), 'شركة تجربة');
    await user.type(screen.getByTestId('join-phone'), '97706792');
    const btn = screen.getByTestId('join-submit');
    // ثلاث ضغطات متتالية قبل أن يُعاد رسم الشاشة (كما يحدث مع الضغط السريع)
    await act(async () => { fireEvent.press(btn); fireEvent.press(btn); fireEvent.press(btn); });
    await waitFor(() => expect(api.sendJoinRequest).toHaveBeenCalledTimes(1));
    expect(api.sendJoinRequest).toHaveBeenCalledWith({ company_name: 'شركة تجربة', service_id: 'tow', phone: '97706792', area_name: 'العاصمة' });
  });
});
