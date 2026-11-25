import { router } from 'expo-router';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import type { Category } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { Icon } from './Icon';
import { haptic, T } from './ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);

function MainRow({ cat, open, onToggle, last }: { cat: Category; open: boolean; onToggle: () => void; last: boolean }) {
  const { c } = useTheme();
  const { t, pick, isRTL } = useI18n();
  const catalog = useCatalog();
  const subs = catalog.subsOf(cat.id);
  const name = pick(cat.name_ar, cat.name_en);
  const go = (slug: string) => { haptic.light(); router.push(`/category/${slug}`); };
  return (
    <View style={{ borderBottomWidth: last && !open ? 0 : 1, borderBottomColor: c.line }}>
      <Pressable testID={`cat-${cat.slug}`} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ expanded: open }}
        onPress={() => { haptic.light(); if (subs.length) onToggle(); else go(cat.slug); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg, backgroundColor: pressed ? c.surface : c.card })}>
        <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={cat.icon} size={22} color={c.primary} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <T v="bodyStrong" numberOfLines={1} style={{ fontFamily: font.semibold }}>{name}</T>
          <T v="caption" faint numberOfLines={1}>
            {cat.ads_count > 0 ? t('categories.adsCount', { n: cat.ads_count }) : t('categories.subsCount', { n: subs.length })}
          </T>
        </View>
        <View style={{ transform: [{ rotate: open ? (isRTL ? '-90deg' : '90deg') : '0deg' }] }}>
          <Icon name="forward" size={18} color={open ? c.primaryBright : c.textMuted} strokeWidth={2} />
        </View>
      </Pressable>
      {open && (
        <View style={{ backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
          {[{ id: -1, slug: cat.slug, label: t('categories.allIn', { name }), n: cat.ads_count }, ...subs.map((s) => ({ id: s.id, slug: s.slug, label: pick(s.name_ar, s.name_en), n: s.ads_count }))].map((s, i, arr) => (
            <Pressable key={s.id} testID={`sub-row-${s.slug}`} onPress={() => go(s.slug)} accessibilityRole="button" accessibilityLabel={s.label}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingStart: space.lg + 52, paddingEnd: space.lg,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: c.line, backgroundColor: pressed ? c.primarySoft : 'transparent' })}>
              <T v="body" style={{ flex: 1, fontFamily: s.id === -1 ? font.semibold : font.regular }} color={s.id === -1 ? c.primaryBright : c.text} numberOfLines={1}>{s.label}</T>
              {s.n > 0 && <T v="caption" faint>{s.n}</T>}
              <Icon name="forward" size={14} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/** Vertical, expandable section list: icon on the start side, chevron on the end, thin dividers. */
export function CategoryList({ limit, style }: { limit?: number; style?: object }) {
  const { c } = useTheme();
  const catalog = useCatalog();
  const [open, setOpen] = useState<number | null>(null);
  const mains = limit ? catalog.mains.slice(0, limit) : catalog.mains;
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, style]}>
      {mains.map((m, i) => (
        <MainRow key={m.id} cat={m} last={i === mains.length - 1} open={open === m.id}
          onToggle={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen(open === m.id ? null : m.id); }} />
      ))}
    </View>
  );
}
