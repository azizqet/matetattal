import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';
import { EmptyState, ErrorState, Skeleton } from '../components/feedback';
import { Icon, type IconName } from '../components/Icon';
import { Header, T } from '../components/ui';
import { useI18n } from '../i18n';
import { markAllNotificationsRead, markNotificationRead, notificationsList } from '../lib/api';
import { useAuth } from '../lib/auth';
import { relativeTime } from '../lib/format';
import { routeFromNotificationData } from '../lib/push';
import { supabase } from '../lib/supabase';
import type { AppNotification } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';

const ICONS: Record<string, IconName> = {
  message: 'chat', ad_approved: 'check', ad_rejected: 'flag', ad_expired: 'clock', ad_expiring: 'clock',
  saved_search: 'bookmark', offer: 'star', general: 'bell', support: 'help',
};

export default function Notifications() {
  const { c } = useTheme();
  const { t, lang, pick } = useI18n();
  const qc = useQueryClient();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['notifications', userId], queryFn: notificationsList, enabled: !!userId });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`notif-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (n: AppNotification) => {
    if (!n.read_at) { markNotificationRead(n.id).then(() => { q.refetch(); qc.invalidateQueries({ queryKey: ['counters'] }); }); }
    if (n.data.link) { if (n.data.link.startsWith('http')) WebBrowser.openBrowserAsync(n.data.link); else Linking.openURL(n.data.link); return; }
    if (n.data.ad_id || n.data.conversation_id || n.data.ticket_id) routeFromNotificationData(n.data as Record<string, unknown>);
  };
  const unread = (q.data ?? []).some((n) => !n.read_at);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('notifications.title')} right={unread ? (
        <Pressable onPress={async () => { await markAllNotificationsRead(); q.refetch(); qc.invalidateQueries({ queryKey: ['counters'] }); }} hitSlop={8} style={{ paddingHorizontal: space.md }} testID="mark-all-read">
          <T v="small" color={c.primary} style={{ fontFamily: font.semibold }}>{t('notifications.markAll')}</T>
        </Pressable>) : undefined} />
      {!userId ? <EmptyState icon="bell" title={t('common.signInRequired')} action={t('auth.signUp')} onAction={() => router.push({ pathname: '/auth/sign-up', params: { reason: 'default' } })} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => String(n.id)}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.primary} />}
          ListEmptyComponent={q.isLoading ? <View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={64} r={radius.md} />)}</View>
            : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="bell" title={t('notifications.empty')} body={t('notifications.emptyBody')} />}
          renderItem={({ item: n }) => (
            <Pressable onPress={() => open(n)} style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: pressed ? c.surface : n.read_at ? 'transparent' : c.primarySoft })}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ICONS[n.type] ?? 'bell'} size={20} color={n.type === 'ad_rejected' ? c.danger : c.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong">{pick(n.title_ar, n.title_en)}</T>
                {!!pick(n.body_ar, n.body_en) && <T v="small" muted numberOfLines={3}>{pick(n.body_ar, n.body_en)}</T>}
                <T v="caption" faint>{relativeTime(n.created_at, lang)}</T>
              </View>
              {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, marginTop: 6 }} />}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.line }} />}
        />
      )}
    </View>
  );
}
