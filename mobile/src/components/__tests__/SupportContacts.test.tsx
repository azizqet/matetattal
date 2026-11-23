import { describe, expect, jest, test } from '@jest/globals';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SupportContacts } from '../SupportContacts';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));

describe('بطاقة التواصل', () => {
  test('زر اتصال وزر واتساب مستقلان لكل رقم بمفتاح 965', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const user = userEvent.setup();
    await render(<SupportContacts message="مرحبا" />);
    for (const n of ['97706792', '99225025']) {
      await user.press(screen.getByTestId(`call-${n}`));
      expect(open).toHaveBeenLastCalledWith(`tel:+965${n}`);
      await user.press(screen.getByTestId(`wa-${n}`));
      expect(open).toHaveBeenLastCalledWith(`https://wa.me/965${n}?text=${encodeURIComponent('مرحبا')}`);
    }
    expect(open).toHaveBeenCalledTimes(4);
    expect(screen.queryByText(/65755222/)).toBeNull();
  });
});
