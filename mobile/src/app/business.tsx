import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Logo } from '@/components/CompanyCard';
import { Badge, Button, Card, Chip, Empty, Field, Loading, Row, Screen, SectionTitle, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useAreas, useServices, useSettings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import type { Company, ServiceRequest } from '@/lib/types';
import {
  arabicError, COMPANY_STATUS_AR, daysLeft, formatKwd, intlPhone, isKuwaitPhone, isVisible, REQUEST_STATUS_AR, SUB_STATUS_AR, telUrl, whatsappUrl, mapsUrl,
} from '@/lib/utils';

export default function Business() {
  const { session, coords } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const mine = useQuery({ queryKey: ['my-companies'], queryFn: () => api.getMyCompanies(session!.user.id), enabled: !!session });

  if (!session) return <Empty icon="store-outline" title="سجّل دخولك لإدارة شركتك" action={<Button title="تسجيل الدخول" onPress={() => router.push({ pathname: '/auth', params: { mode: 'register', type: 'company' } })} />} />;
  if (mine.isLoading) return <Loading />;
  const company = mine.data?.[0];
  return (
    <Screen edges={['bottom']}>
      {company ? <Dashboard c={company} /> : (
        <>
          <Text variant="h1">سجّل شركتك</Text>
          <Text variant="muted">املأ بيانات شركتك، وبعد المراجعة وتفعيل الاشتراك تظهر للعملاء.</Text>
          <CompanyForm uid={session.user.id} coords={coords}
            onSaved={() => { qc.invalidateQueries({ queryKey: ['my-companies'] }); toast('تم إنشاء شركتك. اختر خطة الاشتراك لتفعيلها'); }} />
        </>
      )}
    </Screen>
  );
}

function Dashboard({ c }: { c: Company }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const { session, coords } = useSession();
  const visible = isVisible(c);
  const requests = useQuery({ queryKey: ['company-requests', c.id], queryFn: () => api.getCompanyRequests([c.id]), refetchInterval: 30_000 });
  const setStatus = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) => api.setRequestStatus(id, s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-requests', c.id] }); toast('تم تحديث الطلب'); },
    onError: (e) => toast(arabicError(e)),
  });
  const toggleAvail = useMutation({
    mutationFn: () => api.updateCompany(c.id, { is_available: !c.is_available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-companies'] }),
    onError: (e) => toast(arabicError(e)),
  });

  return (
    <>
      <Card>
        <Row gap={12}>
          <Logo c={c} size={60} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{c.name}</Text>
            <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <Badge label={COMPANY_STATUS_AR[c.status]} tone={c.status === 'approved' ? 'green' : c.status === 'pending' ? 'yellow' : 'red'} />
              <Badge label={visible ? 'ظاهرة للعملاء' : 'غير ظاهرة'} tone={visible ? 'blue' : 'gray'} />
            </Row>
          </View>
        </Row>
        {visible ? <Text variant="small" style={{ marginTop: 8 }}>الاشتراك ينتهي {c.sub_end} (باقي {daysLeft(c.sub_end)} يوم)</Text> : null}
        <Row style={{ marginTop: 12 }}>
          <Stat n={c.visits ?? 0} l="زيارة" /><Stat n={c.calls ?? 0} l="اتصال" /><Stat n={c.wa_taps ?? 0} l="واتساب" /><Stat n={c.rating_count} l="تقييم" />
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Button small title={c.is_available ? 'متاح الآن ✓' : 'غير متاح'} kind={c.is_available ? 'soft' : 'danger'} style={{ flex: 1 }} loading={toggleAvail.isPending} onPress={() => toggleAvail.mutate()} />
          <Button small title={editing ? 'إغلاق التعديل' : 'تعديل البيانات'} icon="pencil" style={{ flex: 1 }} onPress={() => setEditing(!editing)} />
        </Row>
        {visible ? <Button small kind="ghost" title="معاينة صفحتي كما يراها العميل" onPress={() => router.push(`/company/${c.id}`)} /> : null}
      </Card>

      {editing ? <CompanyForm uid={session!.user.id} coords={coords} company={c} onSaved={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['my-companies'] }); toast('تم حفظ التعديلات'); }} /> : null}

      <SubscriptionBox c={c} />
      <PriceList c={c} />

      <SectionTitle title={`طلبات العملاء (${requests.data?.filter((r) => ['new', 'accepted', 'on_way'].includes(r.status)).length ?? 0} مفتوح)`} />
      {requests.data?.length ? requests.data.map((r: ServiceRequest) => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title">طلب #{r.id}</Text><Badge label={REQUEST_STATUS_AR[r.status]} tone={r.status === 'new' ? 'yellow' : r.status === 'done' ? 'green' : 'blue'} />
          </Row>
          <Text variant="small">{new Date(r.created_at).toLocaleString('ar-KW')}{r.area_name ? ' · ' + r.area_name : ''}</Text>
          {r.note ? <Text style={{ marginTop: 6 }}>{r.note}</Text> : null}
          <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <Button small icon="phone" title="اتصال" onPress={() => Linking.openURL(telUrl(r.phone))} />
            <Button small icon="whatsapp" kind="whatsapp" title="واتساب" onPress={() => Linking.openURL(whatsappUrl(intlPhone(r.phone), `مرحباً، بخصوص طلبك رقم ${r.id} في ماتعطل`))} />
            {r.lat != null && r.lng != null ? <Button small kind="soft" icon="map-marker" title="الموقع" onPress={() => Linking.openURL(mapsUrl(r.lat!, r.lng!))} /> : null}
          </Row>
          <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {r.status === 'new' ? <><Button small title="قبول" onPress={() => setStatus.mutate({ id: r.id, s: 'accepted' })} /><Button small kind="danger" title="اعتذار" onPress={() => setStatus.mutate({ id: r.id, s: 'rejected' })} /></> : null}
            {r.status === 'accepted' ? <Button small title="في الطريق" onPress={() => setStatus.mutate({ id: r.id, s: 'on_way' })} /> : null}
            {['accepted', 'on_way'].includes(r.status) ? <Button small kind="soft" title="تم الإنجاز" onPress={() => setStatus.mutate({ id: r.id, s: 'done' })} /> : null}
          </Row>
        </Card>
      )) : <Text variant="muted">لا توجد طلبات بعد. العملاء يقدرون يتصلون بك مباشرة أيضاً.</Text>}
    </>
  );
}

