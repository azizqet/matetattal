import { useQuery } from '@tanstack/react-query';
import * as api from './api';

// بيانات مرجعية تتغير نادراً: نخزنها مؤقتاً لمدة أطول
export const useServices = () => useQuery({ queryKey: ['services'], queryFn: api.getServices, staleTime: 60 * 60_000 });
export const useAreas = () => useQuery({ queryKey: ['areas'], queryFn: api.getAreas, staleTime: 60 * 60_000 });
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: api.getSettings, staleTime: 10 * 60_000 });
export const useCompanies = () => useQuery({ queryKey: ['companies'], queryFn: api.getPublicCompanies, staleTime: 2 * 60_000 });

export function useServiceNames(): Record<string, string> {
  const { data } = useServices();
  return Object.fromEntries((data ?? []).map((s) => [s.id, s.name_ar]));
}
