import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { Sheet } from './feedback';
import { Icon } from './Icon';
import { haptic, T } from './ui';

export type Place = { governorate_id?: number; area_id?: number };
const KEY = 'fikra.place';

/** Browsing location (governorate / area), remembered on the device. */
export function usePlace(): [Place, (p: Place) => void] {
  const [place, setPlace] = useState<Place>({});
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) { try { setPlace(JSON.parse(v) as Place); } catch { /* ignore */ } } }).catch(() => {});
  }, []);
  return [place, (p) => { setPlace(p); AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {}); }];
}

function Item({ title, active, onPress, chevron, testID: tid }: { title: string; active?: boolean; onPress: () => void; chevron?: boolean; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={tid} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: pressed ? c.surface : 'transparent' })}>
      <T v="bodyStrong" style={{ flex: 1 }} color={active ? c.primary : undefined}>{title}</T>
      {active && <Icon name="check" size={18} color={c.primary} strokeWidth={2.4} />}
      {chevron && <Icon name="forward" size={16} color={c.textFaint} />}
    </Pressable>
  );
}

/** Compact pill showing the selected place; opens a two-step governorate → area sheet. */
export function PlacePill({ value, onChange, testID = 'place-pill' }: { value: Place; onChange: (p: Place) => void; testID?: string }) {
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const catalog = useCatalog();
  const [open, setOpen] = useState(false);
  const [gov, setGov] = useState<number | undefined>(undefined);
  const label = value.governorate_id ? catalog.placeName(value.governorate_id, value.area_id) : t('home.allKuwait');
  const govs = catalog.data?.governorates ?? [];
  const areas = (catalog.data?.areas ?? []).filter((a) => a.governorate_id === gov);
  const choose = (p: Place) => { haptic.light(); onChange(p); setOpen(false); };
  const govRow = govs.find((g) => g.id === gov);

  return (
    <>
      <Pressable testID={testID} onPress={() => { setGov(value.governorate_id); setOpen(true); }} accessibilityRole="button" accessibilityLabel={`${t('home.chooseLocation')}: ${label}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.primarySoft }}>
        <Icon name="location" size={16} color={c.primary} />
        <T v="small" numberOfLines={1} style={{ fontFamily: font.semibold, maxWidth: 240 }} color={c.primary}>{label}</T>
        <Icon name="down" size={14} color={c.primary} strokeWidth={2.2} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={govRow ? pick(govRow.name_ar, govRow.name_en) : t('home.chooseLocation')}>
        {gov === undefined ? (
          <View>
            <Item testID="place-all" title={t('home.allKuwait')} active={!value.governorate_id} onPress={() => choose({})} />
            {govs.map((g) => <Item key={g.id} testID={`place-gov-${g.slug}`} title={pick(g.name_ar, g.name_en)} active={value.governorate_id === g.id && !value.area_id} chevron onPress={() => setGov(g.id)} />)}
          </View>
        ) : (
          <View>
            <Item title={t('common.back')} onPress={() => setGov(undefined)} />
            <Item testID="place-gov-all" title={t('home.allOfGov', { name: govRow ? pick(govRow.name_ar, govRow.name_en) : '' })} active={value.governorate_id === gov && !value.area_id} onPress={() => choose({ governorate_id: gov })} />
            {areas.map((a) => <Item key={a.id} title={pick(a.name_ar, a.name_en)} active={value.area_id === a.id} onPress={() => choose({ governorate_id: gov, area_id: a.id })} />)}
          </View>
        )}
      </Sheet>
    </>
  );
}
