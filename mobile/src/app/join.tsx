// طلب انضمام مقدم خدمة: يُرسل للإدارة ولا يُنشر شيء قبل موافقتها (الحالة تُفرض «new» في قاعدة البيانات).
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, Card, Chip, Field, PhoneField, Row, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useAreas, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import { arabicError, isKuwaitPhone, localPhone } from '@/lib/utils';

export default function Join() {
  const { session, profile } = useSession();
  const services = useServices();
  const areas = useAreas();
  const toast = useToast();
  const [company, setCompany] = useState('');
  const [svc, setSvc] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [phone, setPhone] = useState(localPhone(profile?.phone));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const sending = useRef(false);

  if (!session) {
    return (
      <Screen edges={['bottom']}>
        <Card>
          <Text variant="title">سجّل دخولك أولاً</Text>
          <Text variant="muted">طلب الانضمام يحتاج حساباً حتى نتواصل معك ونتابع طلبك.</Text>
          <Button title="تسجيل دخول أو حساب جديد" style={{ marginTop: 12 }} onPress={() => router.push('/auth')} testID="join-login" />
        </Card>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen edges={['bottom']}>
        <Card style={{ alignItems: 'center' }}>
          <Text variant="title">وصلنا طلبك ✅</Text>
          <Text variant="muted" style={{ textAlign: 'center' }}>بتراجع إدارة ماتعطل طلبك وبنتواصل معك على الرقم اللي كتبته. ما يظهر نشاطك في التطبيق إلا بعد الموافقة.</Text>
          <Button title="رجوع" kind="soft" style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  async function send() {
    if (company.trim().length < 2) return toast('اكتب اسم النشاط أو الشركة');
    if (!svc) return toast('اختر نوع الخدمة');
    if (!area) return toast('اختر المنطقة');
    if (!isKuwaitPhone(phone)) return toast('اكتب رقم تواصل كويتي صحيح (8 أرقام)');
    if (sending.current) return;
    sending.current = true; setBusy(true);
    try {
      await api.sendJoinRequest({ company_name: company.trim().slice(0, 100), service_id: svc, area_name: area, phone: localPhone(phone) });
      setDone(true);
    } catch (e) { toast(arabicError(e)); } finally { sending.current = false; setBusy(false); }
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="muted">قدّم خدماتك لعملاء ماتعطل. نراجع الطلب ونتواصل معك قبل النشر.</Text>
      <Field label="اسم النشاط أو الشركة" value={company} onChangeText={(v) => setCompany(v.slice(0, 100))} placeholder="مثال: سطحات الخليج" testID="join-company" />
      <Text variant="label" style={{ marginTop: 12 }}>نوع الخدمة</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(services.data ?? []).map((s) => <Chip key={s.id} label={s.name_ar} active={svc === s.id} onPress={() => setSvc(s.id)} />)}</Row>
      <Text variant="label" style={{ marginTop: 12 }}>المنطقة</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(areas.data ?? []).map((a) => <Chip key={a.id} label={a.name_ar} active={area === a.name_ar} onPress={() => setArea(a.name_ar)} />)}</Row>
      <PhoneField label="رقم التواصل" value={phone} onChangeText={setPhone} testID="join-phone" />
      <Card style={{ marginTop: 14, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Text variant="small" style={{ color: colors.heading }}>الطلب ما يعطي أي صلاحية أو ظهور في التطبيق قبل موافقة الإدارة.</Text>
      </Card>
      <Button title="انضم الآن" icon="send" loading={busy} onPress={send} style={{ marginTop: 14 }} testID="join-submit" />
    </Screen>
  );
}
