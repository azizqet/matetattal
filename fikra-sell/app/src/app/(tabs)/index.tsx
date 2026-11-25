import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdCard } from '../../components/AdCard';
import { AdFeed, useFeedLayout } from '../../components/AdFeed';
import { BannerStrip, CategoryTile } from '../../components/Blocks';
import { Lockup } from '../../components/Brand';
import { AdCardSkeleton } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { Button, IconButton, Section, Segmented, T } from '../../components/ui';
import { useCatalog, useCounters } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { searchAds } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { currentCoords, locationGranted, type Coords } from '../../lib/location';
import { topViewedCategory } from '../../lib/recent';
import type { AdCard as AdCardT, SearchFilters } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

function Rail({ title, filters, onSeeAll, testID }: { title: string; filters: SearchFilters; onSeeAll?: () => void; testID?: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['rail', filters], queryFn: () => searchAds(filters, 0, 10), staleTime: 2 * 60_000 });
  if (q.isSuccess && !q.data.length) return null;
  return (
    <Section title={title} action={onSeeAll ? t('common.seeAll') : undefined} onAction={onSeeAll}>
      <FlatList
        testID={testID}
        horizontal
        data={q.data ?? []}
        keyExtractor={(a: AdCardT) => String(a.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
        renderItem={({ item }) => <AdCard ad={item} layout="rail" width={168} />}
        ListEmptyComponent={q.isLoading ? <View style={{ flexDirection: 'row', gap: space.md }}>{[0, 1].map((i) => <View key={i} style={{ width: 168 }}><AdCardSkeleton /></View>)}</View> : undefined}
      />
    </Section>
  );
}

function NearbyCard({ onGranted }: { onGranted: (c: Coords) => void }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ marginHorizontal: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.primarySoft, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="location" size={22} color={c.primary} spark={false} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyStrong">{t('home.nearbyEnable')}</T>
        <T v="small" muted>{t('home.nearbyHint')}</T>
      </View>
      <Button small title={t('home.nearbyAllow')} loading={busy} testID="allow-location"
        onPress={async () => { setBusy(true); const co = await currentCoords(true); setBusy(false); if (co) onGranted(co); }} />
    </View>
  );
}

export default function Home() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const catalog = useCatalog();
  const counters = useCounters();
  const [layout, setLayout] = useFeedLayout();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locAsked, setLocAsked] = useState<boolean | null>(null);
  const [suggestCat, setSuggestCat] = useState<number | null>(null);
  const featuredOn = catalog.setting('featured_section_enabled', true);

  useEffect(() => {
    locationGranted().then(async (g) => { setLocAsked(g); if (g) setCoords(await currentCoords(false)); });
    topViewedCategory().then(setSuggestCat);
  }, []);

  const refreshExtras = useCallback(() => { catalog.refetch(); counters.refetch(); topViewedCategory().then(setSuggestCat); }, [catalog, counters]);

  const header = (
    <View style={{ gap: space.xxl, paddingBottom: space.lg }}>
      {/* Top bar */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}><Lockup height={30} /></View>
          <IconButton name="heart" label={t('account.favorites')} onPress={() => router.push('/favorites')} testID="home-favorites" />
          <IconButton name="bell" label={t('notifications.title')} badge={counters.data?.unread_notifications} onPress={() => router.push('/notifications')} testID="home-notifications" />
        </View>
        <T v="h2">{profile ? t('home.greeting', { name: profile.full_name.split(' ')[0] }) : t('home.greetingGuest')}</T>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel={t('home.searchPlaceholder')} testID="home-search"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, height: 54, borderRadius: radius.lg, backgroundColor: c.surface, paddingHorizontal: space.lg, borderWidth: 1, borderColor: c.line }}>
          <Icon name="search" size={21} color={c.primary} spark={false} />
          <T muted style={{ flex: 1 }}>{t('home.searchPlaceholder')}</T>
          <View style={{ width: 1.5, height: 22, backgroundColor: c.line }} />
          <Icon name="filter" size={20} color={c.textMuted} spark={false} />
        </Pressable>
      </View>

      {/* Categories */}
      <Section title={t('home.categories')} action={t('common.seeAll')} onAction={() => router.push('/categories')}>
        <FlatList
          horizontal
          data={catalog.mains}
          keyExtractor={(x) => String(x.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
          renderItem={({ item }) => <CategoryTile cat={item} />}
        />
      </Section>

      <BannerStrip placement="home_top" />

      {featuredOn && <Rail title={t('home.featured')} filters={{ featured_only: true }} onSeeAll={() => router.push({ pathname: '/search', params: { featured: '1' } })} testID="rail-featured" />}

      {coords ? (
        <Rail title={t('home.nearby')} filters={{ sort: 'nearest', lat: coords.lat, lng: coords.lng, radius_km: 12 }}
          onSeeAll={() => router.push({ pathname: '/search', params: { sort: 'nearest', lat: String(coords.lat), lng: String(coords.lng) } })} />
      ) : locAsked === false ? <NearbyCard onGranted={setCoords} /> : null}

      {suggestCat && <Rail title={t('home.suggested')} filters={{ category_id: suggestCat }} onSeeAll={() => { const cat = catalog.byId.get(suggestCat); if (cat) router.push(`/category/${cat.slug}`); }} />}

      <BannerStrip placement="home_middle" />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md }}>
        <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: c.accent }} />
        <T v="h3" style={{ flex: 1, fontFamily: font.semibold }}>{t('home.latest')}</T>
        <View style={{ width: 150 }}>
          <Segmented value={layout} onChange={setLayout} options={[{ value: 'grid', label: t('home.grid') }, { value: 'list', label: t('home.list') }]} />
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AdFeed filters={{ sort: 'newest' }} header={header} layout={layout} onRefreshExtra={refreshExtras}
        emptyTitle={t('myAds.empty')} emptyBody={t('myAds.emptyBody')} emptyAction={t('tabs.post')} onEmptyAction={() => router.push('/post/new')} />
    </View>
  );
}
