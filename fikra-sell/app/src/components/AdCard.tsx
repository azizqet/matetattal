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
import { BulbMark } from './Brand';
import { Icon } from './Icon';
import { haptic, Press, T } from './ui';

type Props = { ad: AdCardT; layout?: 'grid' | 'list' | 'rail'; width?: number };

function Photo({ path, style }: { path: string | null; style: object }) {
  const { c } = useTheme();
  const url = publicUrl('ad-images', path);
  return (
    <View style={[{ backgroundColor: c.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {url ? <Image source={{ uri: url }} recyclingKey={path ?? undefined} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={180} cachePolicy="memory-disk" />
        : <BulbMark size={34} lit={false} color={c.lineStrong} />}
    </View>
  );
}

function Heart({ id }: { id: number }) {
  const { isFav, toggle } = useFavorites();
  const { t } = useI18n();
  const on = isFav(id);
  return (
    <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={t('account.favorites')} accessibilityState={{ selected: on }}
      onPress={() => { haptic.medium(); toggle(id); }}
      style={{ position: 'absolute', top: 10, end: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={on ? 'heartFill' : 'heart'} size={19} color={on ? '#E0453A' : '#15161C'} spark={false} />
    </Pressable>
  );
}

/** The price "socket": dark tag anchored to the photo, like the bulb's base. */
function PriceSocket({ ad }: { ad: AdCardT }) {
  const { c } = useTheme();
  const { lang } = useI18n();
  const label = priceLabel(ad, lang);
  const isPrice = ad.price_type === 'fixed' || ad.price_type === 'negotiable';
  return (
    <View style={{ position: 'absolute', bottom: 0, start: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.scheme === 'dark' ? '#0E0F13' : c.ink,
      paddingHorizontal: 11, paddingVertical: 6, borderTopEndRadius: radius.md, borderBottomStartRadius: radius.socket }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
      <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: isPrice ? 15 : 12, color: '#FFFFFF' }}>{label}</Text>
    </View>
  );
}

function Flags({ ad }: { ad: AdCardT }) {
  const { c } = useTheme();
  const { t } = useI18n();
  if (!ad.is_featured && !ad.is_pinned && ad.status !== 'sold') return null;
  const label = ad.status === 'sold' ? t('ad.sold') : ad.is_featured ? t('ad.featured') : t('ad.pinned');
  return (
    <View style={{ position: 'absolute', top: 10, start: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ad.status === 'sold' ? c.ink : c.accent,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.socket }}>
      <Icon name={ad.status === 'sold' ? 'sold' : ad.is_featured ? 'star' : 'pin'} size={12} color={ad.status === 'sold' ? '#FFF' : c.onAccent} spark={false} strokeWidth={2.2} />
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: ad.status === 'sold' ? '#FFF' : c.onAccent }}>{label}</Text>
    </View>
  );
}

function AdCardBase({ ad, layout = 'grid', width }: Props) {
  const { c } = useTheme();
  const { lang, t } = useI18n();
  const { placeName } = useCatalog();
  const open = () => router.push(`/ad/${ad.id}`);
  const meta = [placeName(ad.governorate_id, ad.area_id), relativeTime(ad.bumped_at, lang)].filter(Boolean).join(' · ');
  const ring = ad.is_featured ? { borderWidth: 1.5, borderColor: c.accent } : null;

  if (layout === 'list') {
    return (
      <Press onPress={open} accessibilityRole="button" accessibilityLabel={`${ad.title}, ${priceLabel(ad, lang)}`} scale={0.985}
        style={[{ flexDirection: 'row', gap: space.md, padding: space.sm, borderRadius: radius.lg, backgroundColor: c.card }, ring]}>
        <View>
          <Photo path={ad.cover_path} style={{ width: 118, height: 118, borderTopStartRadius: radius.crown, borderBottomStartRadius: radius.socket, borderTopEndRadius: radius.md, borderBottomEndRadius: radius.md }} />
          <Flags ad={ad} />
        </View>
        <View style={{ flex: 1, paddingVertical: 4, gap: 4 }}>
          <T v="bodyStrong" numberOfLines={2}>{ad.title}</T>
          <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 17, color: c.primary }}>{priceLabel(ad, lang)}</Text>
          {ad.condition && <T v="caption" muted>{t(`ad.${ad.condition}`)}</T>}
          <T v="small" faint numberOfLines={1} style={{ marginTop: 'auto' }}>{meta}</T>
        </View>
        <Heart id={ad.id} />
      </Press>
    );
  }

  const w = width;
  return (
    <Press onPress={open} accessibilityRole="button" accessibilityLabel={`${ad.title}, ${priceLabel(ad, lang)}`} scale={0.975}
      style={[{ width: w, flex: w ? undefined : 1, gap: space.sm }]}>
      <View style={[{ borderTopStartRadius: radius.crown, borderTopEndRadius: radius.crown, borderBottomEndRadius: radius.md, borderBottomStartRadius: radius.socket, overflow: 'hidden' }, ring]}>
        <Photo path={ad.cover_path} style={{ width: '100%', aspectRatio: layout === 'rail' ? 1.1 : 0.95 }} />
        <PriceSocket ad={ad} />
        <Flags ad={ad} />
        <Heart id={ad.id} />
        {ad.images_count > 1 && (
          <View style={{ position: 'absolute', bottom: 8, end: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(14,15,19,0.6)', borderRadius: radius.socket, paddingHorizontal: 6, paddingVertical: 3 }}>
            <Icon name="image" size={12} color="#FFF" spark={false} />
            <Text style={{ color: '#FFF', fontFamily: font.medium, fontSize: 11 }}>{ad.images_count}</Text>
          </View>
        )}
      </View>
      <View style={{ paddingHorizontal: 2, gap: 2 }}>
        <T v="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 21 }}>{ad.title}</T>
        <T v="caption" faint numberOfLines={1}>{meta}</T>
      </View>
    </Press>
  );
}

export const AdCard = memo(AdCardBase);
