import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryList } from '../../components/CategoryList';
import { ErrorState, Skeleton } from '../../components/feedback';
import { IconButton, T } from '../../components/ui';
import { useCatalog } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Categories() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: space.lg, paddingBottom: space.md, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <T v="h2" style={{ flex: 1 }} color={c.primary}>{t('categories.title')}</T>
        <IconButton name="search" label={t('common.search')} tone="surface" onPress={() => router.push('/search')} />
      </View>
      {catalog.isError && !catalog.data ? <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} /> : (
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}>
          {catalog.mains.length ? <CategoryList /> : (
            <View style={{ gap: space.sm }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={64} r={radius.md} />)}</View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
