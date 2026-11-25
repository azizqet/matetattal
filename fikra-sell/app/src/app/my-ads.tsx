import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Confirm, EmptyState, ErrorState, Skeleton, useToast } from '../components/feedback';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Chip, Header, T } from '../components/ui';
import { useI18n, type TKey } from '../i18n';
import { bumpAd, deleteAd, myAds, renewAd, setAdStatus } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toAppError } from '../lib/errors';
import { priceLabel, relativeTime } from '../lib/format';
import { publicUrl } from '../lib/supabase';
import type { Ad, AdStatus } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';

type Tab = 'active' | 'pending' | 'expired' | 'sold';
const TAB_STATUSES: Record<Tab, AdStatus[]> = { active: ['active', 'hidden'], pending: ['pending', 'rejected'], expired: ['expired'], sold: ['sold'] };

export default function MyAds() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>('active');
  const [toDelete, setToDelete] = useState<Ad | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const q = useQuery({ queryKey: ['my-ads', userId], queryFn: myAds, enabled: !!userId });
  const counts = useMemo(() => Object.fromEntries((Object.keys(TAB_STATUSES) as Tab[]).map((k) => [k, (q.data ?? []).filter((a) => TAB_STATUSES[k].includes(a.status)).length])), [q.data]);
  const list = (q.data ?? []).filter((a) => TAB_STATUSES[tab].includes(a.status));

  const act = async (ad: Ad, fn: () => Promise<unknown>, ok: TKey) => {
    setBusyId(ad.id);
    try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ['my-ads'] }); qc.invalidateQueries({ queryKey: ['feed'] }); qc.invalidateQueries({ queryKey: ['ad', ad.id] }); }
    catch (e) {
      const a = toAppError(e);
      const detail = (e as { details?: string })?.details;
      toast.show(a.key === 'errors.bump_cooldown' && detail ? t('myAds.bumpWait', { when: relativeTime(detail, lang) }) : t(a.key, a.vars), 'error');
    } finally { setBusyId(null); }
  };

  const Action = ({ icon, label, onPress, danger, testID }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; testID?: string }) => (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, borderRadius: radius.pill, backgroundColor: pressed ? c.line : c.surface })}>
      <Icon name={icon} size={15} color={danger ? c.danger : c.text} />
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: danger ? c.danger : c.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.myAds')} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, padding: space.lg }}>
          {(Object.keys(TAB_STATUSES) as Tab[]).map((k) => <Chip key={k} testID={`myads-tab-${k}`} label={`${t(`account.${k}`)} (${counts[k] ?? 0})`} active={tab === k} onPress={() => setTab(k)} />)}
        </ScrollView>
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => String(a.id)}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={c.primary} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 60, gap: space.md }}
        ListEmptyComponent={q.isLoading ? <View style={{ gap: space.md }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={150} r={radius.lg} />)}</View>
          : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
            : <EmptyState title={t('myAds.empty')} body={t('myAds.emptyBody')} action={t('tabs.post')} onAction={() => router.push('/post/new')} />}
        renderItem={({ item: ad }) => (
          <View testID={`myad-${ad.id}`} style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: space.md, gap: space.md, opacity: busyId === ad.id ? 0.5 : 1 }}>
            <Pressable onPress={() => router.push(`/ad/${ad.id}`)} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface }}>
                {ad.cover_path && <Image source={{ uri: publicUrl('ad-images', ad.cover_path) }} style={{ width: 84, height: 84 }} contentFit="cover" />}
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <T v="bodyStrong" numberOfLines={2}>{ad.title}</T>
                <Text style={{ fontFamily: font.bold, color: c.primary, fontSize: 15 }}>{priceLabel(ad, lang)}</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge label={t(`ad.${ad.status}`)} tone={ad.status === 'active' ? 'success' : ad.status === 'rejected' ? 'danger' : 'neutral'} />
                  {ad.status === 'active' && ad.expires_at && <T v="caption" faint>{t('myAds.expiresIn', { when: relativeTime(ad.expires_at, lang) })}</T>}
                </View>
                <T v="caption" faint>{t('myAds.stats', { views: ad.views_count, favs: ad.favorites_count })}</T>
              </View>
            </Pressable>
            {ad.status === 'rejected' && ad.reject_reason && <T v="small" color={c.danger}>{t('myAds.rejectedReason', { reason: ad.reject_reason })}</T>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {ad.status === 'active' && <Action icon="bump" label={t('myAds.bump')} testID={`bump-${ad.id}`} onPress={() => act(ad, () => bumpAd(ad.id), 'myAds.bumped')} />}
              {(ad.status === 'expired' || (ad.status === 'active' && ad.expires_at && new Date(ad.expires_at).getTime() - now < 5 * 86400_000)) &&
                <Action icon="refresh" label={t('myAds.renew')} testID={`renew-${ad.id}`} onPress={() => act(ad, () => renewAd(ad.id), 'myAds.renewed')} />}
              {ad.status !== 'sold' && <Action icon="edit" label={t('common.edit')} onPress={() => router.push(`/post/${ad.id}`)} testID={`edit-${ad.id}`} />}
              {(ad.status === 'active' || ad.status === 'hidden') && <Action icon="sold" label={t('myAds.markSold')} testID={`sold-${ad.id}`} onPress={() => act(ad, () => setAdStatus(ad.id, 'sold'), 'myAds.markedSold')} />}
              {ad.status === 'active' && <Action icon="hide" label={t('myAds.hide')} onPress={() => act(ad, () => setAdStatus(ad.id, 'hidden'), 'common.done')} />}
              {ad.status === 'hidden' && <Action icon="eye" label={t('myAds.show')} onPress={() => act(ad, () => setAdStatus(ad.id, 'active'), 'common.done')} />}
              <Action icon="trash" label={t('common.delete')} danger onPress={() => setToDelete(ad)} testID={`delete-${ad.id}`} />
            </View>
          </View>
        )}
      />
      <Confirm visible={!!toDelete} title={t('myAds.deleteTitle')} body={t('myAds.deleteBody')} confirm={t('common.delete')} danger onClose={() => setToDelete(null)}
        onConfirm={() => { const ad = toDelete!; setToDelete(null); act(ad, () => deleteAd(ad), 'myAds.deleted'); }} />
    </View>
  );
}
