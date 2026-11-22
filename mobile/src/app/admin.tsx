import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Logo } from '@/components/CompanyCard';
import { Badge, Button, Card, Chip, Empty, ErrorBox, Field, Loading, Row, Screen, SectionTitle, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useAreas, useServiceNames } from '@/lib/queries';
import { isAdmin, useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import { getLegalDoc, LEGAL_DOCS, legalDocToText } from '@/content/legal';
import { AdCard } from '@/components/Ads';
import { TicketRow, TicketThread, ticketTone } from '@/components/Support';
import type { Ad, AdStatus, Company, Plan, Profile, Promotion, Service, TermsKind, TicketStatus } from '@/lib/types';
import { AD_STATUS_AR, TICKET_STATUS_AR, addDaysISO, arabicError, hasLegalPlaceholders, COMPANY_STATUS_AR, formatKwd, isVisible, SUB_STATUS_AR, todayISO, whatsappUrl } from '@/lib/utils';

type Tab = 'stats' | 'ads' | 'support' | 'join' | 'companies' | 'subs' | 'plans' | 'terms' | 'team' | 'settings';
const TABS: [Tab, string][] = [['stats', 'نظرة عامة'], ['ads', 'الإعلانات'], ['support', 'الدعم الفني'], ['companies', 'الشركات'], ['subs', 'الاشتراكات'], ['join', 'طلبات الانضمام (أرشيف)'], ['plans', 'الخطط والعروض'], ['terms', 'الشروط'], ['team', 'المستخدمون والإدارة'], ['settings', 'الإعدادات']];

export default function Admin() {
  const { profile, ready } = useSession();
  const [tab, setTab] = useState<Tab>('stats');
  if (!ready) return <Loading />;
  if (!isAdmin(profile)) return <Empty icon="shield-lock-outline" title="هذه الصفحة للإدارة فقط" action={<Button title="رجوع" onPress={() => router.back()} />} />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.line }}
        contentContainerStyle={{ padding: 10, gap: 8 }}>
        {TABS.map(([k, l]) => <Chip key={k} label={l} active={tab === k} onPress={() => setTab(k)} />)}
      </ScrollView>
      <Screen edges={['bottom']}>
        {tab === 'stats' ? <Stats /> : tab === 'join' ? <JoinRequests /> : tab === 'companies' ? <Companies /> : tab === 'subs' ? <Subs /> : tab === 'ads' ? <AdsReview /> : tab === 'support' ? <SupportAdmin /> : tab === 'plans' ? <Plans /> : tab === 'terms' ? <Terms /> : tab === 'team' ? <Team /> : <Settings />}
      </Screen>
    </View>
  );
}

const useRefresh = () => {
  const qc = useQueryClient();
  return () => { ['admin'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); qc.invalidateQueries({ queryKey: ['companies'] }); };
};
function useAct<T>(fn: (v: T) => Promise<unknown>, ok: string) {
  const toast = useToast();
  const refresh = useRefresh();
  return useMutation({ mutationFn: fn, onSuccess: () => { toast(ok); refresh(); }, onError: (e) => toast(arabicError(e)) });
}

function Stats() {
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.adminStats });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} />;
  const s = q.data!;
  const items: [string, number | string][] = [
    ['الشركات الظاهرة', s.companies_visible], ['كل الشركات', s.companies_total], ['بانتظار المراجعة', s.companies_pending],
    ['تنتهي خلال 7 أيام', s.expiring_7d], ['طلبات انضمام جديدة', s.join_requests_new], ['العملاء', s.customers],
    ['طلبات الخدمة', s.requests_total], ['طلبات مفتوحة', s.requests_open], ['شكاوى مفتوحة', s.complaints_open],
    ['زيارات الصفحات', s.visits], ['اتصالات', s.calls], ['واتساب', s.wa_taps], ['إيراد الاشتراكات الفعالة', formatKwd(s.revenue_active_kwd)],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map(([l, n]) => (
        <Card key={l} style={{ width: '47%', flexGrow: 1 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 22, color: colors.primary }}>{n}</Text>
          <Text variant="small">{l}</Text>
        </Card>
      ))}
    </View>
  );
}

