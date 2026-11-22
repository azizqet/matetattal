import { describe, expect, jest, test } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/api', () => ({ getPublicAds: jest.fn(async () => []) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/session', () => ({ useSession: () => ({ area: null, coords: null, setArea: jest.fn(), locate: jest.fn(), locating: false }) }));
jest.mock('@/lib/queries', () => ({
  useServices: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useCompanies: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useServiceNames: () => ({}),
  useAreas: () => ({ data: [] }),
}));

// eslint-disable-next-line import/first
import Home from '../../app/(tabs)/index';

describe('شعار الصفحة الرئيسية', () => {
  test('ارتفاع السطر أكبر من حجم الخط (لا قص لأعلى الكلمة) مع الحفاظ على الحجم واللون', async () => {
    await render(<QueryClientProvider client={new QueryClient()}><Home /></QueryClientProvider>);
    const logo = screen.getByTestId('home-logo');
    const st = StyleSheet.flatten(logo.props.style);
    expect(st.fontSize).toBe(28);
    expect(st.color).toBe('#0757DB'); // الأزرق الأساسي على خلفية بيضاء
    expect(st.lineHeight).toBeGreaterThanOrEqual(st.fontSize * 1.4);
  });
});
