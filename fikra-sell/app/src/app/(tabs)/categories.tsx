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
import { font, radius, space } from '../../theme/tokens';

export default function Categories() {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const cols = width >= 700 ? 4 : 3;
  const w = (width - space.lg * 2 - space.sm * (cols - 1)) / cols;

  const Tile = ({ item }: { item: Category }) => {
    const subs = catalog.subsOf(item.id);
    return (
      <Press testID={`category-${item.slug}`} onPress={() => router.push(`/category/${item.slug}`)} accessibilityRole="button" accessibilityLabel={pick(item.name_ar, item.name_en)}
        style={{ width: w, paddingVertical: space.lg, paddingHorizontal: space.sm, gap: space.sm, alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={item.icon} size={30} color={c.primary} />
        </View>
        <T v="small" center numberOfLines={2} style={{ width: '100%', fontFamily: font.semibold, minHeight: 38 }}>{pick(item.name_ar, item.name_en)}</T>
        <T v="caption" faint center numberOfLines={1}>
          {item.ads_count > 0 ? t('categories.adsCount', { n: item.ads_count }) : t('categories.subsCount', { n: subs.length })}
        </T>
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
          columnWrapperStyle={{ gap: space.sm, paddingHorizontal: space.lg }}
          contentContainerStyle={{ gap: space.sm, paddingBottom: 120 }}
          renderItem={({ item }) => <Tile item={item} />}
          ListEmptyComponent={catalog.isLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg }}>
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} w={w} h={150} r={radius.lg} />)}
            </View>) : undefined}
        />
      )}
    </View>
  );
}
