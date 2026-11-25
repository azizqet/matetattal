import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AdFeed, useFeedLayout } from '../../components/AdFeed';
import { BannerStrip } from '../../components/Blocks';
import { EmptyState } from '../../components/feedback';
import { FilterSheet } from '../../components/FilterSheet';
import { Icon } from '../../components/Icon';
import { PlacePill, usePlace } from '../../components/PlacePicker';
import { ResultsToolbar } from '../../components/ResultsToolbar';
import { Header, IconButton, Press, T } from '../../components/ui';
import { useCatalog } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { noteCategoryView } from '../../lib/recent';
import type { SearchFilters } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const catalog = useCatalog();
  const [layout, setLayout] = useFeedLayout();
  const cat = catalog.cats.find((x) => x.slug === slug);
  const main = cat ? catalog.mainOf(cat.id) : undefined;
  const subs = main ? catalog.subsOf(main.id) : [];
  const [place, setPlace] = usePlace();
  const [picked, setFilters] = useState<SearchFilters | null>(null);
  const filters: SearchFilters = picked ?? { category_id: cat?.id, sort: 'newest', governorate_id: place.governorate_id, area_id: place.area_id };
  const [open, setOpen] = useState(false);

  useEffect(() => { if (main) noteCategoryView(main.id); }, [main]);
  const base = { category_id: cat?.id };

  if (!cat && !catalog.isLoading) {
    return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><EmptyState title={t('errors.not_found')} /></View>;
  }
  const title = main ? pick(main.name_ar, main.name_en) : '';

  const header = (
    <View style={{ gap: space.sm, paddingBottom: space.sm }}>
      {main && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={main.icon} size={24} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="h3" numberOfLines={1}>{title}</T>
            {main.ads_count > 0 && <T v="caption" faint>{t('categories.adsCount', { n: main.ads_count })}</T>}
          </View>
          <PlacePill value={{ governorate_id: filters.governorate_id, area_id: filters.area_id }}
            onChange={(p) => { setPlace(p); setFilters({ ...filters, governorate_id: p.governorate_id, area_id: p.area_id }); }} testID="category-place" />
        </View>
      )}
      {subs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>
          {[{ id: main!.id, slug: 'all', label: t('categories.allIn', { name: title }), n: main!.ads_count, all: true }, ...subs.map((s) => ({ id: s.id, slug: s.slug, label: pick(s.name_ar, s.name_en), n: s.ads_count, all: false }))].map((s) => {
            const on = filters.category_id === s.id;
            return (
              <Press key={s.id} testID={`sub-${s.slug}`} accessibilityRole="button" accessibilityState={{ selected: on }}
                onPress={() => setFilters({ ...filters, category_id: s.id, attrs: s.all ? {} : filters.attrs })}
                style={{ minWidth: 92, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? c.primary : c.line, backgroundColor: on ? c.primarySoft : c.card, gap: 2 }}>
                <T v="small" numberOfLines={1} color={on ? c.primary : c.text} style={{ fontFamily: font.semibold }}>{s.label}</T>
                {s.n > 0 && <T v="caption" faint>{t('categories.adsCount', { n: s.n })}</T>}
              </Press>
            );
          })}
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
