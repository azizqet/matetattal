import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCatalog, useFavorites } from '../hooks/data';
import { useI18n } from '../i18n';
import { priceLabel, relativeTime } from '../lib/format';
import { publicUrl } from '../lib/supabase';
import type { AdCard as AdCardT } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { PhotoPlaceholder } from './Brand';
import { Icon } from './Icon';
import { haptic, Press, T } from './ui';

type Props = { ad: AdCardT; layout?: 'grid' | 'list' | 'rail'; width?: number };

function Photo({ path, style }: { path: string | null; style: object }) {
  const { c } = useTheme();
  const url = publicUrl('ad-images', path);
  return (
    <View style={[{ backgroundColor: c.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {url ? <Image source={{ uri: url }} recyclingKey={path ?? undefined} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        : <PhotoPlaceholder />}
    </View>
  );
}

function Heart({ id, small }: { id: number; small?: boolean }) {
  const { c } = useTheme();
  const { isFav, toggle } = useFavorites();
  const { t } = useI18n();
  const on = isFav(id);
  const d = small ? 30 : 34;
  return (
    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={t('account.favorites')} accessibilityState={{ selected: on }}
      onPress={() => { haptic.medium(); toggle(id); }}
      style={{ position: 'absolute', top: 8, end: 8, width: d, height: d, borderRadius: d / 2, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={on ? 'heartFill' : 'heart'} size={small ? 16 : 18} color={on ? c.danger : '#111111'} />
    </Pressable>
  );
}

/** Yellow «مميز» for featured ads (the only place yellow is used), black for sold. */
function Flag({ ad }: { ad: AdCardT }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const sold = ad.status === 'sold';
  if (!ad.is_featured && !ad.is_pinned && !sold) return null;
  const bg = sold ? c.ink : ad.is_featured ? c.featured : c.primary;
  const fg = sold ? '#FFFFFF' : ad.is_featured ? c.onFeatured : c.onPrimary;
  return (
    <View style={{ position: 'absolute', top: 8, start: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.socket }}>
      <Icon name={sold ? 'sold' : ad.is_featured ? 'star' : 'pin'} size={12} color={fg} strokeWidth={2.2} />
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: fg }}>{sold ? t('ad.sold') : ad.is_featured ? t('ad.featured') : t('ad.pinned')}</Text>
    </View>
  );
}

function Count({ n }: { n: number }) {
  if (n < 2) return null;
  return (
    <View style={{ position: 'absolute', bottom: 8, end: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.socket, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Icon name="camera" size={12} color="#FFF" />
      <Text style={{ color: '#FFF', fontFamily: font.medium, fontSize: 11 }}>{n}</Text>
    </View>
  );
}

function Price({ ad, size = 16 }: { ad: AdCardT; size?: number }) {
  const { c } = useTheme();
  const { lang } = useI18n();
  const isPrice = ad.price_type === 'fixed' || ad.price_type === 'negotiable';
  return (
    <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: isPrice ? size : size - 3, color: isPrice ? c.primary : c.textMuted }}>
      {priceLabel(ad, lang)}
    </Text>
  );
}

function AdCardBase({ ad, layout = 'grid', width }: Props) {
  const { c } = useTheme();
  const { lang, t } = useI18n();
  const { placeName } = useCatalog();
  const open = () => router.push(`/ad/${ad.id}`);
  const place = placeName(ad.governorate_id, ad.area_id);
  const when = relativeTime(ad.bumped_at, lang);
  const border = ad.is_featured ? { borderWidth: 1.5, borderColor: c.featured } : { borderWidth: 1, borderColor: c.line };
  const label = `${ad.title}, ${priceLabel(ad, lang)}`;

  if (layout === 'list') {
    return (
      <Press onPress={open} accessibilityRole="button" accessibilityLabel={label} scale={0.985}
        style={[{ flexDirection: 'row', borderRadius: radius.md, backgroundColor: c.card, overflow: 'hidden' }, border]}>
        <View>
          <Photo path={ad.cover_path} style={{ width: 132, height: 116 }} />
          <Flag ad={ad} />
          <Count n={ad.images_count} />
        </View>
        <View style={{ flex: 1, padding: space.md, gap: 4 }}>
          <T v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 21, paddingEnd: 30 }}>{ad.title}</T>
          <Price ad={ad} />
          <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!!place && <Icon name="location" size={12} color={c.textFaint} />}
            <T v="caption" faint numberOfLines={1} style={{ flexShrink: 1 }}>{[place, when].filter(Boolean).join(' · ')}</T>
            {ad.condition && <T v="caption" muted style={{ marginStart: 'auto' }}>{t(`ad.${ad.condition}`)}</T>}
          </View>
        </View>
        <Heart id={ad.id} small />
      </Press>
    );
  }

  return (
    <Press onPress={open} accessibilityRole="button" accessibilityLabel={label} scale={0.98}
      style={[{ width, flex: width ? undefined : 1, borderRadius: radius.md, backgroundColor: c.card, overflow: 'hidden' }, border]}>
      <View>
        <Photo path={ad.cover_path} style={{ width: '100%', aspectRatio: layout === 'rail' ? 1.25 : 1.1 }} />
        <Flag ad={ad} />
        <Heart id={ad.id} />
        <Count n={ad.images_count} />
      </View>
      <View style={{ padding: space.sm + 2, gap: 3 }}>
        <Price ad={ad} size={17} />
        <T v="body" numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 20, minHeight: 40 }}>{ad.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {!!place && <Icon name="location" size={11} color={c.textFaint} />}
          <T v="caption" faint numberOfLines={1} style={{ flexShrink: 1 }}>{place || when}</T>
        </View>
      </View>
    </Press>
  );
}

export const AdCard = memo(AdCardBase);
