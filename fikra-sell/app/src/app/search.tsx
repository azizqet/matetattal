import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, type TextInputInstance, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdFeed, useFeedLayout } from '../components/AdFeed';
import { BannerStrip } from '../components/Blocks';
import { FilterSheet } from '../components/FilterSheet';
import { Icon } from '../components/Icon';
import { ResultsToolbar } from '../components/ResultsToolbar';
import { Chip, IconButton, Section, T, webNoOutline } from '../components/ui';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import { logSearch, suggestions } from '../lib/api';
import { addRecentSearch, clearRecentSearches, recentSearches } from '../lib/recent';
import type { SearchFilters } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';

function useDebounced<T>(v: T, ms = 220): T {
  const [d, setD] = useState(v);
  useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
  return d;
}

export default function Search() {
  const params = useLocalSearchParams<{ q?: string; category?: string; featured?: string; sort?: string; lat?: string; lng?: string; filters?: string }>();
  const { c } = useTheme();
  const { t, isRTL, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const [layout, setLayout] = useFeedLayout();
  const inputRef = useRef<TextInputInstance>(null);

  const initial: SearchFilters = (() => {
    if (params.filters) { try { return JSON.parse(params.filters) as SearchFilters; } catch { /* ignore */ } }
    const f: SearchFilters = {};
    if (params.q) f.q = params.q;
    if (params.category) f.category_id = Number(params.category);
    if (params.featured) f.featured_only = true;
    if (params.sort === 'nearest' && params.lat && params.lng) { f.sort = 'nearest'; f.lat = Number(params.lat); f.lng = Number(params.lng); f.radius_km = 25; }
    return f;
  })();
  const hasPreset = !!(params.q || params.featured || params.sort || params.filters);
  const [text, setText] = useState(initial.q ?? '');
  const [filters, setFilters] = useState<SearchFilters>(initial);
  const [submitted, setSubmitted] = useState(hasPreset);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const debounced = useDebounced(text);

  useEffect(() => { recentSearches().then(setRecent); if (!hasPreset) setTimeout(() => inputRef.current?.focus(), 250); }, [hasPreset]);
  const sugg = useQuery({ queryKey: ['suggest', debounced], queryFn: () => suggestions(debounced), enabled: !submitted && debounced.trim().length >= 1, staleTime: 60_000 });

  const submit = (q: string, extra: Partial<SearchFilters> = {}) => {
    const v = q.trim();
    setText(v);
    setFilters((f) => ({ ...f, ...extra, q: v || undefined, sort: v ? (f.sort === 'nearest' ? 'nearest' : 'relevance') : f.sort }));
    setSubmitted(true);
    inputRef.current?.blur();
    if (v) { addRecentSearch(v).then(() => recentSearches().then(setRecent)); logSearch(v); }
  };

  const catLabel = filters.category_id ? catalog.catName(filters.category_id) : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingBottom: space.sm }}>
        <IconButton name="back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, borderRadius: radius.lg, backgroundColor: c.surface, paddingHorizontal: space.md, borderWidth: 1.5, borderColor: c.primary }}>
          <Icon name="search" size={20} color={c.primary} spark={false} />
          <TextInput
            ref={inputRef}
            testID="search-input"
            value={text}
            onChangeText={(v) => { setText(v); setSubmitted(false); }}
            onSubmitEditing={() => submit(text)}
            onFocus={() => setSubmitted(false)}
            placeholder={catLabel ? t('search.inCategory', { name: catLabel }) : t('search.placeholder')}
            placeholderTextColor={c.textFaint}
            returnKeyType="search"
            style={[{ flex: 1, fontFamily: font.regular, fontSize: 16, color: c.text, textAlign: isRTL ? 'right' : 'left' }, webNoOutline]}
            accessibilityLabel={t('search.placeholder')}
          />
          {text.length > 0 && <Pressable hitSlop={10} onPress={() => { setText(''); setSubmitted(false); inputRef.current?.focus(); }} accessibilityLabel={t('common.clear')}><Icon name="close" size={18} color={c.textMuted} spark={false} /></Pressable>}
        </View>
      </View>

      {submitted ? (
        <AdFeed
          filters={filters}
          layout={layout}
          header={
            <View style={{ gap: space.sm }}>
              <ResultsToolbar filters={filters} onOpenFilters={() => setOpen(true)} layout={layout} setLayout={setLayout} defaultName={filters.q || catLabel || t('search.title')} />
              <BannerStrip placement="search_top" />
            </View>
          }
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60, gap: space.xl, paddingTop: space.sm }}>
          {(sugg.data?.length ?? 0) > 0 && (
            <View>
              {sugg.data!.map((s, i) => (
                <Pressable key={`${s.kind}-${i}`} testID={`suggestion-${i}`} onPress={() => (s.kind === 'category' && s.category_id ? submit('', { category_id: s.category_id }) : submit(s.label))}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 13, backgroundColor: pressed ? c.surface : 'transparent' })}>
                  <Icon name={s.kind === 'category' ? 'grid' : s.kind === 'term' ? 'search' : 'tag'} size={18} color={c.textMuted} spark={false} />
                  <T style={{ flex: 1 }} numberOfLines={1}>{s.kind === 'category' ? s.label.split(' / ')[isRTL ? 0 : 1] : s.label}</T>
                  <Icon name={isRTL ? 'back' : 'forward'} size={16} color={c.textFaint} spark={false} />
                </Pressable>
              ))}
            </View>
          )}
          {recent.length > 0 && (
            <Section title={t('search.recent')} action={t('search.clearRecent')} onAction={() => { clearRecentSearches(); setRecent([]); }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg }}>
                {recent.map((r) => <Chip key={r} label={r} icon="clock" onPress={() => submit(r)} />)}
              </View>
            </Section>
          )}
          <Section title={t('home.categories')}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg }}>
              {catalog.mains.map((m) => <Chip key={m.id} label={pick(m.name_ar, m.name_en)} icon={m.icon as never} active={filters.category_id === m.id}
                onPress={() => submit(text, { category_id: m.id })} />)}
            </View>
          </Section>
        </ScrollView>
      )}
      <FilterSheet visible={open} onClose={() => setOpen(false)} value={filters} onApply={setFilters} hasLocation={filters.lat !== undefined} />
    </View>
  );
}
