import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCounters } from '../hooks/data';
import { useI18n, type TKey } from '../i18n';
import { useRequireAuth } from '../lib/auth';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { haptic } from './ui';

const TABS: Record<string, { icon: IconName; label: TKey }> = {
  index: { icon: 'home', label: 'tabs.home' },
  categories: { icon: 'grid', label: 'tabs.categories' },
  post: { icon: 'plus', label: 'tabs.post' },
  chats: { icon: 'chat', label: 'tabs.chats' },
  account: { icon: 'user', label: 'tabs.account' },
};

/** The lit-bulb Add button: crown + filament plus + two-bar base. */
function BulbButton({ label }: { label: string }) {
  const { c } = useTheme();
  const guard = useRequireAuth();
  const halo = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    halo.set(withRepeat(withSequence(withTiming(1, { duration: 1600 }), withTiming(0.25, { duration: 1600 })), -1));
  }, [halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value * 0.6, transform: [{ scale: 1 + halo.value * 0.12 }] }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return (
    <Pressable
      testID="tab-post"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => { press.set(withSpring(0.9)); }}
      onPressOut={() => { press.set(withSpring(1)); }}
      onPress={() => { haptic.medium(); guard('post', () => router.push('/post/new')); }}
      style={{ flex: 1, alignItems: 'center', marginTop: -30 }}
    >
      <Animated.View style={[{ alignItems: 'center' }, pressStyle]}>
        <View style={{ width: 66, height: 66, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: 66, height: 66, borderRadius: 33, backgroundColor: c.accentGlow }, haloStyle]} />
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.bg }}>
            <Icon name="plus" size={26} color={c.onPrimary} spark={false} strokeWidth={2.6} />
            <View style={{ position: 'absolute', top: 9, end: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} />
          </View>
        </View>
        {/* bulb base */}
        <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: c.text, marginTop: 1 }} />
        <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: c.text, marginTop: 2 }} />
        <Text style={{ fontFamily: font.semibold, fontSize: 11, color: c.text, marginTop: 3 }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const counters = useCounters();
  const unread = counters.data?.unread_messages ?? 0;

  return (
    <View style={{ paddingBottom: Math.max(insets.bottom, 10), paddingTop: 8, backgroundColor: c.bg, borderTopWidth: 1.5, borderTopColor: c.line }}>
      {/* filament notch above the active tab is drawn per item */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          if (route.name === 'post') return <BulbButton key={route.key} label={t(meta.label)} />;
          const focused = state.index === i;
          const badge = route.name === 'chats' ? unread : 0;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(meta.label)}
              onPress={() => {
                haptic.light();
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 4 }}
            >
              <View style={{ position: 'absolute', top: -9.5, width: focused ? 26 : 0, height: 3, borderRadius: 2, backgroundColor: c.primary }} />
              <View>
                <Icon name={meta.icon} size={24} color={focused ? c.primary : c.textFaint} spark={false} strokeWidth={focused ? 2.1 : 1.75} />
                {badge > 0 && (
                  <View style={{ position: 'absolute', top: -4, end: -9, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: c.bg }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: c.onAccent }}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: focused ? font.semibold : font.regular, fontSize: 11, color: focused ? c.text : c.textFaint }}>{t(meta.label)}</Text>
              {focused && <View style={{ width: 4, height: 4, borderRadius: radius.pill, backgroundColor: c.accent }} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
