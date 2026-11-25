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
          style={{ width: w, aspectRatio: 2.35, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface }}>
          <Image source={{ uri: publicUrl('banners', item.image_path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        </Pressable>
      )}
    />
  );
}

/** Category tile: turquoise outline icon on a soft turquoise plate, name below. */
export function CategoryTile({ cat, width = 84, onPress }: { cat: Category; width?: number; onPress?: () => void }) {
  const { c } = useTheme();
  const { pick } = useI18n();
  const name = pick(cat.name_ar, cat.name_en);
  const plate = Math.min(64, width - 12);
  return (
    <Press onPress={onPress ?? (() => router.push(`/category/${cat.slug}`))} accessibilityRole="button" accessibilityLabel={name}
      style={{ width, alignItems: 'center', gap: 6 }} testID={`cat-${cat.slug}`}>
      <View style={{ width: plate, height: plate, borderRadius: radius.lg, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={cat.icon} size={plate * 0.5} color={c.primary} />
      </View>
      <Text numberOfLines={2} style={{ width: '100%', paddingHorizontal: 2, fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: c.text, textAlign: 'center' }}>{name}</Text>
    </Press>
  );
}
