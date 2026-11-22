import { describe, expect, jest, test } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SupportContacts } from '../SupportContacts';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));

describe('بطاقة التواصل', () => {
  test('زر اتصال مستقل لكل رقم، ولا واتساب قبل التأكيد', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const user = userEvent.setup();
    await render(<SupportContacts />);
    expect(screen.getByTestId('call-97706792')).toBeTruthy();
    expect(screen.getByTestId('call-99225025')).toBeTruthy();
    expect(screen.queryByTestId('wa-97706792')).toBeNull();
    expect(screen.queryByTestId('wa-99225025')).toBeNull();
    await user.press(screen.getByTestId('call-99225025'));
    expect(open).toHaveBeenCalledWith('tel:+96599225025');
    await user.press(screen.getByTestId('call-97706792'));
    expect(open).toHaveBeenCalledWith('tel:+96597706792');
    expect(screen.queryByText(/65755222/)).toBeNull();
  });
});