function JoinRequests() {
  const q = useQuery({ queryKey: ['admin', 'join'], queryFn: api.adminJoinRequests });
  const areas = useAreas();
  const names = useServiceNames();
  const [filter, setFilter] = useState<'new' | 'all'>('new');
  const accept = useAct((r: Parameters<typeof api.adminAcceptJoin>[0]) => api.adminAcceptJoin(r, areas.data ?? []), 'تمت إضافة الشركة باشتراك 30 يوم');
  const reject = useAct((id: number) => api.adminSetJoinStatus(id, 'rejected'), 'تم رفض الطلب');
  if (q.isLoading) return <Loading />;
  const list = (q.data ?? []).filter((r) => filter === 'all' || r.status === 'new');
  return (
    <>
      <Row><Chip label="الجديدة" active={filter === 'new'} onPress={() => setFilter('new')} /><Chip label="الكل" active={filter === 'all'} onPress={() => setFilter('all')} /></Row>
      {list.length ? list.map((r) => (
        <Card key={r.id} style={{ marginTop: 10 }}>
          <Row gap={10}>
            <Logo c={{ name: r.company_name, logo_url: r.logo_url }} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{r.company_name}</Text>
              <Text variant="small">{names[r.service_id ?? ''] ?? r.service_id} · {r.area_name} · {r.phone}</Text>
              <Text variant="small">{r.created_at?.slice(0, 10)}</Text>
            </View>
            <Badge label={r.status === 'new' ? 'جديد' : r.status === 'accepted' ? 'مقبول' : 'مرفوض'} tone={r.status === 'new' ? 'yellow' : r.status === 'accepted' ? 'green' : 'red'} />
          </Row>
          <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {r.status === 'new' ? <>
              <Button small title="قبول وإضافة" loading={accept.isPending && accept.variables?.id === r.id} onPress={() => accept.mutate(r)} />
              <Button small kind="danger" title="رفض" onPress={() => reject.mutate(r.id)} />
            </> : null}
            <Button small kind="whatsapp" icon="whatsapp" title="تواصل" onPress={() => Linking.openURL(whatsappUrl(r.phone, `مرحباً ${r.company_name}، بخصوص طلب انضمامكم لماتعطل`))} />
          </Row>
        </Card>
      )) : <Empty title="لا توجد طلبات" />}
    </>
  );
}

function Companies() {
  const q = useQuery({ queryKey: ['admin', 'companies'], queryFn: api.adminCompanies });
  const names = useServiceNames();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'visible' | 'pending' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [linkFor, setLinkFor] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const upd = useAct(({ id, c }: { id: number; c: Partial<Company> }) => api.adminUpdateCompany(id, c), 'تم التحديث');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} />;
  const today = todayISO();
  const list = (q.data ?? []).filter((c) => {
    if (search && !c.name.includes(search.trim())) return false;
    if (filter === 'visible') return isVisible(c);
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'hidden') return !isVisible(c);
    return true;
  });
  const extend = (c: Company, days: number) => {
    const base = c.sub_end < today ? today : c.sub_end;
    upd.mutate({ id: c.id, c: { sub_end: addDaysISO(base, days), sub_start: c.sub_start ?? today, is_active: true, status: 'approved' } });
  };
  async function linkOwner(c: Company) {
    try {
      const u = await api.adminFindUser(email);
      if (!u) return toast('ما لقينا مستخدم بهذا الإيميل. خله يسجل في التطبيق أولاً');
      upd.mutate({ id: c.id, c: { owner_id: u.id } });
      setLinkFor(null); setEmail('');
    } catch (e) { toast(arabicError(e)); }
  }
  return (
    <>
      <Field label="بحث بالاسم" value={search} onChangeText={setSearch} />
      <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {([['all', 'الكل'], ['visible', 'الظاهرة'], ['pending', 'بانتظار المراجعة'], ['hidden', 'غير ظاهرة']] as const).map(([k, l]) => <Chip key={k} label={l} active={filter === k} onPress={() => setFilter(k)} />)}
      </Row>
      <Text variant="small" style={{ marginTop: 8 }}>{list.length} شركة</Text>
      {list.map((c) => (
        <Card key={c.id} style={{ marginTop: 10 }}>
          <Row gap={10}>
            <Logo c={c} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>{c.name}</Text>
              <Text variant="small">{names[c.service_id ?? '']} · ينتهي {c.sub_end} · {c.owner_id ? 'مرتبطة بحساب' : 'بدون حساب'}</Text>
              <Text variant="small">زيارات {c.visits ?? 0} · اتصال {c.calls ?? 0} · واتساب {c.wa_taps ?? 0}</Text>
            </View>
            <Badge label={isVisible(c) ? 'ظاهرة' : COMPANY_STATUS_AR[c.status]} tone={isVisible(c) ? 'green' : c.status === 'pending' ? 'yellow' : 'gray'} />
          </Row>
          <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {c.status === 'pending' ? <Button small title="اعتماد + 30 يوم" onPress={() => extend(c, 30)} /> : null}
            <Button small kind="soft" title="تمديد 30 يوم" onPress={() => extend(c, 30)} />
            <Button small kind={c.is_active ? 'danger' : 'soft'} title={c.is_active ? 'إيقاف' : 'تفعيل'} onPress={() => upd.mutate({ id: c.id, c: { is_active: !c.is_active } })} />
            {c.status !== 'suspended' ? <Button small kind="ghost" title="تعليق" onPress={() => upd.mutate({ id: c.id, c: { status: 'suspended' } })} />
              : <Button small kind="ghost" title="إلغاء التعليق" onPress={() => upd.mutate({ id: c.id, c: { status: 'approved' } })} />}
            <Button small kind="ghost" title="ربط بحساب" onPress={() => setLinkFor(linkFor === c.id ? null : c.id)} />
            <Button small kind="ghost" title="عرض" onPress={() => router.push(`/company/${c.id}`)} />
          </Row>
          {linkFor === c.id ? (
            <View>
              <Field label="إيميل صاحب الشركة (مسجل في التطبيق)" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Button small title="ربط" style={{ marginTop: 8 }} onPress={() => linkOwner(c)} />
            </View>
          ) : null}
        </Card>
      ))}
    </>
  );
}

