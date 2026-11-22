import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Button, Field, PhoneField, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';
import { arabicError, isKuwaitMobile } from '@/lib/utils';

const RESEND_SECONDS = 60;

/**
 * حساب موحد برقم الهاتف (عميل / مقدم خدمة / معلن): رمز تحقق SMS حقيقي من Supabase Auth.
 * أول تحقق ناجح = إنشاء الحساب مباشرة. الرقم فريد في نظام المصادقة فلا تتكرر الحسابات.
 * الدخول بالإيميل باقٍ للحسابات الحالية (ومنها حساب المالك).
 */
export default function Auth() {
  const toast = useToast();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [mode, setMode] = useState<'phone' | 'code' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const lock = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const done = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }

  const sendCode = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم جوال كويتي من 8 أرقام يبدأ بـ 5 أو 6 أو 9'); return; }
    if (terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    if (wait > 0) return;
    await api.sendPhoneOtp(phone);
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id));
    setWait(RESEND_SECONDS); setCode(''); setMode('code');
    toast('أرسلنا رمز التحقق برسالة نصية');
  });

  const verify = () => run(async () => {
    if (!/^\d{6}$/.test(code)) { toast('اكتب الرمز المكوّن من 6 أرقام'); return; }
    await api.verifyPhoneOtp(phone, code);
    toast('أهلاً بك في ماتعطل');
    done();
  });

  const emailLogin = () => run(async () => {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em) || password.length < 6) { toast('اكتب الإيميل وكلمة السر'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) throw error;
    toast('أهلاً بك'); done();
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        {mode === 'phone' ? (
          <>
            <Text variant="h1">الدخول برقم الهاتف</Text>
            <Text variant="muted">سجّل أو ادخل برقم جوالك. نرسل لك رمز تحقق برسالة نصية، والحساب يتفعّل مباشرة.</Text>
            <PhoneField label="رقم الجوال" value={phone} onChangeText={setPhone} testID="auth-phone" />
            <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
            <Button title={wait > 0 ? `إرسال الرمز (${wait})` : 'إرسال رمز التحقق'} icon="message-text-lock-outline" loading={busy}
              disabled={wait > 0} onPress={sendCode} style={{ marginTop: 18 }} testID="auth-send" />
            <Button title="الدخول بالإيميل (للحسابات السابقة)" kind="ghost" small onPress={() => setMode('email')} style={{ marginTop: 10 }} />
          </>
        ) : mode === 'code' ? (
          <>
            <Text variant="h1">رمز التحقق</Text>
            <Text variant="muted">اكتب الرمز المرسل إلى <Text style={{ fontFamily: fonts.bold }}>{'⁦'}+965 {phone}{'⁩'}</Text></Text>
            <View style={{ marginTop: 14 }}>
              <TextInput
                value={code} onChangeText={(v) => setCode(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} autoFocus
                placeholder="000000" placeholderTextColor="#98A3B8" accessibilityLabel="رمز التحقق" testID="auth-code"
                style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#DCE5F5', borderRadius: radius.sm, height: 56, fontSize: 24, letterSpacing: 8, textAlign: 'center', writingDirection: 'ltr', color: '#000', fontFamily: fonts.bold }}
              />
            </View>
            <Button title="تأكيد" icon="check" loading={busy} onPress={verify} style={{ marginTop: 16 }} testID="auth-verify" />
            <Button title={wait > 0 ? `إعادة إرسال الرمز بعد ${wait} ثانية` : 'إعادة إرسال الرمز'} kind="ghost" small disabled={wait > 0 || busy} onPress={sendCode} />
            <Button title="تغيير الرقم" kind="ghost" small onPress={() => { setMode('phone'); setCode(''); }} />
          </>
        ) : (
          <>
            <Text variant="h1">الدخول بالإيميل</Text>
            <Text variant="muted">للحسابات المسجلة سابقاً بالإيميل.</Text>
            <Field label="الإيميل" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="email"
              style={{ writingDirection: 'ltr', textAlign: 'left', color: '#000' }} />
            <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" testID="password"
              style={{ writingDirection: 'ltr', textAlign: 'left', color: '#000' }} />
            <Button title="دخول" loading={busy} onPress={emailLogin} style={{ marginTop: 18 }} testID="auth-submit" />
            <Button title="الرجوع للدخول برقم الهاتف" kind="ghost" small onPress={() => setMode('phone')} style={{ marginTop: 8 }} />
          </>
        )}
        <Button title="الشروط والسياسات" kind="ghost" small icon="file-document-outline" style={{ marginTop: 16 }} onPress={() => router.push('/legal')} />
        <Text variant="small" style={{ textAlign: 'center', color: colors.muted }}>لا نشارك رقمك مع أي جهة. يظهر رقم التواصل فقط في الإعلانات التي تنشرها.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
