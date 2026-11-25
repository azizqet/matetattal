import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo } from 'react';
import { FlatList, Linking, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useI18n } from '../i18n';
import { bannerEvent, banners } from '../lib/api';
import { publicUrl } from '../lib/supabase';
import type { Category } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { Icon } from './Icon';
import { Press } from './ui';

/** Commercial banner spaces managed from the admin panel. */
export function BannerStrip({ placement, categoryId }: { placement: 'home_top' | 'home_middle' | 'category_top' | 'search_top'; categoryId?: number }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ['banners', placement, categoryId], queryFn: () => banners(placement, categoryId), staleTime: 10 * 60_000 });
  const list = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => { list.forEach((b) => bannerEvent(b.id, 'impression')); }, [list]);
  if (!list.length) return null;
  const w = width - space.lg * 2;
  const open = (url: string | null, id: number) => {
    bannerEvent(id, 'click');
    if (!url) return;
    if (url.startsWith('fikrasell://')) Linking.openURL(url);
    else WebBrowser.openBrowserAsync(url);
  };
  return (
    <FlatList
      horizontal
      data={list}
      keyExtractor={(b) => String(b.id)}
      showsHorizontalScrollIndicator={false}
      snapToInterval={w + space.md}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item.link_url, item.id)} accessibilityRole="link" accessibilityLabel={item.title}
          style={{ width: w, aspectRatio: 2.35, borderTopStartRadius: radius.crown, borderTopEndRadius: radius.lg, borderBottomEndRadius: radius.lg, borderBottomStartRadius: radius.socket, overflow: 'hidden', backgroundColor: c.surface }}>
          <Image source={{ uri: publicUrl('banners', item.image_path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        </Pressable>
      )}
    />
  );
}

/** Category tile: icon in a crown-cornered plate with the accent spark. */
export function CategoryTile({ cat, size = 72, onPress }: { cat: Category; size?: number; onPress?: () => void }) {
  const { c } = useTheme();
  const { pick } = useI18n();
  const name = pick(cat.name_ar, cat.name_en);
  return (
    <Press onPress={onPress ?? (() => router.push(`/category/${cat.slug}`))} accessibilityRole="button" accessibilityLabel={name}
      style={{ width: size + 12, alignItems: 'center', gap: 8 }} testID={`cat-${cat.slug}`}>
      <View style={{ width: size, height: size, backgroundColor: c.surface, borderTopStartRadius: size * 0.36, borderTopEndRadius: size * 0.36, borderBottomEndRadius: size * 0.22, borderBottomStartRadius: 6,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
        <Icon name={cat.icon} size={size * 0.46} color={c.primary} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 12, lineHeight: 17, color: c.text, textAlign: 'center' }}>{name}</Text>
    </Press>
  );
}
