import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import { getMySettings, updateMySettings } from '../lib/api';
import { useAuth } from '../lib/auth';
import { toAppError } from '../lib/errors';
import { formatKwd, isValidKwPhone, normalizePhone } from '../lib/format';
import { pickImages, takePhoto, uploadImage, type LocalImage } from '../lib/images';
import { currentCoords, inKuwait } from '../lib/location';
import { publicUrl, supabase } from '../lib/supabase';
import type { Ad, CategoryField, Condition, PriceType } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { Confirm, useToast } from './feedback';
import { Icon } from './Icon';
import { Badge, Button, Chip, IconButton, Input, Press, Switch, T, haptic } from './ui';

type Photo = LocalImage & { key: string; imageId?: number };
type Form = {
  categoryId: number | null; title: string; description: string; priceType: PriceType; price: string; condition: Condition | null;
  governorateId: number | null; areaId: number | null; lat: number | null; lng: number | null; attributes: Record<string, string>;
  phone: string; allowCall: boolean; allowWhatsapp: boolean; allowChat: boolean; photos: Photo[];
};
const EMPTY: Form = {
  categoryId: null, title: '', description: '', priceType: 'fixed', price: '', condition: null, governorateId: null, areaId: null,
  lat: null, lng: null, attributes: {}, phone: '', allowCall: true, allowWhatsapp: true, allowChat: true, photos: [],
};
const DRAFT_KEY = 'fikra.postDraft';
const STEPS = ['stepCategory', 'stepPhotos', 'stepDetails', 'stepPrice', 'stepPreview'] as const;
let keySeq = 0;
const nextKey = () => `p${Date.now()}${keySeq++}`;

function fromAd(ad: Ad): Form {
  return {
    categoryId: ad.category_id, title: ad.title, description: ad.description, priceType: ad.price_type, price: ad.price?.toString() ?? '',
    condition: ad.condition, governorateId: ad.governorate_id, areaId: ad.area_id, lat: ad.lat, lng: ad.lng,
    attributes: Object.fromEntries(Object.entries(ad.attributes).map(([k, v]) => [k, String(v)])),
    phone: ad.contact_phone ?? '', allowCall: ad.allow_call, allowWhatsapp: ad.allow_whatsapp, allowChat: ad.allow_chat,
    photos: (ad.ad_images ?? []).map((i) => ({ key: `r${i.id}`, imageId: i.id, uri: publicUrl('ad-images', i.path)!, remotePath: i.path, width: i.width ?? 0, height: i.height ?? 0 })),
  };
}

