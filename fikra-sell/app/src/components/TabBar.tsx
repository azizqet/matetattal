import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCounters } from '../hooks/data';
import { useI18n, type TKey } from '../i18n';
import { useRequireAuth } from '../lib/auth';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { Icon, type IconName } from './Icon';
import { haptic } from './ui';

const TABS: Record<string, { icon: IconName; label: TKey }> = {
  index: { icon: 'home', label: 'tabs.home' },
  categories: { icon: 'grid', label: 'tabs.categories' },
  post: { icon: 'plus', label: 'tabs.post' },
  chats: { icon: 'chat', label: 'tabs.chats' },
  account: { icon: 'user', label: 'tabs.account' },
};

/** Centre «أضف إعلان» button: a solid turquoise circle. */
function AddButton({ label }: { label: string }) {
  const { c } = useTheme();
  const guard = useRequireAuth();
  return (
    <Pressable testID="tab-post" accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { haptic.medium(); guard('post', () => router.push('/post/new')); }}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, marginTop: -16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, borderColor: c.card, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
        <Icon name="plus" size={24} color={c.onPrimary} strokeWidth={2.6} />
      </View>
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: c.textMuted }}>{label}</Text>
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
    <View style={{ paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          if (route.name === 'post') return <AddButton key={route.key} label={t(meta.label)} />;
          const focused = state.index === i;
          const badge = route.name === 'chats' ? unread : 0;
          const col = focused ? c.primaryBright : c.textMuted;
          return (
            <Pressable key={route.key} testID={`tab-${route.name}`} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t(meta.label)}
              onPress={() => {
                haptic.light();
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 4 }}>
              <View>
                <Icon name={meta.icon} size={24} color={col} strokeWidth={focused ? 2.1 : 1.75} />
                {badge > 0 && (
                  <View style={{ position: 'absolute', top: -4, end: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.primaryBright, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: c.card }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#FFFFFF' }}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: focused ? font.semibold : font.regular, fontSize: 11, color: focused ? c.primaryBright : c.textMuted }}>{t(meta.label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
