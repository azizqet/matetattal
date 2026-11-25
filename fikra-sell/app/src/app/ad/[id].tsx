import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdCard } from '../../components/AdCard';
import { BulbLoader, Confirm, EmptyState, ErrorState, Sheet, useToast } from '../../components/feedback';
import { Gallery } from '../../components/Gallery';
import { Icon } from '../../components/Icon';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar, Badge, Button, Divider, Header, IconButton, Press, Row, Section, T, haptic } from '../../components/ui';
import { useCatalog, useFavorites } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { blockUser, getAd, getProfile, recordAdEvent, searchAds, startConversation } from '../../lib/api';
import { useAuth, useRequireAuth } from '../../lib/auth';
import { priceLabel, relativeTime, shortDate } from '../../lib/format';
import { adUrl, call, shareText, whatsapp } from '../../lib/links';
import { noteCategoryView } from '../../lib/recent';
import type { Ad, CategoryField } from '../../lib/types';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

function attrValue(f: CategoryField, v: unknown, pick: (a?: string | null, b?: string | null) => string): string {
  if (v === undefined || v === null || v === '') return '';
  if (f.type === 'select') { const o = f.options.find((x) => x.v === String(v)); return o ? pick(o.ar, o.en) : String(v); }
  if (f.type === 'boolean') return v ? '✓' : '—';
  const unit = pick(f.unit_ar, f.unit_en);
  const s = typeof v === 'number' && f.type === 'number' ? new Intl.NumberFormat('en-US').format(v) : String(v);
  return unit ? `${s} ${unit}` : s;
}