export function AdForm({ existing }: { existing?: Ad }) {
  const { c } = useTheme();
  const { t, pick, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const qc = useQueryClient();
  const { userId } = useAuth();
  const catalog = useCatalog();
  const maxImages = catalog.setting('max_images', 15);
  const [f, setF] = useState<Form>(existing ? fromAd(existing) : EMPTY);
  const [step, setStep] = useState(existing ? 1 : 0);
  const [mainPick, setMainPick] = useState<number | null>(existing ? catalog.mainOf(existing.category_id)?.id ?? null : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  const createdId = useRef<number | null>(existing?.id ?? null);
  const removedImages = useRef<{ id: number; path: string }[]>([]);
  const scroll = useRef<ScrollViewInstance>(null);
  const settings = useQuery({ queryKey: ['my-settings', userId], queryFn: getMySettings, enabled: !!userId });

  // Restore draft (new ads only) and default phone
  useEffect(() => {
    if (existing) return;
    AsyncStorage.getItem(DRAFT_KEY).then((s) => {
      if (!s) return;
      try {
        const d = JSON.parse(s) as Form;
        if (d.title || d.photos.length || d.categoryId) {
          setF(d); setMainPick(d.categoryId ? catalog.mainOf(d.categoryId)?.id ?? null : null);
          toast.show(t('post.draftRestored'));
        }
      } catch { /* ignore */ }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (existing) return;
    const id = setTimeout(() => AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(f)).catch(() => {}), 600);
    return () => clearTimeout(id);
  }, [f, existing]);

  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));
  const phone = f.phone || (existing ? '' : settings.data?.phone ?? '');
  const cat = f.categoryId ? catalog.byId.get(f.categoryId) : undefined;
  const main = cat ? catalog.mainOf(cat.id) : undefined;
  const fields: CategoryField[] = cat ? catalog.fieldsFor(cat.id) : [];
  const areas = (catalog.data?.areas ?? []).filter((a) => a.governorate_id === f.governorateId);

  // ── Validation per step ─────────────────────────────────────────────
  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0 && !f.categoryId) e.category = t('post.chooseCategory');
    if (s === 1 && f.photos.length === 0) e.photos = t('post.minPhotos');
    if (s === 2) {
      if (f.title.trim().length < 3) e.title = t('post.titleTooShort');
      if (main?.has_condition && !f.condition) e.condition = t('post.fieldRequired', { field: t('post.condition') });
      fields.forEach((fd) => { if (fd.is_required && !f.attributes[fd.key]) e[`attr_${fd.key}`] = t('post.fieldRequired', { field: pick(fd.label_ar, fd.label_en) }); });
    }
    if (s === 3) {
      if ((f.priceType === 'fixed' || f.priceType === 'negotiable') && !(Number(f.price) > 0)) e.price = t('post.priceRequired');
      if (!f.governorateId) e.governorate = t('post.fieldRequired', { field: t('post.governorate') });
      if (!f.allowCall && !f.allowWhatsapp && !f.allowChat) e.contact = t('post.contactRequired');
      if ((f.allowCall || f.allowWhatsapp) && !isValidKwPhone(phone)) e.phone = t('post.phoneRequired');
    }
    setErrors(e);
    if (Object.keys(e).length) { haptic.error(); return false; }
    return true;
  }
  const go = (n: number) => { setStep(n); scroll.current?.scrollTo({ y: 0, animated: false }); };
  const next = () => { if (validate(step)) go(step + 1); };

  // ── Photos ──────────────────────────────────────────────────────────
  const addPhotos = async (camera: boolean) => {
    const room = maxImages - f.photos.length;
    if (room <= 0) return toast.show(t('errors.too_many_images'), 'error');
    const res = camera ? await takePhoto() : await pickImages(room);
    if (res === 'denied') return toast.show(t(camera ? 'errors.permission_camera' : 'errors.permission_photos'), 'error');
    if (!res) return;
    const list = (Array.isArray(res) ? res : [res]).slice(0, room).map((p) => ({ ...p, key: nextKey() }));
    set({ photos: [...f.photos, ...list] });
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= f.photos.length) return;
    const arr = [...f.photos]; [arr[i], arr[j]] = [arr[j], arr[i]]; set({ photos: arr }); haptic.light();
  };
  const makeCover = (i: number) => { const arr = [...f.photos]; const [p] = arr.splice(i, 1); set({ photos: [p, ...arr] }); haptic.light(); };
  const removePhoto = (i: number) => {
    const p = f.photos[i];
    if (p.imageId && p.remotePath) removedImages.current.push({ id: p.imageId, path: p.remotePath });
    set({ photos: f.photos.filter((_, k) => k !== i) });
  };

  // ── Publish / save ──────────────────────────────────────────────────
  const payload = () => ({
    category_id: f.categoryId!, title: f.title.trim(), description: f.description.trim(),
    price: f.priceType === 'fixed' || f.priceType === 'negotiable' ? Number(f.price) : null, price_type: f.priceType,
    condition: main?.has_condition ? f.condition : null, governorate_id: f.governorateId!, area_id: f.areaId,
    lat: f.lat, lng: f.lng, attributes: f.attributes, contact_phone: phone ? normalizePhone(phone) : null,
    allow_call: f.allowCall, allow_whatsapp: f.allowWhatsapp, allow_chat: f.allowChat,
  });

  async function publish() {
    if (![0, 1, 2, 3].every((s) => validate(s))) return;
    setBusy(t('post.publishing'));
    try {
      let adId = createdId.current;
      let status: string | undefined;
      if (adId === null) {
        const { data, error } = await supabase.from('ads').insert(payload()).select('id,status').single();
        if (error) throw error;
        adId = data.id as number; status = data.status as string; createdId.current = adId;
      } else {
        const { data, error } = await supabase.from('ads').update(payload()).eq('id', adId).select('id,status').single();
        if (error) throw error;
        status = data.status as string;
      }
      // Removed images
      for (const r of removedImages.current) {
        await supabase.from('ad_images').delete().eq('id', r.id);
        await supabase.storage.from('ad-images').remove([r.path]);
      }
      removedImages.current = [];
      // Upload new images (sequential, resumable on retry) and persist order
      const photos = [...f.photos];
      const toUpload = photos.filter((p) => !p.remotePath).length;
      let done = 0;
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (!p.remotePath) {
          setBusy(t('post.uploading', { done: done + 1, total: toUpload }));
          const path = await uploadImage('ad-images', `${userId}/${adId}`, p);
          const { data, error } = await supabase.from('ad_images').insert({ ad_id: adId, path, sort: i, width: p.width || null, height: p.height || null }).select('id').single();
          if (error) throw error;
          const saved: Photo = { ...p, remotePath: path, imageId: data.id as number };
          photos.splice(i, 1, saved);
          setF((prev) => ({ ...prev, photos: prev.photos.map((x) => (x.key === p.key ? saved : x)) }));
          done++;
        } else if (p.imageId) {
          await supabase.from('ad_images').update({ sort: i }).eq('id', p.imageId);
        }
      }
      if (!settings.data?.phone && phone && userId) updateMySettings(userId, { phone: normalizePhone(phone) }).catch(() => {});
      if (!existing) await AsyncStorage.removeItem(DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['my-ads'] });
      qc.invalidateQueries({ queryKey: ['ad', adId] });
      haptic.success();
      toast.show(existing ? t('post.saved') : status === 'pending' ? t('post.submittedForReview') : t('post.published'), 'success');
      router.replace(`/ad/${adId}`);
    } catch (e) {
      const a = toAppError(e);
      toast.show(t(a.key, a.vars), 'error');
    } finally {
      setBusy(null);
    }
  }

  const close = () => (existing || (!f.title && !f.photos.length && !f.categoryId) ? router.back() : setDiscard(true));
  const progress = useAnimatedStyle(() => ({ width: withTiming(`${((step + 1) / STEPS.length) * 100}%`, { duration: 260 }) }));
  const thumb = (width - space.lg * 2 - space.md * 2) / 3;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header + filament progress */}
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: space.sm }}>
        <View style={{ height: 52, flexDirection: 'row', alignItems: 'center' }}>
          <IconButton name="close" label={t('common.close')} onPress={close} testID="post-close" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T v="h3">{existing ? t('post.editTitle') : t('post.title')}</T>
            <T v="caption" faint>{`${step + 1}/${STEPS.length} · ${t(`post.${STEPS[step]}`)}`}</T>
          </View>
          <View style={{ width: 42 }} />
        </View>
        <View style={{ height: 3, backgroundColor: c.line, borderRadius: 2, marginHorizontal: space.sm, marginBottom: space.sm, overflow: 'hidden' }}>
          <Animated.View style={[{ height: 3, backgroundColor: c.accent, borderRadius: 2 }, progress]} />
        </View>
      </View>

      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingBottom: 140, gap: space.xl }}>
        {step === 0 && (
          <View style={{ gap: space.lg }}>
            <T v="h2">{mainPick ? t('post.chooseSub') : t('post.chooseCategory')}</T>
            {mainPick && (
              <Press onPress={() => setMainPick(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="button">
                <Icon name="back" size={18} color={c.primary} spark={false} />
                <T color={c.primary} style={{ fontFamily: font.medium }}>{catalog.catName(mainPick)}</T>
              </Press>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {(mainPick ? catalog.subsOf(mainPick) : catalog.mains).map((x) => {
                const selected = f.categoryId === x.id;
                return (
                  <Press key={x.id} testID={`pick-${x.slug}`} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => {
                      if (!mainPick && catalog.subsOf(x.id).length) { setMainPick(x.id); return; }
                      set({ categoryId: x.id, attributes: {}, condition: x.has_condition ? f.condition : null }); setErrors({}); go(1);
                    }}
                    style={{ width: (width - space.lg * 2 - space.md) / 2, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg,
                      backgroundColor: selected ? c.primarySoft : c.surface, borderWidth: 1.5, borderColor: selected ? c.primary : 'transparent' }}>
                    <Icon name={x.icon} size={24} color={c.primary} />
                    <T v="bodyStrong" numberOfLines={2} style={{ flex: 1, fontSize: 14 }}>{pick(x.name_ar, x.name_en)}</T>
                  </Press>
                );
              })}
            </View>
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: space.lg }}>
            <T muted>{t('post.photosHint', { max: maxImages })}</T>
            {errors.photos && <T v="small" color={c.danger}>{errors.photos}</T>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {f.photos.map((p, i) => (
                <View key={p.key} style={{ width: thumb, height: thumb, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface, borderWidth: i === 0 ? 2 : 0, borderColor: c.accent }}>
                  <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  {i === 0 && <View style={{ position: 'absolute', top: 6, start: 6 }}><Badge label={t('post.cover')} tone="accent" /></View>}
                  <Pressable onPress={() => removePhoto(i)} hitSlop={6} accessibilityLabel={t('common.delete')} testID={`remove-photo-${i}`}
                    style={{ position: 'absolute', top: 6, end: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(14,15,19,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={14} color="#FFF" spark={false} strokeWidth={2.4} />
                  </Pressable>
                  <View style={{ position: 'absolute', bottom: 0, start: 0, end: 0, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(14,15,19,0.55)' }}>
                    <Pressable onPress={() => move(i, -1)} hitSlop={4} accessibilityLabel="‹" style={{ padding: 6 }}><Icon name="back" size={16} color="#FFF" spark={false} /></Pressable>
                    {i !== 0 && <Pressable onPress={() => makeCover(i)} accessibilityLabel={t('post.makeCover')} style={{ padding: 6 }}><Icon name="star" size={16} color="#FFF" spark={false} /></Pressable>}
                    <Pressable onPress={() => move(i, 1)} hitSlop={4} accessibilityLabel="›" style={{ padding: 6 }}><Icon name="forward" size={16} color="#FFF" spark={false} /></Pressable>
                  </View>
                </View>
              ))}
              {f.photos.length < maxImages && (
                <>
                  <AddTile size={thumb} icon="image" label={t('post.fromLibrary')} onPress={() => addPhotos(false)} testID="add-photos" />
                  {Platform.OS !== 'web' && <AddTile size={thumb} icon="camera" label={t('post.takePhoto')} onPress={() => addPhotos(true)} />}
                </>
              )}
            </View>
            <T v="caption" faint center>{`${f.photos.length}/${maxImages}`}</T>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: space.lg }}>
            <Input testID="ad-title-input" label={t('post.adTitle')} placeholder={t('post.adTitlePh')} value={f.title} onChangeText={(v) => set({ title: v })} maxLength={90} error={errors.title} hint={`${f.title.length}/90`} />
            {main?.has_condition && (
              <View style={{ gap: space.sm }}>
                <T v="small" muted style={{ fontFamily: font.medium }}>{t('post.condition')}</T>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label={t('ad.new')} active={f.condition === 'new'} onPress={() => set({ condition: 'new' })} testID="cond-new" />
                  <Chip label={t('ad.used')} active={f.condition === 'used'} onPress={() => set({ condition: 'used' })} testID="cond-used" />
                </View>
                {errors.condition && <T v="small" color={c.danger}>{errors.condition}</T>}
              </View>
            )}
            {fields.map((fd) => {
              const label = pick(fd.label_ar, fd.label_en) + (fd.is_required ? ' *' : '');
              const err = errors[`attr_${fd.key}`];
              if (fd.type === 'select') {
                return (
                  <View key={fd.id} style={{ gap: space.sm }}>
                    <T v="small" muted style={{ fontFamily: font.medium }}>{label}</T>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                      {fd.options.map((o) => <Chip key={o.v} testID={`opt-${fd.key}-${o.v}`} label={pick(o.ar, o.en)} active={f.attributes[fd.key] === o.v}
                        onPress={() => set({ attributes: { ...f.attributes, [fd.key]: f.attributes[fd.key] === o.v ? '' : o.v } })} />)}
                    </ScrollView>
                    {err && <T v="small" color={c.danger}>{err}</T>}
                  </View>
                );
              }
              const unit = pick(fd.unit_ar, fd.unit_en);
              return (
                <Input key={fd.id} testID={`field-${fd.key}`} label={label} value={f.attributes[fd.key] ?? ''} error={err}
                  keyboardType={fd.type === 'text' ? 'default' : 'number-pad'} maxLength={fd.type === 'year' ? 4 : 60}
                  right={unit ? <T v="small" faint>{unit}</T> : undefined}
                  onChangeText={(v) => set({ attributes: { ...f.attributes, [fd.key]: fd.type === 'text' ? v : normalizePhone(v).replace(/\+/g, '') } })} />
              );
            })}
            <Input testID="ad-description-input" label={t('post.description')} placeholder={t('post.descriptionPh')} value={f.description} onChangeText={(v) => set({ description: v })} multiline maxLength={4000} hint={`${f.description.length}/4000`} />
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: space.xl }}>
            <View style={{ gap: space.sm }}>
              <T v="small" muted style={{ fontFamily: font.medium }}>{t('post.priceType')}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {(['fixed', 'negotiable', 'contact', 'free'] as PriceType[]).map((p) => <Chip key={p} testID={`price-${p}`} label={t(`post.${p}`)} active={f.priceType === p} onPress={() => set({ priceType: p })} />)}
              </View>
            </View>
            {(f.priceType === 'fixed' || f.priceType === 'negotiable') && (
              <Input testID="price-input" label={t('post.price')} value={f.price} keyboardType="decimal-pad" error={errors.price}
                onChangeText={(v) => set({ price: normalizePhone(v).replace(/\+/g, '').replace(/^(\d*\.?\d{0,3}).*$/, '$1') })}
                right={<T v="small" faint>{t('common.kwd')}</T>} hint={f.price ? formatKwd(f.price, lang) : undefined} />
            )}
            <View style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T v="small" muted style={{ fontFamily: font.medium, flex: 1 }}>{t('post.governorate')}</T>
                <Pressable onPress={async () => {
                  const co = await currentCoords(true);
                  if (!co || !inKuwait(co)) return toast.show(t('errors.permission_location'), 'error');
                  const govs = catalog.data?.governorates ?? [];
                  const near = [...govs].sort((a, b) => Math.hypot(a.lat - co.lat, a.lng - co.lng) - Math.hypot(b.lat - co.lat, b.lng - co.lng))[0];
                  set({ lat: co.lat, lng: co.lng, governorateId: near?.id ?? f.governorateId, areaId: near?.id === f.governorateId ? f.areaId : null });
                }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="location" size={16} color={f.lat ? c.success : c.primary} spark={false} />
                  <T v="small" color={f.lat ? c.success : c.primary} style={{ fontFamily: font.medium }}>{t('post.useMyLocation')}</T>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {(catalog.data?.governorates ?? []).map((g) => <Chip key={g.id} testID={`gov-${g.slug}`} label={pick(g.name_ar, g.name_en)} active={f.governorateId === g.id} onPress={() => set({ governorateId: g.id, areaId: null })} />)}
              </View>
              {errors.governorate && <T v="small" color={c.danger}>{errors.governorate}</T>}
            </View>
            {f.governorateId && (
              <View style={{ gap: space.sm }}>
                <T v="small" muted style={{ fontFamily: font.medium }}>{t('post.area')} ({t('common.optional')})</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {areas.map((a) => <Chip key={a.id} label={pick(a.name_ar, a.name_en)} active={f.areaId === a.id} onPress={() => set({ areaId: f.areaId === a.id ? null : a.id })} />)}
                </View>
              </View>
            )}
            <View style={{ gap: 2 }}>
              <Input testID="phone-input" label={t('post.phone')} placeholder={t('post.phonePh')} value={phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" error={errors.phone} icon="phone" />
              <Switch label={t('post.allowCall')} value={f.allowCall} onValueChange={(v) => set({ allowCall: v })} />
              <Switch label={t('post.allowWhatsapp')} value={f.allowWhatsapp} onValueChange={(v) => set({ allowWhatsapp: v })} />
              <Switch label={t('post.allowChat')} value={f.allowChat} onValueChange={(v) => set({ allowChat: v })} />
              {errors.contact && <T v="small" color={c.danger}>{errors.contact}</T>}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: space.lg }}>
            <T v="h3">{t('post.preview')}</T>
            <View style={{ borderTopStartRadius: radius.crown, borderTopEndRadius: radius.crown, borderBottomEndRadius: radius.lg, borderBottomStartRadius: radius.socket, overflow: 'hidden', borderWidth: 1, borderColor: c.line }}>
              {f.photos[0] && <Image source={{ uri: f.photos[0].uri }} style={{ width: '100%', aspectRatio: 1.25 }} contentFit="cover" />}
              <View style={{ padding: space.lg, gap: space.sm }}>
                <Text style={{ fontFamily: font.bold, fontSize: 24, color: c.primary }}>
                  {f.priceType === 'contact' ? t('ad.contactForPrice') : f.priceType === 'free' ? t('ad.free') : formatKwd(f.price, lang)}
                </Text>
                <T v="h3">{f.title}</T>
                <T v="small" muted>{[catalog.catName(f.categoryId), catalog.placeName(f.governorateId, f.areaId), f.condition ? t(`ad.${f.condition}`) : ''].filter(Boolean).join(' · ')}</T>
                {!!f.description && <T numberOfLines={6}>{f.description}</T>}
                <T v="caption" faint>{t('ad.photos', { n: f.photos.length })}</T>
              </View>
            </View>
            <T v="small" faint center>{t('post.agree')}</T>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={{ position: 'absolute', bottom: 0, start: 0, end: 0, flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: insets.bottom + space.md, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
        {step > 0 && <Button title={t('common.back')} kind="secondary" style={{ flex: 1 }} onPress={() => go(step - 1)} disabled={!!busy} />}
        {step < 4 ? (step > 0 && <Button title={t('common.next')} style={{ flex: 2 }} onPress={next} testID="post-next" />)
          : <Button title={busy ?? (existing ? t('post.saveChanges') : t('post.publish'))} kind="primary" style={{ flex: 2 }} onPress={publish} loading={!!busy && !busy.includes('/')} disabled={!!busy} testID="post-publish" />}
      </View>
      <Confirm visible={discard} title={t('post.discardTitle')} body={t('post.discardBody')} confirm={t('post.discard')} danger onClose={() => setDiscard(false)}
        onConfirm={() => { AsyncStorage.removeItem(DRAFT_KEY); setDiscard(false); router.back(); }} />
    </KeyboardAvoidingView>
  );
}

function AddTile({ size, icon, label, onPress, testID }: { size: number; icon: 'image' | 'camera'; label: string; onPress: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Press onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.primary, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.primarySoft }}>
      <Icon name={icon} size={26} color={c.primary} spark={false} />
      <T v="caption" color={c.primary} center>{label}</T>
    </Press>
  );
}
