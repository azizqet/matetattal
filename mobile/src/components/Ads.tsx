// الإعلانات: بطاقة العرض ونموذج الإضافة/التعديل.
// الحالة لا تُرسل من التطبيق أبداً: الخادم يجعل كل إعلان جديد أو معدّل «بانتظار الموافقة».
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as api from '@/lib/api';
import { useAreas, useServices } from '@/lib/queries';
import { colors, fonts } from '@/lib/theme';
import type { Ad, AdInput } from '@/lib/types';
import { AD_STATUS_AR, arabicError, formatKwd, isKuwaitPhone, localPhone } from '@/lib/utils';
import { Badge, Button, Card, Chip, Field, Icon, PhoneField, Row, Text, useToast } from './ui';

export const adTone = (s: string) => (s === 'approved' ? 'green' : s === 'pending' ? 'yellow' : s === 'rejected' ? 'red' : 'gray') as 'green';

export function AdCard({ ad, serviceName, showStatus, onPress }: { ad: Ad; serviceName?: string; showStatus?: boolean; onPress?: () => void }) {
  return (
    <Card style={{ marginBottom: 10 }} onPress={onPress ?? (() => router.push(`/ad/${ad.id}`))} testID={`ad-${ad.id}`}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        {ad.images[0] ? (
          <Image source={{ uri: ad.images[0] }} style={{ width: 76, height: 76, borderRadius: 12, backgroundColor: colors.primarySoft }} contentFit="cover" />
        ) : (
          <View style={{ width: 76, height: 76, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bullhorn-outline" size={28} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={2}>{ad.title}</Text>
          <Text variant="small" numberOfLines={1}>{[serviceName, ad.area_name].filter(Boolean).join(' · ')}</Text>
          {ad.price != null ? <Text style={{ color: colors.primary, fontFamily: fonts.bold, marginTop: 2 }}>{formatKwd(ad.price)}</Text> : null}
          {showStatus ? <View style={{ marginTop: 6 }}><Badge label={AD_STATUS_AR[ad.status]} tone={adTone(ad.status)} /></View> : null}
        </View>
      </Row>
      {showStatus && ad.status === 'rejected' && ad.reject_reason ? (
        <Text variant="small" style={{ color: colors.danger, marginTop: 8 }}>سبب الرفض: {ad.reject_reason}</Text>
      ) : null}
    </Card>
  );
}

const MAX_IMAGES = 6;

/** نموذج الإعلان (إضافة أو تعديل). عند التعديل يعود الإعلان للمراجعة إذا تغيّرت بياناته. */
export function AdForm({ uid, ad, defaultPhone, onSaved }: { uid: string; ad?: Ad; defaultPhone?: string | null; onSaved: (a?: Ad) => void }) {
  const services = useServices();
  const areas = useAreas();
  const toast = useToast();
  const [title, setTitle] = useState(ad?.title ?? '');
  const [svc, setSvc] = useState<string | null>(ad?.service_id ?? null);
  const [desc, setDesc] = useState(ad?.description ?? '');
  const [area, setArea] = useState<string | null>(ad?.area_name ?? null);
  const [phone, setPhone] = useState(localPhone(ad?.phone ?? defaultPhone));
  const [price, setPrice] = useState(ad?.price != null ? String(ad.price) : '');
  const [images, setImages] = useState<{ uri: string; mime?: string; remote: boolean }[]>((ad?.images ?? []).map((u) => ({ uri: u, remote: true })));
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  async function pick() {
    if (images.length >= MAX_IMAGES) return toast(`الحد ${MAX_IMAGES} صور`);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_IMAGES - images.length });
    if (r.canceled) return;
    const ok = r.assets.filter((a) => (a.fileSize ?? 0) <= 5 * 1024 * 1024);
    if (ok.length < r.assets.length) toast('تم تجاهل صور أكبر من 5 ميجا');
    setImages([...images, ...ok.map((a) => ({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', remote: false }))].slice(0, MAX_IMAGES));
  }

  async function save() {
    if (title.trim().length < 3) return toast('اكتب عنواناً للإعلان (3 أحرف على الأقل)');
    if (!svc) return toast('اختر نوع الخدمة');
    if (desc.trim().length < 10) return toast('اكتب وصفاً للإعلان (10 أحرف على الأقل)');
    if (!area) return toast('اختر المنطقة');
    if (!isKuwaitPhone(phone)) return toast('اكتب رقم تواصل كويتي صحيح (8 أرقام)');
    const priceNum = price.trim() ? Number(price) : null;
    if (priceNum != null && (!isFinite(priceNum) || priceNum < 0)) return toast('السعر غير صحيح');
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const im of images) urls.push(im.remote ? im.uri : await api.uploadAdImage(uid, im.uri, im.mime));
      const body: AdInput = { title: title.trim(), service_id: svc, description: desc.trim(), area_name: area, phone: localPhone(phone), price: priceNum, images: urls };
      if (ad) { await api.updateAd(ad.id, body); onSaved(); }
      else onSaved(await api.createAd(body));
    } catch (e) {
      toast(arabicError(e));
    } finally { sending.current = false; setBusy(false); }
  }

  return (
    <>
      <Field label="عنوان الإعلان" value={title} onChangeText={setTitle} maxLength={80} placeholder="مثال: سطحة متوفرة 24 ساعة في حولي" testID="ad-title" />
      <Text variant="label" style={{ marginTop: 12 }}>نوع الخدمة</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(services.data ?? []).map((s) => <Chip key={s.id} label={s.name_ar} active={svc === s.id} onPress={() => setSvc(s.id)} />)}</Row>
      <Field label="وصف الإعلان" value={desc} onChangeText={setDesc} multiline maxLength={1500} placeholder="اكتب التفاصيل: الخدمة، الأوقات، أي معلومات مهمة" testID="ad-desc" />

      <Text variant="label" style={{ marginTop: 12 }}>الصور (حتى {MAX_IMAGES})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {images.map((im, i) => (
          <View key={im.uri}>
            <Image source={{ uri: im.uri }} style={{ width: 84, height: 84, borderRadius: 12 }} contentFit="cover" />
            <Pressable onPress={() => setImages(images.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="حذف الصورة"
              style={{ position: 'absolute', top: 4, end: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 2 }}>
              <Icon name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ))}
        {images.length < MAX_IMAGES ? (
          <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="إضافة صور"
            style={{ width: 84, height: 84, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }}>
            <Icon name="image-plus" />
          </Pressable>
        ) : null}
      </ScrollView>

      <Text variant="label" style={{ marginTop: 12 }}>المنطقة</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(areas.data ?? []).map((a) => <Chip key={a.id} label={a.name_ar} active={area === a.name_ar} onPress={() => setArea(a.name_ar)} />)}</Row>
      <PhoneField label="رقم التواصل" value={phone} onChangeText={setPhone} testID="ad-phone" />
      <Field label="السعر بالدينار (اختياري)" value={price} onChangeText={(v) => setPrice(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" testID="ad-price"
        style={{ writingDirection: 'ltr', textAlign: 'left', color: colors.inputText }} />

      <Card style={{ marginTop: 14, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Text variant="small" style={{ color: colors.heading }}>
          {ad ? 'تعديل بيانات الإعلان يعيده للمراجعة، ولا يظهر التعديل للجمهور قبل موافقة الإدارة.' : 'يُراجع الإعلان من إدارة ماتعطل قبل نشره، ويصلك إشعار عند القبول أو الرفض.'}
        </Text>
      </Card>
      <Button title={ad ? 'حفظ وإرسال للمراجعة' : 'إرسال الإعلان للمراجعة'} icon="send" loading={busy} onPress={save} style={{ marginTop: 14 }} testID="ad-submit" />
    </>
  );
}
