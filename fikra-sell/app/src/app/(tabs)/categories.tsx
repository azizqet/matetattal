import { router } from 'expo-router';
import React from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorState, Skeleton } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { IconButton, Press, T } from '../../components/ui';
import { useCatalog } from '../../hooks/data';
import { useI18n } from '../../i18n';
import type { Category } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Categories() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const cols = width >= 700 ? 3 : 2;
  const w = (width - space.lg * 2 - space.md * (cols - 1)) / cols;

  const Tile = ({ item }: { item: Category }) => {
    const subs = catalog.subsOf(item.id);
    return (
      <Press testID={`category-${item.slug}`} onPress={() => router.push(`/category/${item.slug}`)} accessibilityRole="button" accessibilityLabel={pick(item.name_ar, item.name_en)}
        style={{ width: w, padding: space.lg, gap: space.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.line,
          borderTopStartRadius: radius.crown, borderTopEndRadius: radius.lg, borderBottomEndRadius: radius.lg, borderBottomStartRadius: radius.socket }}>
        <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={item.icon} size={28} color={c.primary} />
        </View>
        <View style={{ gap: 2 }}>
          <T v="bodyStrong" numberOfLines={1}>{pick(item.name_ar, item.name_en)}</T>
          <T v="caption" faint numberOfLines={1}>
            {item.ads_count > 0 ? t('categories.adsCount', { n: item.ads_count }) : subs.slice(0, 2).map((s) => pick(s.name_ar, s.name_en)).join('، ')}
          </T>
        </View>
      </Press>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: 'row', alignItems: 'center' }}>
        <T v="h1" style={{ flex: 1 }}>{t('categories.title')}</T>
        <IconButton name="search" label={t('common.search')} tone="surface" onPress={() => router.push('/search')} />
      </View>
      {catalog.isError && !catalog.data ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /> : (
        <FlatList
          key={cols}
          data={catalog.mains}
          numColumns={cols}
          keyExtractor={(x) => String(x.id)}
          columnWrapperStyle={{ gap: space.md, paddingHorizontal: space.lg }}
          contentContainerStyle={{ gap: space.md, paddingBottom: 120 }}
          renderItem={({ item }) => <Tile item={item} />}
          ListEmptyComponent={catalog.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg }}>
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} w={w} h={132} r={radius.lg} />)}
            </View>) : undefined}
        />
      )}
    </View>
  );
}
