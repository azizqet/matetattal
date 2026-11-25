import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import type { SearchFilters } from '../lib/types';
import { space } from '../theme/tokens';
import { Sheet } from './feedback';
import { Button, Chip, Input, T } from './ui';

type Sort = NonNullable<SearchFilters['sort']>;

type Props = { visible: boolean; onClose: () => void; value: SearchFilters; onApply: (f: SearchFilters) => void; hasLocation?: boolean };

/** Re-mounts on every open so the draft always starts from the applied filters. */
export function FilterSheet(props: Props) {
  return <FilterSheetInner key={props.visible ? 'open' : 'closed'} {...props} />;
}

function FilterSheetInner({ visible, onClose, value, onApply, hasLocation }: Props) {
  const { t, pick } = useI18n();
  const catalog = useCatalog();
  const [f, setF] = useState<SearchFilters>(value);

  const cat = f.category_id ? catalog.byId.get(f.category_id) : undefined;
  const main = cat ? catalog.mainOf(cat.id) : undefined;
  const fields = cat ? catalog.fieldsFor(cat.id).filter((x) => x.is_filterable && x.type !== 'text') : [];
  const areas = (catalog.data?.areas ?? []).filter((a) => a.governorate_id === f.governorate_id);
  const set = (patch: Partial<SearchFilters>) => setF((p) => ({ ...p, ...patch }));
  const setAttr = (k: string, v: SearchFilters['attrs'] extends infer A ? A extends Record<string, infer V> ? V | undefined : never : never) =>
    setF((p) => { const attrs = { ...(p.attrs ?? {}) }; if (v === undefined || v === '') delete attrs[k]; else attrs[k] = v; return { ...p, attrs }; });
  const num = (s: string) => { const n = Number(s.replace(/[^\d.]/g, '')); return s.trim() === '' || Number.isNaN(n) ? undefined : n; };

  const sorts: { v: Sort; k: Parameters<typeof t>[0] }[] = [
    ...(f.q ? [{ v: 'relevance' as Sort, k: 'search.sortRelevance' as const }] : []),
    { v: 'newest', k: 'search.sortNewest' }, { v: 'oldest', k: 'search.sortOldest' },
    { v: 'price_asc', k: 'search.sortPriceAsc' }, { v: 'price_desc', k: 'search.sortPriceDesc' },
    ...(hasLocation ? [{ v: 'nearest' as Sort, k: 'search.sortNearest' as const }] : []),
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={t('search.filters')}
      footer={
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title={t('common.reset')} kind="secondary" style={{ flex: 1 }} onPress={() => setF({ q: f.q, category_id: value.category_id })} />
          <Button title={t('search.showResults')} style={{ flex: 2 }} onPress={() => { onApply(f); onClose(); }} testID="apply-filters" />
        </View>
      }>
      <View style={{ gap: space.xl }}>
        <Group title={t('search.sort')}>
          {sorts.map((s) => <Chip key={s.v} label={t(s.k)} active={(f.sort ?? (f.q ? 'relevance' : 'newest')) === s.v} onPress={() => set({ sort: s.v })} />)}
        </Group>

        {!value.category_id && (
          <Group title={t('search.category')}>
            <Chip label={t('search.allCategories')} active={!f.category_id} onPress={() => set({ category_id: undefined, attrs: {} })} />
            {catalog.mains.map((m) => <Chip key={m.id} label={pick(m.name_ar, m.name_en)} active={main?.id === m.id} onPress={() => set({ category_id: m.id, attrs: {} })} />)}
          </Group>
        )}

        <View style={{ gap: space.sm }}>
          <T v="bodyStrong">{t('search.priceRange')}</T>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Input containerStyle={{ flex: 1 }} placeholder={t('search.minPrice')} keyboardType="decimal-pad" value={f.min_price?.toString() ?? ''} onChangeText={(s) => set({ min_price: num(s) })} testID="min-price" />
            <Input containerStyle={{ flex: 1 }} placeholder={t('search.maxPrice')} keyboardType="decimal-pad" value={f.max_price?.toString() ?? ''} onChangeText={(s) => set({ max_price: num(s) })} testID="max-price" />
          </View>
        </View>

        {(!main || main.has_condition) && (
          <Group title={t('ad.condition')}>
            <Chip label={t('search.anyCondition')} active={!f.condition} onPress={() => set({ condition: undefined })} />
            <Chip label={t('ad.new')} active={f.condition === 'new'} onPress={() => set({ condition: 'new' })} />
            <Chip label={t('ad.used')} active={f.condition === 'used'} onPress={() => set({ condition: 'used' })} />
          </Group>
        )}

        <Group title={t('post.governorate')}>
          <Chip label={t('search.allGovernorates')} active={!f.governorate_id} onPress={() => set({ governorate_id: undefined, area_id: undefined })} />
          {(catalog.data?.governorates ?? []).map((g) => <Chip key={g.id} label={pick(g.name_ar, g.name_en)} active={f.governorate_id === g.id} onPress={() => set({ governorate_id: g.id, area_id: undefined })} />)}
        </Group>
        {f.governorate_id && areas.length > 0 && (
          <View style={{ gap: space.sm }}>
            <T v="bodyStrong">{t('post.area')}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label={t('search.allAreas')} active={!f.area_id} onPress={() => set({ area_id: undefined })} />
              {areas.map((a) => <Chip key={a.id} label={pick(a.name_ar, a.name_en)} active={f.area_id === a.id} onPress={() => set({ area_id: a.id })} />)}
            </ScrollView>
          </View>
        )}

        {fields.map((fd) => {
          const label = pick(fd.label_ar, fd.label_en);
          const cur = f.attrs?.[fd.key];
          if (fd.type === 'select') {
            return (
              <View key={fd.id} style={{ gap: space.sm }}>
                <T v="bodyStrong">{label}</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                  <Chip label={t('common.all')} active={!cur} onPress={() => setAttr(fd.key, undefined)} />
                  {fd.options.map((o) => <Chip key={o.v} label={pick(o.ar, o.en)} active={cur === o.v} onPress={() => setAttr(fd.key, o.v)} />)}
                </ScrollView>
              </View>
            );
          }
          const range = (typeof cur === 'object' ? cur : {}) as { min?: number; max?: number };
          const unit = pick(fd.unit_ar, fd.unit_en);
          return (
            <View key={fd.id} style={{ gap: space.sm }}>
              <T v="bodyStrong">{label}{unit ? ` (${unit})` : ''}</T>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Input containerStyle={{ flex: 1 }} placeholder={t('search.minPrice')} keyboardType="number-pad" value={range.min?.toString() ?? ''}
                  onChangeText={(s) => { const r = { ...range, min: num(s) }; setAttr(fd.key, r.min === undefined && r.max === undefined ? undefined : r); }} />
                <Input containerStyle={{ flex: 1 }} placeholder={t('search.maxPrice')} keyboardType="number-pad" value={range.max?.toString() ?? ''}
                  onChangeText={(s) => { const r = { ...range, max: num(s) }; setAttr(fd.key, r.min === undefined && r.max === undefined ? undefined : r); }} />
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T v="bodyStrong">{title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>
    </View>
  );
}

export function activeFilterCount(f: SearchFilters, base: SearchFilters = {}): number {
  let n = 0;
  if (f.min_price !== undefined || f.max_price !== undefined) n++;
  if (f.condition) n++;
  if (f.governorate_id) n++;
  if (f.category_id && f.category_id !== base.category_id) n++;
  n += Object.keys(f.attrs ?? {}).length;
  return n;
}