const Stat = ({ n, l }: { n: number; l: string }) => (
  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 12, paddingVertical: 8 }}>
    <Text style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.primary }}>{n}</Text><Text variant="small">{l}</Text>
  </View>
);

function SubscriptionBox({ c }: { c: Company }) {
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.getPlans });
  const subs = useQuery({ queryKey: ['subs', c.id], queryFn: () => api.getCompanySubscriptions(c.id) });
  const settings = useSettings();
  const qc = useQueryClient();
  const toast = useToast();
  const [planInput, setPlan] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [price, setPrice] = useState<{ base: number; total: number; discount_percent: number } | null>(null);
  const active = (plans.data ?? []).filter((p) => p.is_active);
  const pending = subs.data?.find((s) => s.status === 'pending');
  const support = String(settings.data?.support_whatsapp ?? '96565755222');
  const plan = planInput ?? active[0]?.id ?? null;
  useEffect(() => {
    if (!plan) return;
    const t = setTimeout(() => api.quote(plan, code.trim()).then(setPrice).catch(() => setPrice(null)), 350);
    return () => clearTimeout(t);
  }, [plan, code]);

  const req = useMutation({
    mutationFn: () => api.requestSubscription(c.id, plan!, code.trim()),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['subs', c.id] });
      toast('تم إنشاء طلب الاشتراك. أكمل الدفع مع الإدارة لتفعيله');
      Linking.openURL(whatsappUrl(support, `السلام عليكم، أبي أفعّل اشتراك شركة ${c.name} (طلب رقم ${r.subscription_id}) بمبلغ ${formatKwd(r.amount_kwd)}`)).catch(() => {});
    },
    onError: (e) => toast(arabicError(e)),
  });

  return (
    <>
      <SectionTitle title="الاشتراك" />
      <Card>
        {pending ? (
          <View style={{ backgroundColor: colors.warningBg, borderRadius: 12, padding: 10, marginBottom: 10 }}>
            <Text style={{ color: colors.warningText, fontFamily: fonts.bold }}>طلب اشتراك بانتظار الدفع: {formatKwd(pending.amount_kwd)}</Text>
            <Text variant="small" style={{ color: colors.warningText }}>من {pending.starts_on} إلى {pending.ends_on}. تواصل مع الإدارة لإتمام الدفع، ويتفعّل اشتراكك فوراً بعد التأكيد.</Text>
            <Button small kind="whatsapp" icon="whatsapp" title="تواصل للدفع" style={{ marginTop: 8 }}
              onPress={() => Linking.openURL(whatsappUrl(support, `السلام عليكم، أبي أدفع اشتراك شركة ${c.name} (طلب رقم ${pending.id})`))} />
          </View>
        ) : null}
        <Text variant="label">اختر الخطة</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {active.map((p) => <Chip key={p.id} label={`${p.name_ar} · ${formatKwd(p.price_kwd)}`} active={plan === p.id} onPress={() => setPlan(p.id)} />)}
        </Row>
        <Field label="كود خصم (اختياري)" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="مثال: LAUNCH100" />
        {price ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <Text variant="muted">{price.discount_percent ? `خصم ${price.discount_percent}%` : 'المبلغ'}</Text>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 18, color: colors.primary }}>
              {price.discount_percent ? <Text variant="small" style={{ textDecorationLine: 'line-through' }}>{formatKwd(price.base)} </Text> : null}{formatKwd(price.total)}
            </Text>
          </Row>
        ) : null}
        <Button title={isVisible(c) ? 'تجديد الاشتراك' : 'اطلب تفعيل الاشتراك'} icon="credit-card-check-outline" style={{ marginTop: 12 }}
          disabled={!plan} loading={req.isPending} onPress={() => req.mutate()} />
        <Text variant="small" style={{ marginTop: 8 }}>الدفع حالياً يدوي عبر الإدارة. سيتم إضافة الدفع الإلكتروني (كي نت) قريباً.</Text>
        {subs.data?.filter((s) => s.status !== 'pending').slice(0, 5).map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <Text variant="small">{s.starts_on} ← {s.ends_on}</Text>
            <Text variant="small">{formatKwd(s.amount_kwd)} · {SUB_STATUS_AR[s.status]}</Text>
          </Row>
        ))}
      </Card>
    </>
  );
}

