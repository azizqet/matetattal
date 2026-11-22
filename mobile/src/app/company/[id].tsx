import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView } from 'react-native';
import { contact, Logo } from '@/components/CompanyCard';
import { VehicleStatusList } from '@/components/Vehicles';
import { Badge, Button, Card, Empty, Field, Icon, Loading, Row, SectionTitle, Stars, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useServiceNames } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import { arabicError, companyAreas, distanceKm, formatKm, isKuwaitMobile, localPhone, mapsUrl } from '@/lib/utils';

export default function CompanyScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { session, profile, coords, area } = useSession();
  const names = useServiceNames();
  const toast = useToast();
  const qc = useQueryClient();
  const company = useQuery({ queryKey: ['company', id], queryFn: () => api.getCompany(id), enabled: Number.isFinite(id) });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => api.getReviews(id), enabled: Number.isFinite(id) });
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.getFavorites, enabled: !!session });
  const [showReq, setShowReq] = useState(false);
  const [note, setNote] = useState('');
  // null = لم يعدّل المستخدم الحقل بعد، فنعرض القيمة المحفوظة (رقمه أو تقييمه السابق)
  const [phoneInput, setPhone] = useState<string | null>(null);
  const [ratingInput, setRating] = useState<number | null>(null);
  const [commentInput, setComment] = useState<string | null>(null);

  useEffect(() => { if (Number.isFinite(id)) api.trackCompany(id, 'view').catch(() => {}); }, [id]);
  const mine = reviews.data?.find((r) => r.user_id === session?.user.id);
  const phone = phoneInput ?? profile?.phone ?? '';
  const rating = ratingInput ?? mine?.rating ?? 0;
  const comment = commentInput ?? mine?.comment ?? '';

  const isFav = !!favs.data?.includes(id);
  const fav = useMutation({
    mutationFn: () => api.toggleFavorite(id, !isFav),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['favorites'] }); toast(isFav ? 'أزيلت من المفضلة' : 'أضيفت للمفضلة'); },
    onError: (e) => toast(arabicError(e)),
  });
  const req = useMutation({
    mutationFn: () => api.createServiceRequest({
      company_id: id, service_id: company.data?.service_id ?? null, phone: localPhone(phone), note: note.trim() || undefined,
      area_name: area, lat: coords?.lat ?? null, lng: coords?.lng ?? null,
    }),
    onSuccess: () => { setShowReq(false); setNote(''); qc.invalidateQueries({ queryKey: ['my-requests'] }); toast('تم إرسال طلبك للشركة. تابعه من «طلباتي»'); },
    onError: (e) => toast(arabicError(e)),
  });
  const rev = useMutation({
    mutationFn: () => api.upsertReview(id, rating, comment.trim(), mine?.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reviews', id] }); qc.invalidateQueries({ queryKey: ['company', id] }); toast('شكراً لتقييمك'); },
    onError: (e) => toast(arabicError(e)),
  });

  if (company.isLoading) return <Loading />;
  const c = company.data;
  if (!c) return <Empty icon="store-off-outline" title="الشركة غير متاحة" subtitle="قد يكون اشتراكها منتهياً" action={<Button title="رجوع" onPress={() => router.back()} />} />;

  const areas = companyAreas(c);
  const dist = coords && c.lat != null && c.lng != null ? distanceKm(coords, { lat: c.lat, lng: c.lng }) : null;
  const locMsg = coords ? `السلام عليكم، أحتاج خدمة عن طريق تطبيق ماتعطل. موقعي: ${mapsUrl(coords.lat, coords.lng)}` : undefined;
  const needLogin = () => { toast('سجّل دخولك أولاً'); router.push('/auth'); };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: c.name, headerRight: () => (
        <Pressable onPress={() => (session ? fav.mutate() : needLogin())} hitSlop={10} accessibilityLabel="المفضلة">
          <Icon name={isFav ? 'heart' : 'heart-outline'} color="#fff" />
        </Pressable>
      ) }} />
      {c.cover_url ? <Image source={{ uri: c.cover_url }} style={{ height: 150, borderRadius: 20, marginBottom: 12 }} contentFit="cover" /> : null}
      <Card style={{ alignItems: 'center' }}>
        <Logo c={c} size={88} />
        <Text variant="h1" style={{ textAlign: 'center', marginTop: 10, fontSize: 22 }}>{c.name}</Text>
        <Text variant="muted">{names[c.service_id ?? '']}</Text>
        <Row style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Number(c.rating) > 0 ? <Row gap={4}><Stars value={Number(c.rating)} /><Text variant="small">{Number(c.rating).toFixed(1)} ({c.rating_count})</Text></Row> : <Badge label="جديد" />}
          {c.is_24h ? <Badge label="متاح 24 ساعة" tone="green" /> : null}
          {!c.is_available ? <Badge label="غير متاح الآن" tone="red" /> : null}
          {dist != null ? <Badge label={'يبعد ' + formatKm(dist)} tone="gray" /> : null}
          {c.is_sample ? <Badge label="بيانات تجريبية" tone="yellow" /> : null}
        </Row>
        <Row style={{ marginTop: 14, alignSelf: 'stretch' }}>
          <Button title="اتصال" icon="phone" style={{ flex: 1 }} onPress={() => contact(c, 'call')} testID="call-btn" />
          <Button title="واتساب" icon="whatsapp" kind="whatsapp" style={{ flex: 1 }} onPress={() => contact(c, 'wa', locMsg)} testID="wa-btn" />
        </Row>
        <Button title="اطلب الخدمة عبر التطبيق" icon="clipboard-plus-outline" kind="soft" style={{ alignSelf: 'stretch', marginTop: 8 }}
          onPress={() => (session ? setShowReq(!showReq) : needLogin())} />
      </Card>

      {showReq ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="title">طلب خدمة</Text>
          <Text variant="small">{coords ? 'سيتم إرسال موقعك الحالي مع الطلب.' : 'حدد موقعك من الرئيسية لإرساله مع الطلب.'}</Text>
          <Field label="رقم جوالك" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9xxxxxxx" />
          <Field label="وصف المشكلة (اختياري)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="مثال: بنشر بالتاير الأمامي، السيارة بالدائري الخامس" />
          <Button title="أرسل الطلب" icon="send" style={{ marginTop: 12 }} loading={req.isPending}
            onPress={() => (isKuwaitMobile(phone) ? req.mutate() : toast('اكتب رقم جوال كويتي صحيح (8 أرقام)'))} />
        </Card>
      ) : null}

      <VehicleStatusList companyId={c.id} initial={c.company_vehicles} />

      {c.description ? (<><SectionTitle title="عن الشركة" /><Card><Text>{c.description}</Text></Card></>) : null}

      <SectionTitle title="الخدمات والأسعار" />
      <Card>
        {c.company_services?.length ? c.company_services.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Text style={{ flex: 1 }}>{s.title}</Text>
            <Text style={{ fontFamily: fonts.bold, color: colors.primary }}>{s.price_from != null ? `من ${s.price_from} د.ك` : s.price_note ?? ''}</Text>
          </Row>
        )) : null}
        <Text variant="muted" style={{ marginTop: c.company_services?.length ? 8 : 0 }}>{c.price_text || 'اتصل لمعرفة السعر'}</Text>
        <Text variant="small" style={{ marginTop: 6 }}>الدفع يكون مباشرة بينك وبين الشركة.</Text>
      </Card>

      {areas.length ? (<><SectionTitle title="مناطق الخدمة" /><Row style={{ flexWrap: 'wrap' }}>{areas.map((a) => <Badge key={a} label={a} />)}</Row></>) : null}

      {c.lat != null && c.lng != null ? (
        <Button title={c.address ? 'الموقع: ' + c.address : 'عرض الموقع على الخريطة'} icon="map-marker-outline" kind="soft" style={{ marginTop: 14 }}
          onPress={() => Linking.openURL(mapsUrl(c.lat!, c.lng!))} />
      ) : null}

      {c.photos?.length ? (
        <>
          <SectionTitle title="الصور" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {c.photos.map((p) => <Image key={p} source={{ uri: p }} style={{ width: 160, height: 120, borderRadius: 14, marginEnd: 8 }} contentFit="cover" />)}
          </ScrollView>
        </>
      ) : null}

      <SectionTitle title={`التقييمات (${reviews.data?.length ?? 0})`} />
      {session && session.user.id !== c.owner_id ? (
        <Card style={{ marginBottom: 10 }}>
          <Text variant="title">{mine ? 'عدّل تقييمك' : 'قيّم الخدمة'}</Text>
          <Row gap={4} style={{ marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} accessibilityLabel={`${i} نجوم`}>
                <Icon name={rating >= i ? 'star' : 'star-outline'} size={32} color={colors.accent} />
              </Pressable>
            ))}
          </Row>
          <Field label="تعليقك (اختياري)" value={comment} onChangeText={setComment} maxLength={500} multiline />
          <Button title="حفظ التقييم" small style={{ marginTop: 10 }} disabled={!rating} loading={rev.isPending} onPress={() => rev.mutate()} />
        </Card>
      ) : null}
      {reviews.data?.length ? reviews.data.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}><Stars value={r.rating} /><Text variant="small">{r.created_at.slice(0, 10)}</Text></Row>
          {r.comment ? <Text style={{ marginTop: 6 }}>{r.comment}</Text> : null}
        </Card>
      )) : <Text variant="muted">لا توجد تقييمات بعد.</Text>}

      <Button title="الإبلاغ عن مشكلة مع هذه الشركة" kind="ghost" small icon="flag-outline" style={{ marginTop: 16 }}
        onPress={() => (session ? router.push({ pathname: '/complaint', params: { company: String(c.id) } }) : needLogin())} />
    </ScrollView>
  );
}
