import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthField, AuthHero, AuthTabs, KuwaitPhoneField, OtpBoxes, sanitizeKwPhone } from '@/components/AuthUI';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Button, Card, Icon, Row, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import { arabicError, isKuwaitMobile } from '@/lib/utils';

const RESEND_SECONDS = 60;
const CODE_LEN = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Step = 'register' | 'login' | 'verify' | 'forgot' | 'forgot-code' | 'new-password';

/**
 * التسجيل والدخول في «ماتعطل»:
 * • حساب جديد: التلفون (+965) + الاسم + البريد + كلمة المرور ← رمز SMS حقيقي ← تفعيل الحساب والدخول مباشرة.
 * • عندك حساب؟ سجّل دخولك: بالتلفون (أو بالبريد للحسابات القديمة) + كلمة المرور.
 * • نسيت كلمة المرور: رمز SMS إلى التلفون ← كلمة مرور جديدة.
 * كل التحقق والحدود في Supabase Auth؛ لا رموز وهمية في التطبيق.
 */
export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [step, setStep] = useState<Step>(params.mode === 'login' ? 'login' : 'register');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const goHome = () => router.replace('/');
  const focusCode = () => setTimeout(() => codeRef.current?.focus(), 300);

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }

  // ===== حساب جديد =====
  const register = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم تلفون كويتي من 8 أرقام يبدأ بـ 5 أو 6 أو 9'); return; }
    if (name.trim().length < 2) { toast('اكتب اسمك'); return; }
    if (!EMAIL.test(email.trim())) { toast('اكتب بريداً إلكترونياً صحيحاً'); return; }
    if (password.length < 8 || !/\d/.test(password) || !/[^\d]/.test(password)) { toast('كلمة المرور 8 خانات على الأقل، فيها حروف وأرقام'); return; }
    if (terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    const data = await api.signUpWithPhone({ phone, password, name, email });
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id));
    // إن كان تأكيد التلفون معطّلاً في Supabase تعود الجلسة مباشرة
    if (data.session) { toast('أهلاً فيك في ماتعطل'); goHome(); return; }
    setCode(''); setCodeError(false); setWait(RESEND_SECONDS); setStep('verify'); focusCode();
  });

  // ===== التحقق من الرمز (تفعيل حساب / استعادة) =====
  const verify = (value: string) => run(async () => {
    if (value.length !== CODE_LEN) { toast('اكتب الرمز المكوّن من 6 أرقام'); return; }
    try {
      await api.verifyPhoneOtp(phone, value);
    } catch (e) { setCode(''); setCodeError(true); throw e; }
    if (step === 'forgot-code') { setPassword(''); setStep('new-password'); return; }
    toast('تم تفعيل حسابك، أهلاً فيك');
    goHome();
  });
  const onCode = (v: string) => {
    setCode(v); setCodeError(false);
    if (v.length === CODE_LEN) verify(v);
  };
  const resend = () => run(async () => {
    if (wait > 0) return;
    if (step === 'forgot-code') await api.sendLoginOtp(phone); else await api.resendSignupOtp(phone);
    setWait(RESEND_SECONDS); setCode(''); toast('أرسلنا رمزاً جديداً'); focusCode();
  });

  // ===== تسجيل الدخول =====
  const login = () => run(async () => {
    const raw = identifier.trim();
    const isEmail = raw.includes('@');
    // رقم ملصوق بصيغة «‎+965 9770 6792» أو «00965…» يُنقّى إلى 8 أرقام
    const id = isEmail ? raw : sanitizeKwPhone(raw);
    if (isEmail ? !EMAIL.test(id) : !isKuwaitMobile(id)) { toast('اكتب رقم التلفون (8 أرقام) أو البريد الإلكتروني'); return; }
    if (!password) { toast('اكتب كلمة المرور'); return; }
    const user = await api.signInWithPassword(id, password);
    // المدير: لوحة الإدارة تفتح تلقائياً. الصلاحية تُقرأ من قاعدة البيانات (profiles.role)، والخادم يفرضها بـ RLS
    const prof = user ? await api.getMyProfile(user.id).catch(() => null) : null;
    toast('أهلاً فيك');
    if (prof?.role === 'admin') router.replace('/admin'); else goHome();
  });

  // ===== نسيت كلمة المرور =====
  const forgot = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم التلفون المسجّل'); return; }
    await api.sendLoginOtp(phone);
    setCode(''); setCodeError(false); setWait(RESEND_SECONDS); setStep('forgot-code'); focusCode();
  });
  const saveNewPassword = () => run(async () => {
    if (password.length < 8 || !/\d/.test(password)) { toast('كلمة المرور 8 خانات على الأقل وفيها أرقام'); return; }
    await api.setNewPassword(password);
    toast('تم تغيير كلمة المرور'); goHome();
  });

  const isCode = step === 'verify' || step === 'forgot-code';
  const hero = {
    register: ['حياك في ماتعطل', 'سوّ حسابك بخطوة وحدة، وكل خدمات سيارتك صارت بيدك.'],
    login: ['هلا والله', 'سجّل دخولك وكمّل من وين ما وقفت.'],
    verify: ['تأكيد رقم التلفون', 'أرسلنا لك رمز من 6 أرقام برسالة نصية'],
    forgot: ['نسيت كلمة المرور؟', 'ولا يهمك، نرسل لك رمز على تلفونك.'],
    'forgot-code': ['رمز التحقق', 'أرسلنا لك رمز من 6 أرقام برسالة نصية'],
    'new-password': ['كلمة مرور جديدة', 'اختر كلمة مرور قوية وسهلة عليك.'],
  }[step];

  // إعداد لوحة المفاتيح المجرّب سابقاً (كانت خانة التلفون تعمل به): KeyboardAvoidingView بـ padding على iOS.
  // لا automaticallyAdjustKeyboardInsets ولا keyboardDismissMode="interactive": عند الانتقال لخانة التلفون يتغيّر
  // ارتفاع لوحة المفاتيح (لوحة أرقام)، فيعيد iOS حساب الهوامش ويمرّر الصفحة، والوضع التفاعلي يعتبر ذلك سحباً
  // فيُغلق لوحة المفاتيح فوراً — تبدو الخانة مستجيبة لكن لا تقبل الكتابة.
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 28 }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="none"
        testID="auth-scroll"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero title={hero[0]} subtitle={hero[1]} topInset={insets.top + 12}
          onBack={() => (step === 'verify' ? setStep('register') : step === 'forgot-code' || step === 'new-password' ? setStep('forgot') : step === 'forgot' ? setStep('login') : router.canGoBack() ? router.back() : router.replace('/'))}>
          {isCode ? <Text style={st.heroPhone}>{'⁦'}+965 {phone.slice(0, 4)} {phone.slice(4)}{'⁩'}</Text> : null}
        </AuthHero>

        <View style={st.body}>
          <Card style={st.card}>
            {step === 'register' || step === 'login' ? (
              <AuthTabs value={step} onChange={(v) => { setStep(v); setPassword(''); }} options={[['register', 'حساب جديد', 'account-plus-outline'], ['login', 'تسجيل دخول', 'login']]} />
            ) : null}

            <View>
              {step === 'register' ? (
                <>
                  <AuthField icon="account-outline" label="الاسم" placeholder="اسمك الكامل" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={80} testID="reg-name" />
                  <KuwaitPhoneField value={phone} onChangeText={setPhone} testID="reg-phone" />
                  <AuthField icon="email-outline" label="البريد الإلكتروني" placeholder="name@example.com" value={email} onChangeText={setEmail} ltr keyboardType="email-address" autoCapitalize="none"
                    autoCorrect={false} autoComplete="email" textContentType="emailAddress" testID="reg-email" />
                  <AuthField icon="lock-outline" label="كلمة المرور" placeholder="8 خانات أو أكثر" value={password} onChangeText={setPassword} ltr secureToggle autoCapitalize="none"
                    autoComplete="password" textContentType="password" testID="reg-password" />
                  <PasswordHint value={password} />
                  <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
                  <Button title="سوّ حسابي" icon="arrow-left" loading={busy} onPress={register} style={{ marginTop: 18 }} testID="reg-submit" />
                  <Row style={st.trust} gap={6}><Icon name="shield-lock-outline" size={16} color={colors.success} /><Text variant="small">بنرسل لك رمز تحقق على تلفونك لتفعيل الحساب</Text></Row>
                </>
              ) : step === 'login' ? (
                <>
                  {/* الحسابات القديمة بالبريد تقدر تكتب بريدها هنا أيضاً (بدون رابط منفصل) */}
                  <AuthField icon="phone-outline" label="رقم التلفون" placeholder="XXXX XXXX" value={identifier} onChangeText={setIdentifier} ltr autoCapitalize="none" autoCorrect={false}
                    keyboardType={identifier.includes('@') ? 'email-address' : Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} autoComplete="username" textContentType="username" testID="login-id" />
                  <AuthField icon="lock-outline" label="كلمة المرور" placeholder="كلمة المرور" value={password} onChangeText={setPassword} ltr secureToggle autoCapitalize="none"
                    autoComplete="current-password" textContentType="password" testID="login-password" onSubmitEditing={login} />
                  <Button title="نسيت كلمة المرور؟" kind="ghost" small onPress={() => { setStep('forgot'); setPhone(/^\d{8}$/.test(identifier.trim()) ? identifier.trim() : ''); }}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }} testID="login-forgot" />
                  <Button title="سجّل دخولي" icon="login" loading={busy} onPress={login} style={{ marginTop: 6 }} testID="login-submit" />
                </>
              ) : isCode ? (
                <>
                  <View style={st.stepIcon}><Icon name="message-text-lock-outline" size={30} color={colors.primary} /></View>
                  <OtpBoxes ref={codeRef} value={code} onChange={onCode} error={codeError} testID="otp" />
                  {codeError ? <Text variant="small" style={{ color: colors.danger, textAlign: 'center', marginTop: 8 }}>الرمز غير صحيح، جرّب مرة ثانية</Text> : null}
                  <Button title="تأكيد" icon="check" loading={busy} disabled={code.length !== CODE_LEN} onPress={() => verify(code)} style={{ marginTop: 18 }} testID="otp-submit" />
                  <Row style={{ justifyContent: 'center', marginTop: 12 }}>
                    {wait > 0 ? (
                      <Text variant="muted">تقدر تطلب رمز جديد بعد <Text style={{ fontFamily: fonts.bold, color: colors.link }}>{wait}</Text> ثانية</Text>
                    ) : <Button title="أرسل الرمز مرة ثانية" kind="ghost" small icon="refresh" onPress={resend} testID="otp-resend" />}
                  </Row>
                  <Button title="تعديل رقم التلفون" kind="ghost" small onPress={() => { setStep(step === 'verify' ? 'register' : 'forgot'); setCode(''); }} />
                </>
              ) : step === 'forgot' ? (
                <>
                  <KuwaitPhoneField value={phone} onChangeText={setPhone} testID="forgot-phone" autoFocus onSubmitEditing={forgot} />
                  <Button title="أرسل الرمز" icon="message-arrow-left-outline" loading={busy} onPress={forgot} style={{ marginTop: 18 }} testID="forgot-submit" />
                  <Button title="رجوع لتسجيل الدخول" kind="ghost" small onPress={() => setStep('login')} />
                </>
              ) : (
                <>
                  <AuthField icon="lock-reset" label="كلمة المرور الجديدة" placeholder="8 خانات أو أكثر" value={password} onChangeText={setPassword} ltr secureToggle autoCapitalize="none"
                    autoComplete="password" textContentType="password" testID="new-password" />
                  <PasswordHint value={password} />
                  <Button title="احفظ وكمّل" icon="check" loading={busy} onPress={saveNewPassword} style={{ marginTop: 18 }} testID="new-password-save" />
                </>
              )}
            </View>
          </Card>

          {step === 'register' ? (
            <Row style={st.footer} gap={4}>
              <Text variant="muted">عندك حساب؟</Text>
              <Button title="سجّل دخولك" kind="ghost" small onPress={() => setStep('login')} testID="to-login" />
            </Row>
          ) : step === 'login' ? (
            <Row style={st.footer} gap={4}>
              <Text variant="muted">ما عندك حساب؟</Text>
              <Button title="سوّ حساب جديد" kind="ghost" small onPress={() => setStep('register')} testID="to-register" />
            </Row>
          ) : null}
          <Button title="الشروط والسياسات" kind="ghost" small icon="file-document-outline" onPress={() => router.push('/legal')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** مؤشر قوة كلمة المرور */
function PasswordHint({ value }: { value: string }) {
  const checks = [value.length >= 8, /\d/.test(value), /[^\d]/.test(value)];
  const score = checks.filter(Boolean).length;
  const color = score === 3 ? colors.success : score === 2 ? colors.accent : colors.danger;
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: value && i < score ? color : colors.line }} />)}
      </View>
      <Text variant="small" style={{ marginTop: 6 }}>8 خانات على الأقل، فيها حروف وأرقام</Text>
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: { marginTop: -34, padding: 18, borderRadius: radius.xl, ...shadow },
  heroPhone: { color: '#fff', fontFamily: fonts.bold, fontSize: 18, marginTop: 6, letterSpacing: 1, writingDirection: 'ltr', textAlign: 'right' },
  stepIcon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  trust: { justifyContent: 'center', marginTop: 14 },
  footer: { justifyContent: 'center', marginTop: 16 },
});
