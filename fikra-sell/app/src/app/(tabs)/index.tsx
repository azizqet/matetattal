import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdCard } from '../../components/AdCard';
import { AdFeed, useFeedLayout } from '../../components/AdFeed';
import { BannerStrip } from '../../components/Blocks';
import { CategoryList } from '../../components/CategoryList';
import { FikraLogo } from '../../components/Brand';
import { AdCardSkeleton, Skeleton } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { PlacePill, usePlace } from '../../components/PlacePicker';
import { IconButton, Section, T } from '../../components/ui';
import { useCatalog, useCounters } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { searchAds } from '../../lib/api';
import type { AdCard as AdCardT, SearchFilters } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

function FeaturedRail({ filters, onSeeAll }: { filters: SearchFilters; onSeeAll: () => void }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['rail', filters], queryFn: () => searchAds(filters, 0, 10), staleTime: 2 * 60_000 });
  if (q.isSuccess && !q.data.length) return null;
  return (
    <Section title={t('home.featured')} action={t('common.seeAll')} onAction={onSeeAll}>
      <FlatList
        testID="rail-featured"
        horizontal
        data={q.data ?? []}
        keyExtractor={(a: AdCardT) => String(a.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
        renderItem={({ item }) => <AdCard ad={item} layout="rail" width={220} />}
        ListEmptyComponent={q.isLoading ? <View style={{ flexDirection: 'row', gap: space.md }}>{[0, 1].map((i) => <View key={i} style={{ width: 220 }}><AdCardSkeleton /></View>)}</View> : undefined}
      />
    </Section>
  );
}

export default function Home() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const counters = useCounters();
  const [layout, setLayout] = useFeedLayout();
  const [place, setPlace] = usePlace();
  const featuredOn = catalog.setting('featured_section_enabled', true);
  const placeFilters = useMemo<SearchFilters>(() => ({ governorate_id: place.governorate_id, area_id: place.area_id }), [place.governorate_id, place.area_id]);
  const feedFilters = useMemo<SearchFilters>(() => ({ ...placeFilters, sort: 'newest' }), [placeFilters]);
  const featuredFilters = useMemo<SearchFilters>(() => ({ ...placeFilters, featured_only: true }), [placeFilters]);

  const refreshExtras = useCallback(() => { catalog.refetch(); counters.refetch(); }, [catalog, counters]);
  const placeParams = { ...(place.governorate_id ? { gov: String(place.governorate_id) } : {}), ...(place.area_id ? { area: String(place.area_id) } : {}) };

  const header = (
    <View style={{ gap: space.xl, paddingBottom: space.md }}>
      {/* Logo + actions, search, place */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}><FikraLogo height={52} /></View>
          <IconButton name="heart" label={t('account.favorites')} onPress={() => router.push('/favorites')} testID="home-favorites" />
          <IconButton name="bell" label={t('notifications.title')} badge={counters.data?.unread_notifications} onPress={() => router.push('/notifications')} testID="home-notifications" />
        </View>
        <Pressable onPress={() => router.push({ pathname: '/search', params: placeParams })} accessibilityRole="search" accessibilityLabel={t('home.searchPlaceholder')} testID="home-search"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 50, borderRadius: radius.md, backgroundColor: c.surface, paddingStart: space.lg, paddingEnd: 5, borderWidth: 1, borderColor: c.line }}>
          <Icon name="search" size={20} color={c.textMuted} />
          <T muted style={{ flex: 1 }} numberOfLines={1}>{t('home.searchPlaceholder')}</T>
          <View style={{ height: 40, paddingHorizontal: 16, borderRadius: radius.sm, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <T v="small" color={c.onPrimary} style={{ fontWeight: '600' }}>{t('common.search')}</T>
          </View>
        </Pressable>
        <PlacePill value={place} onChange={setPlace} />
      </View>

      {/* Category grid */}
      <Section title={t('home.categories')} action={t('common.seeAll')} onAction={() => router.push('/categories')}>
        <View style={{ paddingHorizontal: space.lg }}>
          {catalog.mains.length ? <CategoryList />
            : <View style={{ gap: space.sm }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={64} r={radius.md} />)}</View>}
        </View>
      </Section>

      <BannerStrip placement="home_top" />

      {featuredOn && <FeaturedRail filters={featuredFilters} onSeeAll={() => router.push({ pathname: '/search', params: { featured: '1', ...placeParams } })} />}

      <BannerStrip placement="home_middle" />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md }}>
        <T v="h3" style={{ flex: 1 }}>{t('home.latest')}</T>
        <IconButton name={layout === 'grid' ? 'list' : 'grid'} label={layout === 'grid' ? t('home.list') : t('home.grid')} tone="surface" size={19}
          onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')} testID="toggle-layout" />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AdFeed filters={feedFilters} header={header} layout={layout} onRefreshExtra={refreshExtras}
        emptyTitle={t('myAds.empty')} emptyBody={t('myAds.emptyBody')} emptyAction={t('tabs.post')} onEmptyAction={() => router.push('/post/new')} />
    </View>
  );
}
