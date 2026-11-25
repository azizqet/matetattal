import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BulbLoader, Confirm, EmptyState, Sheet, useToast } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar, Divider, IconButton, Row, T, haptic, webNoOutline } from '../../components/ui';
import { useI18n } from '../../i18n';
import { blockUser, getConversation, getProfile, hideConversation, markConversationRead, messages as fetchMessages, sendMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { clockTime } from '../../lib/format';
import { pickImages, signedChatImage, uploadImage } from '../../lib/images';
import { publicUrl, supabase } from '../../lib/supabase';
import type { Message } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

function ChatImage({ path }: { path: string }) {
  const q = useQuery({ queryKey: ['chat-img', path], queryFn: () => signedChatImage(path), staleTime: 50 * 60_000 });
  return <Image source={q.data ? { uri: q.data } : undefined} style={{ width: 220, height: 220, borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.08)' }} contentFit="cover" />;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { t, lang, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const toast = useToast();
  const { userId } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<'block' | 'delete' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => getConversation(id) });
  const otherId = conv.data ? (conv.data.buyer_id === userId ? conv.data.seller_id : conv.data.buyer_id) : undefined;
  const other = useQuery({ queryKey: ['profile', otherId], queryFn: () => getProfile(otherId!), enabled: !!otherId });
  const key = useMemo(() => ['messages', id], [id]);
  const msgs = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchMessages(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < 40 ? undefined : last[last.length - 1].created_at),
  });
  const list: Message[] = msgs.data?.pages.flat() ?? [];

  useEffect(() => {
    if (!otherId || !userId) return;
    supabase.from('blocks').select('blocked_id').eq('blocked_id', otherId).then(({ data }) => setBlocked(!!data?.length));
  }, [otherId, userId]);

  // Realtime: new messages + read receipts
  useEffect(() => {
    markConversationRead(id).then(() => qc.invalidateQueries({ queryKey: ['counters'] })).catch(() => {});
    const ch = supabase.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as Message;
        qc.setQueryData<InfiniteData<Message[]>>(key, (d) => {
          if (!d) return d;
          if (d.pages.some((pg) => pg.some((x) => x.id === m.id))) return d;
          return { ...d, pages: [[m, ...d.pages[0]], ...d.pages.slice(1)] };
        });
        if (m.sender_id !== userId) { haptic.light(); markConversationRead(id).catch(() => {}); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as Message;
        qc.setQueryData<InfiniteData<Message[]>>(key, (d) => d && { ...d, pages: d.pages.map((pg) => pg.map((x) => (x.id === m.id ? m : x))) });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, key, qc, userId]);

  const push = (m: Message) => qc.setQueryData<InfiniteData<Message[]>>(key, (d) => (d ? { ...d, pages: [[m, ...d.pages[0].filter((x) => x.id !== m.id)], ...d.pages.slice(1)] } : d));

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setText('');
    try { push(await sendMessage(id, body)); haptic.light(); }
    catch (e) { setText(body); toast.error(e); } finally { setSending(false); }
  };
  const sendImage = async () => {
    const res = await pickImages(1);
    if (res === 'denied') return toast.show(t('errors.permission_photos'), 'error');
    if (!res.length) return;
    setSending(true);
    try { const path = await uploadImage('chat-images', `${id}/${userId}`, res[0]); push(await sendMessage(id, null, path)); }
    catch (e) { toast.error(e); } finally { setSending(false); }
  };

  if (conv.isLoading) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><BulbLoader /></View>;
  if (!conv.data) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}><EmptyState title={t('errors.not_found')} action={t('common.back')} onAction={() => router.back()} /></View>;
  const cv = conv.data;
  const lastMineRead = list.find((m) => m.sender_id === userId);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bg }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton name="back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} />
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 }} onPress={() => otherId && router.push(`/seller/${otherId}`)}>
            <Avatar path={other.data?.avatar_path} name={other.data?.full_name} size={38} />
            <T v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{other.data?.full_name ?? ''}</T>
          </Pressable>
          <IconButton name="more" label={t('common.more')} onPress={() => setMenu(true)} testID="chat-more" />
        </View>
        {/* Linked ad */}
        <Pressable onPress={() => cv.ad_id && router.push(`/ad/${cv.ad_id}`)} accessibilityRole="button" accessibilityLabel={t('chat.viewAd')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.sm, marginBottom: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.surface }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: c.line }}>
            {cv.ad_cover_path && <Image source={{ uri: publicUrl('ad-images', cv.ad_cover_path) }} style={{ width: 40, height: 40 }} />}
          </View>
          <T v="small" numberOfLines={1} style={{ flex: 1, fontFamily: font.medium }}>{cv.ad_id ? cv.ad_title : t('chat.adUnavailable')}</T>
          {cv.ad_id && <Icon name="forward" size={16} color={c.textFaint} />}
        </Pressable>
      </View>

      <FlatList
        inverted
        data={list}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: space.lg, gap: 6 }}
        onEndReached={() => msgs.hasNextPage && msgs.fetchNextPage()}
        ListFooterComponent={msgs.isFetchingNextPage ? <ActivityIndicator color={c.primary} /> : undefined}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === userId;
          const prev = list[index + 1];
          const gapTop = prev && prev.sender_id !== item.sender_id ? 8 : 0;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginTop: gapTop }}>
              <View style={{
                maxWidth: '80%', paddingHorizontal: item.image_path ? 4 : 14, paddingVertical: item.image_path ? 4 : 9,
                backgroundColor: mine ? c.primary : c.surface,
                borderTopStartRadius: 18, borderTopEndRadius: 18,
                borderBottomStartRadius: mine === isRTL ? 18 : 5, borderBottomEndRadius: mine === isRTL ? 5 : 18,
              }}>
                {item.image_path && <ChatImage path={item.image_path} />}
                {item.body && <T color={mine ? c.onPrimary : c.text} selectable>{item.body}</T>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 }}>
                <T v="caption" faint>{clockTime(item.created_at, lang)}</T>
                {mine && item.id === lastMineRead?.id && <Icon name={item.read_at ? 'checks' : 'check'} size={14} color={item.read_at ? c.primary : c.textFaint} />}
                {mine && item.id === lastMineRead?.id && <T v="caption" faint>{item.read_at ? t('chat.seen') : t('chat.sent')}</T>}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={msgs.isLoading ? <BulbLoader /> : undefined}
      />

      {blocked ? (
        <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.line }}>
          <T muted>{t('chat.blockedBanner')}</T>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg }}>
          <IconButton name="image" label={t('chat.photo')} onPress={sendImage} tone="surface" />
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={c.textFaint}
            multiline
            maxLength={2000}
            style={[{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: c.surface, paddingHorizontal: space.lg, paddingTop: 11, paddingBottom: 11,
              fontFamily: font.regular, fontSize: 16, color: c.text, textAlign: isRTL ? 'right' : 'left' }, webNoOutline]}
          />
          <Pressable testID="chat-send" onPress={send} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel={t('common.send')}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? c.primary : c.line, alignItems: 'center', justifyContent: 'center' }}>
            {sending ? <ActivityIndicator color={c.onPrimary} /> : <Icon name="send" size={20} color={text.trim() ? c.onPrimary : c.textFaint} />}
          </Pressable>
        </View>
      )}

      <Sheet visible={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={{ marginHorizontal: -space.xl }}>
          {cv.ad_id && <Row icon="tag" label={t('chat.viewAd')} onPress={() => { setMenu(false); router.push(`/ad/${cv.ad_id}`); }} />}
          <Row icon="flag" label={t('chat.reportChat')} onPress={() => { setMenu(false); setReportOpen(true); }} testID="report-chat" />
          <Row icon="block" label={blocked ? t('common.unblock') : t('chat.blockUser')} onPress={() => { setMenu(false); if (blocked) router.push('/blocked'); else setConfirm('block'); }} testID="block-user" />
          <Divider />
          <Row icon="trash" danger label={t('chat.deleteChat')} onPress={() => { setMenu(false); setConfirm('delete'); }} testID="delete-chat" />
        </View>
      </Sheet>
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="conversation" targetId={id} />
      <Confirm visible={confirm === 'block'} title={t('chat.blockUser')} body={t('chat.blockBody')} confirm={t('common.block')} danger onClose={() => setConfirm(null)}
        onConfirm={async () => { try { await blockUser(otherId!); setBlocked(true); toast.success('chat.blocked'); } catch (e) { toast.error(e); } setConfirm(null); }} />
      <Confirm visible={confirm === 'delete'} title={t('chat.deleteChat')} body={t('chat.deleteChatBody')} confirm={t('common.delete')} danger onClose={() => setConfirm(null)}
        onConfirm={async () => { try { await hideConversation(id); qc.invalidateQueries({ queryKey: ['conversations'] }); setConfirm(null); router.back(); } catch (e) { toast.error(e); } }} />
    </KeyboardAvoidingView>
  );
}