function PriceList({ c }: { c: Company }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-companies'] });
  const add = useMutation({
    mutationFn: () => api.addCompanyService({ company_id: c.id, service_id: c.service_id ?? 'other', title: title.trim(), price_from: price ? Number(price) : null, price_note: null }),
    onSuccess: () => { setTitle(''); setPrice(''); refresh(); },
    onError: (e) => toast(arabicError(e)),
  });
  const del = useMutation({ mutationFn: api.deleteCompanyService, onSuccess: refresh, onError: (e) => toast(arabicError(e)) });
  return (
    <>
      <SectionTitle title="قائمة الخدمات والأسعار" />
      <Card>
        {c.company_services?.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={{ flex: 1 }}>{s.title}</Text>
            <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>{s.price_from != null ? `من ${s.price_from} د.ك` : ''}</Text>
            <Button small kind="ghost" icon="delete-outline" title="" onPress={() => del.mutate(s.id)} />
          </Row>
        ))}
        <Row style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 2 }}><Field label="الخدمة" value={title} onChangeText={setTitle} maxLength={80} placeholder="مثال: سحب داخل المنطقة" /></View>
          <View style={{ flex: 1 }}><Field label="السعر (د.ك)" value={price} onChangeText={(v) => setPrice(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" /></View>
        </Row>
        <Button small title="إضافة" icon="plus" style={{ marginTop: 10 }} disabled={title.trim().length < 2} loading={add.isPending} onPress={() => add.mutate()} />
      </Card>
    </>
  );
}

