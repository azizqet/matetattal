import { describe, expect, jest, test } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn(), canGoBack: () => true } }));
// رقم محفوظ بالصيغة الدولية للتأكد أنه يُعرض 8 أرقام محلية
jest.mock('@/lib/session', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, profile: { full_name: 'تجربة', phone: '96597706792' }, refreshProfile: jest.fn() }),
}));
jest.mock('@/lib/api', () => ({ updateMyProfile: jest.fn(async () => undefined) }));

// eslint-disable-next-line import/first
import Profile from '../../app/profile';
// eslint-disable-next-line import/first
import { phoneInput } from '../ui';

describe('تنظيف إدخال الهاتف', () => {
  test.each([
    ['97706792', '97706792'], ['٩٧٧٠٦٧٩٢', '97706792'], ['۹۷۷۰۶۷۹۲', '97706792'],
    ['9770 6792', '97706792'], ['977067921234', '97706792'], ['abc', ''],
  ])('%s → %s', (inp, out) => expect(phoneInput(inp)).toBe(out));
});

describe('خانة الجوال في «بياناتي»', () => {
  test('تستخدم خانة الهاتف الجديدة وتعرض الرقم المحفوظ 8 أرقام', async () => {
    await render(<Profile />);
    const f = screen.getByTestId('profile-phone');
    const st = StyleSheet.flatten(f.props.style);
    expect(st.writingDirection).toBeUndefined(); // لا writingDirection على خانات الإدخال (سبب مشترك لمشاكل الكتابة)
    expect(st.textAlign).toBe('left');
    expect(st.color).toBe('#000000');
    expect(f.props.keyboardType).toBe('number-pad');
    expect(f.props.value).toBe('97706792');
  });
  test('الكتابة بالأرقام العربية تظهر ولا تُمسح', async () => {
    const user = userEvent.setup();
    await render(<Profile />);
    const f = screen.getByTestId('profile-phone');
    await user.clear(f);
    await user.type(f, '٥٥٥١٢٣٤٥');
    expect(screen.getByTestId('profile-phone').props.value).toBe('55512345');
  });
});