function Subs() {
  const q = useQuery({ queryKey: ['admin', 'subs'], queryFn: api.adminSubscriptions });
  const [note, setNote] = useState<Record<number, string>>({});
  const activate = useAct(({ id, n }: { id: number; n: string }) => api.adminActivateSubscription(id, n), 'تم تفعيل الاشتراك وإظهار الشركة');
  const cancel = useAct((id: number) => api.adminCancelSubscription(id), 'تم إلغاء الطلب');
  if (q.isLoading) return <Loading />;
  return (
    <>
      <Text variant="muted">عند استلام الدفع (تحويل/كاش/رابط دفع) اضغط «تأكيد الدفع والتفعيل». يُسجل الدفع ويُمدد الاشتراك تلقائياً.</Text>
      {q.data?.length ? q.data.map((s) => (
        <Card key={s.id} style={{ marginTop: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title">{s.companies?.name ?? 'شركة #' + s.company_id}</Text>
            <Badge label={SUB_STATUS_AR[s.status]} tone={s.status === 'active' ? 'green' : s.status === 'pending' ? 'yellow' : 'gray'} />
          </Row>
          <Text variant="small">#{s.id} · {s.starts_on} ← {s.ends_on} · {formatKwd(s.amount_kwd)}{s.promotion_id ? ' · بخصم' : ''}</Text>
          {s.payment_note ? <Text variant="small">{s.payment_note}</Text> : null}
          {s.status === 'pending' ? (
            <>
              <Field label="ملاحظة الدفع (مثال: تحويل بنكي رقم ...)" value={note[s.id] ?? ''} onChangeText={(v) => setNote({ ...note, [s.id]: v })} />
              <Row style={{ marginTop: 8 }}>
                <Button small title="تأكيد الدفع والتفعيل" style={{ flex: 1 }} loading={activate.isPending} onPress={() => activate.mutate({ id: s.id, n: note[s.id] ?? '' })} />
                <Button small kind="danger" title="إلغاء" onPress={() => cancel.mutate(s.id)} />
              </Row>
            </>
          ) : null}
        </Card>
      )) : <Empty title="لا توجد اشتراكات بعد" />}
    </>
  );
}

function Plans() {
  const plans = useQuery({ queryKey: ['admin', 'plans'], queryFn: api.getPlans });
  const promos = useQuery({ queryKey: ['admin', 'promos'], queryFn: api.adminPromotions });
  const services = useQuery({ queryKey: ['admin', 'services'], queryFn: api.adminServices });
  const savePlan = useAct((p: Plan) => api.adminSavePlan(p), 'تم حفظ الخطة');
  const savePromo = useAct((p: Partial<Promotion>) => api.adminSavePromotion(p), 'تم حفظ العرض');
  const saveSvc = useAct((s: Service) => api.adminSaveService(s), 'تم حفظ الخدمة');
  const [np, setNp] = useState({ id: '', name_ar: '', months: '1', price: '' });
  const [pr, setPr] = useState({ code: '', name_ar: '', pct: '', max: '' });
  const [ns, setNs] = useState({ id: '', name_ar: '' });
  return (
    <>
      <SectionTitle title="خطط الاشتراك" />
      {plans.data?.map((p) => <PlanRow key={p.id} p={p} onSave={(x) => savePlan.mutate(x)} />)}
      <Card style={{ marginTop: 10 }}>
        <Text variant="title">خطة جديدة</Text>
        <Field label="المعرّف (إنجليزي، مثال: yearly)" value={np.id} onChangeText={(v) => setNp({ ...np, id: v.replace(/[^a-z0-9_]/gi, '').toLowerCase() })} autoCapitalize="none" />
        <Field label="الاسم" value={np.name_ar} onChangeText={(v) => setNp({ ...np, name_ar: v })} />
        <Row><View style={{ flex: 1 }}><Field label="عدد الأشهر" value={np.months} onChangeText={(v) => setNp({ ...np, months: v.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="السعر (د.ك)" value={np.price} onChangeText={(v) => setNp({ ...np, price: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" /></View></Row>
        <Button small title="إضافة الخطة" style={{ marginTop: 10 }} disabled={!np.id || !np.name_ar || !np.price}
          onPress={() => savePlan.mutate({ id: np.id, name_ar: np.name_ar, months: Number(np.months) || 1, price_kwd: Number(np.price), is_active: true, sort: (plans.data?.length ?? 0) + 1 })} />
      </Card>

      <SectionTitle title="أكواد الخصم والعروض" />
      {promos.data?.map((p) => (
        <Card key={p.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title">{p.code} · {p.discount_percent}%</Text>
            <Badge label={p.is_active ? 'فعّال' : 'موقوف'} tone={p.is_active ? 'green' : 'gray'} />
          </Row>
          <Text variant="small">{p.name_ar} · استخدم {p.used_count}{p.max_uses ? ' من ' + p.max_uses : ''}</Text>
          <Button small kind="soft" title={p.is_active ? 'إيقاف' : 'تفعيل'} style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => savePromo.mutate({ id: p.id, is_active: !p.is_active })} />
        </Card>
      ))}
      <Card>
        <Text variant="title">كود جديد</Text>
        <Field label="الكود" value={pr.code} onChangeText={(v) => setPr({ ...pr, code: v.toUpperCase().replace(/\s/g, '') })} autoCapitalize="characters" />
        <Field label="الوصف" value={pr.name_ar} onChangeText={(v) => setPr({ ...pr, name_ar: v })} />
        <Row><View style={{ flex: 1 }}><Field label="نسبة الخصم %" value={pr.pct} onChangeText={(v) => setPr({ ...pr, pct: v.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="حد الاستخدام (اختياري)" value={pr.max} onChangeText={(v) => setPr({ ...pr, max: v.replace(/\D/g, '') })} keyboardType="number-pad" /></View></Row>
        <Button small title="إضافة الكود" style={{ marginTop: 10 }} disabled={!pr.code || !pr.name_ar || !pr.pct}
          onPress={() => savePromo.mutate({ code: pr.code, name_ar: pr.name_ar, discount_percent: Math.min(100, Math.max(1, Number(pr.pct))), max_uses: pr.max ? Number(pr.max) : null, is_active: true })} />
      </Card>

      <SectionTitle title="أقسام الخدمات" />
      {services.data?.map((s) => (
        <Row key={s.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text style={{ flex: 1 }}>{s.name_ar} <Text variant="small">({s.id})</Text></Text>
          <Button small kind={s.is_active ? 'soft' : 'danger'} title={s.is_active ? 'ظاهر' : 'مخفي'} onPress={() => saveSvc.mutate({ ...s, is_active: !s.is_active })} />
        </Row>
      ))}
      <Card style={{ marginTop: 8 }}>
        <Field label="معرّف القسم (إنجليزي)" value={ns.id} onChangeText={(v) => setNs({ ...ns, id: v.replace(/[^a-z0-9_]/gi, '').toLowerCase() })} autoCapitalize="none" />
        <Field label="اسم القسم" value={ns.name_ar} onChangeText={(v) => setNs({ ...ns, name_ar: v })} />
        <Button small title="إضافة قسم" style={{ marginTop: 10 }} disabled={!ns.id || !ns.name_ar}
          onPress={() => saveSvc.mutate({ id: ns.id, name_ar: ns.name_ar, sort: (services.data?.length ?? 0) + 1, icon: null, is_active: true })} />
      </Card>
    </>
  );
}

function PlanRow({ p, onSave }: { p: Plan; onSave: (p: Plan) => void }) {
  const [price, setPrice] = useState(String(p.price_kwd));
  const [name, setName] = useState(p.name_ar);
  return (
    <Card style={{ marginBottom: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}><Text variant="title">{p.id} · {p.months} شهر</Text><Badge label={p.is_active ? 'فعّالة' : 'موقوفة'} tone={p.is_active ? 'green' : 'gray'} /></Row>
      <Row><View style={{ flex: 2 }}><Field label="الاسم" value={name} onChangeText={setName} /></View>
        <View style={{ flex: 1 }}><Field label="السعر (د.ك)" value={price} onChangeText={(v) => setPrice(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" /></View></Row>
      <Row style={{ marginTop: 8 }}>
        <Button small title="حفظ" onPress={() => onSave({ ...p, name_ar: name, price_kwd: Number(price) })} />
        <Button small kind="ghost" title={p.is_active ? 'إيقاف الخطة' : 'تفعيل الخطة'} onPress={() => onSave({ ...p, is_active: !p.is_active })} />
      </Row>
    </Card>
  );
}

const SETTING_LABELS: Record<string, string> = {
  support_whatsapp: 'رقم واتساب قديم (غير مستخدم: أرقام التطبيق ثابتة في الكود)', payment_mode: 'طريقة الدفع (manual / gateway)', payment_provider: 'بوابة الدفع (none / myfatoorah / tap / upayments / knet)',
  trial_days: 'أيام التجربة المجانية', maintenance_message: 'رسالة تنبيه عامة (اتركها فارغة للإخفاء)',
};
function Settings() {
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.adminSettings });
  const save = useAct(({ k, v }: { k: string; v: unknown }) => api.adminSaveSetting(k, v), 'تم حفظ الإعداد');
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (q.isLoading) return <Loading />;
  return (
    <>
      {q.data?.map((s) => {
        const cur = draft[s.key] ?? (s.value == null ? '' : typeof s.value === 'string' ? s.value : JSON.stringify(s.value));
        return (
          <Card key={s.key} style={{ marginBottom: 10 }}>
            <Field label={SETTING_LABELS[s.key] ?? s.key} value={cur} onChangeText={(v) => setDraft({ ...draft, [s.key]: v })} autoCapitalize="none" />
            <Button small title="حفظ" style={{ marginTop: 8, alignSelf: 'flex-start' }}
              onPress={() => save.mutate({ k: s.key, v: cur === '' ? null : /^\d+$/.test(cur) && s.key === 'trial_days' ? Number(cur) : cur })} />
          </Card>
        );
      })}
    </>
  );
}

// ===== الإعلانات بانتظار الموافقة (القواعد في الخادم: سبب الرفض إلزامي، وقت ومراجع من الخادم) =====
function AdsReview() {
  const names = useServiceNames();
  const [filter, setFilter] = useState<AdStatus>('pending');
  const q = useQuery({ queryKey: ['admin', 'ads', filter], queryFn: () => api.adminAds(filter), retry: false });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} />;
  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['pending', 'approved', 'rejected', 'paused'] as AdStatus[]).map((st) => <Chip key={st} label={AD_STATUS_AR[st]} active={filter === st} onPress={() => setFilter(st)} />)}
      </Row>
      {q.data?.length ? q.data.map((a) => <AdReviewCard key={a.id} a={a} serviceName={names[a.service_id]} />) : <Empty icon="bullhorn-outline" title="لا توجد إعلانات هنا" />}
    </>
  );
}

function AdReviewCard({ a, serviceName }: { a: Ad; serviceName?: string }) {
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const review = useAct(({ s, r }: { s: AdStatus; r?: string }) => api.adminReviewAd(a.id, s, r), 'تم تحديث الإعلان');
  return (
    <Card style={{ marginTop: 10 }}>
      <AdCard ad={a} serviceName={serviceName} showStatus onPress={() => router.push(`/ad/${a.id}`)} />
      <Text variant="small">{a.description}</Text>
      <Text variant="small" style={{ marginTop: 4 }}>رقم التواصل: {'\u2066'}{a.phone}{'\u2069'} · أُرسل {new Date(a.created_at).toLocaleString('ar-KW')}</Text>
      <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
        {a.status !== 'approved' ? <Button small title="موافقة ونشر" icon="check" onPress={() => review.mutate({ s: 'approved' })} testID={`approve-${a.id}`} /> : null}
        {a.status !== 'rejected' ? <Button small kind="danger" title="رفض" onPress={() => setRejecting(!rejecting)} /> : null}
        {a.status === 'approved' ? <Button small kind="soft" title="إيقاف" icon="pause" onPress={() => review.mutate({ s: 'paused' })} /> : null}
      </Row>
      {rejecting ? (
        <View style={{ marginTop: 6 }}>
          <Field label="سبب الرفض (يصل لصاحب الإعلان)" value={reason} onChangeText={setReason} maxLength={300} multiline />
          <Button small kind="danger" title="تأكيد الرفض" style={{ marginTop: 8 }} disabled={!reason.trim()}
            onPress={() => { review.mutate({ s: 'rejected', r: reason }); setRejecting(false); }} />
        </View>
      ) : null}
    </Card>
  );
}

// ===== الدعم الفني =====
function SupportAdmin() {
  const { session } = useSession();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('new');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['admin', 'tickets', filter], queryFn: () => api.adminTickets(filter === 'all' ? undefined : filter), refetchInterval: 30_000, retry: false });
  const setStatus = useAct(({ id, s }: { id: number; s: TicketStatus }) => api.adminSetTicketStatus(id, s), 'تم تحديث حالة الطلب');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} />;
  const term = search.trim();
  const list = (q.data ?? []).filter((t) => !term || t.subject.includes(term) || String(t.id) === term.replace('#', ''));
  const current = list.find((t) => t.id === open) ?? (q.data ?? []).find((t) => t.id === open);
  if (current && session) {
    return (
      <>
        <Button small kind="ghost" icon="arrow-right" title="رجوع للقائمة" onPress={() => setOpen(null)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="title" style={{ flex: 1 }}>#{current.id} · {current.subject}</Text>
          <Badge label={TICKET_STATUS_AR[current.status]} tone={ticketTone(current.status)} />
        </Row>
        <Row style={{ marginVertical: 8, flexWrap: 'wrap' }}>
          {(['new', 'in_progress', 'resolved'] as TicketStatus[]).map((st) => (
            <Chip key={st} label={st === 'resolved' ? 'تم الحل (إغلاق)' : TICKET_STATUS_AR[st]} active={current.status === st}
              onPress={() => current.status !== st && setStatus.mutate({ id: current.id, s: st })} />
          ))}
        </Row>
        <TicketThread ticket={current} uid={session.user.id} asStaff />
      </>
    );
  }
  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {(['new', 'in_progress', 'resolved', 'all'] as const).map((st) => <Chip key={st} label={st === 'all' ? 'الكل' : TICKET_STATUS_AR[st]} active={filter === st} onPress={() => setFilter(st)} />)}
      </Row>
      <Field label="بحث بالعنوان أو رقم الطلب" value={search} onChangeText={setSearch} />
      <View style={{ marginTop: 10 }}>
        {list.length ? list.map((t) => <TicketRow key={t.id} t={t} onPress={() => setOpen(t.id)} />) : <Empty icon="headset" title="لا توجد طلبات" />}
      </View>
    </>
  );
}

function Terms() {
  const q = useQuery({ queryKey: ['admin', 'terms'], queryFn: api.adminTermsDocuments });
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<TermsKind>('customers');
  const [form, setForm] = useState<{ title: string; version: string; body: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const all = q.data ?? [];
  const history = all.filter((d) => d.kind === kind);
  const current = history.find((d) => d.is_current);

  function startFromDraft() {
    const d = getLegalDoc(kind)!;
    const next = current ? `${current.version.split('.')[0]}.${Number(current.version.split('.')[1] ?? 0) + 1}` : d.version;
    setForm({ title: current?.title ?? d.title, version: next, body: current?.body ?? legalDocToText(d) });
    setConfirm(false);
  }
  const placeholders = form ? hasLegalPlaceholders(form.body) || hasLegalPlaceholders(form.title) : false;
  const versionOk = !!form && /^\d+\.\d+$/.test(form.version) && !history.some((d) => d.version === form.version);

  async function publish() {
    if (!form) return;
    if (placeholders) return toast('النص يحتوي بيانات ناقصة «[يُستكمل: ...]». أكملها قبل النشر');
    if (!versionOk) return toast('رقم الإصدار غير صحيح أو مستخدم سابقاً (مثال: 1.0)');
    if (form.body.trim().length < 50) return toast('النص قصير جداً');
    setBusy(true);
    try {
      await api.adminPublishTerms(kind, form.version, form.title.trim(), form.body.trim());
      toast('تم نشر النسخة. سيُطلب من المستخدمين الموافقة عليها');
      setForm(null); setConfirm(false);
      qc.invalidateQueries({ queryKey: ['admin', 'terms'] });
      qc.invalidateQueries({ queryKey: ['terms'] });
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {LEGAL_DOCS.map((d) => <Chip key={d.id} label={d.title} active={kind === d.id} onPress={() => { setKind(d.id); setForm(null); }} />)}
      </Row>
      <Card style={{ marginTop: 12 }}>
        <Text variant="title">النسخة النافذة</Text>
        {current ? (
          <>
            <Text>الإصدار {current.version} · نُشرت {current.published_at ? new Date(current.published_at).toLocaleString('ar-KW') : ''}</Text>
            <Text variant="small" selectable>البصمة: {current.body_sha256.slice(0, 16)}…</Text>
          </>
        ) : <Text variant="muted">لم تُنشر أي نسخة بعد — التطبيق يعرض المسودة المضمّنة، ولا يُطلب إقرار من المستخدمين.</Text>}
        {!form ? <Button small title={current ? 'إصدار نسخة جديدة' : 'تجهيز النسخة الأولى من المسودة'} icon="file-document-edit-outline" style={{ marginTop: 10 }} onPress={startFromDraft} /> : null}
      </Card>

      {form ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="title">نسخة جديدة</Text>
          <Field label="العنوان" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} maxLength={120} />
          <Field label="رقم الإصدار" value={form.version} onChangeText={(v) => setForm({ ...form, version: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad"
            error={versionOk ? undefined : 'رقم غير صحيح أو مستخدم سابقاً'} />
          <Field label="النص الكامل (سطر يبدأ برقم ثم نقطة = عنوان قسم)" value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} multiline
            style={{ minHeight: 260 }} testID="terms-body" />
          {placeholders ? (
            <View style={{ backgroundColor: '#FDECEA', borderRadius: 12, padding: 10, marginTop: 10 }} testID="terms-placeholders">
              <Text style={{ color: colors.danger, fontFamily: fonts.bold }}>لا يمكن النشر بعد</Text>
              <Text variant="small" style={{ color: colors.danger }}>النص يحتوي «[يُستكمل: ...]» (مثل بيانات الجهة المشغّلة أو سياسة الاسترداد). أكملها بعد المراجعة القانونية.</Text>
            </View>
          ) : null}
          {!confirm ? (
            <Button title="نشر هذه النسخة" icon="publish" style={{ marginTop: 12 }} disabled={placeholders || !versionOk} onPress={() => setConfirm(true)} />
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontFamily: fonts.bold }}>تأكيد النشر</Text>
              <Text variant="small">بعد النشر لا يمكن تعديل هذه النسخة، وتصبح نافذة فوراً، ويُطلب من المستخدمين الموافقة عليها عند دخولهم.</Text>
              <Row style={{ marginTop: 8 }}>
                <Button title="نعم، انشر" style={{ flex: 1 }} loading={busy} onPress={publish} testID="terms-publish" />
                <Button title="تراجع" kind="soft" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
              </Row>
            </View>
          )}
          <Button small kind="ghost" title="إلغاء" onPress={() => setForm(null)} />
        </Card>
      ) : null}

      <SectionTitle title={`سجل الإصدارات (${history.length})`} />
      {q.isLoading ? <Loading /> : history.length ? history.map((d) => (
        <Card key={d.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title">الإصدار {d.version}</Text>
            <Badge label={d.is_current ? 'النافذة' : d.published_at ? 'سابقة' : 'غير منشورة'} tone={d.is_current ? 'green' : 'gray'} />
          </Row>
          <Text variant="small">{d.published_at ? new Date(d.published_at).toLocaleString('ar-KW') : new Date(d.created_at).toLocaleString('ar-KW')}</Text>
        </Card>
      )) : <Text variant="muted">لا توجد إصدارات منشورة لهذه الوثيقة.</Text>}
    </>
  );
}

const ROLE_AR: Record<Profile['role'], string> = { customer: 'عميل', company: 'مقدم خدمة', staff: 'مشرف', admin: 'مدير' };

function Team() {
  const { session } = useSession();
  const team = useQuery({ queryKey: ['admin', 'team'], queryFn: api.adminTeam });
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<{ id: string; email: string; role: string; full_name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const setRole = useAct(({ id, role }: { id: string; role: Profile['role'] }) => api.adminSetRole(id, role), 'تم تغيير الصلاحية');
  const me = session?.user.id;

  async function find() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast('اكتب إيميل صحيح');
    setBusy(true);
    try {
      const u = await api.adminFindUser(email);
      setFound(u);
      if (!u) toast('لا يوجد حساب بهذا الإيميل. يجب أن يسجّل الشخص في التطبيق أولاً');
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }
  function change(id: string, role: Profile['role']) {
    if (id === me) return toast('لا يمكنك تغيير صلاحية حسابك بنفسك');
    setRole.mutate({ id, role });
    setFound(null);
  }

  return (
    <>
      <Card style={{ backgroundColor: colors.warningBg, borderColor: '#F3E2A9' }}>
        <Text style={{ color: colors.warningText, fontFamily: fonts.bold }}>تنبيه أمني</Text>
        <Text variant="small" style={{ color: colors.warningText }}>صلاحية «مدير» تمنح كامل الصلاحيات التشغيلية. ملكية المشروع محمية في قاعدة البيانات: لا يمكن تغيير صلاحية المالك، ومنح أو سحب صلاحية «مدير» للمالك فقط، ولا يغيّر أحد صلاحية نفسه.</Text>
      </Card>
      <SectionTitle title="فريق الإدارة الحالي" />
      {team.isLoading ? <Loading /> : (team.data ?? []).map((p) => (
        <Card key={p.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="title">{p.full_name || 'بدون اسم'}{p.id === me ? ' (أنت)' : ''}</Text>
            <Badge label={ROLE_AR[p.role]} tone={p.role === 'admin' ? 'blue' : 'gray'} />
          </Row>
          {p.id !== me ? (
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {p.role !== 'admin' ? <Button small title="ترقية إلى مدير" onPress={() => change(p.id, 'admin')} /> : null}
              {p.role !== 'staff' ? <Button small kind="soft" title="مشرف" onPress={() => change(p.id, 'staff')} /> : null}
              <Button small kind="danger" title="إزالة من الإدارة" onPress={() => change(p.id, 'customer')} />
            </Row>
          ) : null}
        </Card>
      ))}
      <SectionTitle title="إضافة عضو" />
      <Card>
        <Text variant="small">يسجّل الشخص حساباً في التطبيق أولاً، ثم ابحث عنه بالإيميل.</Text>
        <Field label="إيميل الحساب" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button small title="بحث" icon="magnify" style={{ marginTop: 8 }} loading={busy} onPress={find} />
        {found ? (
          <View style={{ marginTop: 10 }}>
            <Text variant="title">{found.full_name || found.email}</Text>
            <Text variant="small">{found.email} · الصلاحية الحالية: {ROLE_AR[found.role as Profile['role']] ?? found.role}</Text>
            {found.id === me ? <Text variant="small">هذا حسابك.</Text> : (
              <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <Button small title="منح صلاحية مدير" onPress={() => change(found.id, 'admin')} />
                <Button small kind="soft" title="منح صلاحية مشرف" onPress={() => change(found.id, 'staff')} />
              </Row>
            )}
          </View>
        ) : null}
      </Card>
    </>
  );
}
