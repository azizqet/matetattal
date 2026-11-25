import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AdFeed, useFeedLayout } from '../../components/AdFeed';
import { BannerStrip } from '../../components/Blocks';
import { EmptyState } from '../../components/feedback';
import { FilterSheet } from '../../components/FilterSheet';
import { ResultsToolbar } from '../../components/ResultsToolbar';
import { Chip, Header, IconButton } from '../../components/ui';
import { useCatalog } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { noteCategoryView } from '../../lib/recent';
import type { SearchFilters } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const catalog = useCatalog();
  const [layout, setLayout] = useFeedLayout();
  const cat = catalog.cats.find((x) => x.slug === slug);
  const main = cat ? catalog.mainOf(cat.id) : undefined;
  const subs = main ? catalog.subsOf(main.id) : [];
  const [picked, setFilters] = useState<SearchFilters | null>(null);
  const filters: SearchFilters = picked ?? { category_id: cat?.id, sort: 'newest' };
  const [open, setOpen] = useState(false);

  useEffect(() => { if (main) noteCategoryView(main.id); }, [main]);
  const base = { category_id: cat?.id };

  if (!cat && !catalog.isLoading) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><EmptyState title={t('errors.not_found')} /></View>;
  }
  const title = main ? pick(main.name_ar, main.name_en) : '';

  const header = (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      {subs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md }}>
          <Chip label={t('categories.allIn', { name: title })} active={filters.category_id === main?.id}
            onPress={() => setFilters({ ...filters, category_id: main!.id, attrs: {} })} />
          {subs.map((s) => (
            <Chip key={s.id} testID={`sub-${s.slug}`} label={pick(s.name_ar, s.name_en)} active={filters.category_id === s.id}
              onPress={() => setFilters({ ...filters, category_id: s.id })} />
          ))}
        </ScrollView>
      )}
      <ResultsToolbar filters={filters} base={base} onOpenFilters={() => setOpen(true)} layout={layout} setLayout={setLayout} defaultName={title} />
      {main && <BannerStrip placement="category_top" categoryId={main.id} />}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={title} right={<IconButton name="search" label={t('common.search')} onPress={() => router.push({ pathname: '/search', params: { category: String(main?.id ?? '') } })} />} />
      {filters.category_id && <AdFeed filters={filters} header={header} layout={layout} />}
      <FilterSheet visible={open} onClose={() => setOpen(false)} value={filters} onApply={setFilters} />
    </View>
  );
}
