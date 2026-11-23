// صفحة الدخول والتسجيل: رقم الهاتف الكويتي + رمز OTP حقيقي برسالة SMS (للجميع).
// الحسابات القديمة المسجّلة بالإيميل: تدخل مرة واحدة بالإيميل ثم تربط رقمها برمز SMS (نفس الحساب ونفس البيانات).
// مبادئ ثابتة حتى تعمل الكتابة على الآيفون والأندرويد:
//  • TextInput قياسي مباشرة: بدون تغليف بعناصر ضغط، بدون حركات حوله، بدون writingDirection، بدون maxLength
//    (التنقية والحد في onChangeText)، وبدون مكوّنات تُعاد إنشاؤها مع كل حرف.
//  • شاشة واحدة بخطوات: الرقم ← الرمز ← الاسم (للحساب الجديد فقط). وخطوة «legacy» للحسابات القديمة.
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Icon, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, gradients, radius, shadow } from '@/lib/theme';
import { arabicError, isKuwaitMobile } from '@/lib/utils';

const RESEND_SECONDS = 60;
const CODE_LEN = 6;

const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
/** رقم كويتي محلي (8) من أي إدخال: كتابة، لصق «‎+965 9991 2313»، «00965…»، أو تعبئة تلقائية */
export function cleanPhone(v: string) {
  let d = latin(v).replace(/\D/g, '');
  if (d.length > 8 && d.startsWith('00965')) d = d.slice(5);
  else if (d.length > 8 && d.startsWith('965')) d = d.slice(3);
  return d.slice(0, 8);
}
export const cleanCode = (v: string) => latin(v).replace(/\D/g, '').slice(0, CODE_LEN);

