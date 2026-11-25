import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, Skeleton } from '../../components/feedback';
import { Avatar, Button, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { conversations } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relativeTime } from '../../lib/format';
import { publicUrl, supabase } from '../../lib/supabase';
import type { Conversation, Profile } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

export function useConversationList() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['conversations', userId],
    enabled: !!userId,
    queryFn: async () => {
      const list = (await conversations()).filter((cv) => !(cv.buyer_id === userId ? cv.buyer_hidden_at : cv.seller_hidden_at));
      const others = [...new Set(list.map((cv) => (cv.buyer_id === userId ? cv.seller_id : cv.buyer_id)))];
      const { data } = others.length ? await supabase.from('profiles').select('id, full_name, avatar_path').in('id', others) : { data: [] };
      const map = new Map((data as Pick<Profile, 'id' | 'full_name' | 'avatar_path'>[] | null ?? []).map((p) => [p.id, p]));
      return list.map((cv) => ({ ...cv, other: map.get(cv.buyer_id === userId ? cv.seller_id : cv.buyer_id) }));
    },
  });
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`convs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        qc.invalidateQueries({ queryKey: ['conversations', userId] });
        qc.invalidateQueries({ queryKey: ['counters', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);
  return q;
}

export default function Chats() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const q = useConversationList();

  const header = <View style={{ paddingTop: insets.top + 12, paddingHorizontal: space.lg, paddingBottom: space.md, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line }}><T v="h2" color={c.primary}>{t('chat.title')}</T></View>;

  if (!userId) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {header}
        <EmptyState icon="chat" title={t('auth.guestPrompt', { action: t('auth.actionChat') })} body={t('account.guestBody')}
          action={t('auth.signUp')} onAction={() => router.push({ pathname: '/auth/sign-up', params: { reason: 'chat' } })} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(cv) => cv.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={q.isLoading ? (
          <View style={{ gap: space.lg, padding: space.lg }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ flexDirection: 'row', gap: space.md }}><Skeleton w={56} h={56} r={18} /><View style={{ flex: 1, gap: 8 }}><Skeleton w="60%" /><Skeleton w="85%" h={12} /></View></View>)}</View>
        ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : <EmptyState icon="chat" title={t('chat.empty')} body={t('chat.emptyBody')} />}
        renderItem={({ item }: { item: Conversation & { other?: Pick<Profile, 'id' | 'full_name' | 'avatar_path'> } }) => {
          const unread = item.buyer_id === userId ? item.buyer_unread : item.seller_unread;
          const cover = publicUrl('ad-images', item.ad_cover_path);
          return (
            <Pressable testID={`conv-${item.id}`} onPress={() => router.push(`/chat/${item.id}`)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: pressed ? c.surface : 'transparent', alignItems: 'center' })}>
              <View>
                <View style={{ width: 58, height: 58, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface }}>
                  {cover && <Image source={{ uri: cover }} style={{ width: 58, height: 58 }} contentFit="cover" />}
                </View>
                <View style={{ position: 'absolute', bottom: -4, end: -4, borderWidth: 2, borderColor: c.bg, borderRadius: 14 }}>
                  <Avatar path={item.other?.avatar_path} name={item.other?.full_name} size={24} />
                </View>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <T v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{item.other?.full_name ?? '—'}</T>
                  <T v="caption" faint>{relativeTime(item.last_message_at, lang)}</T>
                </View>
                <T v="caption" muted numberOfLines={1}>{item.ad_title}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <T v="small" numberOfLines={1} style={{ flex: 1, fontFamily: unread ? font.semibold : font.regular }} color={unread ? c.text : c.textMuted}>
                    {item.last_sender_id === userId ? `${t('chat.you')}: ` : ''}{item.last_message_preview === '📷' ? t('chat.photo') : item.last_message_preview}
                  </T>
                  {unread > 0 && (
                    <View style={{ minWidth: 22, height: 22, borderRadius: radius.pill, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.onPrimary }}>{unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.line, marginStart: 92 }} />}
        ListFooterComponent={q.data?.length ? undefined : <View style={{ alignItems: 'center' }}><Button small kind="secondary" title={t('tabs.home')} onPress={() => router.navigate('/')} /></View>}
      />
    </View>
  );
}
