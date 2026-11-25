import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';
import { useI18n } from '../i18n';
import { PAGE_SIZE, searchAds } from '../lib/api';
import type { AdCard as AdCardT, SearchFilters } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { AdCard } from './AdCard';
import { AdCardSkeleton, BulbLoader, EmptyState, ErrorState } from './feedback';

const LAYOUT_KEY = 'fikra.feedLayout';
export type FeedLayout = 'grid' | 'list';

export function useFeedLayout(): [FeedLayout, (l: FeedLayout) => void] {
  const [layout, setLayout] = useState<FeedLayout>('grid');
  useEffect(() => { AsyncStorage.getItem(LAYOUT_KEY).then((v) => { if (v === 'list' || v === 'grid') setLayout(v); }).catch(() => {}); }, []);
  return [layout, (l) => { setLayout(l); AsyncStorage.setItem(LAYOUT_KEY, l).catch(() => {}); }];
}

export function useAdFeed(filters: SearchFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['feed', filters],
    queryFn: ({ pageParam }) => searchAds(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.length),
    enabled,
    staleTime: 60_000,
  });
}

export function AdFeed({ filters, header, layout, emptyTitle, emptyBody, emptyAction, onEmptyAction, onRefreshExtra }: {
  filters: SearchFilters; header?: React.ReactElement | null; layout: FeedLayout; emptyTitle?: string; emptyBody?: string;
  emptyAction?: string; onEmptyAction?: () => void; onRefreshExtra?: () => void;
}) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const q = useAdFeed(filters);
  const items: AdCardT[] = q.data?.pages.flat() ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const cols = layout === 'grid' ? (width >= 700 ? 3 : 2) : 1;
  const gap = space.md;
  const cardW = (width - space.lg * 2 - gap * (cols - 1)) / cols;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    onRefreshExtra?.();
    await q.refetch();
    setRefreshing(false);
  }, [q, onRefreshExtra]);

  const renderItem = useCallback(({ item }: { item: AdCardT }) => (
    <View style={{ width: cols === 1 ? undefined : cardW, paddingHorizontal: cols === 1 ? space.lg : 0, marginBottom: cols === 1 ? space.sm : space.xl }}>
      <AdCard ad={item} layout={layout} width={cols === 1 ? undefined : cardW} />
    </View>
  ), [cols, cardW, layout]);

  return (
    <FlatList
      key={`${layout}-${cols}`}
      data={items}
      numColumns={cols}
      keyExtractor={(a: AdCardT) => String(a.id)}
      renderItem={renderItem}
      columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: space.lg } : undefined}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={
        q.isLoading ? (
          <View style={{ flexDirection: cols > 1 ? 'row' : 'column', flexWrap: 'wrap', gap, paddingHorizontal: cols > 1 ? space.lg : 0 }}>
            {Array.from({ length: 4 }).map((_, i) => <View key={i} style={{ width: cols > 1 ? cardW : '100%', marginBottom: space.lg }}><AdCardSkeleton list={cols === 1} /></View>)}
          </View>
        ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : <EmptyState title={emptyTitle ?? t('search.noResults')} body={emptyBody ?? t('search.noResultsBody')} action={emptyAction} onAction={onEmptyAction} />
      }
      ListFooterComponent={q.isFetchingNextPage ? <BulbLoader size={28} /> : <View style={{ height: 120 }} />}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={9}
    />
  );
}