export default function AdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const adId = Number(id);
  const { c } = useTheme();
  const { t, lang, pick } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const toast = useToast();
  const guard = useRequireAuth();
  const { userId } = useAuth();
  const catalog = useCatalog();
  const { isFav, toggle } = useFavorites();
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState<'ad' | 'user' | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  const q = useQuery({ queryKey: ['ad', adId], queryFn: () => getAd(adId), enabled: Number.isFinite(adId) });
  const ad = q.data;
  const seller = useQuery({ queryKey: ['profile', ad?.user_id], queryFn: () => getProfile(ad!.user_id), enabled: !!ad });
  const similar = useQuery({
    queryKey: ['similar', adId], enabled: !!ad && ad.status === 'active',
    queryFn: () => searchAds({ category_id: ad!.category_id, exclude_id: adId, governorate_id: undefined }, 0, 10),
  });

  useEffect(() => {
    if (ad?.status === 'active') { recordAdEvent(ad.id, 'view').catch(() => {}); noteCategoryView(ad.main_category_id); }
  }, [ad?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><BulbLoader label={t('common.loading')} /></View>;
  if (q.isError) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><ErrorState error={q.error} onRetry={() => q.refetch()} /></View>;
  if (!ad) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><EmptyState title={t('ad.notFound')} body={t('ad.notFoundBody')} action={t('tabs.home')} onAction={() => router.replace('/')} /></View>;

  const mine = ad.user_id === userId;
  const fields = catalog.fieldsFor(ad.category_id).filter((f) => ad.attributes[f.key] !== undefined && ad.attributes[f.key] !== '');
  const main = catalog.mainOf(ad.category_id);
  const priceKind = catalog.byId.get(ad.category_id)?.price_label ?? 'price';
  const url = adUrl(ad.id);
  const priceText = priceLabel(ad, lang);
  const canContact = ad.status === 'active' && !mine;

  const openChat = () => guard('chat', async () => {
    setChatBusy(true);
    try { const conv = await startConversation(ad.id); router.push(`/chat/${conv}`); } catch (e) { toast.error(e); } finally { setChatBusy(false); }
  });

  const statusTone: Record<string, 'neutral' | 'accent' | 'success' | 'danger' | 'primary'> = { pending: 'neutral', rejected: 'danger', expired: 'neutral', sold: 'primary', hidden: 'neutral', active: 'success' };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <Gallery images={ad.ad_images ?? []} height={Math.min(width * 0.95, 520)} />
        <View style={{ backgroundColor: c.bg, paddingTop: space.lg, gap: space.xl }}>
          <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {!!ad.featured_until && new Date(ad.featured_until) > new Date() && <Badge label={t('ad.featured')} tone="accent" />}
              {(mine || ad.status !== 'active') && <Badge label={t(`ad.${ad.status}`)} tone={statusTone[ad.status]} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <Text testID="ad-price" style={{ fontFamily: font.bold, fontSize: 28, lineHeight: 38, color: c.primary }}>{priceText}</Text>
              {priceKind !== 'price' && ad.price !== null && <T v="small" muted>{priceKind === 'salary' || priceKind === 'rent' ? t('ad.perMonth') : ''}</T>}
              {ad.price_type === 'negotiable' && <Badge label={t('ad.negotiable')} tone="primary" />}
            </View>
            <T v="h2" testID="ad-title">{ad.title}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' }}>
              <Meta icon="location" text={catalog.placeName(ad.governorate_id, ad.area_id)} />
              <Meta icon="clock" text={relativeTime(ad.bumped_at, lang)} />
              <Meta icon="eye" text={t('ad.views', { n: ad.views_count })} />
            </View>
          </View>

          {ad.status === 'rejected' && mine && ad.reject_reason && (
            <View style={{ marginHorizontal: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: c.dangerSoft }}>
              <T v="small" color={c.danger}>{t('myAds.rejectedReason', { reason: ad.reject_reason })}</T>
            </View>
          )}

          {/* Details table */}
          <Section title={t('ad.details')}>
            <View style={{ marginHorizontal: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
              <DetailRow label={t('ad.category')} value={[pick(main?.name_ar, main?.name_en), main?.id !== ad.category_id ? catalog.catName(ad.category_id) : ''].filter(Boolean).join(' › ')} />
              {ad.condition && <DetailRow label={t('ad.condition')} value={t(`ad.${ad.condition}`)} />}
              {fields.map((f) => <DetailRow key={f.id} label={pick(f.label_ar, f.label_en)} value={attrValue(f, ad.attributes[f.key], pick)} />)}
              <DetailRow label={t('ad.adNumber')} value={String(ad.id)} last />
            </View>
          </Section>

          {ad.description.length > 0 && (
            <Section title={t('ad.description')}>
              <T style={{ paddingHorizontal: space.lg, lineHeight: 26 }} selectable>{ad.description}</T>
            </Section>
          )}

          {/* Seller */}
          {seller.data && (
            <Section title={t('ad.seller')}>
              <Press onPress={() => router.push(`/seller/${seller.data!.id}`)} accessibilityRole="button" accessibilityLabel={seller.data.full_name}
                style={{ marginHorizontal: space.lg, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Avatar path={seller.data.avatar_path} name={seller.data.full_name} size={52} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="bodyStrong">{seller.data.full_name}</T>
                    {seller.data.is_merchant && <Badge label={t('account.merchant')} tone="primary" />}
                  </View>
                  <T v="small" muted>{t('ad.memberSince', { date: shortDate(seller.data.created_at, lang) })} · {t('account.activeAds', { n: seller.data.active_ads_count })}</T>
                </View>
                <Icon name="forward" size={18} color={c.textFaint} />
              </Press>
            </Section>
          )}

          <View style={{ marginHorizontal: space.lg, flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed' }}>
            <Icon name="shield" size={20} color={c.success} />
            <T v="small" muted style={{ flex: 1 }}>{t('ad.safety')}</T>
          </View>

          {!mine && (
            <Press onPress={() => guard('report', () => setReportOpen('ad'))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', padding: space.sm }} accessibilityRole="button" testID="report-ad">
              <Icon name="flag" size={16} color={c.textMuted} />
              <T v="small" muted>{t('ad.reportAd')}</T>
            </Press>
          )}

          {(similar.data?.length ?? 0) > 0 && (
            <Section title={t('ad.similar')}>
              <FlatList horizontal data={similar.data} keyExtractor={(a) => String(a.id)} showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }} renderItem={({ item }) => <AdCard ad={item} layout="rail" width={164} />} />
            </Section>
          )}
        </View>
      </ScrollView>

      {/* Floating top controls */}
      <View style={{ position: 'absolute', top: insets.top + 6, start: space.md, end: space.md, flexDirection: 'row', gap: space.sm }}>
        <IconButton name="back" tone="overlay" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flex: 1 }} />
        <IconButton name="share" tone="overlay" label={t('common.share')} testID="share-ad" onPress={() => { recordAdEvent(ad.id, 'share').catch(() => {}); shareText(t('ad.shareText', { title: ad.title, price: priceText, url }), url); }} />
        {!mine && <IconButton name={isFav(ad.id) ? 'heartFill' : 'heart'} tone="overlay" label={t('account.favorites')} onPress={() => { haptic.medium(); toggle(ad.id); }} testID="fav-ad" />}
        <IconButton name="more" tone="overlay" label={t('common.more')} onPress={() => setMenu(true)} testID="ad-more" />
      </View>

      {/* Sticky action bar */}
      <View style={{ position: 'absolute', bottom: 0, start: 0, end: 0, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line, flexDirection: 'row', gap: space.sm }}>
        {mine ? (
          <>
            <Button title={t('common.edit')} icon="edit" kind="secondary" style={{ flex: 1 }} onPress={() => router.push(`/post/${ad.id}`)} testID="edit-ad" />
            <Button title={t('account.myAds')} icon="list" style={{ flex: 1 }} onPress={() => router.push('/my-ads')} />
          </>
        ) : canContact ? (
          <>
            {ad.allow_call && ad.contact_phone && <Button title={t('ad.call')} icon="phone" kind="secondary" style={{ flex: 1 }} testID="call" onPress={() => { recordAdEvent(ad.id, 'call').catch(() => {}); call(ad.contact_phone!); }} />}
            {ad.allow_whatsapp && ad.contact_phone && <Button title={t('ad.whatsapp')} icon="whatsapp" kind="secondary" style={{ flex: 1 }} testID="whatsapp" onPress={() => { recordAdEvent(ad.id, 'whatsapp').catch(() => {}); whatsapp(ad.contact_phone!, t('ad.whatsappText', { title: ad.title, url })); }} />}
            {ad.allow_chat && <Button title={t('ad.chat')} icon="chat" style={{ flex: 1.2 }} loading={chatBusy} onPress={openChat} testID="chat" />}
          </>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', paddingVertical: space.sm }}><T muted>{t(`ad.${ad.status}`)}</T></View>
        )}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} scroll={false}>
        <View style={{ marginHorizontal: -space.xl }}>
          <Row icon="share" label={t('common.share')} onPress={() => { setMenu(false); shareText(t('ad.shareText', { title: ad.title, price: priceText, url }), url); }} />
          {!mine && <Row icon="flag" label={t('ad.reportAd')} onPress={() => { setMenu(false); guard('report', () => setReportOpen('ad')); }} />}
          {!mine && <Row icon="user" label={`${t('common.report')} — ${seller.data?.full_name ?? ''}`} onPress={() => { setMenu(false); guard('report', () => setReportOpen('user')); }} />}
          {!mine && <><Divider /><Row icon="block" danger label={t('chat.blockUser')} onPress={() => { setMenu(false); guard('default', () => setBlockOpen(true)); }} /></>}
          {mine && <Row icon="edit" label={t('common.edit')} onPress={() => { setMenu(false); router.push(`/post/${ad.id}`); }} />}
        </View>
      </Sheet>
      <ReportSheet visible={reportOpen !== null} onClose={() => setReportOpen(null)} targetType={reportOpen ?? 'ad'} targetId={reportOpen === 'user' ? ad.user_id : String(ad.id)} />
      <Confirm visible={blockOpen} title={t('chat.blockUser')} body={t('chat.blockBody')} confirm={t('common.block')} danger onClose={() => setBlockOpen(false)}
        onConfirm={async () => {
          try { await blockUser(ad.user_id); toast.success('chat.blocked'); setBlockOpen(false); qc.invalidateQueries({ queryKey: ['feed'] }); router.back(); }
          catch (e) { toast.error(e); }
        }} />
    </View>
  );
}

function Meta({ icon, text }: { icon: 'location' | 'clock' | 'eye'; text: string }) {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={15} color={c.textFaint} />
      <T v="small" faint>{text}</T>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, gap: space.md }}>
      <T v="small" muted style={{ width: '40%' }}>{label}</T>
      <T v="small" style={{ flex: 1, fontFamily: font.medium }}>{value}</T>
    </View>
  );
}

export type { Ad };
