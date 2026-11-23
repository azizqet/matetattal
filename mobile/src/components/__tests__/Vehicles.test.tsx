import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
jest.mock('@/lib/api', () => ({}));

// eslint-disable-next-line import/first
import { AvailableVehiclesBadge } from '../Vehicles';

describe('شارة السطحات المتاحة', () => {
  test('لا تظهر لشركة بلا سطحات', async () => {
    await render(<AvailableVehiclesBadge vehicles={[]} />);
    expect(screen.queryByText(/متاح/)).toBeNull();
  });
  test('تعدّ المتاح فقط وتتجاهل الموقوفة', async () => {
    await render(<AvailableVehiclesBadge vehicles={[{ status: 'available', is_active: true }, { status: 'available', is_active: true }, { status: 'busy', is_active: true }, { status: 'available', is_active: false }]} />);
    expect(screen.getByText('2 متاح الآن')).toBeTruthy();
  });
  test('عند عدم وجود متاح', async () => {
    await render(<AvailableVehiclesBadge vehicles={[{ status: 'busy', is_active: true }]} />);
    expect(screen.getByText('لا توجد سطحة متاحة الآن')).toBeTruthy();
  });
});
