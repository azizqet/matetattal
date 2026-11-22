import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: Object.assign(() => null, { glyphMap: {} }) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/session', () => ({ useSession: () => ({ session: { user: { id: 'u1' } }, signOut: jest.fn() }) }));
jest.mock('@/lib/api', () => {
  const d = { id: 7, kind: 'customers', version: '1.0', title: 'شروط الاستخدام', body: '1. مقدمة\n• بند أول', body_sha256: 'x', published_at: '2026-11-22T00:00:00Z', is_current: true, created_at: '' };
  return {
    getMyPendingTerms: jest.fn(async () => [{ document_id: 7, kind: 'customers', version: '1.0', title: 'شروط الاستخدام' }]),
    getCurrentTerms: jest.fn(async () => [d]),
    getMyAcceptedDocIds: jest.fn(async () => []),
    acceptTerms: jest.fn(async () => undefined),
  };
});
const doc = { id: 7, kind: 'customers' as const, version: '1.0', title: 'شروط الاستخدام', body: '1. مقدمة\n• بند أول', body_sha256: 'x', published_at: '2026-11-22T00:00:00Z', is_current: true, created_at: '' };

// eslint-disable-next-line import/first
import { ConsentCheckbox, ConsentGate } from '../Consent';
// eslint-disable-next-line import/first
import { ToastProvider } from '../ui';

const wrap = (ui: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockApi = require('@/lib/api') as { acceptTerms: jest.Mock };

describe('الموافقة الإلكترونية', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('مربع الإقرار لا يظهر قبل نشر أي نسخة', async () => {
    await render(<ConsentCheckbox docs={[]} checked={false} onChange={() => {}} />);
    expect(screen.queryByTestId('consent-check')).toBeNull();
  });

  test('مربع الإقرار يذكر الوثيقة وإصدارها ويتبدل عند الضغط', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(<ConsentCheckbox docs={[doc]} checked={false} onChange={onChange} />);
    expect(screen.getByText(/شروط الاستخدام \(الإصدار 1.0\)/)).toBeTruthy();
    await user.press(screen.getByTestId('consent-check'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('بوابة المستخدم الحالي: زر الموافقة معطّل حتى الإقرار، ثم تُسجَّل الموافقة بسياق update', async () => {
    const user = userEvent.setup();
    await render(wrap(<ConsentGate />));
    await waitFor(() => expect(screen.getByTestId('gate-accept')).toBeTruthy(), { timeout: 10_000 });
    await user.press(screen.getByTestId('gate-accept'));
    expect(mockApi.acceptTerms).not.toHaveBeenCalled();
    await user.press(screen.getByTestId('gate-check'));
    await user.press(screen.getByTestId('gate-accept'));
    await waitFor(() => expect(mockApi.acceptTerms).toHaveBeenCalledTimes(1), { timeout: 10_000 });
    expect((mockApi.acceptTerms.mock.calls[0] as unknown[]).slice(0, 2)).toEqual([[7], 'update']);
  }, 30_000);
});
