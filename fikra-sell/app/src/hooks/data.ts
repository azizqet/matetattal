import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useToast } from '../components/feedback';
import { useI18n } from '../i18n';
import * as api from '../lib/api';
import { useAuth, useRequireAuth } from '../lib/auth';
import type { Category, CategoryField } from '../lib/types';

export function useCatalog() {
  const q = useQuery({ queryKey: ['catalog'], queryFn: api.fetchCatalog, staleTime: 60 * 60_000, gcTime: 24 * 60 * 60_000 });
  const { pick } = useI18n();
  const helpers = useMemo(() => {
    const cats = [...(q.data?.categories ?? [])].sort((a, b) => a.sort - b.sort || a.id - b.id);
    const byId = new Map(cats.map((c) => [c.id, c]));
    const mains = cats.filter((c) => c.parent_id === null);
    const subsOf = (id: number) => cats.filter((c) => c.parent_id === id);
    const fieldsFor = (catId: number): CategoryField[] => {
      const cat = byId.get(catId);
      const mainId = cat?.parent_id ?? catId;
      return (q.data?.fields ?? []).filter((f) => f.category_id === catId || f.category_id === mainId).sort((a, b) => a.sort - b.sort);
    };
    const catName = (id?: number | null) => { const c = id ? byId.get(id) : undefined; return c ? pick(c.name_ar, c.name_en) : ''; };
    const govName = (id?: number | null) => { const g = q.data?.governorates.find((x) => x.id === id); return g ? pick(g.name_ar, g.name_en) : ''; };
    const areaName = (id?: number | null) => { const a = q.data?.areas.find((x) => x.id === id); return a ? pick(a.name_ar, a.name_en) : ''; };
    const placeName = (gov?: number | null, area?: number | null) => [areaName(area), govName(gov)].filter(Boolean).join('، ');
    const setting = <T,>(key: string, fallback: T): T => ((q.data?.settings?.[key] as T | undefined) ?? fallback);
    const mainOf = (id: number): Category | undefined => { const c = byId.get(id); return c?.parent_id ? byId.get(c.parent_id) : c; };
    return { cats, byId, mains, subsOf, fieldsFor, catName, govName, areaName, placeName, setting, mainOf };
  }, [q.data, pick]);
  return { ...q, ...helpers };
}

export function useFavorites() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const guard = useRequireAuth();
  const q = useQuery({ queryKey: ['favorites', userId], queryFn: api.favoriteIds, enabled: !!userId, staleTime: 5 * 60_000 });
  const ids = useMemo(() => new Set(q.data ?? []), [q.data]);
  const m = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => api.setFavorite(id, on),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: ['favorites', userId] });
      const prev = qc.getQueryData<number[]>(['favorites', userId]) ?? [];
      qc.setQueryData(['favorites', userId], on ? [id, ...prev.filter((x) => x !== id)] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(['favorites', userId], ctx?.prev); toast.error(e); },
    onSuccess: (_d, { on }) => toast.success(on ? 'favorites.added' : 'favorites.removed'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorite-ads'] }),
  });
  const toggle = useCallback((id: number) => guard('favorite', () => m.mutate({ id, on: !ids.has(id) })), [guard, ids, m]);
  return { ids, toggle, isFav: (id: number) => ids.has(id) };
}

export function useCounters() {
  const { userId } = useAuth();
  return useQuery({ queryKey: ['counters', userId], queryFn: api.counters, enabled: !!userId, refetchInterval: 60_000, staleTime: 15_000 });
}
