import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { AdCard } from '../components/AdCard';
import { AdCardSkeleton, EmptyState, ErrorState } from '../components/feedback';
import { Header } from '../components/ui';
import { useFavorites } from '../hooks/data';
import { useI18n } from '../i18n';
import { getAdsByIds } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AdCard as Card } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

export default function Favorites() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { userId } = useAuth();
  const { ids } = useFavorites();
  const idList = [...ids];
  const q = useQuery({
    queryKey: ['favorite-ads', idList.join(',')],
    enabled: !!userId,
    queryFn: async () => {
      const ads = await getAdsByIds(idList);
      const order = new Map(idList.map((id, i) => [id, i]));
      return ads.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map<Card>((a) => ({
        id: a.id, title: a.title, price: a.price, price_type: a.price_type, condition: a.condition, cover_path: a.cover_path, images_count: a.images_count,
        category_id: a.category_id, main_category_id: a.main_category_id, governorate_id: a.governorate_id, area_id: a.area_id, user_id: a.user_id,
        status: a.status, created_at: a.created_at, bumped_at: a.bumped_at, is_featured: !!a.featured_until && new Date(a.featured_until) > new Date(),
        is_pinned: false, distance_km: null, favorites_count: a.favorites_count,
      }));
    },
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.favorites')} />
      {!userId ? <EmptyState icon="heart" title={t('auth.guestPrompt', { action: t('auth.actionFavorite') })} action={t('auth.signIn')} onAction={() => router.push({ pathname: '/auth/sign-in', params: { reason: 'favorite' } })} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.primary} />}
          renderItem={({ item }) => <AdCard ad={item} layout="list" />}
          ListEmptyComponent={q.isLoading ? <View style={{ gap: space.md }}><AdCardSkeleton list /><AdCardSkeleton list /></View>
            : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="heart" title={t('favorites.empty')} body={t('favorites.emptyBody')} />}
        />
      )}
    </View>
  );
}
