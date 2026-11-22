import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, Chip, Field, PhoneField, Row, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useAreas, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { arabicError, isKuwaitPhone, localPhone } from '@/lib/utils';

/** انضمام سريع بدون حساب (نفس جدول join_requests المستخدم في الموقع الحالي) أو بحساب شركة كامل */
export default function Join() {
  const { session } = useSession();
  const services = useServices();
  const areas = useAreas();
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [svc, setSvc] = useState<string>('tow');
  const [area, setArea] = useState<string>('العاصمة');
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  // قفل فوري ضد الضغط المتكرر (state لا يتحدث قبل الضغطة الثانية)
  const sending = useRef(false);

  async function send() {
    if (name.trim().length < 2 || name.trim().length > 100) return toast('اسم الشركة لازم يكون بين 2 و100 حرف');
    if (!isKuwaitPhone(phone)) {
      setPhoneError('رقم كويتي من 8 أرقام يبدأ بـ 2 أو 5 أو 6 أو 9');
      return toast('اكتب رقم هاتف كويتي صحيح (8 أرقام)');
    }
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await api.sendJoinRequest({ company_name: name.trim(), service_id: svc, phone: localPhone(phone), area_name: area });
      toast('وصل طلبك. بنتواصل معك لتفعيل الاشتراك');
      router.replace({ pathname: '/contact', params: { reason: 'join' } });
    } catch (e) {
      sending.current = false; // يسمح بإعادة المحاولة بعد الخطأ فقط
      toast(arabicError(e));
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
    <Screen edges={['bottom']}>
      <Card style={{ backgroundColor: '#EDF3FF' }}>
        <Text variant="title">الطريقة الموصى بها: حساب شركة</Text>
        <Text variant="muted">أنشئ حساباً لتدير صفحة شركتك بنفسك: الشعار والصور والأسعار ومناطق الخدمة، وتستقبل طلبات العملاء وتجدد اشتراكك.</Text>
        <Button title={session ? 'افتح لوحة شركتي' : 'إنشاء حساب شركة'} icon="store-plus" style={{ marginTop: 10 }}
          onPress={() => (session ? router.replace('/business') : router.push({ pathname: '/auth', params: { mode: 'register', type: 'company' } }))} />
      </Card>

      <Text variant="h2" style={{ marginTop: 22 }}>أو طلب انضمام سريع</Text>
      <Text variant="muted">بدون حساب — تتواصل معك الإدارة لتفعيل الاشتراك.</Text>
      <Field label="اسم الشركة" value={name} onChangeText={setName} maxLength={100} testID="join-name" />
      <PhoneField label="رقم الهاتف" value={phone} onChangeText={(v) => { setPhone(v); setPhoneError(undefined); }} error={phoneError} testID="join-phone" />
      <Text variant="label" style={{ marginTop: 12 }}>نوع الخدمة</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(services.data ?? []).map((s) => <Chip key={s.id} label={s.name_ar} active={svc === s.id} onPress={() => setSvc(s.id)} />)}</Row>
      <Text variant="label" style={{ marginTop: 12 }}>المنطقة الرئيسية</Text>
      <Row style={{ flexWrap: 'wrap' }}>{(areas.data ?? []).map((a) => <Chip key={a.id} label={a.name_ar} active={area === a.name_ar} onPress={() => setArea(a.name_ar)} />)}</Row>
      <Button title="أرسل الطلب" icon="send" loading={busy} onPress={send} style={{ marginTop: 18 }} testID="join-submit" />
    </Screen>
    </KeyboardAvoidingView>
  );
}