type Step = 'phone' | 'code' | 'name' | 'legacy';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refreshProfile, signOut } = useSession();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  // linking = حساب قديم (إيميل) يربط رقمه: الرمز يُرسل عبر تغيير رقم الحساب نفسه، لا عبر حساب جديد
  const [linking, setLinking] = useState(params.mode === 'link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }

  // المدير يرى لوحة الإدارة مباشرة — الصلاحية تُقرأ من قاعدة البيانات (profiles.role) والخادم يفرضها بـ RLS
  async function finish(userId: string) {
    const prof = await api.getMyProfile(userId).catch(() => null);
    await refreshProfile().catch(() => {});
    if (prof?.role === 'admin') { router.replace('/admin'); return; }
    if (!prof?.full_name?.trim()) { setStep('name'); return; }
    toast('أهلاً فيك'); router.replace('/');
  }

  const sendCode = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم تلفون كويتي من 8 أرقام يبدأ بـ 5 أو 6 أو 9'); return; }
    if (!linking && terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    if (wait > 0) return;
    if (linking) await api.sendLinkPhoneCode(phone); else await api.sendPhoneCode(phone);
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id));
    setCode(''); setWait(RESEND_SECONDS); setStep('code');
  });

  const verify = (value: string) => run(async () => {
    if (value.length !== CODE_LEN) { toast('اكتب الرمز المكوّن من 6 أرقام'); return; }
    let user;
    try { user = linking ? await api.verifyLinkPhoneCode(phone, value) : await api.verifyPhoneCode(phone, value); } catch (e) { setCode(''); throw e; }
    if (!user) { toast('تعذّر التحقق، حاول مرة ثانية'); return; }
    setUid(user.id);
    await finish(user.id);
  });

  // حساب قديم: دخول بالإيميل مرة واحدة، ثم ربط الرقم (إلا إذا كان مربوطاً ومؤكَّداً من قبل)
  const legacyLogin = () => run(async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { toast('اكتب بريد إلكتروني صحيح'); return; }
    if (!password) { toast('اكتب كلمة المرور'); return; }
    const user = await api.signInLegacyEmail(em, password);
    setPassword('');
    if (!user) return;
    setUid(user.id);
    if (api.hasConfirmedPhone(user)) { await finish(user.id); return; }
    setLinking(true); setStep('phone'); setPhone('');
    toast('آخر خطوة: اربط رقم تلفونك بحسابك');
  });

  const saveName = () => run(async () => {
    if (name.trim().length < 2) { toast('اكتب اسمك'); return; }
    if (uid) await api.updateMyProfile(uid, { full_name: name.trim().slice(0, 80) });
    await refreshProfile().catch(() => {});
    toast('أهلاً فيك في ماتعطل'); router.replace('/');
  });

  const onCode = (v: string) => {
    const c = cleanCode(v);
    setCode(c);
    if (c.length === CODE_LEN) verify(c);
  };

  const back = () => {
    if (step === 'code') { setStep('phone'); setCode(''); return; }
    if (step === 'legacy') { setStep('phone'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  const titles: Record<Step, [string, string]> = {
    phone: linking ? ['اربط رقم تلفونك', 'من الحين الدخول يكون برقمك. بنرسل لك رمز تحقق'] : ['حياك في ماتعطل', 'سجّل أو ادخل برقم تلفونك'],
    legacy: ['حساب قديم بالإيميل', 'ادخل مرة وحدة بالإيميل، وبعدها اربط رقمك'],
    code: ['رمز التحقق', `أرسلنا رمزاً من 6 أرقام إلى ⁦+965 ${phone.slice(0, 4)} ${phone.slice(4)}⁩`],
    name: ['آخر خطوة', 'شنو اسمك؟'],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12 }]}>
            {step !== 'name' && !(linking && step === 'phone') ? (
              <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="رجوع" style={st.back} testID="auth-back">
                <Icon name="arrow-right" size={24} color={colors.white} />
              </Pressable>
            ) : null}
            <Text style={st.brand}>ماتعطل<Text style={st.dot}>•</Text></Text>
            <Text style={st.title}>{titles[step][0]}</Text>
            <Text style={st.sub}>{titles[step][1]}</Text>
          </LinearGradient>

          <View style={st.card}>
            {step === 'phone' ? (
              <>
                <Text style={st.label}>رقم التلفون</Text>
                {/* المفتاح ثابت ومنفصل؛ الحقل يأخذ الأرقام فقط */}
                <View style={st.phoneRow}>
                  <View style={st.cc}><Text style={st.ccText}>🇰🇼 +965</Text></View>
                  <TextInput
                    testID="phone"
                    value={phone}
                    onChangeText={(v) => setPhone(cleanPhone(v))}
                    keyboardType="number-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    placeholder="XXXXXXXX"
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="done"
                    onSubmitEditing={sendCode}
                    style={[st.input, st.ltr, st.grow]}
                  />
                </View>
                {!linking ? <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} /> : null}
                <MainButton title={wait > 0 ? `متابعة (${wait})` : 'متابعة'} onPress={sendCode} busy={busy} disabled={phone.length !== 8 || wait > 0} testID="send" />
                <Text style={st.note}>بنرسل لك رمز تحقق برسالة نصية. رقمك ما يظهر لأي أحد.</Text>
              </>
            ) : step === 'legacy' ? (
              <>
                <Text style={st.label}>البريد الإلكتروني</Text>
                <TextInput testID="legacy-email" value={email} onChangeText={(v) => setEmail(v.replace(/\s/g, '').slice(0, 120))} keyboardType="email-address"
                  autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="username" placeholder="name@example.com"
                  placeholderTextColor={colors.placeholder} style={[st.input, st.ltr, st.small]} />
                <Text style={[st.label, { marginTop: 14 }]}>كلمة المرور</Text>
                <TextInput testID="legacy-password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  autoComplete="current-password" textContentType="password" placeholderTextColor={colors.placeholder}
                  returnKeyType="go" onSubmitEditing={legacyLogin} style={[st.input, st.ltr, st.small]} />
                <MainButton title="دخول وربط الرقم" onPress={legacyLogin} busy={busy} testID="legacy-login" />
              </>
            ) : step === 'code' ? (
              <>
                <Text style={st.label}>رمز التحقق</Text>
                <TextInput
                  testID="code"
                  value={code}
                  onChangeText={onCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  autoFocus
                  placeholder="000000"
                  placeholderTextColor={colors.placeholder}
                  style={[st.input, st.code]}
                />
                <MainButton title="تأكيد" onPress={() => verify(code)} busy={busy} disabled={code.length !== CODE_LEN} testID="verify" />
                <View style={st.row}>
                  {wait > 0 ? (
                    <Text style={st.note}>تقدر تطلب رمز جديد بعد {wait} ثانية</Text>
                  ) : (
                    <Pressable onPress={sendCode} hitSlop={8} accessibilityRole="button" testID="resend"><Text style={st.link}>أرسل الرمز مرة ثانية</Text></Pressable>
                  )}
                </View>
                <Pressable onPress={back} hitSlop={8} accessibilityRole="button" style={st.row} testID="change-number"><Text style={st.link}>تعديل رقم التلفون</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={st.label}>الاسم</Text>
                <TextInput
                  testID="name"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  placeholder="اسمك"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  style={[st.input, st.rtl]}
                />
                <MainButton title="ابدأ" onPress={saveName} busy={busy} disabled={name.trim().length < 2} testID="save-name" />
              </>
            )}
          </View>

          {step === 'phone' && linking ? (
            <Pressable onPress={() => signOut().then(() => router.replace('/')).catch(() => {})} hitSlop={8} accessibilityRole="button" style={st.row} testID="link-signout">
              <Text style={st.link}>تسجيل الخروج والتصفح بدون حساب</Text>
            </Pressable>
          ) : null}
          {step === 'phone' && !linking ? (
            <>
              <Pressable onPress={() => setStep('legacy')} hitSlop={8} accessibilityRole="button" style={st.row} testID="legacy-link">
                <Text style={st.link}>عندك حساب قديم بالإيميل؟</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/legal')} hitSlop={8} accessibilityRole="button" style={st.row}>
                <Text style={st.link}>الشروط والسياسات</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function MainButton({ title, onPress, busy, disabled, testID }: { title: string; onPress: () => void; busy: boolean; disabled?: boolean; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={title} testID={testID}
      style={({ pressed }) => [st.btn, (busy || disabled) && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={st.btnText}>{title}</Text>}
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 22, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  back: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { color: '#fff', fontFamily: fonts.heavy, fontSize: 24, lineHeight: 38 },
  dot: { color: colors.accent },
  title: { color: '#fff', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 42, marginTop: 12 },
  sub: { color: '#fff', opacity: 0.92, fontFamily: fonts.medium, fontSize: 16, lineHeight: 26 },
  card: { marginTop: -32, marginHorizontal: 16, padding: 20, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.label, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', direction: 'ltr', gap: 8 },
  cc: { height: 58, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ccText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.link },
  // حقل قياسي: إطار + خط واضح فقط
  input: { height: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingHorizontal: 16, fontSize: 20, color: colors.inputText, fontFamily: fonts.bold },
  ltr: { textAlign: 'left' },
  // يمنع الحقل من تجاوز البطاقة على الشاشات الصغيرة (عرض ذاتي للحقل في المتصفح)
  grow: { flex: 1, minWidth: 0, width: 0 },
  rtl: { textAlign: 'right', fontSize: 18 },
  small: { fontSize: 17 },
  code: { textAlign: 'center', fontSize: 28, letterSpacing: 10 },
  btn: { marginTop: 18, height: 56, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 17, lineHeight: 26 },
  note: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 12 },
  row: { alignItems: 'center', marginTop: 14 },
  link: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.link },
});
