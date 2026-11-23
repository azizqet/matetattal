import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Button, Card, Field, Icon, Row, Text, phoneInput, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, fonts, gradients, radius, shadow } from '@/lib/theme';
import { arabicError, isKuwaitMobile } from '@/lib/utils';

const RESEND_SECONDS = 60;
const CODE_LEN = 6;
const ltr = { writingDirection: 'ltr' as const, textAlign: 'left' as const, color: colors.inputText };

/** أرقام عربية/فارسية → إنجليزية، أرقام فقط، بطول محدد */
export function codeInput(v: string, max = CODE_LEN) {
  return v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\D/g, '').slice(0, max);
}

/**
 * الدخول برقم الجوال الكويتي (+965) مع رمز تحقق SMS حقيقي من Supabase Auth.
 * رقم جديد = حساب جديد تلقائياً، ورقم مسجل = تسجيل دخول. لا موافقة من المالك.
 * الدخول بالإيميل باقٍ للحسابات السابقة فقط (ومنها حساب المالك) — لا تسجيل جديد بالإيميل.
 */
export default function Auth() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [step, setStep] = useState<'phone' | 'code' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const lock = useRef(false);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const finish = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };

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
    setWait(RESEND_SECONDS); setCode(''); setStep('code');
    setTimeout(() => codeRef.current?.focus(), 250);
  });

  const verify = (value = code) => run(async () => {
    if (value.length !== CODE_LEN) { toast('اكتب الرمز المكوّن من 6 أرقام'); return; }
    try {
      await api.verifyPhoneOtp(phone, value);
    } catch (e) { setCode(''); throw e; }
    toast('أهلاً بك في ماتعطل');
    finish();
  });

  const emailLogin = () => run(async () => {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em) || password.length < 6) { toast('اكتب البريد وكلمة المرور'); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) throw error;
    toast('أهلاً بك'); finish();
  });

  const onCode = (v: string) => {
    const c = codeInput(v);
    setCode(c);
    if (c.length === CODE_LEN) verify(c); // تحقق تلقائي عند اكتمال الرمز (يدوياً أو بالتعبئة التلقائية)
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[st.hero, { paddingTop: insets.top + 56 }]}>
          <View style={st.badge}><Icon name={step === 'code' ? 'message-lock-outline' : 'cellphone-key'} size={34} color={colors.white} /></View>
          <Text style={st.heroTitle}>{step === 'code' ? 'رمز التحقق' : step === 'email' ? 'الدخول بالبريد' : 'أهلاً بك في ماتعطل'}</Text>
          <Text style={st.heroSub}>
            {step === 'code' ? 'أرسلنا رمزاً من 6 أرقام برسالة نصية إلى'
              : step === 'email' ? 'للحسابات المسجلة سابقاً بالبريد الإلكتروني'
                : 'سجّل أو ادخل برقم جوالك خلال ثوانٍ'}
          </Text>
          {step === 'code' ? <Text style={st.heroPhone}>{'⁦'}+965 {phone.slice(0, 4)} {phone.slice(4)}{'⁩'}</Text> : null}
        </LinearGradient>

        <View style={st.body}>
          {step === 'phone' ? (
            <Card style={st.card}>
              <Text variant="label">رقم الجوال</Text>
              {/* المفتاح ثابت يسار الحقل لأن الرقم يُكتب من اليسار لليمين */}
              <View style={st.phoneRow}>
                <View style={st.cc}><Text style={st.ccText}>🇰🇼 +965</Text></View>
                <TextInput
                  value={phone}
                  onChangeText={(v) => setPhone(phoneInput(v))}
                  keyboardType="number-pad" inputMode="numeric" textContentType="telephoneNumber" autoComplete="tel"
                  maxLength={8} placeholder="9XXX XXXX" placeholderTextColor={colors.placeholder} autoFocus
                  accessibilityLabel="رقم الجوال" testID="auth-phone" style={st.phoneInput}
                  onSubmitEditing={sendCode} returnKeyType="done"
                />
              </View>
              <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
              <Button title={wait > 0 ? `متابعة (${wait})` : 'متابعة'} icon="arrow-left" loading={busy} disabled={wait > 0 || phone.length !== 8}
                onPress={sendCode} style={{ marginTop: 18 }} testID="auth-send" />
              <Row style={{ marginTop: 14, justifyContent: 'center' }} gap={6}>
                <Icon name="shield-check" size={16} color={colors.success} />
                <Text variant="small">رقمك محمي ولا يظهر لأي أحد</Text>
              </Row>
            </Card>
          ) : step === 'code' ? (
            <Card style={st.card}>
              {/* حقل واحد مخفي خلف المربعات: يدعم التعبئة التلقائية من الرسائل (iOS oneTimeCode / Android sms-otp) */}
              <Pressable onPress={() => codeRef.current?.focus()} accessibilityRole="button" accessibilityLabel="أدخل رمز التحقق">
                <View style={st.boxes}>
                  {Array.from({ length: CODE_LEN }).map((_, i) => {
                    const active = i === Math.min(code.length, CODE_LEN - 1);
                    return (
                      <View key={i} style={[st.box, code[i] ? st.boxFilled : null, active && st.boxActive]}>
                        <Text style={st.boxText}>{code[i] ?? ''}</Text>
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  ref={codeRef} value={code} onChangeText={onCode} maxLength={CODE_LEN}
                  keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp"
                  importantForAutofill="yes" caretHidden accessibilityLabel="رمز التحقق" testID="auth-code" style={st.hiddenInput}
                />
              </Pressable>
              <Button title="تأكيد" icon="check" loading={busy} disabled={code.length !== CODE_LEN} onPress={() => verify()} style={{ marginTop: 20 }} testID="auth-verify" />
              <Row style={{ marginTop: 14, justifyContent: 'center' }}>
                {wait > 0 ? (
                  <Text variant="muted">إعادة الإرسال بعد <Text style={{ fontFamily: fonts.bold, color: colors.primary }}>{wait}</Text> ثانية</Text>
                ) : (
                  <Button title="إعادة إرسال الرمز" kind="ghost" small icon="refresh" disabled={busy} onPress={sendCode} testID="auth-resend" />
                )}
              </Row>
              <Button title="تغيير الرقم" kind="ghost" small onPress={() => { setStep('phone'); setCode(''); }} />
            </Card>
          ) : (
            <Card style={st.card}>
              <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={ltr} testID="email" />
              <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" style={ltr} testID="password" />
              <Button title="دخول" loading={busy} onPress={emailLogin} style={{ marginTop: 18 }} testID="auth-submit" />
              <Button title="نسيت كلمة المرور؟" kind="ghost" small onPress={() => router.push('/auth-reset')} />
              <Button title="الرجوع للدخول برقم الجوال" kind="ghost" small onPress={() => setStep('phone')} />
            </Card>
          )}

          {step === 'phone' ? (
            <Button title="لديك حساب قديم بالبريد؟ ادخل من هنا" kind="ghost" small style={{ marginTop: 14 }} onPress={() => setStep('email')} testID="auth-email-link" />
          ) : null}
          <Button title="الشروط والسياسات" kind="ghost" small icon="file-document-outline" onPress={() => router.push('/legal')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 28, paddingBottom: 56, paddingHorizontal: 24, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  badge: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontFamily: fonts.heavy, fontSize: 25, lineHeight: 38, marginTop: 14 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  heroPhone: { color: '#fff', fontFamily: fonts.bold, fontSize: 18, marginTop: 4, letterSpacing: 1 },
  body: { paddingHorizontal: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: { marginTop: -34, padding: 18, borderRadius: radius.lg, ...shadow },
  phoneRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 8 },
  cc: { height: 56, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ccText: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary, writingDirection: 'ltr' },
  phoneInput: { flex: 1, height: 56, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingHorizontal: 14,
    fontFamily: fonts.bold, fontSize: 20, letterSpacing: 2, color: colors.inputText, writingDirection: 'ltr', textAlign: 'left' },
  boxes: { flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 60, borderRadius: 14, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  boxFilled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxText: { fontFamily: fonts.heavy, fontSize: 24, color: colors.inputText, lineHeight: 32 },
  hiddenInput: { position: 'absolute', opacity: 0.02, width: '100%', height: '100%', color: 'transparent' },
});