function CompanyForm({ uid, company, coords, onSaved }: { uid: string; company?: Company; coords: { lat: number; lng: number } | null; onSaved: () => void }) {
  const services = useServices();
  const areas = useAreas();
  const toast = useToast();
  const [name, setName] = useState(company?.name ?? '');
  const [svc, setSvc] = useState(company?.service_id ?? 'tow');
  const [phone, setPhone] = useState(company?.phone ?? '');
  const [wa, setWa] = useState(company?.whatsapp ?? '');
  const [priceText, setPriceText] = useState(company?.price_text ?? '');
  const [desc, setDesc] = useState(company?.description ?? '');
  const [address, setAddress] = useState(company?.address ?? '');
  const [is24, setIs24] = useState(company?.is_24h ?? false);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(company?.lat != null && company?.lng != null ? { lat: company.lat, lng: company.lng } : null);
  const [areaIds, setAreaIds] = useState<number[]>(company?.company_areas?.map((a) => a.area_id) ?? []);
  const [logo, setLogo] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickLogo() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      if ((a.fileSize ?? 0) > 3 * 1024 * 1024) return toast('الصورة كبيرة. الحد 3 ميجا');
      setLogo({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg' });
    }
  }

  async function save() {
    if (name.trim().length < 2) return toast('اكتب اسم الشركة');
    if (!isKuwaitPhone(phone)) return toast('رقم الهاتف غير صحيح');
    if (wa && !isKuwaitPhone(wa)) return toast('رقم الواتساب غير صحيح');
    if (!areaIds.length) return toast('اختر منطقة خدمة واحدة على الأقل');
    setBusy(true);
    try {
      const logo_url = logo ? await api.uploadCompanyImage(uid, logo.uri, logo.mime) : company?.logo_url ?? null;
      const body: api.CompanyInput = {
        name: name.trim().slice(0, 100), service_id: svc, phone: intlPhone(phone), whatsapp: intlPhone(wa || phone),
        price_text: priceText.trim() || null, description: desc.trim().slice(0, 1500) || null, address: address.trim() || null,
        is_24h: is24, lat: loc?.lat ?? null, lng: loc?.lng ?? null, logo_url,
      };
      const id = company ? (await api.updateCompany(company.id, body), company.id) : (await api.createMyCompany(uid, body)).id;
      await api.setCompanyAreas(id, areaIds);
      onSaved();
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <Card style={{ marginTop: 14 }}>
      <Row gap={12}>
        {logo ? <Logo c={{ name, logo_url: logo.uri }} /> : <Logo c={{ name: name || 'م', logo_url: company?.logo_url ?? null }} />}
        <Button small kind="soft" icon="image-plus" title={company?.logo_url || logo ? 'تغيير الشعار' : 'إضافة شعار'} onPress={pickLogo} />
      </Row>
      <Field label="اسم الشركة" value={name} onChangeText={setName} maxLength={100} />
      <Text variant="label" style={{ marginTop: 12 }}>الخدمة الرئيسية</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(services.data ?? []).map((s) => <Chip key={s.id} label={s.name_ar} active={svc === s.id} onPress={() => setSvc(s.id)} />)}</Row>
      <Field label="رقم الهاتف" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9xxxxxxx" />
      <Field label="رقم الواتساب (إذا مختلف)" value={wa} onChangeText={setWa} keyboardType="phone-pad" />
      <Field label="الأسعار باختصار" value={priceText} onChangeText={setPriceText} maxLength={120} placeholder="مثال: السحب يبدأ من 10 د.ك" />
      <Field label="وصف الشركة" value={desc} onChangeText={setDesc} multiline maxLength={1500} />
      <Text variant="label" style={{ marginTop: 12 }}>مناطق الخدمة</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {(areas.data ?? []).map((a) => (
          <Chip key={a.id} label={a.name_ar} active={areaIds.includes(a.id)} onPress={() => setAreaIds(areaIds.includes(a.id) ? areaIds.filter((x) => x !== a.id) : [...areaIds, a.id])} />
        ))}
      </Row>
      <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Chip label="نعمل 24 ساعة" icon="clock-outline" active={is24} onPress={() => setIs24(!is24)} />
        <Chip label={loc ? 'تم تحديد موقع الشركة ✓' : 'استخدم موقعي الحالي كموقع الشركة'} icon="map-marker" active={!!loc}
          onPress={() => (coords ? setLoc(coords) : toast('حدد موقعك أولاً من زر المنطقة في الرئيسية'))} />
      </Row>
      <Field label="العنوان (اختياري)" value={address} onChangeText={setAddress} maxLength={200} />
      <Button title={company ? 'حفظ التعديلات' : 'إنشاء الشركة'} loading={busy} onPress={save} style={{ marginTop: 16 }} />
    </Card>
  );
}
